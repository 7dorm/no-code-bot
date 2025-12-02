// WebUI.ts
import { UI } from "./UI";

export class WebUI implements UI {
  private inputResolver: ((value: string) => void) | null = null;

  async sendMessage(message: string, answers: string[]): Promise<void> {
    
  }

  async getInput(): Promise<string> {
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
    console.log("Диалог завершен.");
  }
}
