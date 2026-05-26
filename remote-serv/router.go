package main

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/gorilla/websocket"

	"net/http"

	"github.com/google/uuid"
)

type Patch interface {
	ToBytes() []byte
}

type sessions interface {
	NewSession(config Config) (string, error)
	ConnectSession(token string, outgoing chan<- []byte) (uuid.UUID, Config, error)
	ApplyPatch(patch []byte, token string) error
	DisconnectSession(session uuid.UUID, token string)
}

type httpWebSocket struct {
	sessions sessions
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func (ws *httpWebSocket) MemberSession(ctxx context.Context, conn *websocket.Conn, token string) {
	ctx, cancel := context.WithCancel(ctxx)
	defer cancel()

	outgoing := make(chan []byte)

	userId, config, err := ws.sessions.ConnectSession(token, outgoing)
	if err != nil {
		conn.Close()
		return
	}
	defer ws.sessions.DisconnectSession(userId, token)

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
				ws.sessions.DisconnectSession(userId, token)
				slog.Info("Disconnected session", "session_id", userId, "token", token)
				return
			}

			fmt.Println("Received patch:", string(msg))
			err = ws.sessions.ApplyPatch(msg, token)
			if err != nil {
				slog.Error("Failed to apply patch", "error", err)
			}
		}
	}()

	go func() {
		for {
			select {
			case <-ctx.Done():
				return

			case msg := <-outgoing:
				err := conn.WriteMessage(websocket.TextMessage, msg)
				if err != nil {
					cancel()
					return
				}
			}
		}
	}()

	<-ctx.Done()
}

func (ws *httpWebSocket) HandlerJoin(w http.ResponseWriter, r *http.Request) {
	fmt.Println("HandlerJoin called")
	ctx := context.Background()

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		conn.Close()
		return
	}

	conn.SetReadDeadline(time.Now().Add(10 * time.Second))

	_, msg, err := conn.ReadMessage()
	if err != nil {
		fmt.Println("Failed to read initial config:", err)
		conn.Close()
		return
	}
	conn.SetReadDeadline(time.Time{})

	token, err := ws.sessions.NewSession(msg)
	if err != nil {
		fmt.Println("Failed to create session:", err)
		conn.Close()
		return
	}

	err = conn.WriteMessage(websocket.TextMessage, []byte(token))
	if err != nil {
		fmt.Println("Failed to send token:", err)
		conn.Close()
		return
	}
	ws.MemberSession(ctx, conn, token)
}

func (ws *httpWebSocket) HandlerCreat(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	path := r.URL.Path

	token := strings.TrimPrefix(path, "/session/")

	ws.MemberSession(ctx, conn, token)

}

func (ws *httpWebSocket) Handle() {
	fmt.Println("Handle called")
	http.HandleFunc("/create", ws.HandlerJoin)
	http.HandleFunc("/session/", ws.HandlerCreat)
	http.ListenAndServe(":8080", nil)
}
