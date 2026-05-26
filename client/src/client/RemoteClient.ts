import {
  RemoteClientConfig,
  SessionConfig,
  RemoteClientEvents,
  PatchData,
} from './types';

export class RemoteClient {
  private ws: WebSocket | null = null;
  private config: RemoteClientConfig;
  private events: RemoteClientEvents;
  private token: string | null = null;
  private isConnected: boolean = false;

  constructor(config: RemoteClientConfig, events: RemoteClientEvents = {}) {
    this.config = config;
    this.events = events;
  }

  /**
   * Create a new session by connecting to /create endpoint
   * @param initialConfig - Initial configuration for the session
   */
  async createSession(initialConfig: SessionConfig): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.config.serverUrl}/create`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connection opened for session creation');
        };

        this.ws.onmessage = (event) => {
          const message = event.data;

          if (!this.token) {
            // First message is the token
            this.token = message;
            this.isConnected = true;
            this.events.onConnect?.();
            if (this.token) {
              resolve(this.token);
            } else {
              reject(new Error('Failed to receive token'));
            }
          } else {
            // Subsequent messages are config or other data
            this.events.onConfig?.(message);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.events.onError?.(new Error('WebSocket connection error'));
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket connection closed');
          this.isConnected = false;
          this.events.onDisconnect?.();
        };

        // Send initial config to create session
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(initialConfig));
        } else {
          this.ws.onopen = () => {
            this.ws?.send(JSON.stringify(initialConfig));
          };
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Connect to an existing session using a token
   * @param token - Session token
   */
  async connectSession(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.token = token;
        const wsUrl = `${this.config.serverUrl}/session/${token}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connection opened for existing session');
        };

        this.ws.onmessage = (event) => {
          const message = event.data;

          if (!this.isConnected) {
            // First message is the config
            this.isConnected = true;
            this.events.onConnect?.();
            this.events.onConfig?.(message);
            resolve();
          } else {
            // Subsequent messages
            this.events.onMessage?.(message);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.events.onError?.(new Error('WebSocket connection error'));
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket connection closed');
          this.isConnected = false;
          this.events.onDisconnect?.();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Apply a patch to the current session
   * @param patch - Patch data to apply
   */
  applyPatch(patch: PatchData): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    try {
      const patchData = JSON.stringify(patch);
      this.ws.send(patchData);
    } catch (error) {
      console.error('Error sending patch:', error);
      this.events.onError?.(error as Error);
    }
  }

  /**
   * Disconnect from the current session
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.token = null;
    }
  }

  /**
   * Check if the client is connected
   */
  isClientConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get the current session token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Update event handlers
   */
  updateEvents(events: Partial<RemoteClientEvents>): void {
    this.events = { ...this.events, ...events };
  }
}
