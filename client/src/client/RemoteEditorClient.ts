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

export class RemoteEditorClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private onPatchCallbacks: ((patch: JsonPatch) => void)[] = [];
  private onConfigCallbacks: ((snapshot: RemoteConfigSnapshot) => void)[] = [];
  private onConnectCallbacks: (() => void)[] = [];
  private onDisconnectCallbacks: (() => void)[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(url: string = 'ws://localhost:8080') {
    this.url = url;
  }

  connect(initialConfig?: any): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${this.url}/create`);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          // Send initial config if provided
          if (this.ws) {
            if (initialConfig) {
              this.ws.send(JSON.stringify(initialConfig));
            } else {
              // Send empty config if none provided
              this.ws.send(JSON.stringify({}));
            }
          }
        };

        this.ws.onmessage = (event) => {
          const data = event.data;
          
          if (!this.token) {
            this.token = data;
            console.log('Session token received:', this.token);
            this.reconnectAttempts = 0;
            this.onConnectCallbacks.forEach(cb => cb());
            if (this.token) {
              resolve(this.token);
            } else {
              reject(new Error('Failed to receive token'));
            }
          } else {
            this.handleServerMessage(data);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.onDisconnectCallbacks.forEach(cb => cb());
          this.ws = null;
          
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
            setTimeout(() => {
              if (this.token) {
                this.join(this.token).catch(console.error);
              }
            }, this.reconnectDelay);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  join(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.token = token;
        this.ws = new WebSocket(`${this.url}/session/${token}`);

        this.ws.onopen = () => {
          console.log('WebSocket connected to session:', token);
          this.reconnectAttempts = 0;
          this.onConnectCallbacks.forEach(cb => cb());
          resolve();
        };

        this.ws.onmessage = (event) => {
          const data = event.data;
          
          if (!this.token) {
            this.token = data;
            console.log('Session token received:', this.token);
          } else {
            this.handleServerMessage(data);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.onDisconnectCallbacks.forEach(cb => cb());
          this.ws = null;
          
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
            setTimeout(() => {
              this.join(token).catch(console.error);
            }, this.reconnectDelay);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  sendPatch(patch: JsonPatch): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return;
    }
    console.log('Sending patch:', patch);
    try {
      this.ws.send(JSON.stringify(patch));
    } catch (error) {
      console.error('Failed to send patch:', error);
    }
  }

  onPatch(callback: (patch: JsonPatch) => void): void {
    this.onPatchCallbacks.push(callback);
  }

  onConfig(callback: (snapshot: RemoteConfigSnapshot) => void): void {
    this.onConfigCallbacks.push(callback);
  }

  onConnect(callback: () => void): void {
    this.onConnectCallbacks.push(callback);
  }

  onDisconnect(callback: () => void): void {
    this.onDisconnectCallbacks.push(callback);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.token = null;
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

      if (parsed && typeof parsed === 'object') {
        this.onConfigCallbacks.forEach((cb) => cb(parsed as RemoteConfigSnapshot));
        return;
      }

      console.warn('Unknown server message format:', parsed);
    } catch (e) {
      console.error('Failed to parse server message:', e);
    }
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
}
