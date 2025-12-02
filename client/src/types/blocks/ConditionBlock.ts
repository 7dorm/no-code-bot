import { BlockInterface } from '../BlockInterface';

/**
 * Интерфейс для условия в блоке Condition
 */
export interface ConditionCase {
  condition: string; // Логическое выражение для проверки
  label?: string; // Подпись для условия (опционально)
}

/**
 * Интерфейс для блока Условие
 * Условное ветвление логики с несколькими условиями и дефолтной веткой
 */
export interface ConditionBlockData extends BlockInterface {
  type: 'condition';
  conditions: ConditionCase[]; // Массив условий для проверки
  hasDefault: boolean; // Есть ли дефолтная ветка (else)
}

/**
 * Метаданные блока Условие
 */
export const ConditionBlockMeta = {
  type: 'condition' as const,
  label: 'Условие',
  icon: '🔀',
  color: '#ff9800',
  description: 'Условное ветвление с несколькими условиями',
  hasInput: true,
  hasOutput: true,
  hasMultipleOutputs: true,
};
