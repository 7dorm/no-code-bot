#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  for pid in "$REMOTE_PID" "$ENGINE_MANAGER_PID" "$SERVER_PID"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}

trap cleanup EXIT INT TERM

# Запуск сервера в фоне
cd "$ROOT_DIR/server"
if [ ! -d "node_modules" ]; then
  echo "Устанавливаем зависимости сервера..."
  npm install
fi

echo "Запускаем mock API на порту 3003..."
npm start &
SERVER_PID=$!

echo "Запускаем engine-manager на порту 3004..."
npm run start:manager &
ENGINE_MANAGER_PID=$!

sleep 2

cd "$ROOT_DIR/remote-serv"
if ! command -v go >/dev/null 2>&1; then
  echo "Для collaborative режима нужен Go, но команда 'go' не найдена."
  exit 1
fi
echo "Подтягиваем зависимости remote-serv..."
go mod download
echo "Запускаем remote-serv на порту 8080..."
ENGINE_MANAGER_URL=http://localhost:4004 go run . &
REMOTE_PID=$!

sleep 2

cd "$ROOT_DIR/client"
if [ ! -d "node_modules" ]; then
  echo "Устанавливаем зависимости клиента..."
  npm install
fi
echo "Запускаем клиент..."
npm run dev -- --host 0.0.0.0
