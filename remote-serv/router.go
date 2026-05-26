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
	UpdatePreview(token string, sender uuid.UUID, preview PreviewState) error
	ListSessions() []SessionSummary
	DisconnectSession(session uuid.UUID, token string)
}

type httpWebSocket struct {
	sessions sessions
	port     string
}

type clientEnvelope struct {
	Type  string       `json:"type"`
	State PreviewState `json:"state"`
}

type sessionCreatedMessage struct {
	Type     string `json:"type"`
	Token    string `json:"token"`
	OwnerKey string `json:"ownerKey,omitempty"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func (ws *httpWebSocket) MemberSession(ctxx context.Context, conn *websocket.Conn, token string, participantName string, ownerKey string) {
	ctx, cancel := context.WithCancel(ctxx)
	defer cancel()

	outgoing := make(chan []byte, 32)

	participantID, config, err := ws.sessions.ConnectSession(token, participantName, ownerKey, outgoing)
	if err != nil {
		conn.Close()
		return
	}
	defer ws.sessions.DisconnectSession(participantID, token)

	if err := conn.WriteMessage(websocket.TextMessage, config); err != nil {
		conn.Close()
		return
	}

	defer conn.Close()

	go func() {
		defer cancel()

		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				ws.sessions.DisconnectSession(participantID, token)
				slog.Info("Disconnected session", "participant_id", participantID, "token", token)
				return
			}

			if err := ws.handleClientMessage(token, participantID, msg); err != nil {
				slog.Error("Failed to process client message", "error", err, "token", token)
			}
		}
	}()

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

	<-ctx.Done()
}

func (ws *httpWebSocket) handleClientMessage(token string, participantID uuid.UUID, msg []byte) error {
	trimmed := bytes.TrimSpace(msg)
	if len(trimmed) == 0 {
		return nil
	}

	if trimmed[0] == '[' {
		return ws.sessions.ApplyPatch(msg, token, participantID)
	}

	var envelope clientEnvelope
	if err := json.Unmarshal(msg, &envelope); err != nil {
		return err
	}

	switch envelope.Type {
	case "preview_state":
		return ws.sessions.UpdatePreview(token, participantID, envelope.State)
	default:
		return fmt.Errorf("unknown client message type: %s", envelope.Type)
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

func (ws *httpWebSocket) HandleListSessions(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"items": ws.sessions.ListSessions(),
	})
}

func (ws *httpWebSocket) Handle() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/create", ws.HandlerCreate)
	mux.HandleFunc("/session/", ws.HandlerJoin)
	mux.HandleFunc("/api/sessions", ws.HandleListSessions)

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
