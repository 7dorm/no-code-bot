# No-Code Bot Server

В папке `server` теперь живут две роли:

- mock API сервер для локального preview и загрузки файлов;
- `engine-manager` для совместного режима из ветки `ochir_task`.

## Установка зависимостей

```bash
npm install
```

## Запуск mock API

```bash
npm start
```

По умолчанию сервер слушает `http://localhost:3003`.

Если порт занят, можно переопределить его:

```bash
PORT=3013 npm start
```

### Основные endpoint'ы

#### `POST /api/ai/complete`

Mock endpoint для preview AI Router и AI Extractor. Если в настройках проекта указан этот endpoint, AI-блоки получают структурированный результат через сервер.

Поддерживаемые режимы:
- `router` - выбирает route из списка `routes`
- `extractor` - извлекает сущности из списка `entities`
- `assistant` - отвечает на обычные вопросы, распознаёт специальные темы, извлекает сущности и возвращает кнопки

Для `provider: "openaiCompatible"` endpoint вызывает OpenAI-compatible API. Для Yandex AI Studio рабочий формат такой:

```json
{
  "aiSettings": {
    "provider": "openaiCompatible",
    "endpoint": "http://localhost:3003/api/ai/complete",
    "apiKey": "...",
    "baseUrl": "https://llm.api.cloud.yandex.net/v1",
    "model": "gpt://folder-id/yandexgpt-lite"
  }
}
```

Для `provider: "yandex-alice"` или `provider: "yandexgpt"` endpoint попробует вызвать Yandex AI Studio через Foundation Models API.

```json
{
  "aiSettings": {
    "provider": "yandex-alice",
    "endpoint": "http://localhost:3003/api/ai/complete",
    "apiKey": "...",
    "iamToken": "",
    "folderId": "...",
    "modelUri": "",
    "model": "yandexgpt/latest"
  }
}
```

Вместо `apiKey` можно использовать `iamToken`. Модель по умолчанию собирается как `gpt://{folderId}/{model}`; её можно переопределить через `modelUri`. Переменные окружения `YANDEX_API_KEY`, `YANDEX_IAM_TOKEN`, `YANDEX_FOLDER_ID` и `YANDEX_MODEL_URI` остаются запасным вариантом для старых запусков, если в проекте эти поля пустые.

`assistant` ожидает от модели только JSON:

```json
{
  "message": "текст ответа пользователю",
  "intent": "chat или route.id",
  "isSpecialTopic": false,
  "confidence": 0.0,
  "reason": "коротко",
  "entities": {
    "entityName": {
      "value": null,
      "confidence": 0.0,
      "found": false
    }
  },
  "missing": [],
  "buttons": []
}
```

Если Yandex credentials не заданы или запрос не удался, сервер вернёт mock-ответ на локальных эвристиках, чтобы можно было проверить конфиг без внешнего API.

#### `POST /api/upload?path=/patients/`

Загружает файл на сервер и сохраняет его в указанную папку относительно корня проекта.

## Запуск engine-manager

```bash
npm run start:manager
```

По умолчанию `engine-manager` слушает `http://localhost:3004`.

Можно переопределить порт:

```bash
ENGINE_MANAGER_PORT=3010 npm run start:manager
```

### API engine-manager

#### `POST /api/NewConf`
#### `POST /api/configs`

Создаёт новый конфиг и новый активный runtime.

#### `GET /api/GetConf/:id`
#### `GET /api/configs/:id`

Возвращает конфиг и метаинформацию runtime.

#### `PATCH /api/ApplyPatch/:id`
#### `PATCH /api/configs/:id`

Поддерживает JSON Patch и Merge Patch, после чего пересобирает runtime и увеличивает `revision`.

#### `DELETE /api/DeleteConf/:id`
#### `DELETE /api/configs/:id`

Удаляет конфиг и соответствующий runtime.

#### `GET /api/configs`

Возвращает короткий список всех активных runtime.

#### `GET /health`

Проверка, что сервис поднят.
