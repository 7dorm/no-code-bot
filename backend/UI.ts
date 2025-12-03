export interface UI {
    sendMessage(msg: string, answers: string[]): Promise<void>;
    getInput(): Promise<string>;
    finish(): void;
}
