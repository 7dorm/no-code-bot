/**
 * Реестр всех метаданных блоков
 * Используется для получения информации о блоках по типу
 */

import { StartBlockMeta } from './StartBlock';
import { MessageBlockMeta } from './MessageBlock';
import { ConditionBlockMeta } from './ConditionBlock';
import { VariableBlockMeta } from './VariableBlock';
import { ApiBlockMeta } from './ApiBlock';
import { FileBlockMeta } from './FileBlock';
import { ScriptBlockMeta } from './ScriptBlock';

export type BlockType = 
  | 'start'
  | 'message'
  | 'condition'
  | 'variable'
  | 'api'
  | 'file'
  | 'script';

// Базовый тип для метаданных блока
export type BlockMeta = {
  type: BlockType;
  label: string;
  icon: string;
  color: string;
  description: string;
  hasInput: boolean;
  hasOutput: boolean;
  hasMultipleOutputs: boolean;
};

/**
 * Реестр всех метаданных блоков
 */
export const BLOCK_METADATA: Record<BlockType, BlockMeta> = {
  start: StartBlockMeta,
  message: MessageBlockMeta,
  condition: ConditionBlockMeta,
  variable: VariableBlockMeta,
  api: ApiBlockMeta,
  file: FileBlockMeta,
  script: ScriptBlockMeta,
};

/**
 * Получить метаданные блока по типу
 */
export function getBlockMeta(type: BlockType): BlockMeta {
  return BLOCK_METADATA[type];
}

/**
 * Получить иконку блока по типу
 */
export function getBlockIcon(type: BlockType): string {
  return BLOCK_METADATA[type].icon;
}

/**
 * Получить цвет блока по типу
 */
export function getBlockColor(type: BlockType): string {
  return BLOCK_METADATA[type].color;
}
