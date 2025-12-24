import { BlockInterface } from '../BlockInterface';


export interface FileBlockData extends BlockInterface {
  type: 'file';
  action: 'upload' | 'download' | 'delete' | 'read'; 
  fileName?: string; 
  filePath?: string; 
}


export const FileBlockMeta = {
  type: 'file' as const,
  label: 'Файл',
  icon: '',
  color: '#798',
  description: 'Обработка файлов',
  hasInput: true,
  hasOutput: true,
  hasMultipleOutputs: false,
};

