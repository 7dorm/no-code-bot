import { BlockInterface } from '../BlockInterface';

/**
 * Интерфейс для блока Конец
 * Завершение диалога с пользователем
 */
export interface EndBlockData extends BlockInterface {
  type: 'end';
  message?: string; // Финальное сообщение перед завершением (опционально)
}

/**
 * Метаданные блока Конец
 */
export const EndBlockMeta = {
  type: 'end' as const,
  label: 'Конец',
  icon: '⏹️',
  color: '#f44336',
  description: 'Завершение диалога',
  hasInput: true,
  hasOutput: false,
  hasMultipleOutputs: false,
};

