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
	ErrPreviewNotFound     = errors.New("preview not found")
	ErrPreviewForbidden    = errors.New("preview control forbidden")
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

type PreviewInstance struct {
	ID                   string
	OwnerOnly            bool
	CreatorParticipantID uuid.UUID
	CreatorName          string
	State                PreviewState
}

type PreviewSummary struct {
	ID                        string           `json:"id"`
	OwnerOnly                 bool             `json:"ownerOnly"`
	CreatorParticipantID      string           `json:"creatorParticipantId"`
	CreatorName               string           `json:"creatorName"`
	ControllerParticipantID   string           `json:"controllerParticipantId,omitempty"`
	ControllerName            string           `json:"controllerName,omitempty"`
	Active                    bool             `json:"active"`
	IsRunning                 bool             `json:"isRunning"`
	WaitingForInput           bool             `json:"waitingForInput"`
	WaitingForFile            bool             `json:"waitingForFile"`
	RequestedFileName         string           `json:"requestedFileName,omitempty"`
	ActiveAnswersMessageIndex *int             `json:"activeAnswersMessageIndex"`
	Messages                  []PreviewMessage `json:"messages"`
	UpdatedAt                 time.Time        `json:"updatedAt"`
}

type Participant struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	IsOwner  bool      `json:"isOwner"`
	JoinedAt time.Time `json:"joinedAt"`
}

type SessionStateMessage struct {
	Type                 string           `json:"type"`
	Token                string           `json:"token"`
	ProjectName          string           `json:"projectName"`
	CurrentParticipantID string           `json:"currentParticipantId"`
	OwnerParticipantID   string           `json:"ownerParticipantId,omitempty"`
	OwnerName            string           `json:"ownerName,omitempty"`
	IsCurrentParticipantOwner bool        `json:"isCurrentParticipantOwner"`
	Participants         []Participant    `json:"participants"`
	ParticipantsCount    int              `json:"participantsCount"`
	Previews             []PreviewSummary `json:"previews"`
	UpdatedAt            time.Time        `json:"updatedAt"`
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
	Previews           map[string]*PreviewInstance
	UpdatedAt          time.Time
	EmptySince         *time.Time
}

type SessionManager struct {
	config          ConfigManager
	sessions        map[string]*SessionData
	mu              sync.RWMutex
	sessionTTL      time.Duration
	cleanupInterval time.Duration
}

func NewSessionManager(config ConfigManager, sessionTTL, cleanupInterval time.Duration) *SessionManager {
	sm := &SessionManager{
		config:          config,
		sessions:        make(map[string]*SessionData),
		sessionTTL:      sessionTTL,
		cleanupInterval: cleanupInterval,
	}

	go sm.startCleanupLoop()

	return sm
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
		Previews:     make(map[string]*PreviewInstance),
		UpdatedAt:    now,
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
	session.EmptySince = nil

	if isOwner {
		session.OwnerParticipantID = participantID
		session.OwnerName = name
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

func (sm *SessionManager) CreatePreview(token string, sender uuid.UUID, ownerOnly bool) (string, error) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	session, ok := sm.sessions[token]
	if !ok {
		return "", ErrSessionNotFound
	}

	participant, ok := session.Participants[sender]
	if !ok {
		return "", ErrParticipantNotFound
	}

	now := time.Now()
	previewID := uuid.NewString()
	session.Previews[previewID] = &PreviewInstance{
		ID:                   previewID,
		OwnerOnly:            ownerOnly,
		CreatorParticipantID: sender,
		CreatorName:          participant.Name,
		State: PreviewState{
			Active:    true,
			OwnerOnly: ownerOnly,
			Messages:  []PreviewMessage{},
			UpdatedAt: now,
		},
	}
	session.UpdatedAt = now

	sm.broadcastSessionStateLocked(token, session)

	return previewID, nil
}

func (sm *SessionManager) UpdatePreview(token string, previewID string, sender uuid.UUID, preview PreviewState) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	session, ok := sm.sessions[token]
	if !ok {
		return ErrSessionNotFound
	}

	instance, ok := session.Previews[previewID]
	if !ok {
		return ErrPreviewNotFound
	}

	participant, ok := session.Participants[sender]
	if !ok {
		return ErrParticipantNotFound
	}

	if instance.OwnerOnly && instance.CreatorParticipantID != sender {
		return ErrPreviewForbidden
	}

	preview.OwnerOnly = instance.OwnerOnly
	preview.Active = true
	preview.UpdatedAt = time.Now()
	if preview.Messages == nil {
		preview.Messages = []PreviewMessage{}
	}

	if instance.OwnerOnly {
		preview.ControllerParticipantID = sender.String()
		preview.ControllerName = participant.Name
	} else {
		existingController := instance.State.ControllerParticipantID
		if existingController != "" && existingController != sender.String() {
			return ErrPreviewForbidden
		}
		preview.ControllerParticipantID = sender.String()
		preview.ControllerName = participant.Name
	}

	instance.State = preview
	session.UpdatedAt = preview.UpdatedAt

	sm.broadcastSessionStateLocked(token, session)

	return nil
}

type PreviewInputMessage struct {
	Type          string `json:"type"`
	PreviewID     string `json:"previewId"`
	InputType     string `json:"inputType"`
	Value         string `json:"value"`
	SenderID      string `json:"senderId"`
	SenderName    string `json:"senderName"`
}

func (sm *SessionManager) RelayPreviewInput(token string, previewID string, sender uuid.UUID, inputType string, value string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	session, ok := sm.sessions[token]
	if !ok {
		return ErrSessionNotFound
	}

	instance, ok := session.Previews[previewID]
	if !ok {
		return ErrPreviewNotFound
	}

	participant, ok := session.Participants[sender]
	if !ok {
		return ErrParticipantNotFound
	}

	if instance.OwnerOnly && instance.CreatorParticipantID != sender {
		return ErrPreviewForbidden
	}

	controllerID := instance.State.ControllerParticipantID
	if controllerID == "" {
		return nil
	}

	controllerUUID, err := uuid.Parse(controllerID)
	if err != nil {
		return err
	}

	controller, ok := session.Participants[controllerUUID]
	if !ok {
		return nil
	}

	if controllerUUID == sender {
		return nil
	}

	payload, err := json.Marshal(PreviewInputMessage{
		Type:       "preview_input",
		PreviewID:  previewID,
		InputType:  inputType,
		Value:      value,
		SenderID:   sender.String(),
		SenderName: participant.Name,
	})
	if err != nil {
		return err
	}

	sendNonBlocking(controller.Outgoing, payload)

	return nil
}

func (sm *SessionManager) ClosePreview(token string, previewID string, sender uuid.UUID) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	session, ok := sm.sessions[token]
	if !ok {
		return ErrSessionNotFound
	}

	instance, ok := session.Previews[previewID]
	if !ok {
		return ErrPreviewNotFound
	}

	if instance.CreatorParticipantID != sender {
		return ErrPreviewForbidden
	}

	delete(session.Previews, previewID)
	session.UpdatedAt = time.Now()

	sm.broadcastSessionStateLocked(token, session)

	return nil
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

	for previewID, preview := range session.Previews {
		if preview.OwnerOnly && preview.CreatorParticipantID == participantID {
			delete(session.Previews, previewID)
			continue
		}

		if preview.State.ControllerParticipantID == participantID.String() {
			preview.State.ControllerParticipantID = ""
			preview.State.ControllerName = ""
			preview.State.UpdatedAt = session.UpdatedAt
		}
	}

	if session.OwnerParticipantID == participantID {
		session.OwnerParticipantID = uuid.Nil
	}

	if len(session.Participants) == 0 {
		now := time.Now()
		session.EmptySince = &now
		slog.Info(
			"Session is empty and scheduled for expiry",
			"config_id", session.ConfigID,
			"expires_at", now.Add(sm.sessionTTL),
		)
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

	previews := make([]PreviewSummary, 0, len(session.Previews))
	for _, preview := range session.Previews {
		previews = append(previews, previewSummaryFromInstance(preview))
	}

	sort.Slice(previews, func(i, j int) bool {
		return previews[i].UpdatedAt.After(previews[j].UpdatedAt)
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
		Previews:                  previews,
		UpdatedAt:                 session.UpdatedAt,
	}

	if session.OwnerParticipantID != uuid.Nil {
		message.OwnerParticipantID = session.OwnerParticipantID.String()
	}

	return json.Marshal(message)
}

func previewSummaryFromInstance(preview *PreviewInstance) PreviewSummary {
	return PreviewSummary{
		ID:                        preview.ID,
		OwnerOnly:                 preview.OwnerOnly,
		CreatorParticipantID:      preview.CreatorParticipantID.String(),
		CreatorName:               preview.CreatorName,
		ControllerParticipantID:   preview.State.ControllerParticipantID,
		ControllerName:            preview.State.ControllerName,
		Active:                    preview.State.Active,
		IsRunning:                 preview.State.IsRunning,
		WaitingForInput:           preview.State.WaitingForInput,
		WaitingForFile:            preview.State.WaitingForFile,
		RequestedFileName:         preview.State.RequestedFileName,
		ActiveAnswersMessageIndex: preview.State.ActiveAnswersMessageIndex,
		Messages:                  preview.State.Messages,
		UpdatedAt:                 preview.State.UpdatedAt,
	}
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

func (sm *SessionManager) startCleanupLoop() {
	ticker := time.NewTicker(sm.cleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		sm.cleanupExpiredSessions()
	}
}

func (sm *SessionManager) cleanupExpiredSessions() {
	type expiredSession struct {
		token    string
		configID string
	}

	expired := make([]expiredSession, 0)

	sm.mu.Lock()
	now := time.Now()
	for token, session := range sm.sessions {
		if len(session.Participants) > 0 || session.EmptySince == nil {
			continue
		}

		if now.Sub(*session.EmptySince) >= sm.sessionTTL {
			expired = append(expired, expiredSession{
				token:    token,
				configID: session.ConfigID,
			})
			delete(sm.sessions, token)
		}
	}
	sm.mu.Unlock()

	for _, item := range expired {
		slog.Info(
			"Removing expired session",
			"token", item.token,
			"config_id", item.configID,
		)
		sm.deleteConfigAsync(item.configID)
	}
}

func (sm *SessionManager) deleteConfigAsync(configID string) {
	configUUID, err := uuid.Parse(configID)
	if err != nil {
		slog.Error("failed to parse config id for deletion", "config_id", configID, "error", err)
		return
	}

	if err := sm.config.DeleteConfig(configUUID); err != nil {
		slog.Error("failed to delete expired config", "config_id", configID, "error", err)
	}
}

var _ sessions = &SessionManager{}
