import { BlockInterface } from '../BlockInterface';

/**
 * Интерфейс для блока Файл
 * Обработка файлов: загрузка, скачивание, удаление, чтение
 */
export interface FileBlockData extends BlockInterface {
  type: 'file';
  action: 'upload' | 'download' | 'delete' | 'read'; // Действие с файлом
  fileName?: string; // Имя файла (опционально)
  filePath?: string; // Путь к файлу (опционально)
}

/**
 * Метаданные блока Файл
 */
export const FileBlockMeta = {
  type: 'file' as const,
  label: 'Файл',
  icon: '📎',
  color: '#795548',
  description: 'Обработка файлов',
  hasInput: true,
  hasOutput: true,
  hasMultipleOutputs: false,
};

