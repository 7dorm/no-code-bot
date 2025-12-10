import { UI } from "./UI";

export class WebUI implements UI {
  private inputResolver: ((value: string) => void) | null = null;
  private onMessageCallback?: (message: string, answers?: string[]) => void;
  private onFinishCallback?: () => void;
  private onInputRequestedCallback?: () => void; // Колбэк когда запрошен ввод

  constructor(
    onMessage?: (message: string, answers?: string[]) => void, 
    onFinish?: () => void,
    onInputRequested?: () => void
  ) {
    this.onMessageCallback = onMessage;
    this.onFinishCallback = onFinish;
    this.onInputRequestedCallback = onInputRequested;
  }

  async sendMessage(message: string, answers: string[]): Promise<void> {
    if (this.onMessageCallback) {
      this.onMessageCallback(message, answers);
    }
  }

  async getInput(): Promise<string> {
    // Сообщаем, что запрошен ввод
    if (this.onInputRequestedCallback) {
      this.onInputRequestedCallback();
    }
    
    return new Promise((resolve) => {
      this.inputResolver = resolve;
    });
  }

  handleUserMessage(text: string): void {
    if (this.inputResolver) {
      this.inputResolver(text);
      this.inputResolver = null;
    }
  }

  finish(): void {
    if (this.onFinishCallback) {
      this.onFinishCallback();
    }
  }

  sendFile(path: string): void {
    // Для WebUI отправка файла - это просто сообщение
    if (this.onMessageCallback) {
      this.onMessageCallback(`📎 Файл отправлен: ${path}`, []);
    }
  }

  getFile(pathToSave: string, name: string): string {
    // Для WebUI возвращаем уникальное имя файла
    const uniqueName = `${name}_${Date.now()}`;
    if (this.onMessageCallback) {
      this.onMessageCallback(`📎 Файл получен: ${uniqueName}`, []);
    }
    return uniqueName;
  }

  deleteFile(path: string): void {
    // Для WebUI удаление файла - это просто сообщение
    if (this.onMessageCallback) {
      this.onMessageCallback(`🗑️ Файл удален: ${path}`, []);
    }
  }
}
