import { Project } from '../types';
import { adaptProjectToEngine } from './backend/projectAdapter';
import engineSource from '@backend/Engine.ts?raw';
import uiSource from '@backend/UI.ts?raw';
import telegramUISource from '@backend/TelegramUI.ts?raw';

export interface TelegramExportFile {
  name: string;
  content: string;
}

export interface TelegramExportResult {
  files: TelegramExportFile[];
}

// Функция для получения содержимого Engine.ts
function getEngineTsContent(): string {
  return engineSource;
}

function getUITsContent(): string {
  return uiSource;
}

function getTelegramUITsContent(): string {
  return telegramUISource;
}

function createIndexTs(): string {
  return `import {Engine} from "./Engine";
import {TelegramUI} from "./TelegramUI";
import {readFileSync} from "node:fs";
import 'dotenv/config';
import { Telegraf } from 'telegraf';

interface UserState {
    eng: Engine;
    ui: TelegramUI;
}

const userStates = new Map<number, UserState>();
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
    throw new Error('Не указан BOT_TOKEN в переменных окружения');
}

const bot = new Telegraf(BOT_TOKEN);

bot.start(async (ctx) => {
    if (!ctx.chat) return;
    const chatId = ctx.chat.id;

    const raw = readFileSync("./project.json", "utf-8");
    const data = JSON.parse(raw);

    const ui = new TelegramUI(ctx);
    const eng = new Engine(ui, data, {});

    userStates.set(chatId, { eng, ui });

    await ctx.reply('Бот запущен!');
    
    (async () => {
        try {
            await eng.execute(true);
        } catch (error) {
            console.error('Ошибка выполнения бота:', error);
        }
    })();
});

bot.on('text', async (ctx) => {
    if (!ctx.chat) return;
    const chatId = ctx.chat.id;
    const state = userStates.get(chatId);

    if (!state) {
        await ctx.reply('Нажмите /start для начала работы.');
        return;
    }

    if (ctx.message.text === '/start') {
        return;
    }

    const isWaitingForInput = state.ui.isWaitingForInput();
    if (!isWaitingForInput) {
        (async () => {
            try {
                await state.eng.execute();
            } catch (error) {
                console.error('Ошибка выполнения бота:', error);
            }
        })();
    }
    
    state.ui.handleUserMessage(ctx.message.text);
});

bot.on('callback_query', async (ctx) => {
    if (!ctx.chat) return;
    const chatId = ctx.chat.id;
    const state = userStates.get(chatId);
    if (!state) return;

    if ('data' in ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        await ctx.answerCbQuery();
        state.ui.handleUserMessage(data);
    } else {
        await ctx.answerCbQuery('Неподдерживаемый тип запроса');
    }
});

bot.on('document', async (ctx) => {
    if (!ctx.chat) return;
    const chatId = ctx.chat.id;
    const state = userStates.get(chatId);
    
    if (!state) {
        await ctx.reply('Пожалуйста, начните с команды /start');
        return;
    }

    const document = ctx.message.document;
    if (document && document.file_id) {
        const fileName = document.file_name || \`file_\${Date.now()}\`;
        state.ui.handleUserFile(fileName);
    }
});

bot.on('photo', async (ctx) => {
    if (!ctx.chat) return;
    const chatId = ctx.chat.id;
    const state = userStates.get(chatId);
    
    if (!state) {
        await ctx.reply('Пожалуйста, начните с команды /start');
        return;
    }

    const photos = ctx.message.photo;
    if (photos && photos.length > 0) {
        const largestPhoto = photos[photos.length - 1];
        if (largestPhoto && largestPhoto.file_id) {
            const fileName = \`photo_\${Date.now()}.jpg\`;
            state.ui.handleUserFile(fileName);
        }
    }
});

bot.launch();
console.log('Telegram bot started...');
`;
}

// Функция для создания package.json
function createPackageJson(projectName: string): string {
  return JSON.stringify({
    "name": projectName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    "version": "1.0.0",
    "description": "Telegram bot created with no-code-bot",
    "main": "index.ts",
    "scripts": {
      "start": "ts-node index.ts",
      "build": "tsc",
      "dev": "ts-node-dev --respawn index.ts"
    },
    "keywords": ["telegram", "bot"],
    "author": "",
    "license": "ISC",
    "dependencies": {
      "dotenv": "^16.4.5",
      "telegraf": "^4.16.3",
      "typescript": "^5.9.3",
      "node-fetch": "^2.7.0"
    },
    "devDependencies": {
      "@types/node": "^24.9.1",
      "ts-node": "^10.9.2",
      "ts-node-dev": "^2.0.0"
    }
  }, null, 2);
}

// Функция для создания tsconfig.json
function createTsConfigJson(): string {
  return JSON.stringify({
    "compilerOptions": {
      "module": "commonjs",
      "target": "ES2020",
      "types": ["node"],
      "sourceMap": true,
      "declaration": true,
      "declarationMap": true,
      "noUncheckedIndexedAccess": true,
      "exactOptionalPropertyTypes": true,
      "strict": true,
      "jsx": "preserve",
      "verbatimModuleSyntax": false,
      "isolatedModules": false,
      "noUncheckedSideEffectImports": true,
      "moduleDetection": "force",
      "skipLibCheck": true,
      "moduleResolution": "node",
      "esModuleInterop": true
    }
  }, null, 2);
}

// Функция для создания README.md
function createReadme(projectName: string, hasToken: boolean): string {
  const tokenInstructions = hasToken 
    ? `2. Файл \`.env\` уже создан с токеном бота из проекта. Если нужно изменить токен, отредактируйте файл \`.env\`.`
    : `2. Создайте файл \`.env\` в корне проекта и добавьте ваш токен бота:
\`\`\`
BOT_TOKEN=ваш_токен_бота
\`\`\`

Чтобы получить токен бота:
1. Найдите [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте команду /newbot
3. Следуйте инструкциям для создания бота
4. Скопируйте полученный токен в файл .env`;

  return `# ${projectName} - Telegram Bot

Этот проект был создан с помощью no-code-bot редактора.

## Установка

1. Установите зависимости:
\`\`\`bash
npm install
\`\`\`

${tokenInstructions}

## Запуск

Для запуска бота в режиме разработки:
\`\`\`bash
npm run dev
\`\`\`

Для запуска бота в продакшене:
\`\`\`bash
npm start
\`\`\`

## Структура проекта

- \`index.ts\` - главный файл для запуска бота
- \`Engine.ts\` - движок выполнения логики бота
- \`TelegramUI.ts\` - интерфейс для работы с Telegram API
- \`UI.ts\` - базовый интерфейс UI
- \`project.json\` - структура проекта (блоки и связи)

## Дополнительная информация

Проект использует:
- [Telegraf](https://telegraf.js.org/) - библиотека для работы с Telegram Bot API
- TypeScript для типобезопасности
- Node.js для выполнения

При возникновении проблем проверьте:
1. Правильность токена бота в .env
2. Установлены ли все зависимости (npm install)
3. Версию Node.js (рекомендуется 18+)
`;
}

// Функция для создания .env.example
function createEnvExample(token?: string): string {
  if (token) {
    return `BOT_TOKEN=${token}
`;
  }
  return `BOT_TOKEN=ваш_токен_бота_здесь
`;
}

// Функция для создания .env (если токен есть)
function createEnv(token: string): string {
  return `BOT_TOKEN=${token}
`;
}

/**
 * Создает zip архив с полным проектом Telegram бота
 * @param project - Проект для экспорта
 * @returns Объект с массивом файлов для zip архива
 */
export function createTelegramExport(project: Project): TelegramExportResult {
  if (!project) {
    throw new Error('Проект не указан');
  }

  // Адаптируем проект к формату Engine
  const engineNodes = adaptProjectToEngine(project);
  const projectJson = JSON.stringify(engineNodes, null, 2);

  const projectName = project.name || 'telegram-bot';
  
  // Получаем токен из проекта (приоритет: telegramToken, затем botToken)
  const botToken = project.telegramToken || project.botToken;

  // Создаем все необходимые файлы
  const files: TelegramExportFile[] = [
    {
      name: 'Engine.ts',
      content: getEngineTsContent()
    },
    {
      name: 'UI.ts',
      content: getUITsContent()
    },
    {
      name: 'TelegramUI.ts',
      content: getTelegramUITsContent()
    },
    {
      name: 'index.ts',
      content: createIndexTs()
    },
    {
      name: 'package.json',
      content: createPackageJson(projectName)
    },
    {
      name: 'tsconfig.json',
      content: createTsConfigJson()
    },
    {
      name: 'project.json',
      content: projectJson
    },
    {
      name: 'README.md',
      content: createReadme(projectName, !!botToken)
    },
    {
      name: '.env.example',
      content: createEnvExample(botToken)
    }
  ];

  // Если токен есть, создаем также файл .env с токеном
  if (botToken) {
    files.push({
      name: '.env',
      content: createEnv(botToken)
    });
  }

  return { files };
}
