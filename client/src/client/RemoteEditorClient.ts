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

export type RemoteConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

export interface RemoteConnectionInfo {
  status: RemoteConnectionStatus;
  attempt: number;
  maxAttempts: number;
}

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
  id?: string;
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

export interface RemotePreviewInstance {
  id: string;
  ownerOnly: boolean;
  creatorParticipantId: string;
  creatorName: string;
  controllerParticipantId?: string;
  controllerName?: string;
  active: boolean;
  isRunning: boolean;
  waitingForInput: boolean;
  waitingForFile: boolean;
  requestedFileName?: string;
  activeAnswersMessageIndex: number | null;
  messages: PreviewChatMessage[];
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
  previews: RemotePreviewInstance[];
  updatedAt?: string;
}

interface RemoteSessionCreatedMessage {
  type: 'session_created';
  token: string;
  ownerKey?: string;
}

interface PreviewCreatedMessage {
  type: 'preview_created';
  previewId: string;
}

interface PreviewSyncEnvelope {
  type: 'preview_state';
  previewId: string;
  state: SharedPreviewState;
}

interface PreviewCreateEnvelope {
  type: 'preview_create';
  ownerOnly: boolean;
}

interface PreviewCloseEnvelope {
  type: 'preview_close';
  previewId: string;
}

export interface PreviewInputMessage {
  type: 'preview_input';
  previewId: string;
  inputType: 'text' | 'file' | 'restart';
  value: string;
  senderId: string;
  senderName: string;
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

  return 'ws://127.0.0.1:8080';
}

function getMaxReconnectAttempts(): number {
  const configured = Number(import.meta.env.VITE_REMOTE_RECONNECT_MAX_ATTEMPTS);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured);
  }
  return 10;
}

function normalizePreviewState(state: SharedPreviewState): SharedPreviewState {
  return {
    id: state.id,
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
  private readonly maxReconnectAttempts: number;
  private token: string | null = null;
  private ownerKey: string | null = null;
  private participantName = '';
  private connectionStatus: RemoteConnectionStatus = 'idle';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private onPatchCallbacks: Array<(patch: JsonPatch) => void> = [];
  private onConfigCallbacks: Array<(snapshot: RemoteConfigSnapshot) => void> = [];
  private onSessionStateCallbacks: Array<(state: RemoteSessionState) => void> = [];
  private onConnectCallbacks: Array<() => void> = [];
  private onDisconnectCallbacks: Array<() => void> = [];
  private onConnectionStatusCallbacks: Array<(info: RemoteConnectionInfo) => void> = [];
  private previewInputHandler: ((message: PreviewInputMessage) => void) | null = null;

  constructor(wsUrl: string = getDefaultRemoteWsUrl()) {
    this.wsUrl = wsUrl;
    this.maxReconnectAttempts = getMaxReconnectAttempts();
  }

  connect(initialConfig?: any, participantName: string = ''): Promise<string> {
    this.participantName = participantName.trim();
    this.shouldReconnect = true;
    this.clearReconnectTimer();
    this.reconnectAttempts = 0;
    this.setConnectionStatus('connecting');

    return new Promise((resolve, reject) => {
      try {
        this.closeSocketSilently();
        const ws = new WebSocket(this.buildCreateUrl());
        this.ws = ws;
        let settled = false;
        const timeout = window.setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          this.setConnectionStatus('failed');
          this.closeSocketSilently();
          reject(new Error('Не удалось создать совместную сессию: таймаут. Проверьте, что remote-serv запущен на 8080, а engine-manager на 4004.'));
        }, 10000);

        ws.onopen = () => {
          this.reconnectAttempts = 0;
          ws.send(JSON.stringify(initialConfig || {}));
        };

        ws.onmessage = (event) => {
          const data = typeof event.data === 'string' ? event.data : String(event.data);
          const created = this.tryHandleSessionCreated(data);
          if (created) {
            if (!settled) {
              settled = true;
              window.clearTimeout(timeout);
              this.setConnectionStatus('connected');
              this.onConnectCallbacks.forEach((cb) => cb());
            }
            resolve(created.token);
            return;
          }

          this.handleServerMessage(data);
        };

        ws.onerror = () => {
          if (!settled) {
            settled = true;
            window.clearTimeout(timeout);
            this.setConnectionStatus('failed');
            reject(new Error('Не удалось подключиться к сервису совместных сессий. Проверьте remote-serv на порту 8080.'));
          }
        };

        ws.onclose = () => {
          if (this.ws === ws) {
            this.ws = null;
          }
          if (!settled) {
            settled = true;
            window.clearTimeout(timeout);
            this.setConnectionStatus('failed');
            reject(new Error('Соединение закрылось до создания сессии. Проверьте, что remote-serv запущен на 8080, а engine-manager на 4004.'));
            return;
          }
          this.handleSocketClose();
        };
      } catch (error) {
        this.setConnectionStatus('failed');
        reject(error);
      }
    });
  }

  join(token: string, participantName: string = ''): Promise<void> {
    this.token = token;
    this.participantName = participantName.trim();
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    this.setConnectionStatus('connecting');

    return this.openJoinSocket();
  }

  retryConnection(): Promise<void> {
    if (!this.token) {
      return Promise.reject(new Error('No session token to reconnect'));
    }

    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    this.setConnectionStatus('connecting');

    return this.openJoinSocket();
  }

  createPreview(ownerOnly: boolean): Promise<string> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket is not connected'));
    }

    const envelope: PreviewCreateEnvelope = {
      type: 'preview_create',
      ownerOnly,
    };

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error('Preview creation timed out'));
      }, 5000);

      const handleMessage = (event: MessageEvent) => {
        const data = typeof event.data === 'string' ? event.data : String(event.data);
        try {
          const parsed = JSON.parse(data) as PreviewCreatedMessage;
          if (parsed?.type === 'preview_created' && typeof parsed.previewId === 'string') {
            window.clearTimeout(timeout);
            this.ws?.removeEventListener('message', handleMessage);
            resolve(parsed.previewId);
          }
        } catch {
          // ignore non-json messages handled elsewhere
        }
      };

      this.ws?.addEventListener('message', handleMessage);

      try {
        this.ws?.send(JSON.stringify(envelope));
      } catch (error) {
        window.clearTimeout(timeout);
        this.ws?.removeEventListener('message', handleMessage);
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

  sendPreviewState(previewId: string, state: SharedPreviewState): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const envelope: PreviewSyncEnvelope = {
      type: 'preview_state',
      previewId,
      state: normalizePreviewState(state),
    };

    try {
      this.ws.send(JSON.stringify(envelope));
    } catch (error) {
      console.error('Failed to send preview state:', error);
    }
  }

  closePreview(previewId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const envelope: PreviewCloseEnvelope = {
      type: 'preview_close',
      previewId,
    };

    try {
      this.ws.send(JSON.stringify(envelope));
    } catch (error) {
      console.error('Failed to close preview:', error);
    }
  }

  sendPreviewInput(previewId: string, inputType: PreviewInputMessage['inputType'], value: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      this.ws.send(JSON.stringify({
        type: 'preview_input',
        previewId,
        inputType,
        value,
      }));
    } catch (error) {
      console.error('Failed to send preview input:', error);
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

  onConnectionStatus(callback: (info: RemoteConnectionInfo) => void): void {
    this.onConnectionStatusCallbacks.push(callback);
  }

  onPreviewInput(callback: (message: PreviewInputMessage) => void): void {
    this.previewInputHandler = callback;
  }

  clearPreviewInputHandler(): void {
    this.previewInputHandler = null;
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.closeSocketSilently();
    this.setConnectionStatus('disconnected');
  }

  getToken(): string | null {
    return this.token;
  }

  getConnectionInfo(): RemoteConnectionInfo {
    return {
      status: this.connectionStatus,
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
    };
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private openJoinSocket(): Promise<void> {
    if (!this.token) {
      return Promise.reject(new Error('Session token is missing'));
    }

    return new Promise((resolve, reject) => {
      try {
        this.closeSocketSilently();
        const ws = new WebSocket(this.buildJoinUrl(this.token!));
        this.ws = ws;
        let settled = false;

        ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.setConnectionStatus('connected');
          this.onConnectCallbacks.forEach((cb) => cb());
          settled = true;
          resolve();
        };

        ws.onmessage = (event) => {
          const data = typeof event.data === 'string' ? event.data : String(event.data);
          this.handleServerMessage(data);
        };

        ws.onerror = () => {
          if (!settled) {
            settled = true;
            reject(new Error('Failed to join remote session'));
          }
        };

        ws.onclose = () => {
          if (this.ws === ws) {
            this.ws = null;
          }

          if (!settled) {
            settled = true;
            reject(new Error('Remote session connection closed'));
            if (this.shouldReconnect && this.token) {
              this.onDisconnectCallbacks.forEach((cb) => cb());
              this.scheduleReconnect();
            }
            return;
          }

          this.handleSocketClose();
        };
      } catch (error) {
        reject(error);
      }
    });
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

      if (this.isPreviewInput(parsed)) {
        this.previewInputHandler?.(parsed);
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
    if (!this.shouldReconnect) {
      this.onDisconnectCallbacks.forEach((cb) => cb());
      this.setConnectionStatus('disconnected');
      return;
    }

    if (!this.token) {
      this.onDisconnectCallbacks.forEach((cb) => cb());
      this.setConnectionStatus('disconnected');
      return;
    }

    this.onDisconnectCallbacks.forEach((cb) => cb());
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || !this.token) {
      this.setConnectionStatus('disconnected');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setConnectionStatus('failed');
      return;
    }

    this.reconnectAttempts += 1;
    this.setConnectionStatus('reconnecting');

    const delay = Math.min(1000 * (2 ** (this.reconnectAttempts - 1)), 30000);
    this.clearReconnectTimer();
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.setConnectionStatus('connecting');
      void this.openJoinSocket().catch((error) => {
        console.warn('Reconnect attempt failed:', error);
      });
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private closeSocketSilently(): void {
    if (!this.ws) {
      return;
    }

    const socket = this.ws;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    socket.close();
    this.ws = null;
  }

  private setConnectionStatus(status: RemoteConnectionStatus): void {
    if (this.connectionStatus === status) {
      this.emitConnectionStatus();
      return;
    }

    this.connectionStatus = status;
    this.emitConnectionStatus();
  }

  private emitConnectionStatus(): void {
    const info = this.getConnectionInfo();
    this.onConnectionStatusCallbacks.forEach((cb) => cb(info));
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

  private isPreviewInput(value: unknown): value is PreviewInputMessage {
    return (
      !!value &&
      typeof value === 'object' &&
      (value as PreviewInputMessage).type === 'preview_input' &&
      typeof (value as PreviewInputMessage).previewId === 'string'
    );
  }
}
