# Формат патчей для синхронизации

## Общий формат

Используется стандарт **JSON Patch (RFC 6902)** для описания изменений в проекте.

Патч представляет собой массив операций:
```json
[
  { "op": "operation", "path": "/path/to/field", "value": "new value" }
]
```

## Поддерживаемые операции

### `add` - добавление элемента
```json
{
  "op": "add",
  "path": "/blocks/-",
  "value": {
    "id": "block-123",
    "type": "blockNode",
    "position": { "x": 100, "y": 200 },
    "data": { "type": "message", "label": "Сообщение", "text": "Привет" }
  }
}
```

### `remove` - удаление элемента
```json
{
  "op": "remove",
  "path": "/blocks/0"
}
```

### `replace` - замена значения
```json
{
  "op": "replace",
  "path": "/blocks/0/data/text",
  "value": "Новое сообщение"
}
```

### `move` - перемещение элемента
```json
{
  "op": "move",
  "from": "/blocks/0",
  "path": "/blocks/-"
}
```

## Примеры патчей для операций редактора

### Добавление блока
```json
[
  {
    "op": "add",
    "path": "/blocks/-",
    "value": {
      "id": "block-new",
      "type": "blockNode",
      "position": { "x": 250, "y": 100 },
      "data": { "type": "message", "label": "Сообщение", "text": "Текст" }
    }
  }
]
```

### Обновление блока
```json
[
  {
    "op": "replace",
    "path": "/blocks/0/data/text",
    "value": "Обновленный текст"
  }
]
```

### Удаление блока
```json
[
  {
    "op": "remove",
    "path": "/blocks/0"
  }
]
```

### Добавление соединения
```json
[
  {
    "op": "add",
    "path": "/connections/-",
    "value": {
      "id": "conn-1",
      "source": "block-1",
      "target": "block-2"
    }
  }
]
```

### Удаление соединения
```json
[
  {
    "op": "remove",
    "path": "/connections/0"
  }
]
```

### Обновление настроек проекта
```json
[
  {
    "op": "replace",
    "path": "/exportPlatform",
    "value": "telegram"
  }
]
```

## Структура проекта

```json
{
  "id": "project-id",
  "name": "Project Name",
  "blocks": [
    {
      "id": "block-id",
      "type": "blockNode",
      "position": { "x": 100, "y": 200 },
      "data": { /* block data */ }
    }
  ],
  "connections": [
    {
      "id": "conn-id",
      "source": "block-id-1",
      "target": "block-id-2"
    }
  ],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Content-Type

Для отправки патчей используется заголовок:
```
Content-Type: application/json-patch+json
```

## Конфликты

При применении патчей используется стратегия **last-write-wins** - последний примененный патч имеет приоритет.
