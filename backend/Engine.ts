import {UI} from "./UI";

function evalCondition(condStr: string): boolean {
    if (condStr === "default") return true;
    const match = condStr.match(/^\s*(\d+)\s*([<>]=?|==|!=)\s*(\d+)\s*$/);
    if (!match) throw new Error(`Invalid condition: ${condStr}`);

    const left = Number(match[1]);
    const op = match[2];
    const right = Number(match[3]);

    switch (op) {
        case ">":
            return left > right;
        case "<":
            return left < right;
        case ">=":
            return left >= right;
        case "<=":
            return left <= right;
        case "==":
            return left == right;
        case "!=":
            return left != right;
        default:
            throw new Error(`Unknown operator: ${op}`);
    }
}

export class Engine {
    private nodeStructure: {} = {};
    private maxIndex = 0;
    private variables: {} = {
        "": ""
    };
    private ui: UI;
    private index = 9999;
    private saveNext = false;
    private saveName = "";
    private skipInput = false;
    private saveType = "";

    constructor(ui: UI, botStructure: []) {
        botStructure.forEach((ele: {}) => {
            // @ts-ignore
            this.index = Math.min(this.index, ele["id"]);
            // @ts-ignore
            this.nodeStructure[ele["id"]] = ele;
            // @ts-ignore
            this.maxIndex = Math.max(this.maxIndex, ele["id"]);
        });
        this.ui = ui;
    }

    // Основной обработчик структуры бота
    async execute(skip: boolean = false): Promise<void> {
        if (skip) return;
        let userInput = "";

        // @ts-ignore
        const block = this.nodeStructure[this.index];

        // Проверка на необходимость пользовательского ввода
        if (!this.skipInput) {
            userInput = await this.ui.getInput();
            // @ts-ignore
            this.variables['lastMessage'] = userInput;
        } else {
            // @ts-ignore
            userInput = this.variables['lastMessage'];
            this.skipInput = false;
        }

        // Сохранение пользовательского ввода в переменную
        if (this.saveNext) {
            switch (this.saveType) {
                case ("int"):
                    // @ts-ignore
                    this.variables[this.saveName] = parseInt(userInput, 10);
                    break;
                default:
                    // @ts-ignore
                    this.variables[this.saveName] = userInput;
                    break;
            }
            this.saveNext = false;
            this.saveName = "";
            this.saveType = "";
        }

        // Обработка типа блока
        switch (block["Type"]) {
            case ("output"):
                await this.executeMessage(userInput);
                break;
            case ("condition"):
                await this.executeCondition(userInput);
                break;
            case ("request"):
                break;
            default:
                break;
        }

    }

    async executeMessage(msg: string): Promise<void> {
        // @ts-ignore
        let block = this.nodeStructure[this.index];
        this.ui.sendMessage(
            block["Text"],
            block["Answers"] ? block["Answers"] : []);

        // Последнее сообщение
        if (block["Nexts"].length == 0) {
            this.ui.finish();
            return;
        }

        // Сохранить в переменную если необходимо
        if (block["VarName"] != null) {
            this.saveNext = true;
            this.saveName = block["VarName"];
            this.saveType = block["VarType"];
        }

        // Переход к следующему блоку
        this.index = block["Nexts"][0];

        // Перейти к исполнению следующего блока без пользовательского ввода
        if (block["skip"] != null && block["skip"]) {
            this.skipInput = true;
            this.execute();
        }
    }

    // Проверка условных блоков
    async executeCondition(msg: string): Promise<void> {
        let successfulCond = -1;

        // @ts-ignore
        const block = this.nodeStructure[this.index];

        // Проход по всем условиям
        for (let i = 0; i < block["Cond"].length; i++) {
            let cond = block["Cond"][i];
            successfulCond++;

            // подмена переменных заключеных в "{}"
            const matches = [...cond.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
            matches.forEach((match: string) => {
                // @ts-ignore
                if (this.variables[match] != null) {
                    // @ts-ignore
                    cond = cond.replace("{" + match + "}", this.variables[match]);
                }
            })

            if (evalCondition(cond)) break;
        }

        // Переход к следующему блоку
        // @ts-ignore
        this.index = this.nodeStructure[this.index]["Nexts"][successfulCond];

        // Перейти к исполнению следующего блока без пользовательского ввода
        this.skipInput = true;
        this.execute();
    }
}
