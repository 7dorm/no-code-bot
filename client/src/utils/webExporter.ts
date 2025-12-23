import { Project } from '../types';
import { adaptProjectToEngine } from './backend/projectAdapter';

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

// Генерация кода Engine для веб-версии
function generateWebEngineCode(): string {
  return `
// ===== ENGINE CODE FOR WEB =====
// Этот код скопирован из движка No-Code Bot

class UI {
  async sendMessage(message, answers = []) {}
  async getInput() {}
  async getFile(pathToSave, name) {}
  sendFile(path) {}
  deleteFile(path) {}
  finish() {}
}

class WebUI extends UI {
  constructor(chatContainer) {
    super();
    this.chatContainer = chatContainer;
    this.stop = false;
    this.inputResolver = null;
    this.fileResolver = null;
    this.messageQueue = [];
    this.isProcessing = false;
  }

  async sendMessage(message, answers = []) {
    return new Promise((resolve) => {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message bot-message';

      const bubble = document.createElement('div');
      bubble.className = 'message-bubble';
      bubble.textContent = message;

      messageDiv.appendChild(bubble);

      if (answers && answers.length > 0) {
        // Скрываем текстовое поле ввода, если есть кнопки выбора
        this.hideTextInput();

        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'quick-replies';

        answers.forEach(answer => {
          const button = document.createElement('button');
          button.className = 'quick-reply-btn';
          button.textContent = answer;
          button.onclick = () => {
            // Добавляем выбор пользователя в чат
            const userMessageDiv = document.createElement('div');
            userMessageDiv.className = 'message user-message';

            const userBubble = document.createElement('div');
            userBubble.className = 'message-bubble';
            userBubble.textContent = answer;

            userMessageDiv.appendChild(userBubble);
            this.chatContainer.appendChild(userMessageDiv);

            // Прокручиваем вниз
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;

            // Убираем кнопки
            buttonsDiv.remove();

            // Разрешаем промис
            if (this.inputResolver) {
              this.inputResolver(answer);
              this.inputResolver = null;
            }
          };
          buttonsDiv.appendChild(button);
        });

        messageDiv.appendChild(buttonsDiv);
      }

      this.chatContainer.appendChild(messageDiv);
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight;

      resolve();
    });
  }

  async getInput() {
    return new Promise((resolve) => {
      this.inputResolver = resolve;

      // Показываем поле ввода текста
      this.showTextInput();
    });
  }

  showTextInput() {
    // Убираем существующее поле ввода, если есть
    const existingInput = document.querySelector('.text-input-area');
    if (existingInput) {
      existingInput.remove();
    }

    // Создаем контейнер для ввода
    const inputContainer = document.createElement('div');
    inputContainer.className = 'text-input-area';

    // Создаем поле ввода
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'text-input';
    input.placeholder = 'Введите сообщение...';
    input.maxLength = 1000;

    // Создаем кнопку отправки
    const sendButton = document.createElement('button');
    sendButton.className = 'send-btn';
    sendButton.innerHTML = '📤';
    sendButton.title = 'Отправить';

    // Обработчик ввода
    const handleSend = () => {
      const text = input.value.trim();
      if (text) {
        // Добавляем сообщение пользователя в чат
        const userMessageDiv = document.createElement('div');
        userMessageDiv.className = 'message user-message';

        const userBubble = document.createElement('div');
        userBubble.className = 'message-bubble';
        userBubble.textContent = text;

        userMessageDiv.appendChild(userBubble);
        this.chatContainer.appendChild(userMessageDiv);

        // Прокручиваем вниз
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;

        // Очищаем и скрываем поле ввода
        inputContainer.remove();

        // Разрешаем промис
        if (this.inputResolver) {
          this.inputResolver(text);
          this.inputResolver = null;
        }
      }
    };

    // Обработчики событий
    sendButton.onclick = handleSend;
    input.onkeypress = (e) => {
      if (e.key === 'Enter') {
        handleSend();
      }
    };

    // Добавляем элементы в контейнер
    inputContainer.appendChild(input);
    inputContainer.appendChild(sendButton);

    // Добавляем в чат-контейнер
    const chatContainer = this.chatContainer.parentElement;
    chatContainer.appendChild(inputContainer);

    // Фокус на поле ввода
    setTimeout(() => input.focus(), 100);
  }

  hideTextInput() {
    const existingInput = document.querySelector('.text-input-area');
    if (existingInput) {
      existingInput.remove();
    }
  }

  finish() {
    this.stop = true;
    // Скрываем поле ввода
    this.hideTextInput();
    // Показываем сообщение о завершении
    const finishDiv = document.createElement('div');
    finishDiv.className = 'message bot-message';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = '👋 <strong>Диалог завершен!</strong><br><button onclick="restartBot()" class="restart-btn">🔄 Начать заново</button>';

    finishDiv.appendChild(bubble);
    this.chatContainer.appendChild(finishDiv);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  async sendFile(path) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = \`📎 Файл: <code>\${path}</code>\`;

    messageDiv.appendChild(bubble);
    this.chatContainer.appendChild(messageDiv);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  async getFile(pathToSave, name) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = \`📎 Пожалуйста, загрузите файл: <strong>\${name}</strong>\`;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.marginTop = '10px';

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        // Добавляем сообщение о загрузке файла
        const userMessageDiv = document.createElement('div');
        userMessageDiv.className = 'message user-message';

        const userBubble = document.createElement('div');
        userBubble.className = 'message-bubble';
        userBubble.textContent = \`📎 Файл загружен: \${file.name}\`;

        userMessageDiv.appendChild(userBubble);
        this.chatContainer.appendChild(userMessageDiv);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;

        // Разрешаем промис с именем файла
        if (this.fileResolver) {
          const uniqueName = \`\${file.name}_\${Date.now()}\`;
          this.fileResolver(uniqueName);
          this.fileResolver = null;
        }
      }
    };

    bubble.appendChild(fileInput);
    messageDiv.appendChild(bubble);
    this.chatContainer.appendChild(messageDiv);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;

    return new Promise((resolve) => {
      this.fileResolver = resolve;
    });
  }

  handleUserMessage(text) {
    if (this.inputResolver) {
      this.inputResolver(text);
      this.inputResolver = null;
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
      // Пустое сообщение пропускается
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
          // Body не является JSON, оставляем как есть
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
          }
        } catch (error) {
          // Не удалось извлечь массив ответов
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

// Экспорт проекта в веб-приложение
export function exportToWeb(project: Project): WebAppCode {
  // Конвертируем проект в формат Engine
  const engineNodes = adaptProjectToEngine(project);
  const projectJson = JSON.stringify(engineNodes, null, 2);

  const header = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.name} - No-Code Bot</title>
    <style>
`;
  const globals = project.globalConstants ? generateGlobalConstants(project.globalConstants) + '\n' : '';
  const engineCode = generateWebEngineCode();

  const htmlContent = `
    </style>
</head>
<body>
    <div class="chatbot-container">
        <div class="chatbot-header">
            <h2>🤖 ${project.name}</h2>
            <p>Создано в No-Code Bot</p>
        </div>

        <div class="chat-messages" id="chatMessages">
            <div class="message bot-message">
                <div class="message-bubble">
                    👋 Привет! Нажмите "Начать чат" для начала разговора.
                </div>
            </div>
        </div>

        <div class="chat-input-area">
            <button id="startButton" class="start-btn">🚀 Начать чат</button>
        </div>
    </div>

    <script>
        // ===== GLOBAL CONSTANTS =====
        ${globals}

        // ===== BOT STRUCTURE =====
        const BOT_STRUCTURE = ${projectJson};
        const GLOBAL_CONSTANTS = ${JSON.stringify(project.globalConstants || {})};

        // ===== ENGINE CODE =====
        ${engineCode}

        // ===== WEB APP LOGIC =====
        let currentEngine = null;
        let currentUI = null;

        const chatMessages = document.getElementById('chatMessages');
        const startButton = document.getElementById('startButton');

        function restartBot() {
            // Очищаем чат, оставляя только приветственное сообщение
            chatMessages.innerHTML = \`
                <div class="message bot-message">
                    <div class="message-bubble">
                        👋 Привет! Нажмите "Начать чат" для начала разговора.
                    </div>
                </div>
            \`;

            // Показываем кнопку старта
            startButton.style.display = 'block';

            // Сбрасываем движок
            currentEngine = null;
            currentUI = null;
        }

        async function startBot() {
            try {
                // Скрываем кнопку старта
                startButton.style.display = 'none';

                // Создаем UI и Engine
                currentUI = new WebUI(chatMessages);
                currentEngine = new Engine(currentUI, BOT_STRUCTURE, GLOBAL_CONSTANTS);

                // Запускаем бота
                await currentEngine.execute(true);

            } catch (error) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'message bot-message';
                errorDiv.innerHTML = \`
                    <div class="message-bubble">
                        ⚠️ Произошла ошибка: \${error.message}
                    </div>
                \`;
                chatMessages.appendChild(errorDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }

        // Обработчик нажатия кнопки старта
        startButton.addEventListener('click', startBot);

        // Функция для перезапуска (экспортируется глобально)
        window.restartBot = restartBot;


        // ===== END WEB APP LOGIC =====
    </script>
</body>
</html>`;

  // Создаем CSS для веб-приложения
  const cssContent = `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        .chatbot-container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            width: 100%;
            max-width: 500px;
            height: 70vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .chatbot-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
        }

        .chatbot-header h2 {
            margin-bottom: 5px;
            font-size: 24px;
        }

        .chatbot-header p {
            opacity: 0.9;
            font-size: 14px;
        }

        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            background: #f8f9fa;
        }

        .message {
            display: flex;
            margin-bottom: 10px;
        }

        .message.user {
            justify-content: flex-end;
        }

        .message.bot {
            justify-content: flex-start;
        }

        .message-bubble {
            max-width: 70%;
            padding: 12px 16px;
            border-radius: 18px;
            font-size: 14px;
            line-height: 1.4;
            word-wrap: break-word;
        }

        .user .message-bubble {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-bottom-right-radius: 5px;
        }

        .bot .message-bubble {
            background: white;
            color: #333;
            border-bottom-left-radius: 5px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .quick-replies {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 12px;
        }

        .quick-reply-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .quick-reply-btn:hover {
            background: #5a67d8;
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }

        .quick-reply-btn:active {
            transform: translateY(0);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .chat-input-area {
            padding: 20px;
            border-top: 1px solid #e0e0e0;
            display: flex;
            justify-content: center;
        }

        .start-btn {
            background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
        }

        .start-btn:hover {
            background: linear-gradient(135deg, #45a049 0%, #4caf50 100%);
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(76, 175, 80, 0.4);
        }

        .restart-btn {
            background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
            margin-top: 10px;
        }

        .restart-btn:hover {
            background: linear-gradient(135deg, #45a049 0%, #4caf50 100%);
            transform: translateY(-1px);
        }

        .text-input-area {
            padding: 20px;
            border-top: 1px solid #e0e0e0;
            display: flex;
            gap: 10px;
            align-items: center;
            background: #f8f9fa;
        }

        .text-input {
            flex: 1;
            padding: 12px 16px;
            border: 2px solid #e0e0e0;
            border-radius: 25px;
            font-size: 16px;
            outline: none;
            transition: border-color 0.2s ease;
        }

        .text-input:focus {
            border-color: #667eea;
        }

        .send-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .send-btn:hover {
            background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
            transform: scale(1.05);
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
        }

        .send-btn:active {
            transform: scale(0.95);
        }

        /* Responsive */
        @media (max-width: 600px) {
            .chatbot-container {
                height: 80vh;
                margin: 10px;
            }

            .message-bubble {
                max-width: 85%;
            }

            .text-input-area {
                padding: 15px;
                gap: 8px;
            }

            .text-input {
                padding: 10px 14px;
                font-size: 16px; /* Предотвращает зум на iOS */
            }

            .send-btn {
                width: 44px;
                height: 44px;
                font-size: 16px;
            }
        }

        /* Scrollbar styling */
        .chat-messages::-webkit-scrollbar {
            width: 6px;
        }

        .chat-messages::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 3px;
        }

        .chat-messages::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 3px;
        }

        .chat-messages::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
        }
`;

  const jsContent = `
        // ===== GLOBAL CONSTANTS =====
        ${globals}

        // ===== BOT STRUCTURE =====
        const BOT_STRUCTURE = ${projectJson};
        const GLOBAL_CONSTANTS = ${JSON.stringify(project.globalConstants || {})};

        // ===== ENGINE CODE =====
        ${engineCode}

        // ===== WEB APP LOGIC =====
        let currentEngine = null;
        let currentUI = null;

        function restartBot() {
            // Очищаем чат, оставляя только приветственное сообщение
            const chatMessages = document.getElementById('chatMessages');
            chatMessages.innerHTML = \`
                <div class="message bot-message">
                    <div class="message-bubble">
                        👋 Привет! Нажмите "Начать чат" для начала разговора.
                    </div>
                </div>
            \`;

            // Показываем кнопку старта
            const startButton = document.getElementById('startButton');
            startButton.style.display = 'block';

            // Сбрасываем движок
            currentEngine = null;
            currentUI = null;
        }

        async function startBot() {
            try {
                const chatMessages = document.getElementById('chatMessages');
                const startButton = document.getElementById('startButton');

                // Скрываем кнопку старта
                startButton.style.display = 'none';

                // Создаем UI и Engine
                currentUI = new WebUI(chatMessages);
                currentEngine = new Engine(currentUI, BOT_STRUCTURE, GLOBAL_CONSTANTS);

                // Запускаем бота
                await currentEngine.execute(true);

            } catch (error) {
                const chatMessages = document.getElementById('chatMessages');
                const errorDiv = document.createElement('div');
                errorDiv.className = 'message bot-message';
                errorDiv.innerHTML = \`
                    <div class="message-bubble">
                        ⚠️ Произошла ошибка: \${error.message}
                    </div>
                \`;
                chatMessages.appendChild(errorDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }

        // Функция для перезапуска (экспортируется глобально)
        window.restartBot = restartBot;


        // ===== END WEB APP LOGIC =====
`;

  return {
    html: header + cssContent + htmlContent,
    js: jsContent,
    css: cssContent,
    projectJson
  };
}

// Создание архива для веб-экспорта
export function createWebExport(project: Project): { code: string; instructions: string; files: { name: string; content: string }[] } {
  const { html, css, js, projectJson } = exportToWeb(project);

  const instructions = `# 🚀 Инструкция по запуску веб-бота

## 📋 Описание
Это автономное веб-приложение с чат-ботом, созданное из проекта "${project.name}" в No-Code Bot.

## 🛠️ Запуск

### Вариант 1: Открыть в браузере
1. **Распакуйте архив**
2. **Откройте файл \`index.html\` в браузере**
3. **Нажмите "🚀 Начать чат"**

### Вариант 2: Запустить локальный сервер
1. **Установите Node.js** (если нет)
2. **Установите http-server:**
   \`\`\`bash
   npm install -g http-server
   \`\`\`

3. **Запустите сервер:**
   \`\`\`bash
   cd папка_с_архивом
   http-server -p 8080
   \`\`\`

4. **Откройте в браузере:** \`http://localhost:8080\`

### Вариант 3: Разместить на хостинге
Загрузите файлы на любой веб-хостинг:
- Netlify
- Vercel
- GitHub Pages
- Хостинг-провайдер

## ⚙️ Функциональность

### Чат-интерфейс
- **Красивый дизайн** с градиентами и анимациями
- **Адаптивный** для мобильных устройств
- **Кнопки быстрого ответа** для выбора вариантов
- **Поддержка файлов** (загрузка от пользователя)
- **Автопрокрутка** чата

### Возможности бота
- Все блоки из вашего проекта
- API запросы (с учетом CORS политик браузера)
- Переменные и условия
- JavaScript скрипты
- Работа с файлами

## 🔧 Настройка

### Кастомизация внешнего вида
Измените CSS в файле \`index.html\` или отдельно в \`styles.css\`

### Добавление новых функций
Модифицируйте JavaScript код в файле \`index.html\`

### Работа с API
Если бот делает запросы к API:
- Убедитесь, что сервер поддерживает CORS
- Или используйте прокси-сервер

## 📱 Совместимость

- **Chrome/Edge:** Полная поддержка
- **Firefox:** Полная поддержка
- **Safari:** Полная поддержка
- **Мобильные браузеры:** Полная поддержка

## 🐛 Возможные проблемы

### Бот не запускается
- Проверьте, что JavaScript включен в браузере
- Проверьте консоль браузера на ошибки

### API запросы не работают
- CORS ограничения браузера
- Проверьте URL API endpoints

### Файлы не загружаются
- Браузерные ограничения безопасности
- Файлы обрабатываются локально

## 📞 Поддержка

Если возникли проблемы:
1. Откройте консоль браузера (F12)
2. Проверьте сообщения об ошибках
3. Убедитесь, что все файлы в одной папке

Приятного использования! 🤖✨

---
*Создано с помощью No-Code Bot*
*Дата генерации: ${new Date().toISOString()}*
`;

  const files = [
    {
      name: 'index.html',
      content: html
    },
    {
      name: 'app.js',
      content: js
    },
    {
      name: 'styles.css',
      content: css
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

  return {
    code: html,
    instructions,
    files
  };
}
