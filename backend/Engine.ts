import { UI } from "./UI";


declare global {
  var fetch: typeof import('node-fetch').default | undefined;
}


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
  const matches = [...condStr.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
  
  matches.forEach((match: string) => {
    
    if (variables[match] !== undefined && variables[match] !== null) {
      processedCond = processedCond.replace(`{${match}}`, String(variables[match]));
    } else if (globalConstants && globalConstants[match] !== undefined && globalConstants[match] !== null) {
      processedCond = processedCond.replace(`{${match}}`, String(globalConstants[match]));
    }
  });

  
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

  
  const numMatch = cond.match(/^\s*([\w{}.]+)\s*([<>]=?|==|!=)\s*([\w{}.]+)\s*$/);
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

  
  if (cond.toLowerCase().includes('contains')) {
    const parts = cond.toLowerCase().split('contains');
    if (parts.length === 2) {
      
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

    
    if (!this.index && botStructure.length > 0) {
      
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
      
      
      this.executionCount[this.index] = (this.executionCount[this.index] || 0) + 1;
      
      
      if (this.executionCount[this.index] > this.maxExecutionCount) {
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
        const outputBlockId = this.index;
        const outputExecutionId = `exec_${Date.now()}_${Math.random().toString(6).substr(1, 9)}`;
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
    if (!block) {
      return;
    }



    
    let processedText = block.Text || '';
    
    processedText = processedText.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      
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
      const messageId = `${this.index}_${Date.now()}_${Math.random().toString(6).substr(1, 9)}`;
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
      
      
      
      
      const currentBlockId = this.index; 
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

    
    
    
    
    const messageToSend = processedText.trim() !== '' ? processedText : 
                          (block.AnswersFromVariable ? 'Нет доступных вариантов для выбора.' : '');
    
    if (messageToSend !== '') {
      const messageId = `${this.index}_${Date.now()}_${Math.random().toString(6).substr(1, 9)}`;
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

    
    
    this.index = block.Nexts[0];
    
    await this.execute(true);
  }

  
  async executeCondition(msg: string): Promise<void> {
    const block = this.nodeStructure[this.index!];
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

  async executeVariable(): Promise<void> {
    const block = this.nodeStructure[this.index!];
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

  async executeFILE(): Promise<void> {
  const block = this.nodeStructure[this.index!];
  if (!block) return;

  
  const replaceVariables = (text: string): string => {
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


  async executeAPI(): Promise<void> {
    const block = this.nodeStructure[this.index!];
    if (!block || !block.ApiUrl) {
      return;
    }

    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      
      const replaceVariable = (varName: string): string => {
        if (this.variables[varName] !== undefined && this.variables[varName] !== null) {
          return String(this.variables[varName]);
        } else if (this.globalConstants && this.globalConstants[varName] !== undefined && this.globalConstants[varName] !== null) {
          return String(this.globalConstants[varName]);
        }
        return `{{${varName}}}`; 
      };

      
      let url = block.ApiUrl;
      const urlVariables: Record<string, string> = {};
      url = url.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        const value = replaceVariable(varName);
        urlVariables[varName] = value;
        return value;
      });
      

      
      let body = block.ApiBody || '';
      const bodyVariables: Record<string, any> = {};
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

      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(block.ApiHeaders || {}),
      };

      
      Object.keys(headers).forEach(key => {
        if (headers[key]) {
          headers[key] = headers[key].replace(/\{\{(\w+)\}\}/g, (match, varName) => replaceVariable(varName));
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

      let response: Response;
      try {
        response = await fetchFn(url, fetchOptions);
      } catch (fetchError: any) {
        
        const errorMessage = fetchError.message || String(fetchError);
        if (errorMessage.includes('CORS') || errorMessage.includes('access control')) {
          const isLocalhost = url.includes('localhost') || url.includes('7.0.0.');
          const errorMsg = isLocalhost 
            ? `CORS error: The API server at ${url} does not allow requests from this origin. This is a browser security restriction. Please configure CORS on the server (add Access-Control-Allow-Origin header) or use an external API endpoint.`
            : `CORS error: The API server at ${url} does not allow requests from this origin. Please configure CORS on the server or contact the API provider.`;
          throw new Error(errorMsg);
        }
        throw fetchError;
      }
      
      
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

      
      if (block.ApiResponseVariable && block.ApiResponseVariable.trim() !== '') {
        const varName = block.ApiResponseVariable.trim();
        this.variables[varName] = responseData;
        
        this.variables[`${varName}_status`] = response.status;
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
            const answersVarName = block.ApiAnswersVariable?.trim() || `${block.ApiResponseVariable || 'apiResponse'}_answers`;
            this.variables[answersVarName] = answersArray.map(item => String(item));
          } else {
            console.log(`     Path "${path}" does not point to an array in API response`);
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
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      
      if (block.ApiResponseVariable && block.ApiResponseVariable.trim() !== '') {
        const varName = block.ApiResponseVariable.trim();
        this.variables[varName] = { 
          error: error.message || String(error),
          errorType: error.name || 'UnknownError'
        };
        this.variables[`${varName}_status`] = error.status || 0;
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

  async executeSkip(): Promise<void> {
    
    const block = this.nodeStructure[this.index!];
    if (block && block.Nexts.length > 0) {
      
      this.index = block.Nexts[0];
      this.skipInput = true;
      await this.execute();
    }
  }

  async executeScript(): Promise<void> {
    const block = this.nodeStructure[this.index!];
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
    } catch (error: any) {
      
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
}