import { Engine, UI } from "../Engine"
import * as fs from "fs";

// Мокируем fs.readFileSync для подгрузки нашего тестового конфига
jest.mock("fs");

const config = [
  { "id": 1, "Type": "start", "Nexts": [2] },
  { "id": 2, "Type": "output", "Text": "Are you handsome?", "Answers": ["Ugly", "Monster"], "Nexts": [3, 4] },
  { "id": 3, "Type": "output", "Text": "ugly", "Nexts": [5] },
  { "id": 4, "Type": "output", "Text": "monster", "Nexts": [5] },
  { "id": 5, "Type": "output", "Text": "bb", "Nexts": [] }
];

describe("Engine test with mock UI", () => {
  let uiMock: UI;
  let engine: Engine;
  let answersQueue: string[];

  beforeEach(() => {
    answersQueue = [];
    // Мокаем fs.existsSync и readFileSync
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(config));

    // Создаем мок UI
    uiMock = {
      PrintMessage: jest.fn(async () => {}),
      GetInput: jest.fn(async () => answersQueue.shift() ?? ""),
      Finish: jest.fn()
    };

    engine = new Engine("test2.json", uiMock);
  });

  it("should traverse the flow correctly choosing first answers", async () => {
    answersQueue.push("Ugly");

    await engine.next_node(); // start -> 2
    await engine.next_node(); // output node 2, "Ugly" -> 3
    await engine.next_node(); // output node 3 -> 5
    await engine.next_node(); // output node 5 -> Finish

    expect(uiMock.PrintMessage).toHaveBeenCalledWith("Are you handsome?", ["Ugly", "Monster"]);
    expect(uiMock.PrintMessage).toHaveBeenCalledWith("ugly", []);
    expect(uiMock.PrintMessage).toHaveBeenCalledWith("bb", []);

    expect(uiMock.Finish).toHaveBeenCalled();
  });

  it("should handle second answer correctly", async () => {
    answersQueue.push("Monster");

    await engine.next_node(); // start -> 2
    await engine.next_node(); // output node 2, "Monster" -> 4
    await engine.next_node(); // output node 4 -> 5
    await engine.next_node(); // output node 5 -> Finish

    expect(uiMock.PrintMessage).toHaveBeenCalledWith("Are you handsome?", ["Ugly", "Monster"]);
    expect(uiMock.PrintMessage).toHaveBeenCalledWith("monster", []);
    expect(uiMock.PrintMessage).toHaveBeenCalledWith("bb", []);
    expect(uiMock.Finish).toHaveBeenCalled();
  });
});
