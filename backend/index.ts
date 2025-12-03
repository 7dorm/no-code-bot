import {Engine} from "./Engine";
import {TelegramUI} from "./TelegramUI";
import {readFileSync} from "node:fs";
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

    const raw = readFileSync("./test/test1.json", "utf-8");
    const data = JSON.parse(raw);

    const ui = new TelegramUI(ctx);
    const eng = new Engine(ui, data);

    userStates.set(chatId, { eng, ui });

    await ctx.reply('Bot started!');
});

bot.on('text', (ctx) => {
    if (!ctx.chat) return;
    const chatId = ctx.chat.id;
    const state = userStates.get(chatId);

    if (!state) {
        ctx.reply('Press /start.');
        return;
    }

    if (ctx.message.text === '/start') {
        return;
    }

    state.eng.execute();
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
        state.eng.execute();
        state.ui.handleUserMessage(data);
    } else {
        await ctx.answerCbQuery('Unsupported query type');
    }
});


bot.launch();
console.log('Telegram bot started...');
