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
  Type: 'output' | 'condition' | 'start' | 'variable' | 'FILE' | 'api' | 'skip' | 'end';
  Text?: string;
  VarName?: string;
  VarType?: string;
  Nexts: string[];
  Cond?: string[];
  skip?: boolean;
  Answers?: string[];
  VariableName?: string; // Для variable блоков
  VariableValue?: string; // Для variable блоков
  SaveNextToVariable?: string; // Для variable блоков - сохранить следующий ответ пользователя

  // API блоки
  ApiUrl?: string;
  ApiMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  ApiHeaders?: Record<string, string>;
  ApiBody?: string;
  ApiResponseVariable?: string; // Имя переменной для сохранения ответа

  FILEAct? : 'Upload' | 'DownLoad' | 'Delete' | 'Read';
  FileName?: string; // Для FILE блоков
  PathToSave?: string; // Для FILE блоков
  PathToFile?: string; // Для FILE блоков
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
  // Проверка на сравнение чисел 
  const numMatch = cond.match(/^\s*([\w{}]+)\s*([<>]=?|==|!=)\s*([\w{}]+)\s*$/);
  if (numMatch) {
    // @ts-ignore
    let leftStr = numMatch[1].replace(/[{}]/g, '');
    // @ts-ignore
    let rightStr = numMatch[3].replace(/[{}]/g, '');
    const op = numMatch[2];

    const left = variables[leftStr] !== undefined ? Number(variables[leftStr]) : 
                 (globalConstants && globalConstants[leftStr] !== undefined ? Number(globalConstants[leftStr]) : Number(leftStr));
    const right = variables[rightStr] !== undefined ? Number(variables[rightStr]) : 
                  (globalConstants && globalConstants[rightStr] !== undefined ? Number(globalConstants[rightStr]) : Number(rightStr));

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

  // Проверка на равенство строк
  if (cond.includes('===') || cond.includes('==')) {
    const [left, right] = cond.split(/===|==/).map(s => s.trim().replace(/['"]/g, ''));
    // @ts-ignore
    const leftValue = variables[left] !== undefined ? String(variables[left]) : 
                     (globalConstants && globalConstants[left] !== undefined ? String(globalConstants[left]) : left);
    // @ts-ignore
    const rightValue = variables[right] !== undefined ? String(variables[right]) : 
                      (globalConstants && globalConstants[right] !== undefined ? String(globalConstants[right]) : right);
    return leftValue === rightValue;
  }

  // Проверка на неравенство строк
  if (cond.includes('!==') || cond.includes('!=')) {
    const [left, right] = cond.split(/!==|!=/).map(s => s.trim().replace(/['"]/g, ''));
    // @ts-ignore
    const leftValue = variables[left] !== undefined ? String(variables[left]) : 
                     (globalConstants && globalConstants[left] !== undefined ? String(globalConstants[left]) : left);
    // @ts-ignore
    const rightValue = variables[right] !== undefined ? String(variables[right]) : 
                      (globalConstants && globalConstants[right] !== undefined ? String(globalConstants[right]) : right);
    return leftValue !== rightValue;
  }

  // Проверка на >= и <=
  if (cond.includes('>=')) {
    const [left, right] = cond.split('>=').map(s => s.trim());
    // @ts-ignore
    const leftValue = variables[left] !== undefined ? Number(variables[left]) : 
                     (globalConstants && globalConstants[left] !== undefined ? Number(globalConstants[left]) : Number(left));
    // @ts-ignore
    const rightValue = variables[right] !== undefined ? Number(variables[right]) : 
                      (globalConstants && globalConstants[right] !== undefined ? Number(globalConstants[right]) : Number(right));
    return !isNaN(leftValue) && !isNaN(rightValue) && leftValue >= rightValue;
  }

  if (cond.includes('<=')) {
    const [left, right] = cond.split('<=').map(s => s.trim());
    // @ts-ignore
    const leftValue = variables[left] !== undefined ? Number(variables[left]) : 
                     (globalConstants && globalConstants[left] !== undefined ? Number(globalConstants[left]) : Number(left));
    // @ts-ignore
    const rightValue = variables[right] !== undefined ? Number(variables[right]) : 
                      (globalConstants && globalConstants[right] !== undefined ? Number(globalConstants[right]) : Number(right));
    return !isNaN(leftValue) && !isNaN(rightValue) && leftValue <= rightValue;
  }

  // Проверка на > и <
  if (cond.includes('>')) {
    const [left, right] = cond.split('>').map(s => s.trim());
    // @ts-ignore
    const leftValue = variables[left] !== undefined ? Number(variables[left]) : 
                     (globalConstants && globalConstants[left] !== undefined ? Number(globalConstants[left]) : Number(left));
    // @ts-ignore
    const rightValue = variables[right] !== undefined ? Number(variables[right]) : 
                      (globalConstants && globalConstants[right] !== undefined ? Number(globalConstants[right]) : Number(right));
    return !isNaN(leftValue) && !isNaN(rightValue) && leftValue > rightValue;
  }

  if (cond.includes('<')) {
    const [left, right] = cond.split('<').map(s => s.trim());
    // @ts-ignore
    const leftValue = variables[left] !== undefined ? Number(variables[left]) : 
                     (globalConstants && globalConstants[left] !== undefined ? Number(globalConstants[left]) : Number(left));
    // @ts-ignore
    const rightValue = variables[right] !== undefined ? Number(variables[right]) : 
                      (globalConstants && globalConstants[right] !== undefined ? Number(globalConstants[right]) : Number(right));
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
  private globalConstants: Record<string, any> = {};

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
      case "api":
        await this.executeAPI();
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

      const uniqueName = this.ui.getFile(pathToSave, fileName);

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
      console.error('API block missing URL');
      return;
    }

    console.log('API Block:', {
      id: block.id,
      url: block.ApiUrl,
      method: block.ApiMethod,
      responseVariable: block.ApiResponseVariable,
      currentVariables: Object.keys(this.variables)
    });

    try {
      // Заменяем переменные в URL
      let url = block.ApiUrl;
      url = url.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        if (this.variables[varName] !== undefined && this.variables[varName] !== null) {
          return String(this.variables[varName]);
        } else if (this.globalConstants && this.globalConstants[varName] !== undefined && this.globalConstants[varName] !== null) {
          return String(this.globalConstants[varName]);
        }
        return match;
      });

      // Заменяем переменные в теле запроса
      let body = block.ApiBody || '';
      if (body) {
        body = body.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
          if (this.variables[varName] !== undefined && this.variables[varName] !== null) {
            return String(this.variables[varName]);
          } else if (this.globalConstants && this.globalConstants[varName] !== undefined && this.globalConstants[varName] !== null) {
            return String(this.globalConstants[varName]);
          }
          return match;
        });
      }

      // Подготавливаем заголовки
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(block.ApiHeaders || {}),
      };

      // Заменяем переменные в заголовках
      Object.keys(headers).forEach(key => {
        headers[key] = headers[key].replace(/\{\{(\w+)\}\}/g, (match, varName) => {
          if (this.variables[varName] !== undefined && this.variables[varName] !== null) {
            return String(this.variables[varName]);
          } else if (this.globalConstants && this.globalConstants[varName] !== undefined && this.globalConstants[varName] !== null) {
            return String(this.globalConstants[varName]);
          }
          return match;
        });
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

      console.log(`Executing API ${method} ${url}`, { headers, body: method !== 'GET' ? body : undefined });
      
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
        console.log(`✅ API response saved to variable: "${varName}"`, {
          value: responseData,
          status: response.status,
          allVariables: Object.keys(this.variables)
        });
      } else {
        console.warn('⚠️ API response received but no variable specified for saving. ResponseVariable:', block.ApiResponseVariable);
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
      console.error('❌ API request failed:', error);
      
      // В случае ошибки сохраняем информацию об ошибке
      if (block.ApiResponseVariable && block.ApiResponseVariable.trim() !== '') {
        const varName = block.ApiResponseVariable.trim();
        this.variables[varName] = { 
          error: error.message || String(error),
          errorType: error.name || 'UnknownError'
        };
        this.variables[`${varName}_status`] = error.status || 0;
        console.log(`✅ API error saved to variable: "${varName}"`, {
          error: error.message || String(error),
          allVariables: Object.keys(this.variables)
        });
      } else {
        console.warn('⚠️ API error occurred but no variable specified for saving. ResponseVariable:', block.ApiResponseVariable);
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
  }
}