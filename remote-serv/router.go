package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type sessions interface {
	NewSession(config Config) (string, string, error)
	ConnectSession(token string, participantName string, ownerKey string, outgoing chan<- []byte) (uuid.UUID, Config, error)
	ApplyPatch(patch []byte, token string, sender uuid.UUID) error
	CreatePreview(token string, sender uuid.UUID, ownerOnly bool) (string, error)
	UpdatePreview(token string, previewID string, sender uuid.UUID, preview PreviewState) error
	RelayPreviewInput(token string, previewID string, sender uuid.UUID, inputType string, value string) error
	ClosePreview(token string, previewID string, sender uuid.UUID) error
	DisconnectSession(session uuid.UUID, token string)
}

type httpWebSocket struct {
	sessions sessions
	port     string
}

type clientEnvelope struct {
	Type      string       `json:"type"`
	PreviewID string       `json:"previewId,omitempty"`
	OwnerOnly *bool        `json:"ownerOnly,omitempty"`
	InputType string       `json:"inputType,omitempty"`
	Value     string       `json:"value,omitempty"`
	State     PreviewState `json:"state"`
}

type sessionCreatedMessage struct {
	Type     string `json:"type"`
	Token    string `json:"token"`
	OwnerKey string `json:"ownerKey,omitempty"`
}

type previewCreatedMessage struct {
	Type      string `json:"type"`
	PreviewID string `json:"previewId"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func (ws *httpWebSocket) MemberSession(ctxx context.Context, conn *websocket.Conn, token string, participantName string, ownerKey string) {
	ctx, cancel := context.WithCancel(ctxx)
	defer cancel()

	outgoing := make(chan []byte, 256)

	participantID, config, err := ws.sessions.ConnectSession(token, participantName, ownerKey, outgoing)
	if err != nil {
		conn.Close()
		return
	}
	defer ws.sessions.DisconnectSession(participantID, token)
	defer conn.Close()

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case msg := <-outgoing:
				if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
					cancel()
					return
				}
			}
		}
	}()

	if !queueOutgoing(ctx, outgoing, config) {
		return
	}

	go func() {
		defer cancel()

		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				ws.sessions.DisconnectSession(participantID, token)
				slog.Info("Disconnected session", "participant_id", participantID, "token", token)
				return
			}

			if response, err := ws.handleClientMessage(token, participantID, msg); err != nil {
				slog.Error("Failed to process client message", "error", err, "token", token)
			} else if len(response) > 0 {
				queueOutgoing(ctx, outgoing, response)
			}
		}
	}()

	<-ctx.Done()
}

func queueOutgoing(ctx context.Context, outgoing chan<- []byte, payload []byte) bool {
	message := append([]byte(nil), payload...)
	select {
	case <-ctx.Done():
		return false
	case outgoing <- message:
		return true
	}
}

func (ws *httpWebSocket) handleClientMessage(token string, participantID uuid.UUID, msg []byte) ([]byte, error) {
	trimmed := bytes.TrimSpace(msg)
	if len(trimmed) == 0 {
		return nil, nil
	}

	if trimmed[0] == '[' {
		return nil, ws.sessions.ApplyPatch(msg, token, participantID)
	}

	var envelope clientEnvelope
	if err := json.Unmarshal(msg, &envelope); err != nil {
		return nil, err
	}

	switch envelope.Type {
	case "preview_create":
		ownerOnly := envelope.OwnerOnly != nil && *envelope.OwnerOnly
		previewID, err := ws.sessions.CreatePreview(token, participantID, ownerOnly)
		if err != nil {
			return nil, err
		}
		return json.Marshal(previewCreatedMessage{
			Type:      "preview_created",
			PreviewID: previewID,
		})
	case "preview_state":
		if envelope.PreviewID == "" {
			return nil, fmt.Errorf("previewId is required")
		}
		return nil, ws.sessions.UpdatePreview(token, envelope.PreviewID, participantID, envelope.State)
	case "preview_input":
		if envelope.PreviewID == "" {
			return nil, fmt.Errorf("previewId is required")
		}
		return nil, ws.sessions.RelayPreviewInput(token, envelope.PreviewID, participantID, envelope.InputType, envelope.Value)
	case "preview_close":
		if envelope.PreviewID == "" {
			return nil, fmt.Errorf("previewId is required")
		}
		return nil, ws.sessions.ClosePreview(token, envelope.PreviewID, participantID)
	default:
		return nil, fmt.Errorf("unknown client message type: %s", envelope.Type)
	}
}

func (ws *httpWebSocket) HandlerCreate(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		conn.Close()
		return
	}
	conn.SetReadDeadline(time.Time{})

	token, ownerKey, err := ws.sessions.NewSession(msg)
	if err != nil {
		conn.Close()
		return
	}

	createdPayload, err := json.Marshal(sessionCreatedMessage{
		Type:     "session_created",
		Token:    token,
		OwnerKey: ownerKey,
	})
	if err != nil {
		conn.Close()
		return
	}

	if err := conn.WriteMessage(websocket.TextMessage, createdPayload); err != nil {
		conn.Close()
		return
	}

	ws.MemberSession(ctx, conn, token, readParticipantName(r), ownerKey)
}

func (ws *httpWebSocket) HandlerJoin(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	token := strings.TrimPrefix(r.URL.Path, "/session/")
	ws.MemberSession(ctx, conn, token, readParticipantName(r), r.URL.Query().Get("ownerKey"))
}

func (ws *httpWebSocket) Handle() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/create", ws.HandlerCreate)
	mux.HandleFunc("/session/", ws.HandlerJoin)

	server := &http.Server{
		Addr:    ":" + ws.port,
		Handler: withCORS(mux),
	}

	return server.ListenAndServe()
}

func readParticipantName(r *http.Request) string {
	return r.URL.Query().Get("name")
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		slog.Error("failed to write json response", "error", err)
	}
}
