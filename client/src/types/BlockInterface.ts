/**
 * Базовый интерфейс для всех блоков
 * Каждый тип блока должен расширять этот интерфейс
 */
export interface BlockInterface {
  type: string;
  label?: string;
}

