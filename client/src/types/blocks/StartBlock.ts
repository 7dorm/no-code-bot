import { BlockInterface } from '../BlockInterface';


export interface StartBlockData extends BlockInterface {
  type: 'start';
}


export const StartBlockMeta = {
  type: 'start' as const,
  label: 'Старт',
  icon: '',
  color: '#caf0',
  description: 'Точка входа в диалог бота',
  hasInput: false,
  hasOutput: true,
  hasMultipleOutputs: false,
};

