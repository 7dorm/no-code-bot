import { BlockInterface } from '../BlockInterface';


export interface ConditionCase {
  condition: string; 
  label?: string; 
}


export interface ConditionBlockData extends BlockInterface {
  type: 'condition';
  conditions: ConditionCase[]; 
  hasDefault: boolean; 
}


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
