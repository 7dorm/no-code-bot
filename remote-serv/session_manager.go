package main

import (
	"errors"
	"sync"
	"time"
	"log/slog"

	"github.com/google/uuid"
)

type Ppatch struct {
	data  []byte
	token string
}

var (
	ErrSessionNotFound = errors.New("session not found")
)

type Config []byte

type ConfigManager interface {
	NewConfig(config Config) (string, error)
	ApplyPatches(patch []byte, token string) error
	GetConfig(configId string) (Config, error)
	DeleteConfig(configId uuid.UUID) error
}

type SessionData struct {
	configId          string
	outcoming         map[uuid.UUID]chan<- []byte
	lastMemberDate    time.Time
	lastMemberTimeOut time.Time
}

type SessionManager struct {
	config   ConfigManager
	sessions map[string]*SessionData
	incoming chan Ppatch
	mu       sync.RWMutex
}

func NewSessionManager(config ConfigManager) *SessionManager {
	return &SessionManager{
		config:   config,
		sessions: make(map[string]*SessionData),
		mu:       sync.RWMutex{},
		incoming: make(chan Ppatch),
	}
}

func (sm *SessionManager) NewSession(config Config) (string, error) {
	configId, err := sm.config.NewConfig(config)
	if err != nil {
		return "", err
	}

	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.sessions[configId] = &SessionData{
		configId:  configId,
		outcoming: make(map[uuid.UUID]chan<- []byte),
	}

	return configId, nil
}

func (sm *SessionManager) ConnectSession(token string, outcoming chan<- []byte) (uuid.UUID, Config, error) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	conf, err := sm.config.GetConfig(token)
	if err != nil {
		return uuid.Nil, make(Config, 0), err
	}

	s, ok := sm.sessions[token]
	if !ok {
		return uuid.Nil, make(Config, 0), ErrSessionNotFound
	}
	id := uuid.New()
	s.outcoming[id] = outcoming

	slog.Info("Connected session", "session_id", id, "config_id", s.configId, "config", string(conf))

	return id, conf, nil
}

func (sm *SessionManager) ApplyPatch(patch []byte, token string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	err := sm.config.ApplyPatches(patch, token)
	if err != nil {
		slog.Error("ApplyPatch", "error", err)
		return err
	}

	ss := sm.sessions[token]

	go func() {
		for _, a := range ss.outcoming {
			a <- patch
		}
	}()

	return nil
}

func (sm *SessionManager) DisconnectSession(session uuid.UUID, token string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	s, ok := sm.sessions[token]
	if !ok {
		return
	}
	delete(s.outcoming, session)
	
	slog.Info("Disconnected session", "session_id", session, "config_id", s.configId)
}

var _ sessions = &SessionManager{}
