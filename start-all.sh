#!/bin/bash

# Запуск сервера в фоне
cd server
if [ ! -d "node_modules" ]; then
  echo "Устанавливаем зависимости сервера..."
  npm install
fi
echo "Запускаем сервер на порту 3003..."
npm start &
SERVER_PID=$!

# Ждем немного, чтобы сервер запустился
sleep 2

# Запускаем клиент
cd ../client
if [ ! -d "node_modules" ]; then
  echo "Устанавливаем зависимости клиента..."
  npm install
fi
echo "Запускаем клиент..."
npm run dev

# При завершении убиваем сервер
trap "kill $SERVER_PID" EXIT

