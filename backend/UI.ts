export interface UI {
    sendMessage(msg: string, answers: []): Promise<void>;
    getInput(): Promise<string>;
    finish(): void;
}
