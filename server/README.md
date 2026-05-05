# No-Code Bot Server

Mock API сервер для тестирования ботов.

## Установка зависимостей

```bash
npm install
```

## Запуск сервера

```bash
npm start
```

Сервер запустится на порту 3003: http://localhost:3003

## API Endpoints

### AI-блоки

**POST** `/api/ai/complete`

Mock endpoint для preview AI Router и AI Extractor. Если в настройках проекта указан этот endpoint, AI-блоки смогут получать структурированный результат через сервер. Сейчас endpoint использует локальные эвристики без внешнего LLM.

Поддерживаемые режимы:
- `router` - выбирает route из списка `routes`;
- `extractor` - извлекает сущности из списка `entities`.

### Загрузка файлов

**POST** `/api/upload?path=/patients/`

Загружает файл на сервер и сохраняет его в указанную папку относительно корня проекта.

**Параметры:**
- `path` (query, опциональный) - путь для сохранения файла (например: `/patients/`, `/documents/`)
- `file` (form-data) - файл для загрузки

**Ответ:**
```json
{
  "success": true,
  "filename": "document-1234567890-123456789.pdf",
  "originalName": "document.pdf",
  "path": "patients/document-1234567890-123456789.pdf",
  "fullPath": "/path/to/project/patients/document-1234567890-123456789.pdf"
}
```

Файлы сохраняются в папку проекта (или указанную подпапку) с уникальным именем.
