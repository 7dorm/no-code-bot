// Типы для узлов (блоков) и соединений

export type BlockType = 
  | 'start'
  | 'message'
  | 'condition'
 Ўvariable'
  | 'api'
  | 'file';

export interface BlockData {
  type: BlockType;
  label?: string;
  params?: Record<string, any>;
}

// Результат выполнения блока
export interface BlockExecutionResult {
  success: boolean;
  nextNodeId?: string | null;
  output?: any;
  error?: string;
}

// Контекст выполнения
export interface ExecutionContext {
  variables: Record<string, any>;
  userInput?: string;
  currentMessage?: string;
}

export interface BlockNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: BlockData;
}

export interface Connection {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
}

export interface Project {
  id: string;
  name: string;
  telegramToken?: string;
  globalConstants?: Record<string, any>;
  blocks: BlockNode[];
  connections: Connection[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceState {
  projects: Project[];
  currentProject: Project | null;
  selectedNode: BlockNode | null;
  history: {
    past: Project[];
    present: Project;
    future: Project[];
  };
}

// Типы для предпросмотра
export interface PreviewState {
  isActive: boolean;
  currentNodeId: string | null;
  userInput: string;
  botHistory: Array<{ role: 'bot' | 'user'; content: string }>;
}
