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
  aiSettings?: AiSettings;
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
  Type: 'output' | 'condition' | 'start' | 'variable' | 'FILE' | 'api' | 'skip' | 'script' | 'aiRouter' | 'aiExtractor' | 'aiAssistant';
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
  AiSettings?: AiSettings;
  AiInputVariable?: string;
  AiInstruction?: string;
  AiContextMode?: AiContextMode;
  AiRoutes?: AiRoute[];
  AiFallbackRoute?: string;
  AiConfidenceThreshold?: number;
  AiConfidenceVariable?: string;
  AiReasonVariable?: string;
  AiIntentVariable?: string;
  AiEntities?: AiEntity[];
  AiAskMissing?: boolean;
  AiRawResultVariable?: string;
  AiReplyVariable?: string;
  AiButtonsVariable?: string;
  AiSpecialTopicVariable?: string;
  AiLoop?: boolean;
  AiExitPhrases?: string[];
}

export type AiContextMode = 'none' | 'last_message' | 'last_n_messages';

export interface AiSettings {
  provider?: 'mock' | 'custom' | 'openai' | 'openaiCompatible' | 'yandex-alice' | 'yandexgpt';
  endpoint?: string;
  apiKey?: string;
  baseUrl?: string;
  iamToken?: string;
  folderId?: string;
  modelUri?: string;
  model?: string;
  systemPrompt?: string;
  safetyPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  language?: string;
  contextWindowMode?: AiContextMode;
  confidenceThreshold?: number;
}

export interface AiRoute {
  id: string;
  title: string;
  description?: string;
  examples?: string[];
}

export type AiEntityType = 'string' | 'number' | 'phone' | 'email' | 'date' | 'time' | 'enum' | 'boolean';

export interface AiEntity {
  name: string;
  variableName: string;
  type: AiEntityType;
  description?: string;
  required?: boolean;
  enumValues?: string[];
  validationRegex?: string;
  askPrompt?: string;
}
