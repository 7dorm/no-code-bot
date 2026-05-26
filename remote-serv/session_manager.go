package main

import (
	"encoding/json"
	"errors"
	"log/slog"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

var (
	ErrSessionNotFound     = errors.New("session not found")
	ErrParticipantNotFound = errors.New("participant not found")
	ErrPreviewForbidden    = errors.New("only the session owner can control preview")
)

type Config []byte

type ConfigManager interface {
	NewConfig(config Config) (string, error)
	ApplyPatches(patch []byte, token string) error
	GetConfig(configID string) (Config, error)
	DeleteConfig(configID uuid.UUID) error
}

type PreviewMessage struct {
	Role    string   `json:"role"`
	Content string   `json:"content"`
	Answers []string `json:"answers,omitempty"`
}

type PreviewState struct {
	Active                    bool             `json:"active"`
	OwnerOnly                 bool             `json:"ownerOnly"`
	IsRunning                 bool             `json:"isRunning"`
	WaitingForInput           bool             `json:"waitingForInput"`
	WaitingForFile            bool             `json:"waitingForFile"`
	RequestedFileName         string           `json:"requestedFileName,omitempty"`
	ActiveAnswersMessageIndex *int             `json:"activeAnswersMessageIndex"`
	Messages                  []PreviewMessage `json:"messages"`
	ControllerParticipantID   string           `json:"controllerParticipantId,omitempty"`
	ControllerName            string           `json:"controllerName,omitempty"`
	UpdatedAt                 time.Time        `json:"updatedAt"`
}

type Participant struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	IsOwner  bool      `json:"isOwner"`
	JoinedAt time.Time `json:"joinedAt"`
}

type SessionStateMessage struct {
	Type                      string        `json:"type"`
	Token                     string        `json:"token"`
	ProjectName               string        `json:"projectName"`
	CurrentParticipantID      string        `json:"currentParticipantId"`
	OwnerParticipantID        string        `json:"ownerParticipantId,omitempty"`
	OwnerName                 string        `json:"ownerName,omitempty"`
	IsCurrentParticipantOwner bool          `json:"isCurrentParticipantOwner"`
	Participants              []Participant `json:"participants"`
	ParticipantsCount         int           `json:"participantsCount"`
	Preview                   PreviewState  `json:"preview"`
	UpdatedAt                 time.Time     `json:"updatedAt"`
}

type SessionSummary struct {
	Token             string    `json:"token"`
	ProjectName       string    `json:"projectName"`
	OwnerName         string    `json:"ownerName,omitempty"`
	ParticipantsCount int       `json:"participantsCount"`
	PreviewActive     bool      `json:"previewActive"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

type ParticipantConnection struct {
	ID       uuid.UUID
	Name     string
	IsOwner  bool
	JoinedAt time.Time
	Outgoing chan<- []byte
}

type SessionData struct {
	ConfigID           string
	ProjectName        string
	OwnerKey           string
	OwnerName          string
	OwnerParticipantID uuid.UUID
	Participants       map[uuid.UUID]*ParticipantConnection
	Preview            PreviewState
	UpdatedAt          time.Time
}

type SessionManager struct {
	config   ConfigManager
	sessions map[string]*SessionData
	mu       sync.RWMutex
}

func NewSessionManager(config ConfigManager) *SessionManager {
	return &SessionManager{
		config:   config,
		sessions: make(map[string]*SessionData),
		mu:       sync.RWMutex{},
	}
}

func (sm *SessionManager) NewSession(config Config) (string, string, error) {
	configID, err := sm.config.NewConfig(config)
	if err != nil {
		return "", "", err
	}

	projectName := ""
	if snapshot, getErr := sm.config.GetConfig(configID); getErr == nil {
		projectName = extractProjectName(snapshot)
	}

	ownerKey := uuid.NewString()
	now := time.Now()

	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.sessions[configID] = &SessionData{
		ConfigID:     configID,
		ProjectName:  projectName,
		OwnerKey:     ownerKey,
		Participants: make(map[uuid.UUID]*ParticipantConnection),
		Preview: PreviewState{
			OwnerOnly: true,
			Messages:  []PreviewMessage{},
			UpdatedAt: now,
		},
		UpdatedAt: now,
	}

	return configID, ownerKey, nil
}

func (sm *SessionManager) ConnectSession(token string, participantName string, ownerKey string, outgoing chan<- []byte) (uuid.UUID, Config, error) {
	conf, err := sm.config.GetConfig(token)
	if err != nil {
		return uuid.Nil, nil, err
	}

	sm.mu.Lock()
	defer sm.mu.Unlock()

	session, ok := sm.sessions[token]
	if !ok {
		return uuid.Nil, nil, ErrSessionNotFound
	}

	if name := extractProjectName(conf); name != "" {
		session.ProjectName = name
	}

	participantID := uuid.New()
	joinedAt := time.Now()
	name := normalizeParticipantName(participantName, len(session.Participants)+1)
	isOwner := ownerKey != "" && ownerKey == session.OwnerKey

	participant := &ParticipantConnection{
		ID:       participantID,
		Name:     name,
		IsOwner:  isOwner,
		JoinedAt: joinedAt,
		Outgoing: outgoing,
	}
	session.Participants[participantID] = participant
	session.UpdatedAt = joinedAt

	if isOwner {
		session.OwnerParticipantID = participantID
		session.OwnerName = name
		if session.Preview.Active {
			session.Preview.ControllerParticipantID = participantID.String()
			session.Preview.ControllerName = name
			session.Preview.UpdatedAt = joinedAt
		}
	}

	sm.broadcastSessionStateLocked(token, session)

	slog.Info("Connected session", "participant_id", participantID, "config_id", session.ConfigID, "participant_name", name, "is_owner", isOwner)

	return participantID, conf, nil
}

func (sm *SessionManager) ApplyPatch(patch []byte, token string, sender uuid.UUID) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	session, ok := sm.sessions[token]
	if !ok {
		return ErrSessionNotFound
	}

	if err := sm.config.ApplyPatches(patch, token); err != nil {
		slog.Error("ApplyPatch", "error", err)
		return err
	}

	if snapshot, err := sm.config.GetConfig(token); err == nil {
		if name := extractProjectName(snapshot); name != "" {
			session.ProjectName = name
		}
	}

	session.UpdatedAt = time.Now()

	for participantID, participant := range session.Participants {
		if participantID == sender {
			continue
		}
		sendNonBlocking(participant.Outgoing, patch)
	}

	sm.broadcastSessionStateLocked(token, session)

	return nil
}

func (sm *SessionManager) UpdatePreview(token string, sender uuid.UUID, preview PreviewState) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	session, ok := sm.sessions[token]
	if !ok {
		return ErrSessionNotFound
	}

	participant, ok := session.Participants[sender]
	if !ok {
		return ErrParticipantNotFound
	}

	if !participant.IsOwner {
		return ErrPreviewForbidden
	}

	preview.OwnerOnly = true
	preview.ControllerParticipantID = sender.String()
	preview.ControllerName = participant.Name
	preview.UpdatedAt = time.Now()
	if preview.Messages == nil {
		preview.Messages = []PreviewMessage{}
	}

	session.Preview = preview
	session.UpdatedAt = preview.UpdatedAt

	sm.broadcastSessionStateLocked(token, session)

	return nil
}

func (sm *SessionManager) ListSessions() []SessionSummary {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	items := make([]SessionSummary, 0, len(sm.sessions))
	for token, session := range sm.sessions {
		items = append(items, SessionSummary{
			Token:             token,
			ProjectName:       session.ProjectName,
			OwnerName:         session.OwnerName,
			ParticipantsCount: len(session.Participants),
			PreviewActive:     session.Preview.Active,
			UpdatedAt:         session.UpdatedAt,
		})
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].UpdatedAt.After(items[j].UpdatedAt)
	})

	return items
}

func (sm *SessionManager) DisconnectSession(participantID uuid.UUID, token string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	session, ok := sm.sessions[token]
	if !ok {
		return
	}

	participant, exists := session.Participants[participantID]
	if !exists {
		return
	}

	delete(session.Participants, participantID)
	session.UpdatedAt = time.Now()

	if session.OwnerParticipantID == participantID {
		session.OwnerParticipantID = uuid.Nil
		if session.Preview.Active {
			session.Preview.ControllerParticipantID = ""
			session.Preview.ControllerName = participant.Name
			session.Preview.UpdatedAt = session.UpdatedAt
		}
	}

	sm.broadcastSessionStateLocked(token, session)

	slog.Info("Disconnected session", "participant_id", participantID, "config_id", session.ConfigID, "participant_name", participant.Name)
}

func (sm *SessionManager) broadcastSessionStateLocked(token string, session *SessionData) {
	for participantID, participant := range session.Participants {
		payload, err := sm.sessionStatePayloadLocked(token, session, participantID)
		if err != nil {
			slog.Error("failed to marshal session state", "token", token, "error", err)
			continue
		}
		sendNonBlocking(participant.Outgoing, payload)
	}
}

func (sm *SessionManager) sessionStatePayloadLocked(token string, session *SessionData, currentParticipantID uuid.UUID) ([]byte, error) {
	participants := make([]Participant, 0, len(session.Participants))
	for _, participant := range session.Participants {
		participants = append(participants, Participant{
			ID:       participant.ID.String(),
			Name:     participant.Name,
			IsOwner:  participant.IsOwner,
			JoinedAt: participant.JoinedAt,
		})
	}

	sort.Slice(participants, func(i, j int) bool {
		if participants[i].IsOwner != participants[j].IsOwner {
			return participants[i].IsOwner
		}
		return participants[i].JoinedAt.Before(participants[j].JoinedAt)
	})

	message := SessionStateMessage{
		Type:                      "session_state",
		Token:                     token,
		ProjectName:               session.ProjectName,
		CurrentParticipantID:      currentParticipantID.String(),
		OwnerName:                 session.OwnerName,
		IsCurrentParticipantOwner: session.OwnerParticipantID == currentParticipantID,
		Participants:              participants,
		ParticipantsCount:         len(participants),
		Preview:                   session.Preview,
		UpdatedAt:                 session.UpdatedAt,
	}

	if session.OwnerParticipantID != uuid.Nil {
		message.OwnerParticipantID = session.OwnerParticipantID.String()
	}

	return json.Marshal(message)
}

func extractProjectName(config Config) string {
	var snapshot struct {
		Name   string `json:"name"`
		Config struct {
			Name string `json:"name"`
		} `json:"config"`
	}

	if err := json.Unmarshal(config, &snapshot); err != nil {
		return ""
	}

	if name := strings.TrimSpace(snapshot.Config.Name); name != "" {
		return name
	}

	return strings.TrimSpace(snapshot.Name)
}

func normalizeParticipantName(name string, index int) string {
	trimmed := strings.TrimSpace(name)
	if trimmed != "" {
		return trimmed
	}
	return "Участник " + strconv.Itoa(index)
}

func sendNonBlocking(outgoing chan<- []byte, payload []byte) {
	if outgoing == nil {
		return
	}

	message := append([]byte(nil), payload...)
	select {
	case outgoing <- message:
	default:
		slog.Warn("dropping outgoing session message because the channel is full")
	}
}

var _ sessions = &SessionManager{}
