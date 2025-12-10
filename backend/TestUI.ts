import {Engine} from "./Engine"
import {UI} from "./UI";
import * as readline from "readline";
import {readFileSync} from "node:fs";

class ConsoleUi implements UI {
    private stop: boolean = false;

    private rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    async sendMessage(message: string, answers: string[]): Promise<void> {
        console.log(message);
        if (answers.length > 0) return;
    }

   async getInput(): Promise<string> {
        return new Promise(resolve => {
            this.rl.question("> ", answer => resolve(answer));
        });
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
    const raw = readFileSync("./test/test.json", "utf-8");
    const data = JSON.parse(raw);
    const eng = new Engine(ui, data, {});

    while (!ui.Is_done()) {
        await eng.execute();
    }
    console.log("Finish")
}

main();
