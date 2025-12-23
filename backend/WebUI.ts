import { UI } from "./UI";

export class WebUI implements UI {
  private inputResolver: ((value: string) => void) | null = null;
  private fileResolver: ((value: string) => void) | null = null;
  private onMessageCallback: ((message: string, answers?: string[]) => void) | undefined = undefined;
  private onFinishCallback: (() => void) | undefined = undefined;
  private onInputRequestedCallback: (() => void) | undefined = undefined; // Колбэк когда запрошен ввод
  private onFileRequestedCallback: ((fileName: string) => void) | undefined = undefined; // Колбэк когда запрошен файл

  constructor(
    onMessage?: (message: string, answers?: string[]) => void, 
    onFinish?: () => void,
    onInputRequested?: () => void,
    onFileRequested?: (fileName: string) => void
  ) {
    this.onMessageCallback = onMessage;
    this.onFinishCallback = onFinish;
    this.onInputRequestedCallback = onInputRequested;
    this.onFileRequestedCallback = onFileRequested;
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

  async getFile(pathToSave: string, name: string): Promise<string> {
    // Сообщаем, что запрошен файл
    if (this.onFileRequestedCallback) {
      this.onFileRequestedCallback(name);
    }
    
    // Ожидаем загрузку файла от пользователя
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
    // Для WebUI удаление файла - это просто сообщение
    if (this.onMessageCallback) {
      this.onMessageCallback(`🗑️ Файл удален: ${path}`, []);
    }
  }
}
