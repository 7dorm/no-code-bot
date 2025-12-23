import { Project } from '../types';
import { adaptProjectToEngine } from './backend/projectAdapter';

export interface TelegramBotCode {
  token: string;
  code: string;
  projectJson: string;
}

export interface WebAppCode {
  html: string;
  js: string;
  css: string;
  projectJson: string;
}

function generateGlobalConstants(constants: Record<string, any>): string {
  let out = '';
  for (const [key, value] of Object.entries(constants)) {
    out += `const ${key} = ${JSON.stringify(value)}\n`;
  }
  return out;
}

// Генерация кода Engine для экспорта
function generateEngineCode(): string {
  return `
// ===== ENGINE CODE =====
// Этот код скопирован из движка No-Code Bot
// Для продакшена рекомендуется использовать npm пакет

class UI {
  async sendMessage(message, answers = []) {}
  async getInput() {}
  async getFile(pathToSave, name) {}
  sendFile(path) {}
  deleteFile(path) {}
  finish() {}
}

class TelegramUI extends UI {
  constructor(bot, chatId) {
    super();
    this.bot = bot;
    this.chatId = chatId;
    this.stop = false;
    this.inputResolver = null;
    this.fileResolver = null;
  }

  async sendMessage(message, answers = []) {
    if (answers.length > 0) {
      const keyboard = {
        inline_keyboard: answers.map(a => [{ text: a, callback_data: a }])
      };
      await this.bot.sendMessage(this.chatId, message, { reply_markup: keyboard });
    } else {
      await this.bot.sendMessage(this.chatId, message);
    }
  }

  async getInput() {
    return new Promise((resolve) => {
      this.inputResolver = resolve;
    });
  }

  finish() {
    this.stop = true;
  }

  handleUserMessage(text) {
    if (this.inputResolver) {
      this.inputResolver(text);
      this.inputResolver = null;
    }
  }

  async sendFile(path) {
    try {
      await this.bot.sendDocument(this.chatId, path);
    } catch (error) {
      await this.bot.sendMessage(this.chatId, \`Ошибка отправки файла: \${path}\`);
    }
  }

  async getFile(pathToSave, name) {
    await this.bot.sendMessage(this.chatId, \`📎 Пожалуйста, отправьте файл: \${name}\`);
    return new Promise((resolve) => {
      this.fileResolver = resolve;
    });
  }

  handleUserFile(fileName) {
    if (this.fileResolver) {
      const uniqueName = \`\${fileName}_\${Date.now()}\`;
      this.fileResolver(uniqueName);
      this.fileResolver = null;
    }
  }

  deleteFile(path) {
    // Удаление файла
  }

  isDone() {
    return this.stop;
  }
}

function evalCondition(condStr, variables, userInput = '', globalConstants = {}) {
  if (condStr === "default") return true;

  let processedCond = condStr;
  const matches = [...condStr.matchAll(/\\{([^}]+)\\}/g)].map(m => m[1]);

  matches.forEach((match) => {
    if (variables[match] !== undefined && variables[match] !== null) {
      processedCond = processedCond.replace(\`\\{\${match}\\}\`, String(variables[match]));
    } else if (globalConstants && globalConstants[match] !== undefined && globalConstants[match] !== null) {
      processedCond = processedCond.replace(\`\\{\${match}\\}\`, String(globalConstants[match]));
    }
  });

  processedCond = processedCond.replace(/\\buserInput\\b/g, userInput);

  const orParts = processedCond.split('||').map(part => part.trim()).filter(Boolean);
  if (orParts.length > 0) {
    return orParts.some(orPart => {
      const andParts = orPart.split('&&').map(part => part.trim()).filter(Boolean);
      return andParts.every(part => {
        const getValue = (expr) => {
          expr = expr.trim().replace(/[{}]/g, '');
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
          if (variables[expr] !== undefined) {
            return variables[expr];
          }
          if (globalConstants && globalConstants[expr] !== undefined) {
            return globalConstants[expr];
          }
          return expr;
        };

        const numMatch = part.match(/^\\s*([\\w{}.]+)\\s*([<>]=?|==|!=)\\s*([\\w{}.]+)\\s*$/);
        if (numMatch) {
          const leftValue = getValue(numMatch[1]);
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

        if (part.toLowerCase().includes('contains')) {
          const parts_cond = part.toLowerCase().split('contains');
          if (parts_cond.length === 2) {
            const left = parts_cond[0].trim();
            const right = parts_cond[1].trim().replace(/['"]/g, '');
            const leftValue = variables[left] !== undefined ? variables[left] :
                             (globalConstants && globalConstants[left] !== undefined ? globalConstants[left] : left) || userInput;
            return String(leftValue).toLowerCase().includes(right.toLowerCase());
          }
        }

        if (part.includes('===') || part.includes('==')) {
          const parts_cond = part.split(/===|==/);
          if (parts_cond.length === 2 && parts_cond[0] && parts_cond[1]) {
            const left = parts_cond[0].trim().replace(/['"]/g, '');
            const right = parts_cond[1].trim().replace(/['"]/g, '');
            const leftValue = getValue(left);
            const rightValue = getValue(right);
            return String(leftValue) === String(rightValue);
          }
        }

        if (part.includes('!==') || part.includes('!=')) {
          const parts_cond = part.split(/!==|!=/);
          if (parts_cond.length === 2 && parts_cond[0] && parts_cond[1]) {
            const left = parts_cond[0].trim().replace(/['"]/g, '');
            const right = parts_cond[1].trim().replace(/['"]/g, '');
            const leftValue = getValue(left);
            const rightValue = getValue(right);
            return String(leftValue) !== String(rightValue);
          }
        }

        if (part.includes('>=')) {
          const parts_cond = part.split('>=');
          if (parts_cond.length === 2 && parts_cond[0] && parts_cond[1]) {
            const left = parts_cond[0].trim();
            const right = parts_cond[1].trim();
            const leftValue = getValue(left);
            const rightValue = getValue(right);
            const leftNum = typeof leftValue === 'number' ? leftValue : Number(leftValue);
            const rightNum = typeof rightValue === 'number' ? rightValue : Number(rightValue);
            return !isNaN(leftNum) && !isNaN(rightNum) && leftNum >= rightNum;
          }
        }

        if (part.includes('>') && !part.includes('>=')) {
          const parts_cond = part.split('>');
          if (parts_cond.length === 2 && parts_cond[0] && parts_cond[1]) {
            const left = parts_cond[0].trim();
            const right = parts_cond[1].trim();
            const leftValue = getValue(left);
            const rightValue = getValue(right);
            const leftNum = typeof leftValue === 'number' ? leftValue : Number(leftValue);
            const rightNum = typeof rightValue === 'number' ? rightValue : Number(rightValue);
            return !isNaN(leftNum) && !isNaN(rightNum) && leftNum > rightNum;
          }
        }

        if (part.includes('<=')) {
          const parts_cond = part.split('<=');
          if (parts_cond.length === 2 && parts_cond[0] && parts_cond[1]) {
            const left = parts_cond[0].trim();
            const right = parts_cond[1].trim();
            const leftValue = getValue(left);
            const rightValue = getValue(right);
            const leftNum = typeof leftValue === 'number' ? leftValue : Number(leftValue);
            const rightNum = typeof rightValue === 'number' ? rightValue : Number(rightValue);
            return !isNaN(leftNum) && !isNaN(rightNum) && leftNum <= rightNum;
          }
        }

        if (part.includes('<') && !part.includes('<=')) {
          const parts_cond = part.split('<');
          if (parts_cond.length === 2 && parts_cond[0] && parts_cond[1]) {
            const left = parts_cond[0].trim();
            const right = parts_cond[1].trim();
            const leftValue = getValue(left);
            const rightValue = getValue(right);
            const leftNum = typeof leftValue === 'number' ? leftValue : Number(leftValue);
            const rightNum = typeof rightValue === 'number' ? rightValue : Number(rightValue);
            return !isNaN(leftNum) && !isNaN(rightNum) && leftNum < rightNum;
          }
        }

        if (part.trim().toLowerCase() === 'default') {
  return true;
}

        return false;
      });
    });
  }

  return false;
}

class Engine {
  constructor(ui, botStructure, globalConstants = {}) {
    this.nodeStructure = {};
    this.variables = {};
    this.files = {};
    this.ui = ui;
    this.index = null;
    this.saveNext = false;
    this.saveName = "";
    this.skipInput = false;
    this.saveType = "";
    this.isFinished = false;
    this.globalConstants = globalConstants;
    this.executionCount = {};
    this.lastExecutedBlock = null;
    this.consecutiveEmptyAnswers = 0;
    this.lastEmptyAnswersBlock = null;

    botStructure.forEach((ele) => {
      this.nodeStructure[ele.id] = ele;
      if (ele.Type === 'start' && !this.index) {
        this.index = ele.id;
      }
    });

    Object.assign(this.variables, globalConstants);

    if (!this.index && botStructure.length > 0) {
      this.index = botStructure[0].id;
    }
  }

  async execute(skipFirstInput = false) {
    if (skipFirstInput) {
      this.skipInput = true;
    }

    if (this.isFinished || !this.index) {
      if (!this.index) {
        this.ui.finish();
      }
      return;
    }

    if (this.index) {
      if (this.lastExecutedBlock && this.lastExecutedBlock !== this.index) {
        this.executionCount[this.lastExecutedBlock] = 0;
      }

      this.executionCount[this.index] = (this.executionCount[this.index] || 0) + 1;

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

    switch (block.Type) {
      case "output":
        await this.executeMessage();
        break;
      case "condition":
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

  async executeStart() {
    const block = this.nodeStructure[this.index];
    if (!block) return;

    if (block.Nexts.length > 0) {
      this.index = block.Nexts[0];
      this.skipInput = true;
      await this.execute();
    } else {
      this.ui.finish();
    }
  }

  async executeMessage() {
    const block = this.nodeStructure[this.index];
    if (!block) return;

    let processedText = block.Text || '';
    processedText = processedText.replace(/\\{\\{(\\w+)\\}\\}/g, (match, varName) => {
      if (this.variables[varName] !== undefined && this.variables[varName] !== null) {
        return String(this.variables[varName]);
      } else if (this.globalConstants && this.globalConstants[varName] !== undefined && this.globalConstants[varName] !== null) {
        return String(this.globalConstants[varName]);
      }
      return match;
    });

    let answers = block.Answers;

    if (!answers && block.AnswersFromVariable) {
      const varName = block.AnswersFromVariable;
      let answersData = this.variables[varName];

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

      if (Array.isArray(answersData)) {
        const isEmpty = answersData.length === 0;

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
        if (block.Nexts.length > 0) {
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

    if (answers && answers.length > 0) {
      const messageToSend = processedText.trim() !== '' ? processedText : 'Выберите вариант:';
      await this.ui.sendMessage(messageToSend, answers);
      const userAnswer = await this.ui.getInput();
      const answerIndex = answers.indexOf(userAnswer);

      if (answerIndex === -1) {
        throw new Error(\`Unknown answer "\${userAnswer}" at block: \${this.index}\`);
      }

      if (block.VarName) {
        this.variables[block.VarName] = userAnswer;
      }
      this.variables['lastMessage'] = userAnswer;
      this.variables['userInput'] = userAnswer;

      if (block.Nexts.length === 1) {
        this.index = block.Nexts[0];
        this.skipInput = true;
        await this.execute(true);
      } else if (answerIndex < block.Nexts.length && block.Nexts[answerIndex]) {
        this.index = block.Nexts[answerIndex];
        this.skipInput = true;
        await this.execute(true);
      } else {
        this.ui.finish();
        this.isFinished = true;
      }
      return;
    }

    const messageToSend = processedText.trim() !== '' ? processedText :
                          (block.AnswersFromVariable ? 'Нет доступных вариантов для выбора.' : '');

    if (messageToSend !== '') {
      await this.ui.sendMessage(messageToSend, []);
    } else {
    }

    if (block.VarName != null) {
      this.saveNext = true;
      this.saveName = block.VarName;
      this.saveType = block.VarType || 'string';

      if (block.Nexts.length > 0) {
        this.index = block.Nexts[0];
        await this.execute(false);
        return;
      } else {
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

    if (block.Nexts.length == 0) {
      this.ui.finish();
      this.isFinished = true;
      return;
    }

    this.index = block.Nexts[0];
    await this.execute(true);
  }

  async executeCondition(msg) {
    const block = this.nodeStructure[this.index];
    if (!block || !block.Cond) return;

    let successfulCond = -1;

    for (let i = 0; i < block.Cond.length; i++) {
      const cond = block.Cond[i];
      if (evalCondition(cond, this.variables, msg, this.globalConstants)) {
        successfulCond = i;
        break;
      }
    }

    if (successfulCond === -1 && block.Nexts.length > block.Cond.length) {
      successfulCond = block.Cond.length;
    }

    if (successfulCond >= 0 && successfulCond < block.Nexts.length) {
      this.index = block.Nexts[successfulCond];
      this.skipInput = true;
      await this.execute();
    } else {
      this.ui.finish();
      this.isFinished = true;
    }
  }

  async executeVariable() {
    const block = this.nodeStructure[this.index];
    if (!block) return;

    if (block.SaveNextToVariable) {
      this.saveNext = true;
      this.saveName = block.SaveNextToVariable;
      this.saveType = 'string';

      if (block.Nexts.length > 0) {
        this.index = block.Nexts[0];
        await this.execute(false);
        return;
      } else {
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

    if (block.VariableName && block.VariableValue !== undefined) {
      let value = block.VariableValue;
      value = value.replace(/\\{\\{(\\w+)\\}\\}/g, (match, varName) => {
        if (this.variables[varName] !== undefined && this.variables[varName] !== null) {
          return String(this.variables[varName]);
        } else if (this.globalConstants && this.globalConstants[varName] !== undefined && this.globalConstants[varName] !== null) {
          return String(this.globalConstants[varName]);
        }
        return match;
      });

      const numValue = Number(value);
      if (!isNaN(numValue) && value.trim() !== '') {
        this.variables[block.VariableName] = numValue;
      } else {
        this.variables[block.VariableName] = value;
      }
    }

    if (block.Nexts.length > 0) {
      this.index = block.Nexts[0];
      this.skipInput = true;
      await this.execute();
    } else {
      this.ui.finish();
      this.isFinished = true;
    }
  }

  async executeFILE() {
    const block = this.nodeStructure[this.index];
    if (!block) return;

    const replaceVariables = (text) => {
      return text.replace(/\\{\\{(\\w+)\\}\\}/g, (match, varName) => {
        if (this.files[varName] !== undefined && this.files[varName] !== null) {
          return String(this.files[varName]);
        } else if (this.variables[varName] !== undefined && this.variables[varName] !== null) {
          return String(this.variables[varName]);
        } else if (this.globalConstants && this.globalConstants[varName] !== undefined && this.globalConstants[varName] !== null) {
          return String(this.globalConstants[varName]);
        }
        return match;
      });
    };

    switch (block.FILEAct) {
      case 'Upload': {
        let fileName = block.FileName || 'file';
        fileName = replaceVariables(fileName);

        let pathToSave = block.PathToSave || '';
        pathToSave = replaceVariables(pathToSave);

        const uniqueName = await this.ui.getFile(pathToSave, fileName);
        const varName = block.FileName || 'lastFile';
        this.files[varName] = uniqueName;
        this.files['lastFile'] = uniqueName;
        this.variables[varName] = uniqueName;
        break;
      }

      case 'DownLoad': {
        if (!block.PathToFile) {
          throw new Error(\`PathToFile is required for download in block \${this.index}\`);
        }

        let filePath = replaceVariables(block.PathToFile);
        this.ui.sendFile(filePath);
        break;
      }

      case 'Delete': {
        if (!block.PathToFile) {
          throw new Error(\`PathToFile is required for delete in block \${this.index}\`);
        }

        let filePath = replaceVariables(block.PathToFile);
        this.ui.deleteFile(filePath);
        break;
      }

      case 'Read': {
        if (!block.PathToFile) {
          throw new Error(\`PathToFile is required for read in block \${this.index}\`);
        }

        let filePath = replaceVariables(block.PathToFile);

        if (block.FileName) {
          this.variables[block.FileName] = filePath;
          this.files[block.FileName] = filePath;
        }
        break;
      }

      default:
        throw new Error(\`Unknown FILEAct in block \${this.index}\`);
    }

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

  async executeAPI() {
    const block = this.nodeStructure[this.index];
    if (!block || !block.ApiUrl) {
      return;
    }

    const startTime = Date.now();
    const timestamp = new Date().toISOString();


    try {
      const replaceVariable = (varName) => {
        if (this.variables[varName] !== undefined && this.variables[varName] !== null) {
          return String(this.variables[varName]);
        } else if (this.globalConstants && this.globalConstants[varName] !== undefined && this.globalConstants[varName] !== null) {
          return String(this.globalConstants[varName]);
        }
        return \`\\{\${varName}\\\}\`;
      };

      let url = block.ApiUrl;
      const urlVariables = {};
      url = url.replace(/\\{\\{(\\w+)\\}\\}/g, (match, varName) => {
        const value = replaceVariable(varName);
        urlVariables[varName] = value;
        return value;
      });

      if (Object.keys(urlVariables).length > 0) {
      }

      let body = block.ApiBody || '';
      const bodyVariables = {};
      if (body) {
        body = body.replace(/\\{\\{(\\w+)\\}\\}/g, (match, varName) => {
          const varValue = this.variables[varName] !== undefined ? this.variables[varName] :
                          (this.globalConstants && this.globalConstants[varName] !== undefined ? this.globalConstants[varName] : null);
          bodyVariables[varName] = varValue;

          if (varValue === null || varValue === undefined) {
            return 'null';
          }

          if (typeof varValue === 'object' && !Array.isArray(varValue)) {
            return JSON.stringify(varValue);
          }

          if (Array.isArray(varValue)) {
            return JSON.stringify(varValue);
          }

          if (typeof varValue === 'number' || typeof varValue === 'boolean') {
            return String(varValue);
          }

          const matchIndex = body.indexOf(match);
          if (matchIndex !== -1) {
            const beforeMatch = body.substring(0, matchIndex);
            const lastQuote = Math.max(
              beforeMatch.lastIndexOf('"'),
              beforeMatch.lastIndexOf("'")
            );
            const lastColon = beforeMatch.lastIndexOf(':');

            if (lastColon !== -1 && (lastQuote === -1 || lastQuote < lastColon)) {
              return JSON.stringify(String(varValue));
            }
          }

          return String(varValue);
        });

        try {
          const bodyObj = JSON.parse(body);
          body = JSON.stringify(bodyObj);
        } catch (e) {
        }
      }

      const headers = {
        'Content-Type': 'application/json',
        ...(block.ApiHeaders || {}),
      };

      Object.keys(headers).forEach(key => {
        if (headers[key]) {
          headers[key] = headers[key].replace(/\\{\\{(\\w+)\\}\\}/g, (match, varName) => replaceVariable(varName));
        }
      });

      const method = block.ApiMethod || 'GET';
      const fetchOptions = {
        method,
        headers,
        mode: 'cors',
        credentials: 'omit',
      };

      if (method !== 'GET' && body) {
        fetchOptions.body = body;
      }

      if (Object.keys(headers).length > 0) {
      }
      if (method !== 'GET' && body) {
        if (Object.keys(bodyVariables).length > 0) {
        }
      }
      if (block.ApiResponseVariable) {
      }
      if (block.ApiAnswersPath && block.ApiAnswersVariable) {
      }

      let fetchFn;
      const isBrowser = typeof window !== 'undefined';

      if (isBrowser) {
        fetchFn = globalThis.fetch;
      } else {
        if (typeof globalThis.fetch !== 'undefined') {
          fetchFn = globalThis.fetch;
        } else if (typeof fetch !== 'undefined') {
          fetchFn = fetch;
        } else {
          try {
            const nodeFetch = require('node-fetch');
            fetchFn = nodeFetch.default || nodeFetch;
          } catch (e) {
            throw new Error('fetch is not available. Please install node-fetch (npm install node-fetch) or use Node.js 18+');
          }
        }
      }

      let response;
      try {
        response = await fetchFn(url, fetchOptions);
      } catch (fetchError) {
        const errorMessage = fetchError.message || String(fetchError);
        if (errorMessage.includes('CORS') || errorMessage.includes('access control')) {
          const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
          const errorMsg = isLocalhost
            ? \`CORS error: The API server at \${url} does not allow requests from this origin. This is a browser security restriction. Please configure CORS on the server (add Access-Control-Allow-Origin header) or use an external API endpoint.\`
            : \`CORS error: The API server at \${url} does not allow requests from this origin. Please configure CORS on the server or contact the API provider.\`;
          throw new Error(errorMsg);
        }
        throw fetchError;
      }

      const duration = Date.now() - startTime;
      let responseData;
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

      if (block.ApiResponseVariable && block.ApiResponseVariable.trim() !== '') {
        const varName = block.ApiResponseVariable.trim();
        this.variables[varName] = responseData;
        this.variables[\`\${varName}_status\`] = response.status;
      } else {
      }

      if (block.ApiAnswersPath && block.ApiAnswersPath.trim() !== '') {
        try {
          const path = block.ApiAnswersPath.trim();
          let answersArray = responseData;
          const pathParts = path.split('.').filter(p => p.trim() !== '');
          for (const part of pathParts) {
            if (answersArray && typeof answersArray === 'object' && part in answersArray) {
              answersArray = answersArray[part];
            } else {
              answersArray = null;
              break;
            }
          }
          if (Array.isArray(answersArray)) {
            const answersVarName = block.ApiAnswersVariable?.trim() || \`\${block.ApiResponseVariable || 'apiResponse'}_answers\`;
            this.variables[answersVarName] = answersArray.map(item => String(item));
          } else {
          }
        } catch (error) {
        }
      }


      if (block.Nexts.length > 0) {
        this.index = block.Nexts[0];
        this.skipInput = true;
        await this.execute();
      } else {
        this.ui.finish();
        this.isFinished = true;
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      if (block.ApiResponseVariable && block.ApiResponseVariable.trim() !== '') {
        const varName = block.ApiResponseVariable.trim();
        this.variables[varName] = {
          error: error.message || String(error),
          errorType: error.name || 'UnknownError'
        };
        this.variables[\`\${varName}_status\`] = error.status || 0;
      } else {
      }


      if (block.Nexts.length > 0) {
        this.index = block.Nexts[0];
        this.skipInput = true;
        await this.execute();
      } else {
        this.ui.finish();
        this.isFinished = true;
      }
    }
  }

  async executeScript() {
    const block = this.nodeStructure[this.index];
    if (!block || !block.ScriptCode) {
      if (block && block.Nexts.length > 0) {
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
      const scriptContext = {
        variables: this.variables,
        globalConstants: this.globalConstants,
        setVariable: (name, value) => {
          this.variables[name] = value;
        },
        getVariable: (name) => {
          return this.variables[name] !== undefined ? this.variables[name] :
                 (this.globalConstants && this.globalConstants[name] !== undefined ? this.globalConstants[name] : undefined);
        },
      };

      const scriptFunction = new Function(
        'variables',
        'globalConstants',
        'setVariable',
        'getVariable',
        \`
        try {
          \${block.ScriptCode}
        } catch (error) {
          throw new Error('Script execution error: ' + error.message);
        }
        \`
      );

      const result = scriptFunction.call(
        scriptContext,
        this.variables,
        this.globalConstants,
        scriptContext.setVariable,
        scriptContext.getVariable
      );

      if (block.ScriptReturnVariable && result !== undefined) {
        this.variables[block.ScriptReturnVariable] = result;
      }

      if (block.Nexts.length > 0) {
        this.index = block.Nexts[0];
        this.skipInput = true;
        await this.execute();
      } else {
        this.ui.finish();
        this.isFinished = true;
      }
    } catch (error) {
      if (block.ScriptReturnVariable) {
        this.variables[block.ScriptReturnVariable] = {
          error: error.message || String(error),
          errorType: 'ScriptExecutionError'
        };
      }

      if (block.Nexts.length > 0) {
        this.index = block.Nexts[0];
        this.skipInput = true;
        await this.execute();
      } else {
        this.ui.finish();
        this.isFinished = true;
      }
    }
  }

  async executeSkip() {
    const block = this.nodeStructure[this.index];
    if (block && block.Nexts.length > 0) {
      this.index = block.Nexts[0];
      this.skipInput = true;
      await this.execute();
    }
  }

  getVariables() {
    return { ...this.variables };
  }

  getVariable(name) {
    return this.variables[name];
  }

  hasVariable(name) {
    return name in this.variables;
  }

  reset() {
    this.variables = {};
    if (this.globalConstants) {
      Object.assign(this.variables, this.globalConstants);
    }
    this.isFinished = false;
    this.skipInput = false;
    this.saveNext = false;
    this.executionCount = {};
    this.lastExecutedBlock = null;
  }
}

// ===== END ENGINE CODE =====
`}

// Экспорт проекта в код для Telegram бота
export function exportToTelegram(project: Project): TelegramBotCode {
  // Проверяем токен в разных полях для совместимости
  const token = project.telegramToken || project.botToken;
  if (!token) {
    throw new Error('Telegram token не установлен в настройках проекта');
  }

  // Конвертируем проект в формат Engine
  const engineNodes = adaptProjectToEngine(project);
  const projectJson = JSON.stringify(engineNodes, null, 2);

  const header = `// Генерированный код для Telegram бота
// Проект: ${project.name}
// Дата: ${new Date().toISOString()}
// Этот код содержит полный движок No-Code Bot

`;
  const requires = `const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

`;
  const tokenLine = `const TOKEN = '${token}';
const bot = new TelegramBot(TOKEN, { polling: true });

`;
  const globals = project.globalConstants ? generateGlobalConstants(project.globalConstants) + '\n' : '';
  const engineCode = generateEngineCode();

  // Основная логика бота
  const main = `
// ===== BOT LOGIC =====

// Хранение состояний ботов по chatId
const botInstances = new Map();

// Функция создания или получения бота для чата
function getBotForChat(chatId) {
  if (!botInstances.has(chatId)) {
    const ui = new TelegramUI(bot, chatId);
    const engine = new Engine(ui, BOT_STRUCTURE, GLOBAL_CONSTANTS);
    botInstances.set(chatId, { ui, engine, isActive: false });
  }
  return botInstances.get(chatId);
}

// Обработка текстовых сообщений
bot.on('text', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;


  try {
    const { ui, engine, isActive } = getBotForChat(chatId);

    // Если бот уже активен, передаем сообщение в UI
    if (isActive) {
      ui.handleUserMessage(text);
      return;
    }

    // Если бот не активен, запускаем его
    botInstances.get(chatId).isActive = true;

    // Запускаем бота асинхронно
    (async () => {
      try {
        await engine.execute(true);
      } catch (error) {
        try {
          await bot.sendMessage(chatId, '⚠️ Произошла ошибка при обработке вашего запроса');
        } catch (sendError) {
        }
      } finally {
        botInstances.get(chatId).isActive = false;
      }
    })();

  } catch (error) {
    try {
      await bot.sendMessage(chatId, '⚠️ Произошла ошибка при обработке вашего запроса');
    } catch (sendError) {
    }
  }
});

// Обработка callback query (нажатия на inline кнопки)
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;


  try {
    const { ui, isActive } = getBotForChat(chatId);

    if (isActive) {
      // Отвечаем на callback query
      await bot.answerCallbackQuery(query.id);

      // Передаем выбранный вариант в UI
      ui.handleUserMessage(data);
    }
  } catch (error) {
  }
});

// Обработка файлов
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;


  try {
    const { ui, isActive } = getBotForChat(chatId);

    if (isActive) {
      // Для простоты используем имя файла
      const fileName = msg.document.file_name || \`file_\${Date.now()}\`;
      ui.handleUserFile(fileName);
    }
  } catch (error) {
  }
});

// Обработка фото
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;


  try {
    const { ui, isActive } = getBotForChat(chatId);

    if (isActive) {
      // Используем временное имя для фото
      const fileName = \`photo_\${Date.now()}.jpg\`;
      ui.handleUserFile(fileName);
    }
  } catch (error) {
  }
});


// ===== END BOT LOGIC =====
`;

  const code = header + requires + tokenLine + globals + engineCode + `
// ===== BOT STRUCTURE =====
const BOT_STRUCTURE = ${projectJson};
const GLOBAL_CONSTANTS = ${JSON.stringify(project.globalConstants || {})};

` + main;

  return {
    token,
    code,
    projectJson
  };
}

// Создание архива для экспорта
export function createTelegramExport(project: Project): { code: string; instructions: string; files: { name: string; content: string }[] } {
  const { code, projectJson } = exportToTelegram(project);

  // Создаем package.json
  const packageJson = {
    name: `telegram-bot-${project.name.toLowerCase().replace(/\s+/g, '-')}`,
    version: "1.0.0",
    description: `Telegram bot generated from No-Code Bot project: ${project.name}`,
    main: "bot.js",
    scripts: {
      start: "node bot.js"
    },
    dependencies: {
      "node-telegram-bot-api": "^0.66.0"
    },
    keywords: ["telegram", "bot", "no-code", "chatbot"],
    author: "No-Code Bot Generator",
    license: "MIT"
  };

  const instructions = `# 🚀 Инструкция по запуску Telegram бота

## 📋 Требования
- Node.js версии 14 или выше
- Telegram аккаунт и токен от @BotFather

## 🛠️ Установка и запуск

### Локальный запуск

1. **Распакуйте архив** в отдельную папку

2. **Установите зависимости:**
   \`\`\`bash
   npm install
   \`\`\`

3. **Проверьте токен** в файле \`bot.js\` (строка с \`const TOKEN = 'ВАШ_ТОКЕН';\`)

4. **Запустите бота:**
   \`\`\`bash
   npm start
   # или
   node bot.js
   \`\`\`

### Деплой на сервер

#### Heroku
1. Создайте приложение на Heroku
2. Загрузите файлы через Heroku CLI или Git
3. Установите переменную окружения \`TELEGRAM_TOKEN\` в настройках Heroku
4. Запустите приложение

#### VPS сервер
1. Загрузите файлы на сервер
2. Установите Node.js
3. Запустите \`npm install && npm start\`
4. Для постоянной работы используйте PM2:
\`\`\`bash
   npm install -g pm2
   pm2 start bot.js --name "telegram-bot"
   pm2 save
   pm2 startup
\`\`\`

#### Railway, Render, или другие платформы
1. Создайте проект
2. Загрузите файлы
3. Установите переменную окружения \`TELEGRAM_TOKEN\`
4. Запустите приложение

## ⚙️ Настройка

### Переменные окружения
Вы можете использовать переменную окружения вместо жестко заданного токена:
\`\`\`bash
export TELEGRAM_TOKEN=ваш_токен_здесь
node bot.js
\`\`\`

### Кастомизация
- Измените логику в \`bot.js\` для дополнительной функциональности
- Настройте обработку ошибок
- Добавьте логирование в базы данных

## 🔧 Возможные проблемы

### Токен не работает
- Проверьте, что токен получен от @BotFather
- Убедитесь, что бот не заблокирован
- Проверьте права доступа к API

### Бот не отвечает
- Проверьте консоль на ошибки
- Убедитесь, что порт 80/443 открыт (для вебхуков)
- Проверьте интернет-соединение

### CORS ошибки
- При использовании API блоков убедитесь, что сервер поддерживает CORS
- Или используйте прокси-сервер

## 📞 Поддержка

- Документация node-telegram-bot-api: https://github.com/yagop/node-telegram-bot-api
- Telegram Bot API: https://core.telegram.org/bots/api

## 📝 Логи

Бот ведет подробные логи в консоль:
- 📨 Входящие сообщения
- 🔄 Состояние бота
- ✅ Успешные операции
- ❌ Ошибки

Приятного использования! 🤖
`;

  const files = [
    {
      name: 'bot.js',
      content: code
    },
    {
      name: 'package.json',
      content: JSON.stringify(packageJson, null, 2)
    },
    {
      name: 'README.md',
      content: instructions
    },
    {
      name: 'project-structure.json',
      content: projectJson
    }
  ];

  return { code, instructions, files };
}
