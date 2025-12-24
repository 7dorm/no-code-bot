export interface UI {
    sendMessage(msg: string, answers: string[]): Promise<void>;
    sendFile(path: string): void;
    getInput(): Promise<string>;
    getFile(pathToSave: string, name: string): Promise<string>;
    deleteFile(path: string): void;
    finish(): void;
}