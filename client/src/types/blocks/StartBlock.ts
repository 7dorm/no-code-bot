import { BlockInterface } from '../BlockInterface';

/**
 * Интерфейс для блока Старт
 * Точка входа в диалог бота
 */
export interface StartBlockData extends BlockInterface {
  type: 'start';
}

/**
 * Метаданные блока Старт
 */
export const StartBlockMeta = {
  type: 'start' as const,
  label: 'Старт',
  icon: '▶️',
  color: '#4caf50',
  description: 'Точка входа в диалог бота',
  hasInput: false,
  hasOutput: true,
  hasMultipleOutputs: false,
};

