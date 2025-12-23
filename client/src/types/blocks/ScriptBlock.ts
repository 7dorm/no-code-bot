import { BlockInterface } from '../BlockInterface';

/**
 * Интерфейс для блока Скрипт
 * Выполнение JavaScript кода для обработки переменных
 */
export interface ScriptBlockData extends BlockInterface {
  type: 'script';
  code: string; // JavaScript код для выполнения
  returnVariable?: string; // Имя переменной для сохранения результата (опционально)
}

/**
 * Метаданные блока Скрипт
 */
export const ScriptBlockMeta = {
  type: 'script' as const,
  label: 'Скрипт',
  icon: '⚡',
  color: '#9c27b0',
  description: 'Выполнение JavaScript кода',
  hasInput: true,
  hasOutput: true,
  hasMultipleOutputs: false,
};

