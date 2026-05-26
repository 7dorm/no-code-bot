import { UI } from "./UI";

declare const require: any;
export interface EngineNode {
  id: string;
  Type: 'output' | 'condition' | 'start' | 'variable' | 'FILE' | 'api' | 'skip' | 'script' | 'aiRouter' | 'aiExtractor';
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
  AiSettings?: AiSettings;
  AiInputVariable?: string;
  AiInstruction?: string;
  AiContextMode?: AiContextMode;
  AiRoutes?: AiRoute[];
  AiFallbackRoute?: string;
  AiConfidenceThreshold?: number;
  AiConfidenceVariable?: string;
  AiReasonVariable?: string;
  AiIntentVariable?: string;
  AiEntities?: AiEntity[];
  AiAskMissing?: boolean;
  AiRawResultVariable?: string;
}

export type AiContextMode = 'none' | 'last_message' | 'last_n_messages';

export interface AiSettings {
  provider?: 'mock' | 'custom' | 'openai';
  endpoint?: string;
  model?: string;
  systemPrompt?: string;
  safetyPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  language?: string;
  contextWindowMode?: AiContextMode;
  confidenceThreshold?: number;
}

export interface AiRoute {
  id: string;
  title: string;
  description?: string;
  examples?: string[];
}

export type AiEntityType = 'string' | 'number' | 'phone' | 'email' | 'date' | 'time' | 'enum' | 'boolean';

export interface AiEntity {
  name: string;
  variableName: string;
  type: AiEntityType;
  description?: string;
  required?: boolean;
  enumValues?: string[];
  validationRegex?: string;
  askPrompt?: string;
}

interface AiRouterResult {
  route: string;
  confidence: number;
  reason?: string;
}

interface AiExtractedEntity {
  value: any;
  confidence: number;
  found: boolean;
}

interface AiExtractorResult {
  entities: Record<string, AiExtractedEntity>;
  missing: string[];
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
  private dialogHistory: Array<{ role: 'bot' | 'user'; content: string }> = [];

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
      this.recordUserMessage(userInput);

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
          this.recordUserMessage(userInput);
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
      case "aiRouter":
        await this.executeAiRouter();
        break;
      case "aiExtractor":
        await this.executeAiExtractor();
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
      await this.ui.sendMessage(messageToSend, answers);
      this.recordBotMessage(messageToSend);
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
      this.recordUserMessage(userAnswer);




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
      await this.ui.sendMessage(messageToSend, []);
      this.recordBotMessage(messageToSend);
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
        this.recordUserMessage(userInput);
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
        this.recordUserMessage(userInput);
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

    try {

      const replaceVariable = (rawName: string): string => {
        const varName = rawName.trim();
        if (this.variables[varName] !== undefined && this.variables[varName] !== null) {
          return String(this.variables[varName]);
        } else if (this.globalConstants && this.globalConstants[varName] !== undefined && this.globalConstants[varName] !== null) {
          return String(this.globalConstants[varName]);
        }
        return `{{${varName}}}`;
      };


      let url = block.ApiUrl;
      const urlVariables: Record<string, string> = {};
      url = url.replace(/\{\{([^}]+)\}\}/g, (_match, varName) => {
        const value = replaceVariable(varName);
        urlVariables[varName] = value;
        return value;
      });



      let body = block.ApiBody || '';
      const bodyVariables: Record<string, any> = {};
      if (body) {


        body = body.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
          const trimmedName = String(varName).trim();

          const varValue = this.variables[trimmedName] !== undefined ? this.variables[trimmedName] :
                          (this.globalConstants && this.globalConstants[trimmedName] !== undefined ? this.globalConstants[trimmedName] : null);
          bodyVariables[trimmedName] = varValue;


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
          headers[key] = headers[key].replace(/\{\{([^}]+)\}\}/g, (_match, varName) => replaceVariable(varName));
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
      this.variables['lastApiDurationMs'] = duration;


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

  async executeAiRouter(): Promise<void> {
    const block = this.nodeStructure[this.index!];
    if (!block) return;

    const routes = block.AiRoutes || [];
    const input = await this.getAiInput(block);
    const result = await this.runAiRouter(block, input);
    const threshold = block.AiConfidenceThreshold ?? block.AiSettings?.confidenceThreshold ?? 0.6;

    if (block.AiIntentVariable) {
      this.variables[block.AiIntentVariable] = result.route;
    }
    if (block.AiConfidenceVariable) {
      this.variables[block.AiConfidenceVariable] = result.confidence;
    }
    if (block.AiReasonVariable) {
      this.variables[block.AiReasonVariable] = result.reason || '';
    }

    let routeIndex = routes.findIndex(route => route.id === result.route);
    if (result.confidence < threshold || routeIndex === -1) {
      const fallbackRouteIndex = block.AiFallbackRoute
        ? routes.findIndex(route => route.id === block.AiFallbackRoute)
        : -1;
      routeIndex = fallbackRouteIndex >= 0 ? fallbackRouteIndex : routes.length;
    }

    const nextId = block.Nexts[routeIndex];
    if (nextId) {
      this.index = nextId;
      this.skipInput = true;
      await this.execute();
    } else {
      this.ui.finish();
      this.isFinished = true;
    }
  }

  async executeAiExtractor(): Promise<void> {
    const block = this.nodeStructure[this.index!];
    if (!block) return;

    const input = await this.getAiInput(block);
    let result = await this.runAiExtractor(block, input);
    this.applyAiExtractorResult(block, result);

    let missing = this.getMissingRequiredEntities(block, result);
    if (missing.length > 0 && block.AiAskMissing !== false) {
      const entity = missing[0];
      const prompt = entity.askPrompt || `Уточните значение для "${entity.name}".`;
      await this.ui.sendMessage(prompt, []);
      this.recordBotMessage(prompt);

      const userInput = await this.ui.getInput();
      this.variables['lastMessage'] = userInput;
      this.variables['userInput'] = userInput;
      this.recordUserMessage(userInput);

      result = await this.runAiExtractor(block, `${input}\n${userInput}`);
      this.applyAiExtractorResult(block, result);
      missing = this.getMissingRequiredEntities(block, result);
    }

    if (block.AiRawResultVariable) {
      this.variables[block.AiRawResultVariable] = result;
    }

    const nextId = missing.length === 0 ? block.Nexts[0] : block.Nexts[1];
    if (nextId) {
      this.index = nextId;
      this.skipInput = true;
      await this.execute();
    } else {
      this.ui.finish();
      this.isFinished = true;
    }
  }

  private async getAiInput(block: EngineNode): Promise<string> {
    const inputVariable = block.AiInputVariable?.trim();
    if (inputVariable && this.variables[inputVariable] !== undefined && this.variables[inputVariable] !== null) {
      return this.stringifyForAi(this.variables[inputVariable]);
    }

    const lastMessage = this.variables['lastMessage'] ?? this.variables['userInput'];
    if (lastMessage !== undefined && lastMessage !== null && String(lastMessage).trim() !== '') {
      return String(lastMessage);
    }

    const userInput = await this.ui.getInput();
    this.variables['lastMessage'] = userInput;
    this.variables['userInput'] = userInput;
    this.recordUserMessage(userInput);
    return userInput;
  }

  private async runAiRouter(block: EngineNode, input: string): Promise<AiRouterResult> {
    const remoteResult = await this.callAiEndpoint<AiRouterResult>('router', block, {
      input,
      routes: block.AiRoutes || [],
      expectedResponse: {
        route: 'route id from routes',
        confidence: 'number from 0 to 1',
        reason: 'short explanation',
      },
    });

    if (remoteResult && typeof remoteResult.route === 'string') {
      return {
        route: remoteResult.route,
        confidence: this.clampConfidence(remoteResult.confidence),
        reason: remoteResult.reason,
      };
    }

    return this.localRoute(input, block.AiRoutes || []);
  }

  private async runAiExtractor(block: EngineNode, input: string): Promise<AiExtractorResult> {
    const remoteResult = await this.callAiEndpoint<AiExtractorResult>('extractor', block, {
      input,
      entities: block.AiEntities || [],
      expectedResponse: {
        entities: {
          entityName: {
            value: 'extracted value or null',
            confidence: 'number from 0 to 1',
            found: 'boolean',
          },
        },
        missing: ['missing required entity names'],
      },
    });

    if (remoteResult && remoteResult.entities && typeof remoteResult.entities === 'object') {
      return {
        entities: remoteResult.entities,
        missing: Array.isArray(remoteResult.missing) ? remoteResult.missing : [],
      };
    }

    return this.localExtract(input, block.AiEntities || []);
  }

  private async callAiEndpoint<T>(mode: 'router' | 'extractor', block: EngineNode, extraPayload: Record<string, any>): Promise<T | null> {
    const endpoint = block.AiSettings?.endpoint?.trim();
    if (!endpoint) {
      return null;
    }

    try {
      const fetchFn = this.getFetchFunction();
      const response = await fetchFn(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          provider: block.AiSettings?.provider || 'custom',
          model: block.AiSettings?.model,
          temperature: block.AiSettings?.temperature ?? 0.2,
          maxTokens: block.AiSettings?.maxTokens ?? 800,
          language: block.AiSettings?.language || 'ru',
          systemPrompt: block.AiSettings?.systemPrompt || '',
          safetyPrompt: block.AiSettings?.safetyPrompt || '',
          instruction: block.AiInstruction || '',
          variables: this.variables,
          globalConstants: this.globalConstants,
          context: this.getAiContext(block.AiContextMode || block.AiSettings?.contextWindowMode || 'last_message'),
          ...extraPayload,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return (data.result || data) as T;
    } catch (error) {
      return null;
    }
  }

  private getFetchFunction(): any {
    if (typeof globalThis.fetch !== 'undefined') {
      return globalThis.fetch.bind(globalThis);
    }
    if (typeof fetch !== 'undefined') {
      return fetch;
    }
    const nodeFetch = require('node-fetch');
    return nodeFetch.default || nodeFetch;
  }

  private localRoute(input: string, routes: AiRoute[]): AiRouterResult {
    if (routes.length === 0) {
      return { route: 'fallback', confidence: 0, reason: 'Нет настроенных веток' };
    }

    const normalizedInput = this.normalizeAiText(input);
    let bestRoute = routes[0];
    let bestScore = 0;

    routes.forEach(route => {
      const text = [
        route.id,
        route.title,
        route.description || '',
        ...(route.examples || []),
      ].join(' ');
      const tokens = this.normalizeAiText(text).split(' ').filter(token => token.length > 2);
      const uniqueTokens = Array.from(new Set(tokens));
      const score = uniqueTokens.reduce((sum, token) => (
        normalizedInput.includes(token) ? sum + 1 : sum
      ), 0);

      if (score > bestScore) {
        bestScore = score;
        bestRoute = route;
      }
    });

    if (bestScore === 0) {
      return {
        route: bestRoute.id,
        confidence: 0.25,
        reason: 'Локальная эвристика не нашла явных совпадений',
      };
    }

    return {
      route: bestRoute.id,
      confidence: Math.min(0.95, 0.55 + bestScore * 0.1),
      reason: 'Ветка выбрана локальной эвристикой по совпадениям в описании и примерах',
    };
  }

  private localExtract(input: string, entities: AiEntity[]): AiExtractorResult {
    const result: AiExtractorResult = { entities: {}, missing: [] };

    entities.forEach(entity => {
      const extracted = this.extractEntityValue(input, entity);
      const variableName = entity.variableName || entity.name;
      const existingValue = this.variables[variableName];
      const alreadyFilled = existingValue !== undefined && existingValue !== null && existingValue !== '';
      result.entities[entity.name] = {
        value: extracted.value,
        confidence: extracted.found ? extracted.confidence : 0,
        found: extracted.found,
      };
      if (entity.required && !extracted.found && !alreadyFilled) {
        result.missing.push(entity.name);
      }
    });

    return result;
  }

  private extractEntityValue(input: string, entity: AiEntity): { value: any; confidence: number; found: boolean } {
    const normalized = input.trim();
    let value: any = null;

    if (entity.validationRegex) {
      try {
        const match = normalized.match(new RegExp(entity.validationRegex, 'i'));
        if (match?.[0]) {
          value = match[0];
        }
      } catch (error) {

      }
    }

    if (value === null) {
      switch (entity.type) {
        case 'phone': {
          const match = normalized.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
          value = match?.[0]?.replace(/[^\d+]/g, '') || null;
          break;
        }
        case 'email': {
          const match = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
          value = match?.[0] || null;
          break;
        }
        case 'date': {
          const match = normalized.match(/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/i);
          value = match?.[0] || null;
          break;
        }
        case 'time': {
          const match = normalized.match(/\b\d{1,2}:\d{2}\b/);
          value = match?.[0] || null;
          break;
        }
        case 'number': {
          const match = normalized.match(/-?\d+(?:[.,]\d+)?/);
          value = match?.[0] ? Number(match[0].replace(',', '.')) : null;
          break;
        }
        case 'enum': {
          const lowerInput = normalized.toLowerCase();
          value = (entity.enumValues || []).find(option => lowerInput.includes(option.toLowerCase())) || null;
          break;
        }
        case 'boolean': {
          const lowerInput = normalized.toLowerCase();
          if (/\b(да|yes|true|ок|согласен|согласна)\b/i.test(lowerInput)) {
            value = true;
          } else if (/\b(нет|no|false|не согласен|не согласна)\b/i.test(lowerInput)) {
            value = false;
          }
          break;
        }
        case 'string':
        default:
          value = null;
          break;
      }
    }

    const found = value !== null && value !== undefined && value !== '';
    return { value, confidence: found ? 0.75 : 0, found };
  }

  private applyAiExtractorResult(block: EngineNode, result: AiExtractorResult): void {
    const entities = block.AiEntities || [];

    entities.forEach(entity => {
      const extracted = result.entities?.[entity.name];
      const variableName = entity.variableName || entity.name;

      if (extracted?.found) {
        this.variables[variableName] = extracted.value;
        this.variables[`${variableName}_status`] = 'filled';
        this.variables[`${variableName}_confidence`] = this.clampConfidence(extracted.confidence);
      } else if (!(variableName in this.variables)) {
        this.variables[variableName] = undefined;
        this.variables[`${variableName}_status`] = 'undefined';
      }
    });
  }

  private getMissingRequiredEntities(block: EngineNode, result: AiExtractorResult): AiEntity[] {
    const entities = block.AiEntities || [];
    const missingNames = new Set(result.missing || []);
    return entities.filter(entity => {
      const variableName = entity.variableName || entity.name;
      const extracted = result.entities?.[entity.name];
      const existingValue = this.variables[variableName];
      const alreadyFilled = existingValue !== undefined && existingValue !== null && existingValue !== '';
      const isMissing = !alreadyFilled && (missingNames.has(entity.name) || !extracted?.found);
      return !!entity.required && isMissing;
    });
  }

  private getAiContext(mode: AiContextMode): Array<{ role: 'bot' | 'user'; content: string }> {
    switch (mode) {
      case 'none':
        return [];
      case 'last_n_messages':
        return this.dialogHistory.slice(-8);
      case 'last_message':
      default:
        return this.dialogHistory.slice(-1);
    }
  }

  private recordBotMessage(content: string): void {
    this.recordDialogMessage('bot', content);
  }

  private recordUserMessage(content: string): void {
    this.recordDialogMessage('user', content);
  }

  private recordDialogMessage(role: 'bot' | 'user', content: string): void {
    if (!content) return;
    this.dialogHistory.push({ role, content });
    if (this.dialogHistory.length > 20) {
      this.dialogHistory = this.dialogHistory.slice(-20);
    }
  }

  private stringifyForAi(value: any): string {
    if (typeof value === 'string') {
      return value;
    }
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }

  private normalizeAiText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-zа-яё0-9_]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private clampConfidence(value: any): number {
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) {
      return 0;
    }
    return Math.max(0, Math.min(1, numberValue));
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
    this.dialogHistory = [];
  }
}
