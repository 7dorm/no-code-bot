import { UI } from "./UI";

// Поддержка fetch для Node.js
declare global {
  var fetch: typeof import('node-fetch').default | undefined;
}

/**
 * Интерфейс узла для Engine
 */
export interface EngineNode {
  id: string;
  Type: 'output' | 'condition' | 'start' | 'variable' | 'FILE' | 'api' | 'skip' | 'script';
  Text?: string;
  VarName?: string;
  VarType?: string;
  Nexts: string[];
  Cond?: string[];
  skip?: boolean;
  Answers?: string[]; // Варианты ответов для выбора пользователем
  AnswersFromVariable?: string; // Имя переменной, содержащей массив для вариантов ответов
  AnswersPath?: string; // Путь к массиву в переменной (например, "data.times")
  VariableName?: string; // Для variable блоков
  VariableValue?: string; // Для variable блоков
  SaveNextToVariable?: string; // Для variable блоков - сохранить следующий ответ пользователя

  // API блоки
  ApiUrl?: string;
  ApiMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  ApiHeaders?: Record<string, string>;
  ApiBody?: string;
  ApiResponseVariable?: string; // Имя переменной для сохранения ответа
  ApiAnswersPath?: string; // Путь к массиву в ответе API для использования в качестве вариантов ответов
  ApiAnswersVariable?: string; // Имя переменной для сохранения массива вариантов ответов

  FILEAct? : 'Upload' | 'DownLoad' | 'Delete' | 'Read';
  FileName?: string; // Для FILE блоков
  PathToSave?: string; // Для FILE блоков
  PathToFile?: string; // Для FILE блоков

  // Script блоки
  ScriptCode?: string; // JavaScript код для выполнения
  ScriptReturnVariable?: string; // Имя переменной для сохранения результата
}

/**
 * Функция оценки условий
 */
function evalCondition(condStr: string, variables: Record<string, any>, userInput: string = '', globalConstants?: Record<string, any>): boolean {
  if (condStr === "default") return true;

  // Подмена переменных в фигурных скобках
  let processedCond = condStr;
  const matches = [...condStr.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
  // @ts-ignore
  matches.forEach((match: string) => {
    // Сначала проверяем переменные, затем глобальные константы
    if (variables[match] !== undefined && variables[match] !== null) {
      processedCond = processedCond.replace(`{${match}}`, String(variables[match]));
    } else if (globalConstants && globalConstants[match] !== undefined && globalConstants[match] !== null) {
      processedCond = processedCond.replace(`{${match}}`, String(globalConstants[match]));
    }
  });

  // Заменяем userInput на фактический ввод пользователя
  processedCond = processedCond.replace(/\buserInput\b/g, userInput);

  const orParts = processedCond.split('||').map(part => part.trim()).filter(Boolean);
  if (orParts.length > 0) {
    return orParts.some(orPart => {
      const andParts = orPart.split('&&').map(part => part.trim()).filter(Boolean);
      return andParts.every(part => evaluateSimpleCondition(part, variables, userInput, globalConstants));
    });
  }

  return evaluateSimpleCondition(processedCond, variables, userInput, globalConstants);
}

function evaluateSimpleCondition(cond: string, variables: Record<string, any>, userInput: string = '', globalConstants?: Record<string, any>): boolean {
  // Функция для получения значения переменной (включая .length)
  const getValue = (expr: string): any => {
    expr = expr.trim().replace(/[{}]/g, '');
    
    // Проверка на .length
    if (expr.includes('.length')) {
      const parts = expr.split('.length');
      if (parts.length > 0 && parts[0]) {
        const varName = parts[0].trim();
        const value = variables[varName] !== undefined ? variables[varName] : 
                     (globalConstants && globalConstants[varName] !== undefined ? globalConstants[varName] : null);
        if (Array.isArray(value)) {
          return value.length;
        }
        return 0;
      }
    }
    
    // Обычная переменная
    if (variables[expr] !== undefined) {
      return variables[expr];
    }
    if (globalConstants && globalConstants[expr] !== undefined) {
      return globalConstants[expr];
    }
    return expr;
  };

  // Проверка на сравнение чисел (включая .length)
  const numMatch = cond.match(/^\s*([\w{}.]+)\s*([<>]=?|==|!=)\s*([\w{}.]+)\s*$/);
  if (numMatch) {
    // @ts-ignore
    const leftValue = getValue(numMatch[1]);
    // @ts-ignore
    const rightValue = getValue(numMatch[3]);
    const op = numMatch[2];

    const left = typeof leftValue === 'number' ? leftValue : Number(leftValue);
    const right = typeof rightValue === 'number' ? rightValue : Number(rightValue);

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
      const leftValue = variables[left] !== undefined ? variables[left] : 
                       (globalConstants && globalConstants[left] !== undefined ? globalConstants[left] : left) || userInput;
      return String(leftValue).toLowerCase().includes(right.toLowerCase());
    }
  }

  // Проверка на равенство строк (включая .length)
  if (cond.includes('===') || cond.includes('==')) {
    const parts = cond.split(/===|==/);
    if (parts.length === 2 && parts[0] && parts[1]) {
      const left = parts[0].trim().replace(/['"]/g, '');
      const right = parts[1].trim().replace(/['"]/g, '');
      const leftValue = getValue(left);
      const rightValue = getValue(right);
      return String(leftValue) === String(rightValue);
    }
  }

  // Проверка на неравенство строк (включая .length)
  if (cond.includes('!==') || cond.includes('!=')) {
    const parts = cond.split(/!==|!=/);
    if (parts.length === 2 && parts[0] && parts[1]) {
      const left = parts[0].trim().replace(/['"]/g, '');
      const right = parts[1].trim().replace(/['"]/g, '');
      const leftValue = getValue(left);
      const rightValue = getValue(right);
      return String(leftValue) !== String(rightValue);
    }
  }

  // Проверка на >= и <=
  if (cond.includes('>=')) {
    const parts = cond.split('>=');
    if (parts.length === 2 && parts[0] && parts[1]) {
      const left = parts[0].trim();
      const right = parts[1].trim();
      const leftValue = getValue(left);
      const rightValue = getValue(right);
      const leftNum = typeof leftValue === 'number' ? leftValue : Number(leftValue);
      const rightNum = typeof rightValue === 'number' ? rightValue : Number(rightValue);
      return !isNaN(leftNum) && !isNaN(rightNum) && leftNum >= rightNum;
    }
  }

  if (cond.includes('<=')) {
    const parts = cond.split('<=');
    if (parts.length === 2 && parts[0] && parts[1]) {
      const left = parts[0].trim();
      const right = parts[1].trim();
      const leftValue = getValue(left);
      const rightValue = getValue(right);
      const leftNum = typeof leftValue === 'number' ? leftValue : Number(leftValue);
      const rightNum = typeof rightValue === 'number' ? rightValue : Number(rightValue);
      return !isNaN(leftNum) && !isNaN(rightNum) && leftNum <= rightNum;
    }
  }

  // Проверка на > и <
  if (cond.includes('>') && !cond.includes('>=')) {
    const parts = cond.split('>');
    if (parts.length === 2 && parts[0] && parts[1]) {
      const left = parts[0].trim();
      const right = parts[1].trim();
      const leftValue = getValue(left);
      const rightValue = getValue(right);
      const leftNum = typeof leftValue === 'number' ? leftValue : Number(leftValue);
      const rightNum = typeof rightValue === 'number' ? rightValue : Number(rightValue);
      return !isNaN(leftNum) && !isNaN(rightNum) && leftNum > rightNum;
    }
  }

  if (cond.includes('<') && !cond.includes('<=')) {
    const parts = cond.split('<');
    if (parts.length === 2 && parts[0] && parts[1]) {
      const left = parts[0].trim();
      const right = parts[1].trim();
      const leftValue = getValue(left);
      const rightValue = getValue(right);
      const leftNum = typeof leftValue === 'number' ? leftValue : Number(leftValue);
      const rightNum = typeof rightValue === 'number' ? rightValue : Number(rightValue);
      return !isNaN(leftNum) && !isNaN(rightNum) && leftNum < rightNum;
    }
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
  private globalConstants: Record<string, any> = {};
  private executionCount: Record<string, number> = {}; // Защита от бесконечных циклов
  private lastExecutedBlock: string | null = null; // Последний выполненный блок
  private consecutiveEmptyAnswers: number = 0; // Счетчик последовательных пустых ответов для предотвращения бесконечных циклов
  private lastEmptyAnswersBlock: string | null = null; // Последний блок с пустыми ответами

  constructor(ui: UI, botStructure: EngineNode[], globalConstants?: Record<string, any>) {
    botStructure.forEach((ele: EngineNode) => {
      this.nodeStructure[ele.id] = ele;
      // Находим стартовый блок
      if (ele.Type === 'start' && !this.index) {
        this.index = ele.id;
      }
    });
    this.ui = ui;

    // Инициализируем глобальные константы
    if (globalConstants) {
      this.globalConstants = { ...globalConstants };
      // Копируем глобальные константы в переменные для использования
      Object.assign(this.variables, globalConstants);
    }

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

    // Защита от бесконечных циклов
    if (this.index) {
      // Если перешли к другому блоку, сбрасываем счетчик предыдущего
      if (this.lastExecutedBlock && this.lastExecutedBlock !== this.index) {
        this.executionCount[this.lastExecutedBlock] = 0;
      }
      
      // Увеличиваем счетчик для текущего блока
      this.executionCount[this.index] = (this.executionCount[this.index] || 0) + 1;
      
      // Если блок выполняется слишком много раз подряд, это цикл
      if (this.executionCount[this.index] > 50) {
        this.ui.finish();
        this.isFinished = true;
        return;
      }
      
      this.lastExecutedBlock = this.index;
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
        const outputBlockId = this.index;
        const outputExecutionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await this.executeMessage();
        // executeMessage() сам обрабатывает переход к следующему блоку
        // Не нужно вызывать execute() здесь, чтобы избежать дублирования
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
      case "api":
        await this.executeAPI();
        break;
      case "skip":
        await this.executeSkip();
        break;
      case "script":
        await this.executeScript();
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
    if (!block) {
      return;
    }



    // Заменяем переменные в тексте сообщения
    let processedText = block.Text || '';
    // Используем регулярное выражение с глобальным флагом для замены всех вхождений
    processedText = processedText.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      // Сначала проверяем переменные, затем глобальные константы
      if (this.variables[varName] !== undefined && this.variables[varName] !== null) {
        return String(this.variables[varName]);
      } else if (this.globalConstants && this.globalConstants[varName] !== undefined && this.globalConstants[varName] !== null) {
        return String(this.globalConstants[varName]);
      }
      return match; // Если переменная не найдена, оставляем как есть
    });

    // Получаем варианты ответов
    let answers: string[] | undefined = block.Answers;
    
    // Если answers не указаны напрямую, пытаемся получить из переменной
    if (!answers && block.AnswersFromVariable) {
      const varName = block.AnswersFromVariable;
      let answersData = this.variables[varName];
      
      // Если указан путь, извлекаем данные по пути
      if (block.AnswersPath && block.AnswersPath.trim() !== '') {
        const path = block.AnswersPath.trim();
        const pathParts = path.split('.').filter(p => p.trim() !== '');
        
        for (const part of pathParts) {
          if (answersData && typeof answersData === 'object' && part in answersData) {
            answersData = answersData[part];
          } else {
            answersData = null;
            break;
          }
        }
      }
      
      // Если получили массив, используем его
      if (Array.isArray(answersData)) {
        // Если массив пустой, все равно используем его (отправим сообщение без вариантов ответов)
        // Это предотвратит бесконечные циклы, когда блок пропускается
        const isEmpty = answersData.length === 0;
        
        // Защита от бесконечных циклов: если тот же блок с пустыми ответами выполняется несколько раз подряд
        if (isEmpty && this.lastEmptyAnswersBlock === this.index) {
          this.consecutiveEmptyAnswers++;
          if (this.consecutiveEmptyAnswers >= 3) {
            await this.ui.sendMessage('⚠️ Произошла ошибка: нет доступных вариантов для выбора. Пожалуйста, попробуйте позже.', []);
            this.ui.finish();
            this.isFinished = true;
            return;
          }
        } else {
          this.consecutiveEmptyAnswers = isEmpty ? 1 : 0;
          this.lastEmptyAnswersBlock = isEmpty ? this.index : null;
        }
        
        answers = answersData.length > 0 ? answersData.map(item => String(item)) : [];
      } else {
        // Если переменная еще не заполнена (не массив или undefined), но мы ожидаем варианты ответов из нее,
        // НЕ отправляем сообщение без вариантов - это предотвратит дублирование
        // Вместо этого просто переходим к следующему блоку
        // Переменная будет заполнена предыдущим блоком (например, API блоком)
        if (block.Nexts.length > 0) {
          // @ts-ignore
          this.index = block.Nexts[0];
          this.skipInput = true;
          await this.execute(true);
        } else {
          this.ui.finish();
          this.isFinished = true;
        }
        return;
      }
    }

    // Если есть варианты ответов, показываем их и ждем выбора
    // Даже если текст пустой, отправляем сообщение с вариантами ответов
    // Если массив пустой (answers.length === 0), все равно отправляем сообщение без вариантов ответов
    // чтобы предотвратить бесконечные циклы
    if (answers && answers.length > 0) {
      // Если текст пустой, используем дефолтное сообщение
      const messageToSend = processedText.trim() !== '' ? processedText : 'Выберите вариант:';
      const messageId = `${this.index}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await this.ui.sendMessage(messageToSend, answers);
      const userAnswer = await this.ui.getInput();
      const answerIndex = answers.indexOf(userAnswer);
      
      if (answerIndex === -1) {
        throw new Error(`Unknown answer "${userAnswer}" at block: ${this.index}`);
      }
      
      // Сохраняем выбранный ответ в переменную, если нужно
      if (block.VarName) {
        this.variables[block.VarName] = userAnswer;
      }
      // Всегда сохраняем выбранный ответ в стандартные переменные
      this.variables['lastMessage'] = userAnswer;
      this.variables['userInput'] = userAnswer;
      
      // Переходим к следующему блоку по индексу выбранного ответа
      // Если Nexts содержит только один элемент (что происходит когда answersFromVariable используется),
      // используем его независимо от индекса ответа
      const currentBlockId = this.index; // Сохраняем текущий ID блока для логирования
      if (block.Nexts.length === 1) {
        const nextBlockId = block.Nexts[0];
        this.index = nextBlockId;
        this.skipInput = true;
        await this.execute(true);
      } else if (answerIndex < block.Nexts.length && block.Nexts[answerIndex]) {
        const nextBlockId = block.Nexts[answerIndex];
        this.index = nextBlockId;
        this.skipInput = true;
        await this.execute(true);
      } else {
        this.ui.finish();
        this.isFinished = true;
      }
      return;
    }

    // Если нет вариантов ответов (включая пустой массив), отправляем сообщение
    // Если answersFromVariable был указан и массив пустой, все равно отправляем сообщение,
    // чтобы предотвратить бесконечные циклы
    // Если текст пустой, используем дефолтное сообщение для пустых массивов
    const messageToSend = processedText.trim() !== '' ? processedText : 
                          (block.AnswersFromVariable ? 'Нет доступных вариантов для выбора.' : '');
    
    if (messageToSend !== '') {
      const messageId = `${this.index}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await this.ui.sendMessage(messageToSend, []);
    } else {
      // Пустое сообщение пропускается
    }

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
    // Продолжаем выполнение следующего блока
    await this.execute(true);
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
      if (evalCondition(cond, this.variables, msg, this.globalConstants)) {
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

    // Если нужно сохранить следующий ответ пользователя в переменную
    if (block.SaveNextToVariable) {
      this.saveNext = true;
      this.saveName = block.SaveNextToVariable;
      this.saveType = 'string';

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
        this.variables[block.SaveNextToVariable] = userInput;
        this.saveNext = false;
        this.saveName = "";
        this.saveType = "";
        this.ui.finish();
        this.isFinished = true;
        return;
      }
    }

    // Обрабатываем установку переменной из значения
    if (block.VariableName && block.VariableValue !== undefined) {
      let value = block.VariableValue;

      // Заменяем переменные в значении
      value = value.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        // Сначала проверяем переменные, затем глобальные константы
        if (this.variables[varName] !== undefined && this.variables[varName] !== null) {
          return String(this.variables[varName]);
        } else if (this.globalConstants && this.globalConstants[varName] !== undefined && this.globalConstants[varName] !== null) {
          return String(this.globalConstants[varName]);
        }
        return match; // Если переменная не найдена, оставляем как есть
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

  // Функция для замены переменных в строке
  const replaceVariables = (text: string): string => {
    return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      // Сначала проверяем файлы, затем переменные, затем глобальные константы
      if (this.files[varName] !== undefined && this.files[varName] !== null) {
        return String(this.files[varName]);
      } else if (this.variables[varName] !== undefined && this.variables[varName] !== null) {
        return String(this.variables[varName]);
      } else if (this.globalConstants && this.globalConstants[varName] !== undefined && this.globalConstants[varName] !== null) {
        return String(this.globalConstants[varName]);
      }
      return match; // Если переменная не найдена, оставляем как есть
    });
  };

  switch (block.FILEAct) {

    case 'Upload': {
      // Загрузка файла от пользователя
      let fileName = block.FileName || 'file';
      fileName = replaceVariables(fileName);
      
      let pathToSave = block.PathToSave || '';
      pathToSave = replaceVariables(pathToSave);

      // Ожидаем загрузку файла от пользователя
      const uniqueName = await this.ui.getFile(pathToSave, fileName);

      // Сохраняем имя файла в переменные
      const varName = block.FileName || 'lastFile';
      this.files[varName] = uniqueName;
      this.files['lastFile'] = uniqueName;
      this.variables[varName] = uniqueName;
      break;
    }

    case 'DownLoad': {
      // Отдача файла пользователю
      if (!block.PathToFile) {
        throw new Error(`PathToFile is required for download in block ${this.index}`);
      }

      // Подмена переменных в пути
      let filePath = replaceVariables(block.PathToFile);

      this.ui.sendFile(filePath);
      break;
    }

    case 'Delete': {
      // Удаление файла
      if (!block.PathToFile) {
        throw new Error(`PathToFile is required for delete in block ${this.index}`);
      }

      let filePath = replaceVariables(block.PathToFile);

      this.ui.deleteFile(filePath);
      break;
    }

    case 'Read': {
      // Чтение файла
      if (!block.PathToFile) {
        throw new Error(`PathToFile is required for read in block ${this.index}`);
      }

      let filePath = replaceVariables(block.PathToFile);

      // Для чтения файла сохраняем путь в переменную, если указано имя файла
      if (block.FileName) {
        this.variables[block.FileName] = filePath;
        this.files[block.FileName] = filePath;
      }
      break;
    }

    default:
      throw new Error(`Unknown FILEAct in block ${this.index}`);
  }

  // Переход к следующему блоку
  const nextId = block.Nexts.find(Boolean);
  if (nextId) {
    this.index = nextId;
    this.skipInput = true;
    await this.execute();
  } else {
    this.ui.finish();
    this.isFinished = true;
  }
}


  async executeAPI(): Promise<void> {
    const block = this.nodeStructure[this.index!];
    if (!block || !block.ApiUrl) {
      return;
    }

    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Функция для замены переменных
      const replaceVariable = (varName: string): string => {
        if (this.variables[varName] !== undefined && this.variables[varName] !== null) {
          return String(this.variables[varName]);
        } else if (this.globalConstants && this.globalConstants[varName] !== undefined && this.globalConstants[varName] !== null) {
          return String(this.globalConstants[varName]);
        }
        return `{{${varName}}}`; // Если переменная не найдена, оставляем как есть
      };

      // Заменяем переменные в URL
      let url = block.ApiUrl;
      const urlVariables: Record<string, string> = {};
      url = url.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        const value = replaceVariable(varName);
        urlVariables[varName] = value;
        return value;
      });
      

      // Заменяем переменные в теле запроса
      let body = block.ApiBody || '';
      const bodyVariables: Record<string, any> = {};
      if (body) {
        // Умная замена переменных в JSON-подобном тексте
        // Обрабатываем случаи: "key": {{variable}} и "key": "{{variable}}"
        body = body.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
          // Получаем значение переменной
          const varValue = this.variables[varName] !== undefined ? this.variables[varName] : 
                          (this.globalConstants && this.globalConstants[varName] !== undefined ? this.globalConstants[varName] : null);
          bodyVariables[varName] = varValue;
          
          // Определяем тип значения
          if (varValue === null || varValue === undefined) {
            return 'null';
          }
          
          // Если значение - объект или массив, сериализуем в JSON
          if (typeof varValue === 'object' && !Array.isArray(varValue)) {
            return JSON.stringify(varValue);
          }
          
          if (Array.isArray(varValue)) {
            return JSON.stringify(varValue);
          }
          
          // Если значение - число или boolean, подставляем как есть (без кавычек)
          if (typeof varValue === 'number' || typeof varValue === 'boolean') {
            return String(varValue);
          }
          
          // Если значение - строка, проверяем контекст в исходном тексте
          // Ищем позицию {{variable}} в исходном body
          const matchIndex = body.indexOf(match);
          if (matchIndex !== -1) {
            // Проверяем, есть ли кавычки перед {{variable}}
            const beforeMatch = body.substring(0, matchIndex);
            const lastQuote = Math.max(
              beforeMatch.lastIndexOf('"'),
              beforeMatch.lastIndexOf("'")
            );
            const lastColon = beforeMatch.lastIndexOf(':');
            
            // Если после : нет кавычек до {{, значит это значение без кавычек - оборачиваем строку
            if (lastColon !== -1 && (lastQuote === -1 || lastQuote < lastColon)) {
              // Это значение JSON без кавычек - оборачиваем строку в кавычки
              return JSON.stringify(String(varValue));
            }
          }
          
          // Иначе возвращаем как строку (уже в кавычках или в другом контексте)
          return String(varValue);
        });
        
        // Пытаемся распарсить как JSON для валидации и форматирования
        try {
          const bodyObj = JSON.parse(body);
          body = JSON.stringify(bodyObj);
        } catch (e) {
          // Если не удалось распарсить, оставляем как есть (может быть не JSON)
        }
      }

      // Подготавливаем заголовки
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(block.ApiHeaders || {}),
      };

      // Заменяем переменные в заголовках
      Object.keys(headers).forEach(key => {
        if (headers[key]) {
          headers[key] = headers[key].replace(/\{\{(\w+)\}\}/g, (match, varName) => replaceVariable(varName));
        }
      });

      // Выполняем HTTP запрос
      const method = block.ApiMethod || 'GET';
      const fetchOptions: RequestInit = {
        method,
        headers,
        // Добавляем режим для работы с CORS
        mode: 'cors',
        credentials: 'omit',
      };

      if (method !== 'GET' && body) {
        fetchOptions.body = body;
      }

      // Логируем детали запроса
      
      // Проверяем доступность fetch (для Node.js < 18 может потребоваться node-fetch)
      let fetchFn: any;
      const isBrowser = typeof window !== 'undefined';
      
      if (isBrowser) {
        // В браузере используем встроенный fetch
        fetchFn = globalThis.fetch;
      } else {
        // На сервере проверяем доступность fetch
        if (typeof globalThis.fetch !== 'undefined') {
          fetchFn = globalThis.fetch;
        } else if (typeof fetch !== 'undefined') {
          fetchFn = fetch;
        } else {
          // Попытка использовать node-fetch если доступен
          try {
            // @ts-ignore
            const nodeFetch = require('node-fetch');
            fetchFn = nodeFetch.default || nodeFetch;
          } catch (e) {
            throw new Error('fetch is not available. Please install node-fetch (npm install node-fetch) or use Node.js 18+');
          }
        }
      }

      let response: Response;
      try {
        response = await fetchFn(url, fetchOptions);
      } catch (fetchError: any) {
        // Обработка CORS ошибок
        const errorMessage = fetchError.message || String(fetchError);
        if (errorMessage.includes('CORS') || errorMessage.includes('access control')) {
          const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
          const errorMsg = isLocalhost 
            ? `CORS error: The API server at ${url} does not allow requests from this origin. This is a browser security restriction. Please configure CORS on the server (add Access-Control-Allow-Origin header) or use an external API endpoint.`
            : `CORS error: The API server at ${url} does not allow requests from this origin. Please configure CORS on the server or contact the API provider.`;
          throw new Error(errorMsg);
        }
        throw fetchError;
      }
      
      // Обрабатываем ответ
      const duration = Date.now() - startTime;
      let responseData: any;
      const contentType = response.headers.get('content-type') || '';
      
      
      if (contentType.includes('application/json')) {
        try {
          responseData = await response.json();
        } catch (e) {
          const text = await response.text();
          responseData = { text, parseError: 'Failed to parse JSON' };
        }
      } else {
        responseData = await response.text();
      }

      // Всегда сохраняем ответ, если указана переменная
      if (block.ApiResponseVariable && block.ApiResponseVariable.trim() !== '') {
        const varName = block.ApiResponseVariable.trim();
        this.variables[varName] = responseData;
        // Также сохраняем статус код
        this.variables[`${varName}_status`] = response.status;
      }

      // Извлекаем массив для вариантов ответов, если указан путь
      if (block.ApiAnswersPath && block.ApiAnswersPath.trim() !== '') {
        try {
          const path = block.ApiAnswersPath.trim();
          let answersArray: any = responseData;
          
          // Парсим путь (например, "data.times" -> ["data", "times"])
          const pathParts = path.split('.').filter(p => p.trim() !== '');
          
          // Проходим по пути
          for (const part of pathParts) {
            if (answersArray && typeof answersArray === 'object' && part in answersArray) {
              answersArray = answersArray[part];
            } else {
              answersArray = null;
              break;
            }
          }
          // Если получили массив, сохраняем его
          if (Array.isArray(answersArray)) {
            const answersVarName = block.ApiAnswersVariable?.trim() || `${block.ApiResponseVariable || 'apiResponse'}_answers`;
            this.variables[answersVarName] = answersArray.map(item => String(item));
          } else {
            console.log(`   ⚠️  Path "${path}" does not point to an array in API response`);
          }
        } catch (error) {
          // Не удалось извлечь массив ответов
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
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // В случае ошибки сохраняем информацию об ошибке
      if (block.ApiResponseVariable && block.ApiResponseVariable.trim() !== '') {
        const varName = block.ApiResponseVariable.trim();
        this.variables[varName] = { 
          error: error.message || String(error),
          errorType: error.name || 'UnknownError'
        };
        this.variables[`${varName}_status`] = error.status || 0;
      }
      
      
      // Переходим к следующему блоку даже при ошибке
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

  async executeScript(): Promise<void> {
    const block = this.nodeStructure[this.index!];
    if (!block || !block.ScriptCode) {
      // Переходим к следующему блоку или завершаем
      if (block && block.Nexts.length > 0) {
        // @ts-ignore
        this.index = block.Nexts[0];
        this.skipInput = true;
        await this.execute();
      } else {
        this.ui.finish();
        this.isFinished = true;
      }
      return;
    }

    try {
      // Создаем безопасный контекст для выполнения скрипта
      const scriptContext = {
        variables: this.variables,
        globalConstants: this.globalConstants,
        // Предоставляем функции для работы с переменными
        setVariable: (name: string, value: any) => {
          this.variables[name] = value;
        },
        getVariable: (name: string) => {
          return this.variables[name] !== undefined ? this.variables[name] : 
                 (this.globalConstants && this.globalConstants[name] !== undefined ? this.globalConstants[name] : undefined);
        },
      };

      // Выполняем скрипт в изолированном контексте
      // Используем Function constructor для создания функции с нужным контекстом
      const scriptFunction = new Function(
        'variables',
        'globalConstants',
        'setVariable',
        'getVariable',
        `
        try {
          ${block.ScriptCode}
        } catch (error) {
          throw new Error('Script execution error: ' + error.message);
        }
        `
      );

      // Выполняем скрипт
      const result = scriptFunction.call(
        scriptContext,
        this.variables,
        this.globalConstants,
        scriptContext.setVariable,
        scriptContext.getVariable
      );

      // Если указана переменная для результата и скрипт вернул значение
      if (block.ScriptReturnVariable && result !== undefined) {
        this.variables[block.ScriptReturnVariable] = result;
      }

      // Переходим к следующему блоку
      if (block.Nexts.length > 0) {
        // @ts-ignore
        this.index = block.Nexts[0];
        this.skipInput = true;
        await this.execute();
      } else {
        // Если нет следующего блока, завершаем диалог
        this.ui.finish();
        this.isFinished = true;
      }
    } catch (error: any) {
      // В случае ошибки сохраняем информацию об ошибке в переменную
      if (block.ScriptReturnVariable) {
        this.variables[block.ScriptReturnVariable] = { 
          error: error.message || String(error),
          errorType: 'ScriptExecutionError'
        };
      }
      
      // Переходим к следующему блоку даже при ошибке
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
  }

  // Получить переменные (для отладки)
  getVariables(): Record<string, any> {
    return { ...this.variables };
  }

  // Получить значение переменной
  getVariable(name: string): any {
    return this.variables[name];
  }

  // Проверить, существует ли переменная
  hasVariable(name: string): boolean {
    return name in this.variables;
  }

  // Сброс состояния
  reset(): void {
    this.variables = {};
    // Восстанавливаем глобальные константы после сброса
    if (this.globalConstants) {
      Object.assign(this.variables, this.globalConstants);
    }
    this.isFinished = false;
    this.skipInput = false;
    this.saveNext = false;
    this.executionCount = {}; // Сбрасываем счетчик выполнения
    this.lastExecutedBlock = null; // Сбрасываем последний выполненный блок
  }
}