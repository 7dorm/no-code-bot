// Генерированный код для Telegram бота
// Проект: Hospital
// Дата: 2025-12-24T02:32:54.131Z
// Этот код содержит полный движок No-Code Bot

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const TOKEN = '8383255570:AAFIGJqXkc5C9d2_mKkul-TZWHrkPCooG_E';
const bot = new TelegramBot(TOKEN, { polling: true });



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
      await this.bot.sendMessage(this.chatId, `Ошибка отправки файла: ${path}`);
    }
  }

  async getFile(pathToSave, name) {
    await this.bot.sendMessage(this.chatId, `📎 Пожалуйста, отправьте файл: ${name}`);
    return new Promise((resolve) => {
      this.fileResolver = resolve;
    });
  }

  handleUserFile(fileName) {
    if (this.fileResolver) {
      const uniqueName = `${fileName}_${Date.now()}`;
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
  const matches = [...condStr.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);

  matches.forEach((match) => {
    if (variables[match] !== undefined && variables[match] !== null) {
      processedCond = processedCond.replace(`\{${match}\}`, String(variables[match]));
    } else if (globalConstants && globalConstants[match] !== undefined && globalConstants[match] !== null) {
      processedCond = processedCond.replace(`\{${match}\}`, String(globalConstants[match]));
    }
  });

  processedCond = processedCond.replace(/\buserInput\b/g, userInput);

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

        const numMatch = part.match(/^\s*([\w{}.]+)\s*([<>]=?|==|!=)\s*([\w{}.]+)\s*$/);
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
    processedText = processedText.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
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
        throw new Error(`Unknown answer "${userAnswer}" at block: ${this.index}`);
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
      value = value.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
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
      return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
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
          throw new Error(`PathToFile is required for download in block ${this.index}`);
        }

        let filePath = replaceVariables(block.PathToFile);
        this.ui.sendFile(filePath);
        break;
      }

      case 'Delete': {
        if (!block.PathToFile) {
          throw new Error(`PathToFile is required for delete in block ${this.index}`);
        }

        let filePath = replaceVariables(block.PathToFile);
        this.ui.deleteFile(filePath);
        break;
      }

      case 'Read': {
        if (!block.PathToFile) {
          throw new Error(`PathToFile is required for read in block ${this.index}`);
        }

        let filePath = replaceVariables(block.PathToFile);

        if (block.FileName) {
          this.variables[block.FileName] = filePath;
          this.files[block.FileName] = filePath;
        }
        break;
      }

      default:
        throw new Error(`Unknown FILEAct in block ${this.index}`);
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
        return `\{${varName}\}`;
      };

      let url = block.ApiUrl;
      const urlVariables = {};
      url = url.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        const value = replaceVariable(varName);
        urlVariables[varName] = value;
        return value;
      });

      if (Object.keys(urlVariables).length > 0) {
      }

      let body = block.ApiBody || '';
      const bodyVariables = {};
      if (body) {
        body = body.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
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
          headers[key] = headers[key].replace(/\{\{(\w+)\}\}/g, (match, varName) => replaceVariable(varName));
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
            ? `CORS error: The API server at ${url} does not allow requests from this origin. This is a browser security restriction. Please configure CORS on the server (add Access-Control-Allow-Origin header) or use an external API endpoint.`
            : `CORS error: The API server at ${url} does not allow requests from this origin. Please configure CORS on the server or contact the API provider.`;
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
        this.variables[`${varName}_status`] = response.status;
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
            const answersVarName = block.ApiAnswersVariable?.trim() || `${block.ApiResponseVariable || 'apiResponse'}_answers`;
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
        this.variables[`${varName}_status`] = error.status || 0;
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
        `
        try {
          ${block.ScriptCode}
        } catch (error) {
          throw new Error('Script execution error: ' + error.message);
        }
        `
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

// ===== BOT STRUCTURE =====
const BOT_STRUCTURE = [
  {
    "id": "start-block",
    "Type": "start",
    "Nexts": [
      "c74952ec-d6fa-4b3d-8bc3-a555f6aa9d92"
    ],
    "skip": true
  },
  {
    "id": "c74952ec-d6fa-4b3d-8bc3-a555f6aa9d92",
    "Type": "api",
    "Nexts": [
      "0d79d1b3-00a0-408b-be4a-bea2e086c76f"
    ],
    "ApiUrl": "http://localhost:3003/api/doctors",
    "ApiMethod": "GET",
    "ApiResponseVariable": "d",
    "ApiAnswersPath": "doctors",
    "ApiAnswersVariable": "doctors"
  },
  {
    "id": "0d79d1b3-00a0-408b-be4a-bea2e086c76f",
    "Type": "output",
    "Nexts": [
      "f3fbf6bd-b84a-4f4d-8a82-710f962d9d13"
    ],
    "Text": "Здравствуйте, этот бот для записи к врачу.\nВыберите врача для записи",
    "VarName": "choosedDoctor",
    "VarType": "string",
    "AnswersFromVariable": "doctors"
  },
  {
    "id": "4123e84a-8d29-42dc-a5ed-e1a6e62f0ad3",
    "Type": "api",
    "Nexts": [
      "efd1c76a-2512-4f57-9843-e14c5fc90325"
    ],
    "ApiUrl": "http://localhost:3003/api/slots?doctor={{choosedDoctor}}&date={{choosedDate}}",
    "ApiMethod": "GET",
    "ApiResponseVariable": "date",
    "ApiAnswersPath": "times",
    "ApiAnswersVariable": "times"
  },
  {
    "id": "6ce4ab86-900a-4311-8e98-d4fb594c96a5",
    "Type": "output",
    "Nexts": [
      "4123e84a-8d29-42dc-a5ed-e1a6e62f0ad3"
    ],
    "Text": "Укажите дату для записи",
    "VarName": "choosedDate",
    "VarType": "string",
    "AnswersFromVariable": "dates"
  },
  {
    "id": "efd1c76a-2512-4f57-9843-e14c5fc90325",
    "Type": "condition",
    "Nexts": [
      "c104b129-6bcd-4a59-83a4-75f59a6586b0",
      "1e08f84a-1cf7-406e-b889-1b729a70d0ef"
    ],
    "Cond": [
      "times.length >0"
    ]
  },
  {
    "id": "1e08f84a-1cf7-406e-b889-1b729a70d0ef",
    "Type": "output",
    "Nexts": [
      "4123e84a-8d29-42dc-a5ed-e1a6e62f0ad3"
    ],
    "Text": "На указанную дату нет времени на запись, выберите другую дату ",
    "VarName": "choosedDate",
    "VarType": "string",
    "AnswersFromVariable": "times"
  },
  {
    "id": "c104b129-6bcd-4a59-83a4-75f59a6586b0",
    "Type": "output",
    "Nexts": [
      "9ac05a05-b6c2-427d-8348-e5327447a4f9"
    ],
    "Text": "Выберите время для записи",
    "VarName": "time",
    "VarType": "string",
    "AnswersFromVariable": "times"
  },
  {
    "id": "d3f5be7c-81f2-4dcf-916f-d548549ac4c3",
    "Type": "output",
    "Nexts": [
      "24823b08-07a5-4af9-83a1-9def7dbcdf16"
    ],
    "Text": "Прикрепите фото документов удостоверяющих личность"
  },
  {
    "id": "24823b08-07a5-4af9-83a1-9def7dbcdf16",
    "Type": "FILE",
    "Nexts": [
      "5eada83a-019f-4e8c-8cf3-80645ad7abc7"
    ],
    "FILEAct": "Upload",
    "FileName": "",
    "PathToFile": "/patients/",
    "PathToSave": "/patients/"
  },
  {
    "id": "9ac05a05-b6c2-427d-8348-e5327447a4f9",
    "Type": "output",
    "Nexts": [
      "4ad70f37-6b1f-4000-b776-f6e50f6593e1"
    ],
    "Text": "Введите ФИО",
    "VarName": "fio",
    "VarType": "string"
  },
  {
    "id": "4ad70f37-6b1f-4000-b776-f6e50f6593e1",
    "Type": "output",
    "Nexts": [
      "d3f5be7c-81f2-4dcf-916f-d548549ac4c3"
    ],
    "Text": "Укажите номер телефона",
    "VarName": "phone",
    "VarType": "string"
  },
  {
    "id": "5eada83a-019f-4e8c-8cf3-80645ad7abc7",
    "Type": "api",
    "Nexts": [
      "8b213c83-2ec1-4ab1-b3b0-55ec914d1cf5"
    ],
    "ApiUrl": "http://localhost:3003/api/appointments",
    "ApiMethod": "POST",
    "ApiBody": "{\n  \"doctor\": {{choosedDoctor}}, \n  \"date\": {{choosedDate}}, \n  \"time\": {{time}}, \n  \"patient\": {\n    \"name\": {{fio}}, \n    \"phone\": {{phone}} \n  }\n}",
    "ApiResponseVariable": "api"
  },
  {
    "id": "f3fbf6bd-b84a-4f4d-8a82-710f962d9d13",
    "Type": "api",
    "Nexts": [
      "6ce4ab86-900a-4311-8e98-d4fb594c96a5"
    ],
    "ApiUrl": "http://localhost:3003/api/dates?doctor={{choosedDoctor}}",
    "ApiMethod": "GET",
    "ApiBody": "{\n  \"doctor\": {{choosedDoctor}}, \n  \"date\": {{choosedDate}}, \n  \"time\": {{time}}, \n  \"patient\": {\n    \"name\": {{fio}}, \n    \"phone\": {{phone}} \n  }\n}",
    "ApiResponseVariable": "selectedDates",
    "ApiAnswersPath": "dates",
    "ApiAnswersVariable": "dates"
  },
  {
    "id": "379dadb8-4cf9-4640-9883-0dd6be407676",
    "Type": "output",
    "Nexts": [],
    "Text": "{{api}}"
  },
  {
    "id": "8b213c83-2ec1-4ab1-b3b0-55ec914d1cf5",
    "Type": "script",
    "Nexts": [
      "379dadb8-4cf9-4640-9883-0dd6be407676"
    ],
    "ScriptCode": "let doctor = variables.api.doctor;\nlet date = variables.api.date;\nlet time = variables.api.time;\nlet patient = variables.api.patient.name;\nlet status = variables.api.status;\n\nvariables.api = `Пациент ${patient} сделал запись к ${doctor} ${date} в ${time}. Статус: ${status}`",
    "ScriptReturnVariable": ""
  }
];
const GLOBAL_CONSTANTS = {};


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
      const fileName = msg.document.file_name || `file_${Date.now()}`;
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
      const fileName = `photo_${Date.now()}.jpg`;
      ui.handleUserFile(fileName);
    }
  } catch (error) {
  }
});


// ===== END BOT LOGIC =====
