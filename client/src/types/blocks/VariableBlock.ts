import { BlockInterface } from '../BlockInterface';


export interface VariableBlockData extends BlockInterface {
  type: 'variable';
  variableName: string; 
  value: string; 
  saveNextInput?: boolean; 
}


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
