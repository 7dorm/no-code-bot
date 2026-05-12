export interface RemoteClientConfig {
  serverUrl: string;
  token?: string;
}

export interface SessionConfig {
  [key: string]: any;
}

export interface RemoteClientEvents {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onConfig?: (config: string) => void;
  onMessage?: (message: string) => void;
  onError?: (error: Error) => void;
}

export interface PatchData {
  [key: string]: any;
}
