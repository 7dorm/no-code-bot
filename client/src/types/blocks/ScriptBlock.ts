import { BlockInterface } from '../BlockInterface';


export interface ScriptBlockData extends BlockInterface {
  type: 'script';
  code: string; 
  returnVariable?: string; 
}


export const ScriptBlockMeta = {
  type: 'script' as const,
  label: 'Скрипт',
  icon: '⚡',
  color: '#9c7b0',
  description: 'Выполнение JavaScript кода',
  hasInput: true,
  hasOutput: true,
  hasMultipleOutputs: false,
};

