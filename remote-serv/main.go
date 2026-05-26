package main

import (
	"log"
	"os"
)

//TIP <p>To run your code, right-click the code and select <b>Run</b>.</p> <p>Alternatively, click
// the <icon src="AllIcons.Actions.Execute"/> icon in the gutter and select the <b>Run</b> menu item from here.</p>

func main() {
	engineManagerURL := "http://engine-manager:3004"
	if envURL := os.Getenv("ENGINE_MANAGER_URL"); envURL != "" {
		engineManagerURL = envURL
	}

	configManager := NewEngineManagerClient(engineManagerURL)
	sessionManager := NewSessionManager(configManager)

	ws := &httpWebSocket{
		sessions: sessionManager,
	}

	log.Println("Starting remote-serv on :8080")
	log.Printf("Connecting to engine-manager at %s", engineManagerURL)

	ws.Handle()
}