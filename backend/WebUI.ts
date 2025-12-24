import { UI } from "./UI";

export class WebUI implements UI {
  private inputResolver: ((value: string) => void) | null = null;
  private fileResolver: ((value: string) => void) | null = null;
  private onMessageCallback: ((message: string, answers?: string[]) => void) | undefined = undefined;
  private onFinishCallback: (() => void) | undefined = undefined;
  private onInputRequestedCallback: (() => void) | undefined = undefined; 
  private onFileRequestedCallback: ((fileName: string) => void) | undefined = undefined; 

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
    
    if (this.onMessageCallback) {
      this.onMessageCallback(` Файл отправлен: ${path}`, []);
    }
  }

  async getFile(pathToSave: string, name: string): Promise<string> {
    
    if (this.onFileRequestedCallback) {
      this.onFileRequestedCallback(name);
    }
    
    
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
    
    if (this.onMessageCallback) {
      this.onMessageCallback(` Файл удален: ${path}`, []);
    }
  }

  isWaitingForInput(): boolean {
    return this.inputResolver !== null;
  }
}
