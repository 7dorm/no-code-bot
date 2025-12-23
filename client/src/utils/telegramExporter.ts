import { Project } from '../types';

export interface TelegramBotCode {
  token: string;
  code: string;
}

function generateGlobalConstants(constants: Record<string, any>): string {
  let out = '';
  for (const [key, value] of Object.entries(constants)) {
    out += `const ${key} = ${JSON.stringify(value)}\n`;
  }
  return out;
}

function generateHandlersSection(): string {
  return `
async function handleMessage(chatId, text) {
  await bot.sendMessage(chatId, text);
}

async function handleCondition(condition, chatId, userId, userMessage) {
  // Упрощенная логика условий — всегда true
  return true;
}

async function handleBotFlow(chatId, userId, userMessage) {
  // TODO: Реализовать обход графа блоков на основе экспортированной конфигурации
  await handleMessage(chatId, 'Привет! Я бот, созданный в визуальном редакторе.');
}
`;
}

// Экспорт проекта в код для Telegram бота
export function exportToTelegram(project: Project): string {
  // Проверяем токен в разных полях для совместимости
  const token = project.telegramToken || project.botToken;
  if (!token) {
    throw new Error('Telegram token не установлен в настройках проекта');
  }

  const header = `// Генерированный код для Telegram бота\n// Проект: ${project.name}\n// Дата: ${new Date().toISOString()}\n\n`;
  const requires = `const TelegramBot = require('node-telegram-bot-api');\n\n`;
  const tokenLine = `const TOKEN = '${token}';\nconst bot = new TelegramBot(TOKEN, { polling: true });\n\n`;
  const globals = project.globalConstants ? generateGlobalConstants(project.globalConstants) + '\n' : '';
  const handlers = generateHandlersSection();
  const main = `
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text || '';
  try {
    await handleBotFlow(chatId, userId, text);
  } catch (error) {
    console.error('Ошибка в боте:', error);
    bot.sendMessage(chatId, '⚠️ Произошла ошибка при обработке вашего запроса');
  }
});

console.log('Бот запущен!');
`;

  return header + requires + tokenLine + globals + handlers + main;
}

// Создание архива для экспорта
export function createTelegramExport(project: Project): { code: string; instructions: string } {
  const code = exportToTelegram(project);
  
  const instructions = `# Инструкция по запуску бота

## Требования
- Node.js версии 14 или выше
- Telegram аккаунт

## Установка

1. Установите зависимости:
\`\`\`bash
npm install node-telegram-bot-api
\`\`\`

2. Замените \`TOKEN\` в файле на ваш токен от @BotFather

3. Запустите бота:
\`\`\`bash
node bot.js
\`\`\`

## Деплой на сервер

Для постоянного запуска используйте:
- Heroku
- VPS сервер
- Railway
- Render

## Поддержка

Если возникли проблемы, обратитесь к документации node-telegram-bot-api
https://github.com/yagop/node-telegram-bot-api
`;

  return { code, instructions };
}
