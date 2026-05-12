# Docker Инструкция

## Запуск сервисов через Docker Compose

Для запуска всех сервисов (engine-manager и remote-serv) выполните:

```bash
docker-compose up -d
```

Это запустит:
- **engine-manager** на порту 3004
- **remote-serv** на порту 8080

## Остановка сервисов

```bash
docker-compose down
```

## Просмотр логов

```bash
# Логи всех сервисов
docker-compose logs -f

# Логи конкретного сервиса
docker-compose logs -f engine-manager
docker-compose logs -f remote-serv
```

## Ручная сборка и запуск

### Engine Manager (TypeScript)

```bash
cd server
docker build -t engine-manager .
docker run -p 3004:3004 engine-manager
```

### Remote Serv (Go)

```bash
cd remote-serv
docker build -t remote-serv .
docker run -p 8080:8080 -e ENGINE_MANAGER_URL=http://localhost:3004 remote-serv
```

## Переменные окружения

### Engine Manager
- `ENGINE_MANAGER_PORT` - порт (по умолчанию: 3004)

### Remote Serv
- `ENGINE_MANAGER_URL` - URL engine-manager (по умолчанию: http://engine-manager:3004)

## Подключение клиента

Для подключения клиента к remote-serv используйте:
- WebSocket URL: `ws://localhost:8080/create` (для создания новой сессии)
- WebSocket URL: `ws://localhost:8080/session/{token}` (для присоединения к существующей)
