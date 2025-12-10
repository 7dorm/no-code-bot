export interface UI {
    sendMessage(msg: string, answers: string[]): string|void;
    sendFile(path: string): void;
    getInput(): Promise<string>;
    getFile(pathToSave: string, name: string): string;//returns unique name for user
    deleteFile(path: string): void;
    finish(): void;
}