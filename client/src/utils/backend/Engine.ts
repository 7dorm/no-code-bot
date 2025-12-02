import { UI } from "./UI";
import { evaluateCondition } from '../../components/Editor/BlockNode';

/**
 * Интерфейс узла для Engine
 */
export interface EngineNode {
  id: string;
  Type: 'output' | 'condition' | 'start' | 'variable' | 'skip' | 'end';
  Text?: string;
  VarName?: string;
  VarType?: string;
  Nexts: string[];
  Cond?: string[];
  skip?: boolean;
  Answers?: string[];
  VariableName?: string; // Для variable блоков
  VariableValue?: string; // Для variable блоков
}

/**
 * Улучшенная функция оценки условий
 */
function evalCondition(condStr: string, variables: Record<string, any>, userInput: string = ''): boolean {
  if (condStr === "default") return true;
  
  // Подмена переменных в фигурных скобках
  let processedCond = condStr;
  const matches = [...condStr.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
  matches.forEach((match: string) => {
    if (variables[match] !== undefined) {
      processedCond = processedCond.replace(`{${match}}`, String(variables[match]));
    }
  });

  // Заменяем userInput на фактический ввод пользователя
  processedCond = processedCond.replace(/\buserInput\b/g, userInput);

  // Простая проверка на сравнение чисел
  const numMatch = processedCond.match(/^\s*(\d+)\s*([<>]=?|==|!=)\s*(\d+)\s*$/);
  if (numMatch) {
    const left = Number(numMatch[1]);
    const op = numMatch[2];
    const right = Number(numMatch[3]);

    switch (op) {
      case ">": return left > right;
      case "<": return left < right;
      case ">=": return left >= right;
      case "<=": return left <= right;
      case "==": return left == right;
      case "!=": return left != right;
    }
  }

  // Проверка на contains
  if (processedCond.toLowerCase().includes('contains')) {
    const parts = processedCond.toLowerCase().split('contains');
    if (parts.length === 2) {
      const left = parts[0].trim();
      const right = parts[1].trim().replace(/['"]/g, '');
      const leftValue = variables[left] || left || userInput;
      return String(leftValue).toLowerCase().includes(right.toLowerCase());
    }
  }

  // Проверка на равенство строк
  if (processedCond.includes('===') || processedCond.includes('==')) {
    const [left, right] = processedCond.split(/===|==/).map(s => s.trim().replace(/['"]/g, ''));
    const leftValue = variables[left] !== undefined ? String(variables[left]) : left;
    const rightValue = variables[right] !== undefined ? String(variables[right]) : right;
    return leftValue === rightValue;
  }

  return Boolean(processedCond);
}

export class Engine {
  private nodeStructure: Record<string, EngineNode> = {};
  private variables: Record<string, any> = {};
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
      this.index = botStructure[0].id;
    }
  }

  // Основной обработчик структуры бота
  async execute(skipFirstInput: boolean = false): Promise<void> {
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
    matches.forEach((match: string) => {
      if (this.variables[match] !== undefined) {
        processedText = processedText.replace(`{{${match}}}`, String(this.variables[match]));
      }
    });

    // Отправляем сообщение сразу
    await this.ui.sendMessage(processedText, block.Answers || []);

    // Сохранить в переменную если необходимо (тогда ждем ввода)
    if (block.VarName != null) {
      this.saveNext = true;
      this.saveName = block.VarName;
      this.saveType = block.VarType || 'string';
      
      // Переходим к следующему блоку, но перед его выполнением получим ввод
      if (block.Nexts.length > 0) {
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
    this.index = block.Nexts[0];

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

