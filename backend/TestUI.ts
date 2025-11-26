import * as path from "path";
import {Engine, UI} from "./Engine"
import * as readline from "readline";

class console_ui implements UI {
  private stop: boolean = false;

  private rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

async PrintMessage(message: string, answers: string[]): Promise<string | void> {
  console.log(message);
  if (answers.length > 0) return "Unsupporting"; 
}

  
  GetInput(): Promise<string>{
    
    return new Promise(resolve => {
      this.rl.question("> ", answer => resolve(answer));
    });
  }

  Finish(): void{
    this.stop = true;
  }

  Is_done(): boolean{
    return this.stop;
  }
}

async function main() {
  console.log("Staring");
  const ui = new console_ui();
  const flowPath = path.resolve(__dirname, "test", "test2.json");
  const eng = new Engine(flowPath, ui);

  while (!ui.Is_done()) {
    await eng.next_node(); 
  }
    console.log("Finish")
}

main();
