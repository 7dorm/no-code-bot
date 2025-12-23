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
    console.log(`\n📤 WebUI.sendMessage called:`);
    console.log(`   Message: "${message}"`);
    console.log(`   Answers:`, answers);
    console.log(`   Has callback:`, !!this.onMessageCallback);
    // #region agent log
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    fetch('http://127.0.0.1:7245/ingest/3dd875b0-2c9e-459b-8e6e-82c5c386ba6d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'WebUI.ts:23',message:'WebUI.sendMessage called',data:{messageId,messageLength:message.length,hasCallback:!!this.onMessageCallback,answersCount:answers.length,messagePreview:message.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
    // #endregion
    if (this.onMessageCallback) {
      console.log(`   ✅ Calling onMessageCallback`);
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/3dd875b0-2c9e-459b-8e6e-82c5c386ba6d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'WebUI.ts:26',message:'Calling onMessageCallback',data:{messageId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
      // #endregion
      this.onMessageCallback(message, answers);
      console.log(`   ✅ onMessageCallback completed`);
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/3dd875b0-2c9e-459b-8e6e-82c5c386ba6d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'WebUI.ts:29',message:'onMessageCallback completed',data:{messageId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
      // #endregion
    } else {
      console.error(`   ❌ No callback registered!`);
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
