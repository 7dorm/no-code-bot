import { UI } from "./UI";

/**
 * Интерфейс узла для Engine
 */
export interface EngineNode {
  id: string;
  Type: 'output' | 'condition' | 'start' | 'variable' | 'FILE' | 'skip' | 'end';
  Text?: string;
  VarName?: string;
  VarType?: string;
  Nexts: string[];
  Cond?: string[];
  skip?: boolean;
  Answers?: string[];
  VariableName?: string; // Для variable блоков
  VariableValue?: string; // Для variable блоков

  FILEAct? : 'Upload' | 'DownLoad' | 'Delete';
  FileName?: string; // Для FILE блоков
  PathToSave?: string; // Для FILE блоков
  PathToFile?: string; // Для FILE блоков
}

/**
 * Функция оценки условий
 */
function evalCondition(condStr: string, variables: Record<string, any>, userInput: string = ''): boolean {
  if (condStr === "default") return true;

  // Подмена переменных в фигурных скобках
  let processedCond = condStr;
  const matches = [...condStr.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
  // @ts-ignore
  matches.forEach((match: string) => {
    if (variables[match] !== undefined) {
      processedCond = processedCond.replace(`{${match}}`, String(variables[match]));
    }
  });

  // Заменяем userInput на фактический ввод пользователя
  processedCond = processedCond.replace(/\buserInput\b/g, userInput);

  const orParts = processedCond.split('||').map(part => part.trim()).filter(Boolean);
  if (orParts.length > 0) {
    return orParts.some(orPart => {
      const andParts = orPart.split('&&').map(part => part.trim()).filter(Boolean);
      return andParts.every(part => evaluateSimpleCondition(part, variables, userInput));
    });
  }

  return evaluateSimpleCondition(processedCond, variables, userInput);
}

function evaluateSimpleCondition(cond: string, variables: Record<string, any>, userInput: string = ''): boolean {
  // Проверка на сравнение чисел 
  const numMatch = cond.match(/^\s*([\w{}]+)\s*([<>]=?|==|!=)\s*([\w{}]+)\s*$/);
  if (numMatch) {
    // @ts-ignore
    let leftStr = numMatch[1].replace(/[{}]/g, '');
    // @ts-ignore
    let rightStr = numMatch[3].replace(/[{}]/g, '');
    const op = numMatch[2];

    const left = variables[leftStr] !== undefined ? Number(variables[leftStr]) : Number(leftStr);
    const right = variables[rightStr] !== undefined ? Number(variables[rightStr]) : Number(rightStr);

    if (!isNaN(left) && !isNaN(right)) {
      switch (op) {
        case ">": return left > right;
        case "<": return left < right;
        case ">=": return left >= right;
        case "<=": return left <= right;
        case "==": return left == right;
        case "!=": return left != right;
      }
    }
  }

  // Проверка на contains
  if (cond.toLowerCase().includes('contains')) {
    const parts = cond.toLowerCase().split('contains');
    if (parts.length === 2) {
      // @ts-ignore
      const left = parts[0].trim();
      // @ts-ignore
      const right = parts[1].trim().replace(/['"]/g, '');
      const leftValue = variables[left] || left || userInput;
      return String(leftValue).toLowerCase().includes(right.toLowerCase());
    }
  }

  // Проверка на равенство строк
  if (cond.includes('===') || cond.includes('==')) {
    const [left, right] = cond.split(/===|==/).map(s => s.trim().replace(/['"]/g, ''));
    // @ts-ignore
    const leftValue = variables[left] !== undefined ? String(variables[left]) : left;
    // @ts-ignore
    const rightValue = variables[right] !== undefined ? String(variables[right]) : right;
    return leftValue === rightValue;
  }

  // Проверка на неравенство строк
  if (cond.includes('!==') || cond.includes('!=')) {
    const [left, right] = cond.split(/!==|!=/).map(s => s.trim().replace(/['"]/g, ''));
    // @ts-ignore
    const leftValue = variables[left] !== undefined ? String(variables[left]) : left;
    // @ts-ignore
    const rightValue = variables[right] !== undefined ? String(variables[right]) : right;
    return leftValue !== rightValue;
  }

  // Проверка на >= и <=
  if (cond.includes('>=')) {
    const [left, right] = cond.split('>=').map(s => s.trim());
    // @ts-ignore
    const leftValue = variables[left] !== undefined ? Number(variables[left]) : Number(left);
    // @ts-ignore
    const rightValue = variables[right] !== undefined ? Number(variables[right]) : Number(right);
    return !isNaN(leftValue) && !isNaN(rightValue) && leftValue >= rightValue;
  }

  if (cond.includes('<=')) {
    const [left, right] = cond.split('<=').map(s => s.trim());
    // @ts-ignore
    const leftValue = variables[left] !== undefined ? Number(variables[left]) : Number(left);
    // @ts-ignore
    const rightValue = variables[right] !== undefined ? Number(variables[right]) : Number(right);
    return !isNaN(leftValue) && !isNaN(rightValue) && leftValue <= rightValue;
  }

  // Проверка на > и <
  if (cond.includes('>')) {
    const [left, right] = cond.split('>').map(s => s.trim());
    // @ts-ignore
    const leftValue = variables[left] !== undefined ? Number(variables[left]) : Number(left);
    // @ts-ignore
    const rightValue = variables[right] !== undefined ? Number(variables[right]) : Number(right);
    return !isNaN(leftValue) && !isNaN(rightValue) && leftValue > rightValue;
  }

  if (cond.includes('<')) {
    const [left, right] = cond.split('<').map(s => s.trim());
    // @ts-ignore
    const leftValue = variables[left] !== undefined ? Number(variables[left]) : Number(left);
    // @ts-ignore
    const rightValue = variables[right] !== undefined ? Number(variables[right]) : Number(right);
    return !isNaN(leftValue) && !isNaN(rightValue) && leftValue < rightValue;
  }

  if (cond.trim().toLowerCase() === 'default') {
    return true;
  }

  return false;
}

export class Engine {
  private nodeStructure: Record<string, EngineNode> = {};
  private variables: Record<string, any> = {};
  private files: Record<string, any> = {};
  private ui: UI;
  private index: string | null = null;
  private saveNext = false;
  private saveName = "";
  private skipInput = false;
  private saveType = "";
  private isFinished = false;

  constructor(ui: UI, botStructure: EngineNode[]) {
    botStructure.forEach((ele: EngineNode) => {
      this.nodeStructure[ele.id] = ele;
      // Находим стартовый блок
      if (ele.Type === 'start' && !this.index) {
        this.index = ele.id;
      }
    });
    this.ui = ui;

    // Если нет явного стартового блока, берем первый
    if (!this.index && botStructure.length > 0) {
      // @ts-ignore
      this.index = botStructure[0].id;
    }
  }

  // Основной обработчик структуры бота
  async execute(skipFirstInput: boolean = false): Promise<void> {
    if (skipFirstInput) {
      this.skipInput = true;
    }
    // Проверяем, завершен ли бот
    if (this.isFinished || !this.index) {
      if (!this.index) {
        this.ui.finish();
      }
      return;
    }

    let userInput = "";

    const block = this.nodeStructure[this.index];
    if (!block) {
      this.ui.finish();
      this.isFinished = true;
      return;
    }

    // Сохранение пользовательского ввода в переменную (происходит перед обработкой блока)
    if (this.saveNext) {
      userInput = await this.ui.getInput();
      this.variables['lastMessage'] = userInput;
      this.variables['userInput'] = userInput;

      switch (this.saveType) {
        case "int":
          this.variables[this.saveName] = parseInt(userInput, 10);
          break;
        default:
          this.variables[this.saveName] = userInput;
          break;
      }
      this.saveNext = false;
      this.saveName = "";
      this.saveType = "";
    }

    // Обработка типа блока
    switch (block.Type) {
      case "output":
        await this.executeMessage();
        break;
      case "condition":
        // Для condition нужно получить ввод перед проверкой
        if (!this.skipInput) {
          userInput = await this.ui.getInput();
          this.variables['lastMessage'] = userInput;
          this.variables['userInput'] = userInput;
        } else {
          userInput = this.variables['lastMessage'] || '';
          this.skipInput = false;
        }
        await this.executeCondition(userInput);
        break;
      case "start":
        await this.executeStart();
        break;
      case "variable":
        await this.executeVariable();
        break;
      case "FILE":
        await this.executeFILE();
        break;
      case "skip":
        await this.executeSkip();
        break;
      case "end":
        this.ui.finish();
        this.isFinished = true;
        break;
      default:
        break;
    }
  }

  async executeStart(): Promise<void> {
    const block = this.nodeStructure[this.index!];
    if (!block) return;

    // Стартовый блок переходит к следующему без ожидания ввода
    if (block.Nexts.length > 0) {
      // @ts-ignore
      this.index = block.Nexts[0];
      this.skipInput = true;
      await this.execute();
    } else {
      this.ui.finish();
    }
  }

  async executeMessage(): Promise<void> {
    const block = this.nodeStructure[this.index!];
    if (!block) return;

    // Заменяем переменные в тексте сообщения
    let processedText = block.Text || '';
    const matches = [...processedText.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
    // @ts-ignore
    matches.forEach((match: string) => {
      if (this.variables[match] !== undefined) {
        processedText = processedText.replace(`{{${match}}}`, String(this.variables[match]));
      }
    });

    if (block.Answers){
        const answer = await this.ui.sendMessage(processedText, block.Answers || []);
        const ind = block.Answers.indexOf(answer!)
        if (ind == -1) throw "Unknown answer at block: " + this.index
        this.index = block.Nexts[ind]!;
    } else {
        await this.ui.sendMessage(processedText, block.Answers || []);

    // Сохранить в переменную если необходимо (тогда ждем ввода)
    if (block.VarName != null) {
      this.saveNext = true;
      this.saveName = block.VarName;
      this.saveType = block.VarType || 'string';

      // Переходим к следующему блоку, но перед его выполнением получим ввод
      if (block.Nexts.length > 0) {
        // @ts-ignore
        this.index = block.Nexts[0];
        // Продолжаем выполнение - следующий блок запросит ввод через saveNext
        await this.execute(false);
        return;
      } else {
        // Если нет следующего блока, ждем ввод и завершаем
        const userInput = await this.ui.getInput();
        this.variables['lastMessage'] = userInput;
        this.variables['userInput'] = userInput;
        switch (this.saveType) {
          case "int":
            this.variables[this.saveName] = parseInt(userInput, 10);
            break;
          default:
            this.variables[this.saveName] = userInput;
            break;
        }
        this.saveNext = false;
        this.saveName = "";
        this.saveType = "";
        this.ui.finish();
        this.isFinished = true;
        return;
      }
    }
    // Последнее сообщение
    if (block.Nexts.length == 0) {
      this.ui.finish();
      this.isFinished = true;
      return;
    }

    // Переход к следующему блоку
    // @ts-ignore
    this.index = block.Nexts[0];
  }


    // Перейти к исполнению следующего блока
    // Если следующий блок требует ввода, выполнение остановится на getInput()
    if (block.skip) {
      this.skipInput = true;
      await this.execute(false);
    } else {
      // Продолжаем выполнение следующего блока
      // Если он запросит ввод, выполнение автоматически остановится
      await this.execute(false);
    }
  }

  // Проверка условных блоков
  async executeCondition(msg: string): Promise<void> {
    const block = this.nodeStructure[this.index!];
    if (!block || !block.Cond) return;

    let successfulCond = -1;

    // Проход по всем условиям
    for (let i = 0; i < block.Cond.length; i++) {
      const cond = block.Cond[i];

      // @ts-ignore
      if (evalCondition(cond, this.variables, msg)) {
        successfulCond = i;
        break;
      }
    }

    // Если ни одно условие не выполнилось и есть дефолтная ветка
    if (successfulCond === -1 && block.Nexts.length > block.Cond.length) {
      successfulCond = block.Cond.length; // Дефолтная ветка
    }

    // Переход к следующему блоку
    if (successfulCond >= 0 && successfulCond < block.Nexts.length) {
      // @ts-ignore
      this.index = block.Nexts[successfulCond];
      this.skipInput = true;
      await this.execute();
    } else {
      this.ui.finish();
      this.isFinished = true;
    }
  }

  async executeVariable(): Promise<void> {
    const block = this.nodeStructure[this.index!];
    if (!block) return;

    // Обрабатываем установку переменной
    if (block.VariableName && block.VariableValue !== undefined) {
      let value = block.VariableValue;

      // Заменяем переменные в значении
      const matches = [...value.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
      // @ts-ignore
      matches.forEach((match: string) => {
        if (this.variables[match] !== undefined) {
          value = value.replace(`{{${match}}}`, String(this.variables[match]));
        }
      });

      // Пытаемся определить тип значения
      const numValue = Number(value);
      if (!isNaN(numValue) && value.trim() !== '') {
        this.variables[block.VariableName] = numValue;
      } else {
        this.variables[block.VariableName] = value;
      }
    }

    // Переходим к следующему блоку
    if (block.Nexts.length > 0) {
      // @ts-ignore
      this.index = block.Nexts[0];
      this.skipInput = true;
      await this.execute();
    } else {
      this.ui.finish();
      this.isFinished = true;
    }
  }

  async executeFILE(): Promise<void> {
  const block = this.nodeStructure[this.index!];
  if (!block) return;

  switch (block.FILEAct) {

    case 'Upload': {
      // Загрузка файла от пользователя
      const fileName = block.FileName || 'file';

      const uniqueName = this.ui.getFile(
        block.PathToSave || '',
        fileName
      );

      // Сохраняем имя файла в переменные
      this.files[fileName] = uniqueName;
      this.files['lastFile'] = uniqueName;
      break;
    }

    case 'DownLoad': {
      // Отдача файла пользователю
      if (!block.PathToFile) {
        throw new Error(`PathToFile is required for download in block ${this.index}`);
      }

      // Подмена переменных в пути
      let filePath = block.PathToFile;
      const matches = [...filePath.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);

      matches.forEach((match: string) => {
        if (this.files[match] !== undefined) {
          filePath = filePath.replace(`{{${match}}}`, String(this.files[match]));
        }
      });

      this.ui.sendFile(filePath);
      break;
    }

    case 'Delete': {
      // Удаление файла
      if (!block.PathToFile) {
        throw new Error(`PathToFile is required for delete in block ${this.index}`);
      }

      let filePath = block.PathToFile;
      const matches = [...filePath.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);

      matches.forEach((match: string) => {
        if (this.files[match] !== undefined) {
          filePath = filePath.replace(`{{${match}}}`, String(this.files[match]));
        }
      });

      this.ui.deleteFile(filePath);
      break;
    }

    default:
      throw new Error(`Unknown FILEAct in block ${this.index}`);
  }

  // Переход к следующему блоку
  if (block.Nexts.length > 0) {
    this.index = block.Nexts[0];
    this.skipInput = true;
    await this.execute();
  } else {
    this.ui.finish();
    this.isFinished = true;
  }
}


  async executeSkip(): Promise<void> {
    // Skip блоки просто переходят дальше
    const block = this.nodeStructure[this.index!];
    if (block && block.Nexts.length > 0) {
      // @ts-ignore
      this.index = block.Nexts[0];
      this.skipInput = true;
      await this.execute();
    }
  }

  // Получить переменные (для отладки)
  getVariables(): Record<string, any> {
    return { ...this.variables };
  }

  // Сброс состояния
  reset(): void {
    this.variables = {};
    this.isFinished = false;
    this.skipInput = false;
    this.saveNext = false;
  }
}
