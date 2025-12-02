import { BlockInterface } from '../BlockInterface';

/**
 * Интерфейс для блока Переменная
 * Работа с переменными: установка, изменение значений
 */
export interface VariableBlockData extends BlockInterface {
  type: 'variable';
  variableName: string; // Имя переменной
  value: string; // Значение переменной (может содержать {{переменные}})
}

/**
 * Метаданные блока Переменная
 */
export const VariableBlockMeta = {
  type: 'variable' as const,
  label: 'Переменная',
  icon: '📝',
  color: '#9c27b0',
  description: 'Работа с переменными',
  hasInput: true,
  hasOutput: true,
  hasMultipleOutputs: false,
};

