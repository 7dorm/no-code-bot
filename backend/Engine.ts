import * as fs from 'fs';

const input = "input"
const output = "output"

export interface UI {
  PrintMessage(message: string, answers: string[]): Promise<void|string>;
  GetInput(): Promise<string>;
  Finish(): void;
}

interface FlowNode {
  id: number;
  Type: "start" | "output" | "input" | "condition" | "Request";
  Nexts?: number[];

  //output
  Text?: string;
  Answers?: string[];
  File?: string[];

  //input
  ValType?: "string" | "int";
  VarName?: string;
  WrongFError?: string;

  //condition
  Cond?: string[];

  //Request
  Var?: string;
  BadStatErr?: string;
}

function evalCondition(condStr: string): boolean {
  if (condStr === "default") return true;
  const match = condStr.match(/^\s*(\d+)\s*([<>]=?|==|!=)\s*(\d+)\s*$/);
  if (!match) throw new Error(`Invalid condition: ${condStr}`);

  const left = Number(match[1]);
  const op = match[2];
  const right = Number(match[3]);

  switch(op) {
    case ">": return left > right;
    case "<": return left < right;
    case ">=": return left >= right;
    case "<=": return left <= right;
    case "==": return left == right;
    case "!=": return left != right;
    default: throw new Error(`Unknown operator: ${op}`);
  }
}

export class Engine {
  private ui: UI;
  private config: FlowNode[];
  private current_node: number = 1;
  private variables: { [key: string]: string | number };

  constructor(path: string, ui: UI) {
    this.ui = ui;

    if (fs.existsSync(path)) {
      const data = fs.readFileSync(path, "utf8");
      this.config = JSON.parse(data);
    } else {
      throw new Error(`Config file not found: ${path}`);
    }
    this.variables = {}
  }

  private parse_vars(text: string): string {
    return (text ?? "").replace(/\{(\w+)\}/g, (_, key) => {
        return String(this.variables[key] ?? `{${key}}`);
      })
  }

  private go_next(): void {
    const node = this.config[this.current_node-1]!;
    if (!node.Nexts || node.Nexts.length === 0) {
      this.ui.Finish();
      return
    }
    this.current_node = node.Nexts?.[0] ?? 0;
  }

  async next_node(): Promise<void> {
    //this.ui.PrintMessage("Current: " + String(this.current_node) + " Next: " + String(this.config[this.current_node-1]?.Nexts));
  const node = this.config[this.current_node-1];

  if (!node) {
    this.ui.PrintMessage("Ошибка: текущий узел не найден", []);
    this.ui.Finish();
    return;
  }

  switch (node.Type) {
    case "start":
      this.current_node = node.Nexts?.[0] ?? 0;
      break;

    case "output":
      const text = this.parse_vars(String(node.Text));

      if (node.Answers) {
        const answer = this.ui.PrintMessage(text, node.Answers);
        this.current_node = node.Nexts?.[node.Answers.findIndex(x => x === String(answer))] ?? 0;
      } else {
        this.ui.PrintMessage(text, []);
      }
      this.go_next();
      break;

    case "input":
      let value = await this.ui.GetInput();

      if (node.ValType === "int") {
        let num = Number(value);

        while (isNaN(num)) {
          this.ui.PrintMessage(node.WrongFError ?? "Invalid number", []);
          value = await this.ui.GetInput();
          num = Number(value);
        }

        this.variables[node.VarName!] = num;
      } else {
        this.variables[node.VarName!] = value;
      }

      
      this.go_next();
      break;

    case "condition":
      const idx = node.Cond!.findIndex(x => evalCondition(this.parse_vars(x)));
      
      this.current_node = node.Nexts?.[idx] ?? 0;
      break;

    default:
      this.ui.PrintMessage(`Unknown node type: ${node.Type}`, []);
      this.ui.Finish();
      return;
    }
  }

}
