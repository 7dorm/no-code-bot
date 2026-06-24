import { BlockInterface } from '../BlockInterface';

export type AiContextMode = 'none' | 'last_message' | 'last_n_messages';

export type AiEntityType =
  | 'string'
  | 'number'
  | 'phone'
  | 'email'
  | 'date'
  | 'time'
  | 'enum'
  | 'boolean';

export interface AiRoute {
  id: string;
  title: string;
  description?: string;
  examples?: string[];
}

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

export interface AiRouterBlockData extends BlockInterface {
  type: 'aiRouter';
  inputVariable?: string;
  instruction?: string;
  routes: AiRoute[];
  fallbackRoute?: string;
  confidenceThreshold?: number;
  confidenceVariable?: string;
  reasonVariable?: string;
  saveNormalizedIntentTo?: string;
  contextMode?: AiContextMode;
}

export interface AiExtractorBlockData extends BlockInterface {
  type: 'aiExtractor';
  inputVariable?: string;
  instruction?: string;
  entities: AiEntity[];
  askMissing?: boolean;
  rawResultVariable?: string;
  contextMode?: AiContextMode;
}

export interface AiAssistantBlockData extends BlockInterface {
  type: 'aiAssistant';
  inputVariable?: string;
  instruction?: string;
  routes: AiRoute[];
  entities: AiEntity[];
  askMissing?: boolean;
  loop?: boolean;
  exitPhrases?: string[];
  confidenceThreshold?: number;
  replyVariable?: string;
  buttonsVariable?: string;
  rawResultVariable?: string;
  confidenceVariable?: string;
  reasonVariable?: string;
  saveNormalizedIntentTo?: string;
  specialTopicVariable?: string;
  contextMode?: AiContextMode;
}

export const AiRouterBlockMeta = {
  type: 'aiRouter' as const,
  label: 'AI Router',
  icon: 'AI',
  color: '#3b7f6f',
  description: 'Выбор ветки диалога через LLM по смыслу сообщения',
  hasInput: true,
  hasOutput: true,
  hasMultipleOutputs: true,
};

export const AiExtractorBlockMeta = {
  type: 'aiExtractor' as const,
  label: 'AI Extractor',
  icon: 'AI',
  color: '#5b6bc8',
  description: 'Извлечение сущностей из свободного текста в переменные',
  hasInput: true,
  hasOutput: true,
  hasMultipleOutputs: true,
};

export const AiAssistantBlockMeta = {
  type: 'aiAssistant' as const,
  label: 'AI Assistant',
  icon: 'AI',
  color: '#7a5c32',
  description: 'Свободный AI-диалог с распознаванием специальных тем, сущностей и кнопок',
  hasInput: true,
  hasOutput: true,
  hasMultipleOutputs: true,
};
