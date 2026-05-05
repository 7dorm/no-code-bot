import { Project } from '../types';
import { adaptProjectToEngine } from './backend/projectAdapter';
import engineTsContent from '@backend/Engine.ts?raw';

export interface TelegramExportFile {
  name: string;
  content: string;
}

export interface TelegramExportResult {
  files: TelegramExportFile[];
}

// Функция для получения содержимого Engine.ts
function getEngineTsContent(): string {
  return engineTsContent;
  // Импортируем Engine.ts из backend - в реальности это будет встроено
  // Для упрощения, мы будем использовать fetch или встроим содержимое
  // Но так как это браузерный код, лучше встроить содержимое Engine.ts
  return `import { UI } from "./UI";

export interface EngineNode {
  id: string;
  Type: 'output' | 'condition' | 'start' | 'variable' | 'FILE' | 'api' | 'skip' | 'script';
  Text?: string;
  VarName?: string;
  VarType?: string;
  Nexts: string[];
  Cond?: string[];
  skip?: boolean;
  Answers?: string[]; 
  AnswersFromVariable?: string; 
  AnswersPath?: string; 
  VariableName?: string; 
  VariableValue?: string; 
  SaveNextToVariable?: string; 
  ApiUrl?: string;
  ApiMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  ApiHeaders?: Record<string, string>;
  ApiBody?: string;
  ApiResponseVariable?: string; 
  ApiAnswersPath?: string; 
  ApiAnswersVariable?: string; 
  FILEAct? : 'Upload' | 'DownLoad' | 'Delete' | 'Read';
  FileName?: string; 
  PathToSave?: string; 
  PathToFile?: string; 
  ScriptCode?: string; 
  ScriptReturnVariable?: string; 
}

function evalCondition(condStr: string, variables: Record<string, any>, userInput: string = '', globalConstants?: Record<string, any>): boolean {
  if (condStr === "default") return true;
  let processedCond = condStr;
  const matches = [...condStr.matchAll(/\\{([^}]+)\\}/g)].map(m => m[1]).filter((m): m is string => m !== undefined);
  
  matches.forEach((match: string) => {
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
      return andParts.every(part => evaluateSimpleCondition(part, variables, userInput, globalConstants));
    });
  }
  return evaluateSimpleCondition(processedCond, variables, userInput, globalConstants);
}

function evaluateSimpleCondition(cond: string, variables: Record<string, any>, userInput: string = '', globalConstants?: Record<string, any>): boolean {
  const getValue = (expr: string): any => {
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
  
  const numMatch = cond.match(/^\\s*([\\w{}.]+)\\s*([<>]=?|==|!=)\\s*([\\w{}.]+)\\s*$/);
  if (numMatch && numMatch[1] && numMatch[2] && numMatch[3]) {
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
  
  if (cond.toLowerCase().includes('contains')) {
    const parts = cond.toLowerCase().split('contains');
    if (parts.length === 2 && parts[0] && parts[1]) {
      const left = parts[0].trim();
      const right = parts[1].trim().replace(/['"]/g, '');
      const leftValue = variables[left] !== undefined ? variables[left] : 
                       (globalConstants && globalConstants[left] !== undefined ? globalConstants[left] : left) || userInput;
      return String(leftValue).toLowerCase().includes(right.toLowerCase());
    }
  }
  
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
  private executionCount: Record<string, number> = {}; 
  private lastExecutedBlock: string | null = null; 
  private consecutiveEmptyAnswers: number = 0; 
  private lastEmptyAnswersBlock: string | null = null; 
  private maxExecutionCount: number = 0;

  constructor(ui: UI, botStructure: EngineNode[], globalConstants?: Record<string, any>) {
    botStructure.forEach((ele: EngineNode) => {
      this.nodeStructure[ele.id] = ele;
      if (ele.Type === 'start' && !this.index) {
        this.index = ele.id;
      }
      this.maxExecutionCount += 1;
    });
    this.ui = ui;
    
    if (globalConstants) {
      this.globalConstants = { ...globalConstants };
      Object.assign(this.variables, globalConstants);
    }
    
    if (!this.index && botStructure.length > 0 && botStructure[0]) {
      this.index = botStructure[0].id;
    }
  }

  async execute(skipFirstInput: boolean = false): Promise<void> {
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
      if (this.index) {
        this.executionCount[this.index] = (this.executionCount[this.index] || 0) + 1;
        const currentCount = this.executionCount[this.index];
        if (currentCount && currentCount > this.maxExecutionCount) {
          this.ui.finish();
          this.isFinished = true;
          return;
        }
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
          this.variables[this.saveName] = parseInt(userInput, 0);
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

  async executeStart(): Promise<void> {
    const block = this.nodeStructure[this.index!];
    if (!block) return;
    if (block.Nexts.length > 0 && block.Nexts[0]) {
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

    let processedText = block.Text || '';
    processedText = processedText.replace(/\\{\\{(\w+)\\}\\}/g, (match, varName) => {
      if (this.variables[varName] !== undefined && this.variables[varName] !== null) {
        return String(this.variables[varName]);
      } else if (this.globalConstants && this.globalConstants[varName] !== undefined && this.globalConstants[varName] !== null) {
        return String(this.globalConstants[varName]);
      }
      return match; 
    });
    
    let answers: string[] | undefined = block.Answers;
    
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
          if (this.consecutiveEmptyAnswers >= 1) {
            await this.ui.sendMessage(' Произошла ошибка: нет доступных вариантов для выбора. Пожалуйста, попробуйте позже.', []);
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
        if (block.Nexts.length > 0 && block.Nexts[0]) {
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
      
      if (block.Nexts.length === 1 && block.Nexts[0]) {
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
    
    const messageToSend = processedText.trim() !== '' ? processedText : 
                          (block.AnswersFromVariable ? 'Нет доступных вариантов для выбора.' : '');
    
    if (messageToSend !== '') {
      await this.ui.sendMessage(messageToSend, []);
    }

    if (block.VarName != null) {
      this.saveNext = true;
      this.saveName = block.VarName;
      this.saveType = block.VarType || 'string';
      
      if (block.Nexts.length > 0 && block.Nexts[0]) {
        this.index = block.Nexts[0];
        await this.execute(false);
        return;
      } else {
        const userInput = await this.ui.getInput();
        this.variables['lastMessage'] = userInput;
        this.variables['userInput'] = userInput;
        switch (this.saveType) {
          case "int":
            this.variables[this.saveName] = parseInt(userInput, 0);
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
    
    if (block.Nexts[0]) {
      this.index = block.Nexts[0];
      await this.execute(true);
    }
  }

  async executeCondition(msg: string): Promise<void> {
    const block = this.nodeStructure[this.index!];
    if (!block || !block.Cond) return;

    let successfulCond = -1;
    for (let i = 0; i < block.Cond.length; i++) {
      const cond = block.Cond[i];
      if (cond && evalCondition(cond, this.variables, msg, this.globalConstants)) {
        successfulCond = i;
        break;
      }
    }
    
    if (successfulCond === -1 && block.Nexts.length > block.Cond.length) {
      successfulCond = block.Cond.length; 
    }
    
    if (successfulCond >= 0 && successfulCond < block.Nexts.length) {
      const nextId = block.Nexts[successfulCond];
      if (nextId) {
        this.index = nextId;
        this.skipInput = true;
        await this.execute();
      } else {
        this.ui.finish();
        this.isFinished = true;
      }
    } else {
      this.ui.finish();
      this.isFinished = true;
    }
  }

  async executeVariable(): Promise<void> {
    const block = this.nodeStructure[this.index!];
    if (!block) return;
    
    if (block.SaveNextToVariable) {
      this.saveNext = true;
      this.saveName = block.SaveNextToVariable;
      this.saveType = 'string';
      
      if (block.Nexts.length > 0 && block.Nexts[0]) {
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
      value = value.replace(/\\{\\{(\w+)\\}\\}/g, (match, varName) => {
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
    
    if (block.Nexts.length > 0 && block.Nexts[0]) {
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

    const replaceVariables = (text: string): string => {
      return text.replace(/\\{\\{(\w+)\\}\\}/g, (match, varName) => {
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

  async executeAPI(): Promise<void> {
    const block = this.nodeStructure[this.index!];
    if (!block || !block.ApiUrl) {
      return;
    }

    try {
      const replaceVariable = (varName: string): string => {
        if (this.variables[varName] !== undefined && this.variables[varName] !== null) {
          return String(this.variables[varName]);
        } else if (this.globalConstants && this.globalConstants[varName] !== undefined && this.globalConstants[varName] !== null) {
          return String(this.globalConstants[varName]);
        }
        return \`\\{\\{\${varName}\\}\\}\`; 
      };

      let url = block.ApiUrl;
      url = url.replace(/\\{\\{(\w+)\\}\\}/g, (match, varName) => {
        return replaceVariable(varName);
      });
      
      let body = block.ApiBody || '';
      if (body) {
        body = body.replace(/\\{\\{(\w+)\\}\\}/g, (match, varName) => {
          const varValue = this.variables[varName] !== undefined ? this.variables[varName] : 
                          (this.globalConstants && this.globalConstants[varName] !== undefined ? this.globalConstants[varName] : null);
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
          return String(varValue);
        });
        
        try {
          const bodyObj = JSON.parse(body);
          body = JSON.stringify(bodyObj);
        } catch (e) {
          // ignore
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(block.ApiHeaders || {}),
      };
      
      Object.keys(headers).forEach(key => {
        if (headers[key]) {
          headers[key] = headers[key].replace(/\\{\\{(\w+)\\}\\}/g, (match, varName) => replaceVariable(varName));
        }
      });
      
      const method = block.ApiMethod || 'GET';
      const fetchOptions: RequestInit = {
        method,
        headers,
        mode: 'cors',
        credentials: 'omit',
      };

      if (method !== 'GET' && body) {
        fetchOptions.body = body;
      }
      
      let fetchFn: any;
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
            throw new Error('fetch is not available. Please install node-fetch (npm install node-fetch) or use Node.js 8+');
          }
        }
      }

      const response = await fetchFn(url, fetchOptions);
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
      
      if (block.ApiResponseVariable && block.ApiResponseVariable.trim() !== '') {
        const varName = block.ApiResponseVariable.trim();
        this.variables[varName] = responseData;
        this.variables[\`\${varName}_status\`] = response.status;
      }
      
      if (block.ApiAnswersPath && block.ApiAnswersPath.trim() !== '') {
        try {
          const path = block.ApiAnswersPath.trim();
          let answersArray: any = responseData;
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
          // ignore
        }
      }
      
      if (block.Nexts.length > 0 && block.Nexts[0]) {
        this.index = block.Nexts[0];
        this.skipInput = true;
        await this.execute();
      } else {
        this.ui.finish();
        this.isFinished = true;
      }
    } catch (error: any) {
      if (block.ApiResponseVariable && block.ApiResponseVariable.trim() !== '') {
        const varName = block.ApiResponseVariable.trim();
        this.variables[varName] = { 
          error: error.message || String(error),
          errorType: error.name || 'UnknownError'
        };
        this.variables[\`\${varName}_status\`] = error.status || 0;
      }
      
      if (block.Nexts.length > 0 && block.Nexts[0]) {
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
    const block = this.nodeStructure[this.index!];
    if (block && block.Nexts.length > 0 && block.Nexts[0]) {
      this.index = block.Nexts[0];
      this.skipInput = true;
      await this.execute();
    }
  }

  async executeScript(): Promise<void> {
    const block = this.nodeStructure[this.index!];
      if (!block || !block.ScriptCode) {
        if (block && block.Nexts.length > 0 && block.Nexts[0]) {
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
        setVariable: (name: string, value: any) => {
          this.variables[name] = value;
        },
        getVariable: (name: string) => {
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
      
      if (block.Nexts.length > 0 && block.Nexts[0]) {
        this.index = block.Nexts[0];
        this.skipInput = true;
        await this.execute();
      } else {
        this.ui.finish();
        this.isFinished = true;
      }
    } catch (error: any) {
      if (block.ScriptReturnVariable) {
        this.variables[block.ScriptReturnVariable] = { 
          error: error.message || String(error),
          errorType: 'ScriptExecutionError'
        };
      }
      
      if (block.Nexts.length > 0 && block.Nexts[0]) {
        this.index = block.Nexts[0];
        this.skipInput = true;
        await this.execute();
      } else {
        this.ui.finish();
        this.isFinished = true;
      }
    }
  }

  getVariables(): Record<string, any> {
    return { ...this.variables };
  }

  getVariable(name: string): any {
    return this.variables[name];
  }

  hasVariable(name: string): boolean {
    return name in this.variables;
  }

  reset(): void {
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
}`;
}

// Функция для получения содержимого UI.ts
function getUITsContent(): string {
  return `export interface UI {
    sendMessage(msg: string, answers: string[]): Promise<void>;
    sendFile(path: string): void;
    getInput(): Promise<string>;
    getFile(pathToSave: string, name: string): Promise<string>;
    deleteFile(path: string): void;
    finish(): void;
}`;
}

// Функция для получения содержимого TelegramUI.ts
function getTelegramUITsContent(): string {
  return `import { Context } from 'telegraf';
import { UI } from './UI';

export class TelegramUI implements UI {
  private ctx: Context;
  private stop = false;
  private inputResolver: ((value: string) => void) | null = null;
  private fileResolver: ((value: string) => void) | null = null;

  constructor(ctx: Context) {
    this.ctx = ctx;
  }

  async sendMessage(message: string, answers: string[] = []): Promise<void> {
    if (answers.length > 0) {
      const keyboard = {
        inline_keyboard: answers.map(a => [{ text: a, callback_data: a }])
      };
      await this.ctx.reply(message, { reply_markup: keyboard });
    } else {
      await this.ctx.reply(message);
    }
  }

  async getInput(): Promise<string> {
    return new Promise((resolve) => {
      this.inputResolver = resolve;
    });
  }

  finish(): void {
    this.stop = true;
  }

  Is_done(): boolean {
    return this.stop;
  }

  isWaitingForInput(): boolean {
    return this.inputResolver !== null;
  }

  handleUserMessage(text: string): void {
    if (this.inputResolver) {
      this.inputResolver(text);
      this.inputResolver = null;
    }
  }

  async sendFile(path: string): Promise<void> {
    try {
      await this.ctx.replyWithDocument({ source: path });
    } catch (error) {
      await this.ctx.reply(\`Ошибка отправки файла: \${path}\`);
    }
  }

  async getFile(pathToSave: string, name: string): Promise<string> {
    await this.ctx.reply(\` Пожалуйста, отправьте файл: \${name}\`);
    return new Promise((resolve) => {
      this.fileResolver = resolve;
    });
  }

  handleUserFile(fileName: string): void {
    if (this.fileResolver) {
      const uniqueName = \`\${fileName}_\${Date.now()}\`;
      this.fileResolver(uniqueName);
      this.fileResolver = null;
    }
  }

  deleteFile(path: string): void {
    console.log(\`Удаление файла: \${path}\`);
  }
}`;
}

// Функция для создания index.ts
function createIndexTs(): string {
  return `import {Engine} from "./Engine";
import {TelegramUI} from "./TelegramUI";
import {readFileSync} from "node:fs";
import { Telegraf } from 'telegraf';

interface UserState {
    eng: Engine;
    ui: TelegramUI;
}

const userStates = new Map<number, UserState>();
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
    throw new Error('Не указан BOT_TOKEN в переменных окружения');
}

const bot = new Telegraf(BOT_TOKEN);

bot.start(async (ctx) => {
    if (!ctx.chat) return;
    const chatId = ctx.chat.id;

    const raw = readFileSync("./project.json", "utf-8");
    const data = JSON.parse(raw);

    const ui = new TelegramUI(ctx);
    const eng = new Engine(ui, data, {});

    userStates.set(chatId, { eng, ui });

    await ctx.reply('Бот запущен!');
    
    (async () => {
        try {
            await eng.execute(true);
        } catch (error) {
            console.error('Ошибка выполнения бота:', error);
        }
    })();
});

bot.on('text', async (ctx) => {
    if (!ctx.chat) return;
    const chatId = ctx.chat.id;
    const state = userStates.get(chatId);

    if (!state) {
        await ctx.reply('Нажмите /start для начала работы.');
        return;
    }

    if (ctx.message.text === '/start') {
        return;
    }

    const isWaitingForInput = state.ui.isWaitingForInput();
    if (!isWaitingForInput) {
        (async () => {
            try {
                await state.eng.execute();
            } catch (error) {
                console.error('Ошибка выполнения бота:', error);
            }
        })();
    }
    
    state.ui.handleUserMessage(ctx.message.text);
});

bot.on('callback_query', async (ctx) => {
    if (!ctx.chat) return;
    const chatId = ctx.chat.id;
    const state = userStates.get(chatId);
    if (!state) return;

    if ('data' in ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        await ctx.answerCbQuery();
        state.ui.handleUserMessage(data);
    } else {
        await ctx.answerCbQuery('Неподдерживаемый тип запроса');
    }
});

bot.on('document', async (ctx) => {
    if (!ctx.chat) return;
    const chatId = ctx.chat.id;
    const state = userStates.get(chatId);
    
    if (!state) {
        await ctx.reply('Пожалуйста, начните с команды /start');
        return;
    }

    const document = ctx.message.document;
    if (document && document.file_id) {
        const fileName = document.file_name || \`file_\${Date.now()}\`;
        state.ui.handleUserFile(fileName);
    }
});

bot.on('photo', async (ctx) => {
    if (!ctx.chat) return;
    const chatId = ctx.chat.id;
    const state = userStates.get(chatId);
    
    if (!state) {
        await ctx.reply('Пожалуйста, начните с команды /start');
        return;
    }

    const photos = ctx.message.photo;
    if (photos && photos.length > 0) {
        const largestPhoto = photos[photos.length - 1];
        if (largestPhoto && largestPhoto.file_id) {
            const fileName = \`photo_\${Date.now()}.jpg\`;
            state.ui.handleUserFile(fileName);
        }
    }
});

bot.launch();
console.log('Telegram bot started...');
`;
}

// Функция для создания package.json
function createPackageJson(projectName: string): string {
  return JSON.stringify({
    "name": projectName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    "version": "1.0.0",
    "description": "Telegram bot created with no-code-bot",
    "main": "index.ts",
    "scripts": {
      "start": "ts-node index.ts",
      "build": "tsc",
      "dev": "ts-node-dev --respawn index.ts"
    },
    "keywords": ["telegram", "bot"],
    "author": "",
    "license": "ISC",
    "dependencies": {
      "telegraf": "^4.16.3",
      "typescript": "^5.9.3",
      "node-fetch": "^2.7.0"
    },
    "devDependencies": {
      "@types/node": "^24.9.1",
      "ts-node": "^10.9.2",
      "ts-node-dev": "^2.0.0"
    }
  }, null, 2);
}

// Функция для создания tsconfig.json
function createTsConfigJson(): string {
  return JSON.stringify({
    "compilerOptions": {
      "module": "commonjs",
      "target": "ES2020",
      "types": ["node"],
      "sourceMap": true,
      "declaration": true,
      "declarationMap": true,
      "noUncheckedIndexedAccess": true,
      "exactOptionalPropertyTypes": true,
      "strict": true,
      "jsx": "preserve",
      "verbatimModuleSyntax": false,
      "isolatedModules": false,
      "noUncheckedSideEffectImports": true,
      "moduleDetection": "force",
      "skipLibCheck": true,
      "moduleResolution": "node",
      "esModuleInterop": true
    }
  }, null, 2);
}

// Функция для создания README.md
function createReadme(projectName: string, hasToken: boolean): string {
  const tokenInstructions = hasToken 
    ? `2. Файл \`.env\` уже создан с токеном бота из проекта. Если нужно изменить токен, отредактируйте файл \`.env\`.`
    : `2. Создайте файл \`.env\` в корне проекта и добавьте ваш токен бота:
\`\`\`
BOT_TOKEN=ваш_токен_бота
\`\`\`

Чтобы получить токен бота:
1. Найдите [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте команду /newbot
3. Следуйте инструкциям для создания бота
4. Скопируйте полученный токен в файл .env`;

  return `# ${projectName} - Telegram Bot

Этот проект был создан с помощью no-code-bot редактора.

## Установка

1. Установите зависимости:
\`\`\`bash
npm install
\`\`\`

${tokenInstructions}

## Запуск

Для запуска бота в режиме разработки:
\`\`\`bash
npm run dev
\`\`\`

Для запуска бота в продакшене:
\`\`\`bash
npm start
\`\`\`

## Структура проекта

- \`index.ts\` - главный файл для запуска бота
- \`Engine.ts\` - движок выполнения логики бота
- \`TelegramUI.ts\` - интерфейс для работы с Telegram API
- \`UI.ts\` - базовый интерфейс UI
- \`project.json\` - структура проекта (блоки и связи)

## Дополнительная информация

Проект использует:
- [Telegraf](https://telegraf.js.org/) - библиотека для работы с Telegram Bot API
- TypeScript для типобезопасности
- Node.js для выполнения

При возникновении проблем проверьте:
1. Правильность токена бота в .env
2. Установлены ли все зависимости (npm install)
3. Версию Node.js (рекомендуется 18+)
`;
}

// Функция для создания .env.example
function createEnvExample(token?: string): string {
  if (token) {
    return `BOT_TOKEN=${token}
`;
  }
  return `BOT_TOKEN=ваш_токен_бота_здесь
`;
}

// Функция для создания .env (если токен есть)
function createEnv(token: string): string {
  return `BOT_TOKEN=${token}
`;
}

/**
 * Создает zip архив с полным проектом Telegram бота
 * @param project - Проект для экспорта
 * @returns Объект с массивом файлов для zip архива
 */
export function createTelegramExport(project: Project): TelegramExportResult {
  if (!project) {
    throw new Error('Проект не указан');
  }

  // Адаптируем проект к формату Engine
  const engineNodes = adaptProjectToEngine(project);
  const projectJson = JSON.stringify(engineNodes, null, 2);

  const projectName = project.name || 'telegram-bot';
  
  // Получаем токен из проекта (приоритет: telegramToken, затем botToken)
  const botToken = project.telegramToken || project.botToken;

  // Создаем все необходимые файлы
  const files: TelegramExportFile[] = [
    {
      name: 'Engine.ts',
      content: getEngineTsContent()
    },
    {
      name: 'UI.ts',
      content: getUITsContent()
    },
    {
      name: 'TelegramUI.ts',
      content: getTelegramUITsContent()
    },
    {
      name: 'index.ts',
      content: createIndexTs()
    },
    {
      name: 'package.json',
      content: createPackageJson(projectName)
    },
    {
      name: 'tsconfig.json',
      content: createTsConfigJson()
    },
    {
      name: 'project.json',
      content: projectJson
    },
    {
      name: 'README.md',
      content: createReadme(projectName, !!botToken)
    },
    {
      name: '.env.example',
      content: createEnvExample(botToken)
    }
  ];

  // Если токен есть, создаем также файл .env с токеном
  if (botToken) {
    files.push({
      name: '.env',
      content: createEnv(botToken)
    });
  }

  return { files };
}
