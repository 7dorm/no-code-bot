import { BlockInterface } from '../BlockInterface';

/**
 * Интерфейс для блока Сообщение
 * Отправка текстового сообщения пользователю
 */
export interface MessageBlockData extends BlockInterface {
  type: 'message';
  text: string; // Текст сообщения для отправки пользователю
  saveResponseToVariable?: string; // Имя переменной, куда сохранять ответ пользователя (опционально)
}

/**
 * Метаданные блока Сообщение
 */
export const MessageBlockMeta = {
  type: 'message' as const,
  label: 'Сообщение',
  icon: '💬',
  color: '#2196f3',
  description: 'Отправка текстового сообщения пользователю',
  hasInput: true,
  hasOutput: true,
  hasMultipleOutputs: false,
};
