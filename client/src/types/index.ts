/**
 * Главный файл экспорта типов
 */

import { BlockData } from './blocks';

// Экспорт базового интерфейса блоков
export type { BlockInterface } from './BlockInterface';


// Экспорт всех типов блоков из отдельных файлов
export {
  // Метаданные блоков
  StartBlockMeta,
  MessageBlockMeta,
  ConditionBlockMeta,
  VariableBlockMeta,
  ApiBlockMeta,
  FileBlockMeta,
  EndBlockMeta,
  // Вспомогательные функции
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
  EndBlockData,
  BlockData,
  BlockType
} from './blocks';

// Результат выполнения блока
export interface BlockExecutionResult {
  success: boolean;
  nextNodeId?: string | null;
  output?: any;
  error?: string;
  saveResponseToVariable?: string; // Имя переменной для сохранения ответа пользователя (для message блоков)
}

// Контекст выполнения
export interface ExecutionContext {
  variables: Record<string, any>;
  userInput?: string;
  currentMessage?: string;
  globalConstants?: Record<string, any>;
}

// Узел блока (для React Flow)
export interface BlockNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: BlockData;
}

// Соединение между блоками
export interface Connection {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
}

// Тип платформы для экспорта
export type ExportPlatform = 'telegram' | 'whatsapp' | 'web';

// Проект
export interface Project {
  id: string;
  name: string;
  exportPlatform?: ExportPlatform;
  botToken?: string; // Универсальный токен/ключ для выбранной платформы
  telegramToken?: string; // Оставлено для обратной совместимости
  globalConstants?: Record<string, any>;
  blocks: BlockNode[];
  connections: Connection[];
  createdAt: Date;
  updatedAt: Date;
}

// Состояние рабочего пространства
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
