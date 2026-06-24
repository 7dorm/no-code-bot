import {Engine} from "./Engine";
import {TelegramUI} from "./TelegramUI";
import { Telegraf } from 'telegraf';
import {loadBotConfig} from "./configLoader";

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

    const {nodes, globalConstants} = loadBotConfig("./test/test.json");

    const ui = new TelegramUI(ctx);
    const eng = new Engine(ui, nodes, globalConstants);

    userStates.set(chatId, { eng, ui });

    await ctx.reply('Bot started!');
    
    
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
        await ctx.reply('Press /start.');
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
        await ctx.answerCbQuery('Unsupported query type');
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
        const fileName = document.file_name || `file_${Date.now()}`;
        await state.ui.handleUserFile(document.file_id, fileName, false);
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
            const fileName = `photo_${Date.now()}.jpg`;
            await state.ui.handleUserFile(largestPhoto.file_id, fileName, true);
        }
    }
});

bot.launch();
console.log('Telegram bot started...');
