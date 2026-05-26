export interface JsonPatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: any;
  from?: string;
}

export type JsonPatch = JsonPatchOperation[];

export type RemoteConfigSnapshot = {
  id?: string;
  revision?: number;
  config?: any;
  runtime?: any;
};

export interface RemoteParticipant {
  id: string;
  name: string;
  isOwner: boolean;
  joinedAt: string;
}

export interface PreviewChatMessage {
  role: 'bot' | 'user';
  content: string;
  answers?: string[];
}

export interface SharedPreviewState {
  active: boolean;
  ownerOnly: boolean;
  isRunning: boolean;
  waitingForInput: boolean;
  waitingForFile: boolean;
  requestedFileName?: string;
  activeAnswersMessageIndex: number | null;
  messages: PreviewChatMessage[];
  controllerParticipantId?: string;
  controllerName?: string;
  updatedAt?: string;
}

export interface RemoteSessionState {
  type: 'session_state';
  token: string;
  projectName: string;
  currentParticipantId: string;
  ownerParticipantId?: string;
  ownerName?: string;
  isCurrentParticipantOwner: boolean;
  participants: RemoteParticipant[];
  participantsCount: number;
  preview: SharedPreviewState;
  updatedAt?: string;
}

export interface RemoteSessionSummary {
  token: string;
  projectName: string;
  ownerName?: string;
  participantsCount: number;
  previewActive: boolean;
  updatedAt: string;
}

interface RemoteSessionCreatedMessage {
  type: 'session_created';
  token: string;
  ownerKey?: string;
}

interface PreviewSyncEnvelope {
  type: 'preview_state';
  state: SharedPreviewState;
}

function toHttpUrl(wsUrl: string): string {
  if (wsUrl.startsWith('ws://')) {
    return `http://${wsUrl.slice(5)}`;
  }
  if (wsUrl.startsWith('wss://')) {
    return `https://${wsUrl.slice(6)}`;
  }
  return wsUrl;
}

function getDefaultRemoteWsUrl(): string {
  const configured = import.meta.env.VITE_REMOTE_WS_URL?.trim();
  if (configured) {
    return configured;
  }

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.hostname}:8080`;
  }

  return 'ws://localhost:8080';
}

function normalizePreviewState(state: SharedPreviewState): SharedPreviewState {
  return {
    active: state.active,
    ownerOnly: state.ownerOnly,
    isRunning: state.isRunning,
    waitingForInput: state.waitingForInput,
    waitingForFile: state.waitingForFile,
    requestedFileName: state.requestedFileName || '',
    activeAnswersMessageIndex:
      typeof state.activeAnswersMessageIndex === 'number'
        ? state.activeAnswersMessageIndex
        : null,
    messages: Array.isArray(state.messages) ? state.messages : [],
    controllerParticipantId: state.controllerParticipantId,
    controllerName: state.controllerName,
    updatedAt: state.updatedAt,
  };
}

export class RemoteEditorClient {
  private ws: WebSocket | null = null;
  private readonly wsUrl: string;
  private readonly httpUrl: string;
  private token: string | null = null;
  private ownerKey: string | null = null;
  private participantName = '';
  private onPatchCallbacks: Array<(patch: JsonPatch) => void> = [];
  private onConfigCallbacks: Array<(snapshot: RemoteConfigSnapshot) => void> = [];
  private onSessionStateCallbacks: Array<(state: RemoteSessionState) => void> = [];
  private onConnectCallbacks: Array<() => void> = [];
  private onDisconnectCallbacks: Array<() => void> = [];
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 1000;
  private shouldReconnect = true;

  constructor(wsUrl: string = getDefaultRemoteWsUrl()) {
    this.wsUrl = wsUrl;
    this.httpUrl = toHttpUrl(wsUrl);
  }

  async listSessions(): Promise<RemoteSessionSummary[]> {
    const response = await fetch(`${this.httpUrl}/api/sessions`);
    if (!response.ok) {
      throw new Error(`Failed to list sessions: ${response.status}`);
    }

    const payload = await response.json();
    return Array.isArray(payload?.items) ? payload.items : [];
  }

  connect(initialConfig?: any, participantName: string = ''): Promise<string> {
    this.participantName = participantName.trim();
    this.shouldReconnect = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.buildCreateUrl());

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.onConnectCallbacks.forEach((cb) => cb());
          if (this.ws) {
            this.ws.send(JSON.stringify(initialConfig || {}));
          }
        };

        this.ws.onmessage = (event) => {
          const data = typeof event.data === 'string' ? event.data : String(event.data);
          const created = this.tryHandleSessionCreated(data);
          if (created) {
            resolve(created.token);
            return;
          }

          this.handleServerMessage(data);
        };

        this.ws.onerror = (error) => {
          reject(error);
        };

        this.ws.onclose = () => {
          this.handleSocketClose();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  join(token: string, participantName: string = ''): Promise<void> {
    this.token = token;
    this.participantName = participantName.trim();
    this.shouldReconnect = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.buildJoinUrl(token));

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.onConnectCallbacks.forEach((cb) => cb());
          resolve();
        };

        this.ws.onmessage = (event) => {
          const data = typeof event.data === 'string' ? event.data : String(event.data);
          this.handleServerMessage(data);
        };

        this.ws.onerror = (error) => {
          reject(error);
        };

        this.ws.onclose = () => {
          this.handleSocketClose();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  sendPatch(patch: JsonPatch): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      this.ws.send(JSON.stringify(patch));
    } catch (error) {
      console.error('Failed to send patch:', error);
    }
  }

  sendPreviewState(state: SharedPreviewState): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const envelope: PreviewSyncEnvelope = {
      type: 'preview_state',
      state: normalizePreviewState(state),
    };

    try {
      this.ws.send(JSON.stringify(envelope));
    } catch (error) {
      console.error('Failed to send preview state:', error);
    }
  }

  onPatch(callback: (patch: JsonPatch) => void): void {
    this.onPatchCallbacks.push(callback);
  }

  onConfig(callback: (snapshot: RemoteConfigSnapshot) => void): void {
    this.onConfigCallbacks.push(callback);
  }

  onSessionState(callback: (state: RemoteSessionState) => void): void {
    this.onSessionStateCallbacks.push(callback);
  }

  onConnect(callback: () => void): void {
    this.onConnectCallbacks.push(callback);
  }

  onDisconnect(callback: () => void): void {
    this.onDisconnectCallbacks.push(callback);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  getToken(): string | null {
    return this.token;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private handleServerMessage(data: string): void {
    try {
      const parsed = JSON.parse(data);

      if (this.isJsonPatch(parsed)) {
        this.onPatchCallbacks.forEach((cb) => cb(parsed));
        return;
      }

      if (this.isSessionState(parsed)) {
        this.token = parsed.token;
        this.onSessionStateCallbacks.forEach((cb) => cb(parsed));
        return;
      }

      if (parsed && typeof parsed === 'object') {
        this.onConfigCallbacks.forEach((cb) => cb(parsed as RemoteConfigSnapshot));
      }
    } catch (error) {
      console.error('Failed to parse server message:', error);
    }
  }

  private tryHandleSessionCreated(data: string): RemoteSessionCreatedMessage | null {
    try {
      const parsed = JSON.parse(data) as RemoteSessionCreatedMessage;
      if (parsed?.type !== 'session_created' || typeof parsed.token !== 'string') {
        return null;
      }

      this.token = parsed.token;
      this.ownerKey = parsed.ownerKey || null;
      return parsed;
    } catch {
      return null;
    }
  }

  private buildCreateUrl(): string {
    const params = new URLSearchParams();
    if (this.participantName) {
      params.set('name', this.participantName);
    }
    const query = params.toString();
    return query ? `${this.wsUrl}/create?${query}` : `${this.wsUrl}/create`;
  }

  private buildJoinUrl(token: string): string {
    const params = new URLSearchParams();
    if (this.participantName) {
      params.set('name', this.participantName);
    }
    if (this.ownerKey) {
      params.set('ownerKey', this.ownerKey);
    }
    const query = params.toString();
    return query
      ? `${this.wsUrl}/session/${token}?${query}`
      : `${this.wsUrl}/session/${token}`;
  }

  private handleSocketClose(): void {
    this.onDisconnectCallbacks.forEach((cb) => cb());
    this.ws = null;

    if (!this.shouldReconnect || !this.token || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts += 1;
    setTimeout(() => {
      if (this.token) {
        this.join(this.token, this.participantName).catch((error) => {
          console.error('Failed to reconnect to remote session:', error);
        });
      }
    }, this.reconnectDelay);
  }

  private isJsonPatch(value: unknown): value is JsonPatch {
    if (!Array.isArray(value)) {
      return false;
    }

    return value.every((operation) => (
      operation &&
      typeof operation === 'object' &&
      typeof (operation as JsonPatchOperation).op === 'string' &&
      typeof (operation as JsonPatchOperation).path === 'string'
    ));
  }

  private isSessionState(value: unknown): value is RemoteSessionState {
    return (
      !!value &&
      typeof value === 'object' &&
      (value as RemoteSessionState).type === 'session_state' &&
      typeof (value as RemoteSessionState).token === 'string'
    );
  }
}
