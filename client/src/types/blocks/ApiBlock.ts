import { BlockInterface } from '../BlockInterface';

/**
 * Интерфейс для блока API
 * Вызов внешнего API endpoint
 */
export interface ApiBlockData extends BlockInterface {
  type: 'api';
  url: string; // URL API endpoint
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; // HTTP метод
  headers?: Record<string, string>; // HTTP заголовки (опционально)
  body?: string; // Тело запроса для POST/PUT (опционально)
  responseVariable?: string; // Имя переменной, куда сохранить ответ (для GET)
}

/**
 * Метаданные блока API
 */
export const ApiBlockMeta = {
  type: 'api' as const,
  label: 'API',
  icon: '🔌',
  color: '#00bcd4',
  description: 'Вызов внешнего API endpoint',
  hasInput: true,
  hasOutput: true,
  hasMultipleOutputs: false,
};

