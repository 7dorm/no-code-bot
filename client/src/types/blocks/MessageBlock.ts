import { BlockInterface } from '../BlockInterface';


export interface MessageBlockData extends BlockInterface {
  type: 'message';
  text: string; 
  saveResponseToVariable?: string; 
  answers?: string[]; 
  answersFromVariable?: string; 
  answersPath?: string; 
}


export const MessageBlockMeta = {
  type: 'message' as const,
  label: 'Сообщение',
  icon: '💬',
  color: '#96f',
  description: 'Отправка текстового сообщения пользователю',
  hasInput: true,
  hasOutput: true,
  hasMultipleOutputs: false,
};
