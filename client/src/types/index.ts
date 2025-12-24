

import { BlockData } from './blocks';


export type { BlockInterface } from './BlockInterface';



export {
  
  StartBlockMeta,
  MessageBlockMeta,
  ConditionBlockMeta,
  VariableBlockMeta,
  ApiBlockMeta,
  FileBlockMeta,
  ScriptBlockMeta,
  
  getBlockMeta,
  getBlockIcon,
  getBlockColor,
  BLOCK_METADATA
} from './blocks';

export type {
  StartBlockData,
  MessageBlockData,
  ConditionBlockData,
  ConditionCase,
  VariableBlockData,
  ApiBlockData,
  FileBlockData,
  ScriptBlockData,
  BlockData,
  BlockType
} from './blocks';


export interface BlockExecutionResult {
  success: boolean;
  nextNodeId?: string | null;
  output?: any;
  error?: string;
  saveResponseToVariable?: string; 
}


export interface ExecutionContext {
  variables: Record<string, any>;
  userInput?: string;
  currentMessage?: string;
  globalConstants?: Record<string, any>;
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


export type ExportPlatform = 'telegram' | 'whatsapp' | 'web';


export interface Project {
  id: string;
  name: string;
  exportPlatform?: ExportPlatform;
  botToken?: string; 
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


export interface PreviewState {
  isActive: boolean;
  currentNodeId: string | null;
  userInput: string;
  botHistory: Array<{ role: 'bot' | 'user'; content: string }>;
}
