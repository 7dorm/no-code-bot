package main

import (
	"log"
	"os"
)

func main() {
	engineManagerURL := "http://localhost:4004"
	if envURL := os.Getenv("ENGINE_MANAGER_URL"); envURL != "" {
		engineManagerURL = envURL
	}
	port := "8080"
	if envPort := os.Getenv("REMOTE_SERV_PORT"); envPort != "" {
		port = envPort
	}

	sessionTTL := parseSessionTTL()
	cleanupInterval := parseCleanupInterval()

	configManager := NewEngineManagerClient(engineManagerURL)
	sessionManager := NewSessionManager(configManager, sessionTTL, cleanupInterval)

	ws := &httpWebSocket{
		sessions: sessionManager,
		port:     port,
	}

	log.Printf("Starting remote-serv on :%s", port)
	log.Printf("Connecting to engine-manager at %s", engineManagerURL)
	log.Printf("Session TTL: %s, cleanup interval: %s", sessionTTL, cleanupInterval)

	if err := ws.Handle(); err != nil {
		log.Fatal(err)
	}
}
