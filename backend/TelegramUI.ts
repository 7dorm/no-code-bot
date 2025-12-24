import { Context } from 'telegraf';
import { UI } from './UI';

export class TelegramUI implements UI {
  private ctx: Context;
  private stop = false;
  private inputResolver: ((value: string) => void) | null = null;
  private fileResolver: ((value: string) => void) | null = null;

  constructor(ctx: Context) {
    this.ctx = ctx;
  }

  async sendMessage(message: string, answers: string[] = []): Promise<void> {
    if (answers.length > 0) {
      const keyboard = {
        inline_keyboard: answers.map(a => [{ text: a, callback_data: a }])
      };
      await this.ctx.reply(message, { reply_markup: keyboard });
    } else {
      await this.ctx.reply(message);
    }
  }

  async getInput(): Promise<string> {
    return new Promise((resolve) => {
      this.inputResolver = resolve;
    });
  }

  finish(): void {
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

  async sendFile(path: string): Promise<void> {
    
    try {
      await this.ctx.replyWithDocument({ source: path });
    } catch (error) {
      await this.ctx.reply(`Ошибка отправки файла: ${path}`);
    }
  }

  async getFile(pathToSave: string, name: string): Promise<string> {
    
    await this.ctx.reply(` Пожалуйста, отправьте файл: ${name}`);
    
    
    return new Promise((resolve) => {
      this.fileResolver = resolve;
    });
  }

  handleUserFile(fileName: string): void {
    if (this.fileResolver) {
      const uniqueName = `${fileName}_${Date.now()}`;
      this.fileResolver(uniqueName);
      this.fileResolver = null;
    }
  }

  deleteFile(path: string): void {
    
    console.log(`Удаление файла: ${path}`);
  }
}


