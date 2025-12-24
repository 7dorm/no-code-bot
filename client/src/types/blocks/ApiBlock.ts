import { BlockInterface } from '../BlockInterface';


export interface ApiBlockData extends BlockInterface {
  type: 'api';
  url: string; 
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; 
  headers?: Record<string, string>; 
  body?: string; 
  responseVariable?: string; 
  answersPath?: string; 
  answersVariable?: string; 
}


export const ApiBlockMeta = {
  type: 'api' as const,
  label: 'API',
  icon: '🔌',
  color: '#00bcd',
  description: 'Вызов внешнего API endpoint',
  hasInput: true,
  hasOutput: true,
  hasMultipleOutputs: false,
};

