# Engine Manager

Отдельный REST-сервис для хранения конфигов в памяти и пересборки активных `Engine`-runtime по `uuid`.

Сервис использует формат проекта редактора из `client/src/store/useEditorStore.ts` и при каждом создании или изменении конфига заново собирает runtime через `backend/Engine.ts`.

Важно: конфиги хранятся только в оперативной памяти. После перезапуска процесса они исчезают.

## Запуск

```bash
cd server
npm install
npm run start:manager
```

По умолчанию сервис слушает `http://localhost:3004`.

Можно переопределить порт:

```bash
ENGINE_MANAGER_PORT=3010 npm run start:manager
```

## API

### `POST /api/NewConf`
### `POST /api/configs`

Создаёт новый конфиг и новый активный runtime.

Если передать только `name`, сервис создаст стартовый проект с одним `start`-блоком.

Пример:

```bash
curl -X POST http://localhost:3004/api/NewConf \
  -H 'Content-Type: application/json' \
  -d '{"name":"My bot"}'
```

### `GET /api/GetConf/:id`
### `GET /api/configs/:id`

Возвращает конфиг и метаинформацию runtime:

- `revision`
- `compiledAt`
- `nodesCount`
- `blockCount`
- `connectionCount`

Пример:

```bash
curl http://localhost:3004/api/GetConf/<uuid>
```

### `PATCH /api/ApplyPatch/:id`
### `PATCH /api/configs/:id`

Поддерживает два формата:

1. JSON Patch (`application/json-patch+json`)
2. Merge Patch (`application/merge-patch+json` или обычный JSON-объект)

Пример JSON Patch:

```bash
curl -X PATCH http://localhost:3004/api/ApplyPatch/<uuid> \
  -H 'Content-Type: application/json-patch+json' \
  -d '[
    {
      "op":"add",
      "path":"/blocks/1",
      "value":{
        "id":"msg-1",
        "type":"blockNode",
        "position":{"x":250,"y":240},
        "data":{"type":"message","label":"Greeting","text":"Hello"}
      }
    }
  ]'
```

Пример Merge Patch:

```bash
curl -X PATCH http://localhost:3004/api/configs/<uuid> \
  -H 'Content-Type: application/merge-patch+json' \
  -d '{"name":"Renamed bot","globalConstants":{"clinic":"A1"}}'
```

После успешного патча сервис:

- применяет изменения к конфигу в памяти
- валидирует результат
- заново пересобирает runtime `Engine`
- увеличивает `revision`

### `DELETE /api/DeleteConf/:id`
### `DELETE /api/configs/:id`

Удаляет конфиг и соответствующий активный runtime.

Пример:

```bash
curl -X DELETE http://localhost:3004/api/DeleteConf/<uuid>
```

## Дополнительно

### `GET /api/configs`

Возвращает короткий список всех активных runtime.

### `GET /health`

Проверка, что сервис поднят.
