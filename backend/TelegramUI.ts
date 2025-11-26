import { Telegraf, Context } from 'telegraf';
import * as path from 'path';
import { UI } from './Engine';
import { Engine } from './Engine';

interface UserState {
  eng: Engine;
  ui: TelegramUI;
}

const userStates = new Map<number, UserState>();
const BOT_TOKEN = process.env.BOT_TOKEN;
const flowPathRaw = process.env.FLOW_PATH;
const FLOW_PATH = flowPathRaw
  ? path.resolve(process.cwd(), flowPathRaw)
  : path.resolve(__dirname, 'test', 'test2.json');

export class TelegramUI implements UI {
  private ctx: Context;
  private stop = false;
  private inputResolver: ((value: string) => void) | null = null;

  constructor(ctx: Context) {
    this.ctx = ctx;
  }

  async PrintMessage(message: string, answers: string[] = []): Promise<void|string> {
    if (answers.length > 0) {
      const keyboard = {
        inline_keyboard: answers.map(a => [{ text: a, callback_data: a }])
      };
      await this.ctx.reply(message, { reply_markup: keyboard });
    } else {
      await this.ctx.reply(message);
    }
  }

  async GetInput(): Promise<string> {
    return new Promise((resolve) => {
      this.inputResolver = resolve;
    });
  }

  Finish(): void {
    this.stop = true;
  }

  Is_done(): boolean {
    return this.stop;
  }

  handleUserMessage(text: string): void {
    if (this.inputResolver) {
      this.inputResolver(text);
      this.inputResolver = null;
    }
  }
}

if (!BOT_TOKEN) {
  throw new Error('Не указан BOT_TOKEN в переменных окружения');
}

const bot = new Telegraf(BOT_TOKEN);

bot.start(async (ctx) => {
  if (!ctx.chat) return;
  const chatId = ctx.chat.id;

  const ui = new TelegramUI(ctx);
  const eng = new Engine(FLOW_PATH, ui);

  userStates.set(chatId, { eng, ui });

  await ctx.reply('Bot started!');

  // Не держим обработчик /start открытым — запускаем цикл отдельно.
  (async () => {
    try {
      while (!ui.Is_done()) {
        await eng.next_node();
      }
      await ctx.reply('End.');
    } catch (err) {
      console.error(err);
      await ctx.reply('Произошла ошибка. Попробуйте позже.');
    } finally {
      userStates.delete(chatId);
    }
  })();
});

bot.on('text', (ctx) => {
  if (!ctx.chat) return;
  const chatId = ctx.chat.id;
  const state = userStates.get(chatId);

  if (!state) {
    ctx.reply('Press /start.');
    return;
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


bot.launch();
console.log('Telegram bot started...');
