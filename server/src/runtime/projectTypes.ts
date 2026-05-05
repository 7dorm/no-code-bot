export type ExportPlatform = 'telegram' | 'whatsapp' | 'web';

export interface BlockPosition {
  x: number;
  y: number;
}

export interface BlockData {
  type: string;
  label: string;
  [key: string]: unknown;
}

export interface BlockNodeConfig {
  id: string;
  type: string;
  position: BlockPosition;
  data: BlockData;
}

export interface ConnectionConfig {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
}

export interface ProjectConfig {
  id: string;
  name: string;
  exportPlatform?: ExportPlatform;
  botToken?: string;
  telegramToken?: string;
  globalConstants?: Record<string, unknown>;
  blocks: BlockNodeConfig[];
  connections: ConnectionConfig[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectConfigPayload
  extends Omit<ProjectConfig, 'createdAt' | 'updatedAt'> {
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface RuntimeSummary {
  status: 'ready';
  compiledAt: Date;
  nodesCount: number;
  blockCount: number;
  connectionCount: number;
}

export interface ConfigSnapshot {
  id: string;
  revision: number;
  config: ProjectConfig;
  runtime: RuntimeSummary;
}

export interface EngineNode {
  id: string;
  Type: 'output' | 'condition' | 'start' | 'variable' | 'FILE' | 'api' | 'skip' | 'script';
  Text?: string;
  VarName?: string;
  VarType?: string;
  Nexts: string[];
  Cond?: string[];
  skip?: boolean;
  Answers?: string[];
  AnswersFromVariable?: string;
  AnswersPath?: string;
  VariableName?: string;
  VariableValue?: string;
  SaveNextToVariable?: string;
  ApiUrl?: string;
  ApiMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  ApiHeaders?: Record<string, string>;
  ApiBody?: string;
  ApiResponseVariable?: string;
  ApiAnswersPath?: string;
  ApiAnswersVariable?: string;
  FILEAct?: 'Upload' | 'DownLoad' | 'Delete' | 'Read';
  FileName?: string;
  PathToSave?: string;
  PathToFile?: string;
  ScriptCode?: string;
  ScriptReturnVariable?: string;
}
