// WebUI.ts
import { UI } from "./Engine";

export class WebUI implements UI {
  async PrintMessage(message: string, answers: string[]): Promise<void> {
    console.log("PrintMessage:");
    console.log("  message:", message);
    console.log("  answers:", answers);
  }

  async GetInput(): Promise<string> {
    console.log("GetInput called — возвращаю заглушку 'test'");
    return "test"; // можно сделать любое значение
  }

  Finish(): void {
    console.log("Finish called — диалог завершён.");
  }
}
