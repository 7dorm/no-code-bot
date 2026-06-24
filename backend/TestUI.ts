import {Engine} from "./Engine"
import {UI} from "./UI";
import * as readline from "readline";
import {loadBotConfig} from "./configLoader";

class ConsoleUi implements UI {
    private stop: boolean = false;

    private rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    async sendMessage(message: string, answers: string[]): Promise<void> {
        console.log(message);
        if (answers.length > 0) {
            console.log(`Варианты: ${answers.join(' | ')}`);
        }
    }

   async getInput(): Promise<string> {
        return new Promise(resolve => {
            this.rl.question("> ", answer => resolve(answer));
        });
    }

    async getFile(pathToSave: string, name: string): Promise<string> {
        console.log(` Пожалуйста, введите имя файла для загрузки: ${name}`);
        return new Promise(resolve => {
            this.rl.question("Имя файла: ", fileName => {
                const uniqueName = `${fileName}_${Date.now()}`;
                resolve(uniqueName);
            });
        });
    }

    sendFile(path: string): void {
        console.log(` Файл отправлен: ${path}`);
    }

    deleteFile(path: string): void {
        console.log(` Файл удален: ${path}`);
    }

    finish(): void {
        this.stop = true;
    }

    Is_done(): boolean {
        return this.stop;
    }
}

async function main() {
    console.log("Staring");
    const ui = new ConsoleUi();
    const {nodes, globalConstants} = loadBotConfig("./test/test.json");
    const eng = new Engine(ui, nodes, globalConstants);

    while (!ui.Is_done()) {
        await eng.execute();
    }
    console.log("Finish")
}

main();
