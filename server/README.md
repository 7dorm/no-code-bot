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

### Основные endpoint'ы

#### `POST /api/ai/complete`

Mock endpoint для preview AI Router и AI Extractor. Если в настройках проекта указан этот endpoint, AI-блоки получают структурированный результат через сервер.

Поддерживаемые режимы:
- `router` - выбирает route из списка `routes`
- `extractor` - извлекает сущности из списка `entities`

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
