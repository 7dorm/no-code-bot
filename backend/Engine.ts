import { UI } from "./UI";

declare const require: any;
export interface EngineNode {
  id: string;
  Type: 'output' | 'condition' | 'start' | 'variable' | 'FILE' | 'api' | 'skip' | 'script' | 'aiRouter' | 'aiExtractor' | 'aiAssistant';
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
  AiReplyVariable?: string;
  AiButtonsVariable?: string;
  AiSpecialTopicVariable?: string;
  AiLoop?: boolean;
  AiExitPhrases?: string[];
}

export type AiContextMode = 'none' | 'last_message' | 'last_n_messages';

export interface AiSettings {
  provider?: 'mock' | 'custom' | 'openai' | 'openaiCompatible' | 'yandex-alice' | 'yandexgpt';
  endpoint?: string;
  apiKey?: string;
  baseUrl?: string;
  iamToken?: string;
  folderId?: string;
  modelUri?: string;
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

interface AiAssistantResult {
  message: string;
  intent?: string;
  isSpecialTopic?: boolean;
  confidence?: number;
  reason?: string;
  entities?: Record<string, AiExtractedEntity>;
  missing?: string[];
  buttons?: string[];
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
      case "aiAssistant":
        await this.executeAiAssistant();
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
    let accumulatedInput = input;
    let result = await this.runAiExtractor(block, input);
    this.applyAiExtractorResult(block, result);

    let missing = this.getMissingRequiredEntities(block, result);
    let attempts = 0;
    const maxAttempts = Math.max(1, (block.AiEntities || []).length + 2);

    while (missing.length > 0 && block.AiAskMissing !== false && attempts < maxAttempts) {
      const entity = missing[0];
      if (!entity) return;
      const prompt = entity.askPrompt || `Уточните значение для "${entity.name}".`;
      await this.ui.sendMessage(prompt, []);
      this.recordBotMessage(prompt);

      const userInput = await this.ui.getInput();
      this.variables['lastMessage'] = userInput;
      this.variables['userInput'] = userInput;
      this.recordUserMessage(userInput);

      accumulatedInput = `${accumulatedInput}\n${entity.name}: ${userInput}`;
      result = await this.runAiExtractor(block, accumulatedInput);
      this.applyAiExtractorResult(block, result);
      missing = this.getMissingRequiredEntities(block, result);
      attempts++;
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

  async executeAiAssistant(): Promise<void> {
    const block = this.nodeStructure[this.index!];
    if (!block) return;

    const input = await this.getAiInput(block);
    if (this.isAiExitMessage(input, block)) {
      this.ui.finish();
      this.isFinished = true;
      return;
    }

    const result = await this.runAiAssistant(block, input);
    this.applyAiAssistantResult(block, result);

    const messageToSend = result.message.trim() || 'Не смог подготовить ответ. Попробуйте переформулировать.';
    const buttons = this.normalizeAiButtons(result.buttons);
    await this.ui.sendMessage(messageToSend, buttons);
    this.recordBotMessage(messageToSend);

    if (block.AiLoop) {
      const userInput = await this.ui.getInput();
      this.variables['lastMessage'] = userInput;
      this.variables['userInput'] = userInput;
      this.recordUserMessage(userInput);

      if (this.isAiExitMessage(userInput, block)) {
        this.ui.finish();
        this.isFinished = true;
        return;
      }

      this.executionCount[block.id] = 0;
      this.index = block.id;
      this.skipInput = true;
      await this.execute(true);
      return;
    }

    const missing = this.getMissingRequiredEntities(block, {
      entities: result.entities || {},
      missing: result.missing || [],
    });
    const nextIndex = result.isSpecialTopic
      ? (missing.length === 0 ? 0 : 1)
      : 2;
    const nextId = block.Nexts[nextIndex] || block.Nexts[0];

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
        reason: remoteResult.reason || '',
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
      return this.mergeLocalAiExtractorResult(block, input, {
        entities: remoteResult.entities,
        missing: Array.isArray(remoteResult.missing) ? remoteResult.missing : [],
      });
    }

    return this.localExtract(input, block.AiEntities || []);
  }

  private async runAiAssistant(block: EngineNode, input: string): Promise<AiAssistantResult> {
    const remoteResult = await this.callAiEndpoint<AiAssistantResult>('assistant', block, {
      input,
      routes: block.AiRoutes || [],
      entities: block.AiEntities || [],
      expectedResponse: {
        message: 'text to send to user',
        intent: 'chat or route id from routes',
        isSpecialTopic: 'boolean',
        confidence: 'number from 0 to 1',
        reason: 'short explanation',
        entities: {
          entityName: {
            value: 'extracted value or null',
            confidence: 'number from 0 to 1',
            found: 'boolean',
          },
        },
        missing: ['missing required entity names'],
        buttons: ['optional quick reply text'],
      },
    });

    if (remoteResult && typeof remoteResult.message === 'string') {
      const normalized = this.normalizeAiAssistantResult(remoteResult);
      const withLocalEntities = this.mergeLocalAiAssistantResult(block, input, normalized);
      return this.sanitizeAiAssistantResult(block, withLocalEntities);
    }

    return this.localAssistant(input, block);
  }

  private async callAiEndpoint<T>(mode: 'router' | 'extractor' | 'assistant', block: EngineNode, extraPayload: Record<string, any>): Promise<T | null> {
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
          apiKey: block.AiSettings?.apiKey,
          baseUrl: block.AiSettings?.baseUrl,
          iamToken: block.AiSettings?.iamToken,
          folderId: block.AiSettings?.folderId,
          modelUri: block.AiSettings?.modelUri,
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
    let bestRoute = routes[0]!;
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

  private mergeLocalAiExtractorResult(block: EngineNode, input: string, result: AiExtractorResult): AiExtractorResult {
    const localResult = this.localExtract(input, block.AiEntities || []);
    const mergedEntities: Record<string, AiExtractedEntity> = { ...(result.entities || {}) };

    (block.AiEntities || []).forEach(entity => {
      const localEntity = localResult.entities[entity.name];
      const remoteEntity = mergedEntities[entity.name];

      if (localEntity?.found && (!remoteEntity || !remoteEntity.found)) {
        mergedEntities[entity.name] = localEntity;
      }
    });

    const missing = (block.AiEntities || [])
      .filter(entity => {
        const variableName = entity.variableName || entity.name;
        const existingValue = this.variables[variableName];
        const alreadyFilled = existingValue !== undefined && existingValue !== null && existingValue !== '';
        const extracted = mergedEntities[entity.name];
        return !!entity.required && !alreadyFilled && (!extracted || !extracted.found);
      })
      .map(entity => entity.name);

    return {
      entities: mergedEntities,
      missing,
    };
  }

  private mergeLocalAiAssistantResult(block: EngineNode, input: string, result: AiAssistantResult): AiAssistantResult {
    const extraction = this.mergeLocalAiExtractorResult(block, input, {
      entities: result.entities || {},
      missing: result.missing || [],
    });
    const activeSpecialTopic = this.isAiSpecialTopicActive(block);
    const threshold = block.AiConfidenceThreshold ?? block.AiSettings?.confidenceThreshold ?? 0.6;
    const fallbackRouteId = block.AiRoutes?.[0]?.id;

    return {
      ...result,
      intent: activeSpecialTopic && (!result.intent || result.intent === 'chat') ? (fallbackRouteId || result.intent) : result.intent,
      isSpecialTopic: result.isSpecialTopic || activeSpecialTopic,
      confidence: activeSpecialTopic ? Math.max(this.clampConfidence(result.confidence), threshold) : result.confidence,
      reason: activeSpecialTopic && !result.isSpecialTopic ? 'Продолжается активный сценарий сбора данных' : result.reason,
      entities: extraction.entities,
      missing: extraction.missing,
    };
  }

  private localAssistant(input: string, block: EngineNode): AiAssistantResult {
    const routes = block.AiRoutes || [];
    const threshold = block.AiConfidenceThreshold ?? block.AiSettings?.confidenceThreshold ?? 0.6;
    const routed = this.localRoute(input, routes);
    const activeSpecialTopic = this.isAiSpecialTopicActive(block);
    const route = routes.find(item => item.id === routed.route) || (activeSpecialTopic ? routes[0] : undefined);
    const isSpecialTopic = (!!route && routed.confidence >= threshold) || activeSpecialTopic;

    if (isSpecialTopic) {
      const extraction = this.localExtract(input, block.AiEntities || []);
      const missing = this.getMissingRequiredEntities(block, extraction);
      const firstMissing = missing[0];
      const buttons = this.getButtonsForMissingEntity(firstMissing);
      const filled = (block.AiEntities || [])
        .map(entity => {
          const extracted = extraction.entities[entity.name];
          return extracted?.found ? `${entity.name}: ${extracted.value}` : null;
        })
        .filter(Boolean);

      return {
        message: firstMissing
          ? (firstMissing.askPrompt || `Уточните значение для "${firstMissing.name}".`)
          : `Понял, это сценарий "${route?.title || 'активный сценарий'}". ${filled.length > 0 ? `Сохранил: ${filled.join(', ')}.` : 'Данные пока не найдены.'}`,
        intent: route?.id || routed.route,
        isSpecialTopic: true,
        confidence: activeSpecialTopic ? Math.max(routed.confidence, threshold) : routed.confidence,
        reason: activeSpecialTopic && routed.confidence < threshold ? 'Продолжается активный сценарий сбора данных' : (routed.reason || ''),
        entities: extraction.entities,
        missing: extraction.missing,
        buttons,
      };
    }

    return {
      message: this.localAssistantChatReply(input),
      intent: 'chat',
      isSpecialTopic: false,
      confidence: routed.confidence,
      reason: 'Сообщение не похоже на одну из специальных тем',
      entities: {},
      missing: [],
      buttons: this.shouldOfferHelpButtons(input) ? ['Записаться', 'Что ты умеешь?'] : [],
    };
  }

  private localAssistantChatReply(input: string): string {
    const normalized = this.normalizeAiText(input);

    if (/(^| )(привет|здравствуй|добрый день|доброе утро|добрый вечер)( |$)/i.test(normalized)) {
      return 'Привет! Я могу отвечать на обычные вопросы, а если вы напишете про запись к врачу, начну собирать нужные данные.';
    }

    if (normalized.includes('что ты умеешь') || normalized.includes('помощь')) {
      return 'Я умею поддерживать обычный диалог и отдельно распознавать специальные темы бота. Например, могу помочь с записью к врачу и уточнить врача, дату, время и имя.';
    }

    if (normalized.includes('2 2') || normalized.includes('два плюс два')) {
      return '2 + 2 = 4.';
    }

    return 'Я понял вопрос. В тестовом mock-режиме отвечаю кратко, а при настроенных ключах Yandex AI Studio ответ будет генерироваться моделью.';
  }

  private shouldOfferHelpButtons(input: string): boolean {
    const normalized = this.normalizeAiText(input);
    return normalized.includes('помощ') || normalized.includes('умеешь') || normalized.includes('начать');
  }

  private isAiSpecialTopicActive(block: EngineNode): boolean {
    if (block.AiSpecialTopicVariable) {
      const value = this.variables[block.AiSpecialTopicVariable];
      if (value === true || value === 'true') {
        return true;
      }
    }

    return (block.AiEntities || []).some(entity => {
      const variableName = entity.variableName || entity.name;
      const value = this.variables[variableName];
      const status = this.variables[`${variableName}_status`];
      return (
        value !== undefined && value !== null && value !== '' ||
        status === 'filled' ||
        status === 'undefined'
      );
    });
  }

  private getButtonsForMissingEntity(entity?: AiEntity): string[] {
    if (!entity) {
      return ['Подтвердить', 'Изменить'];
    }
    if (entity.type === 'enum' && entity.enumValues && entity.enumValues.length > 0) {
      return entity.enumValues;
    }
    return [];
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
          value = this.extractNaturalDate(normalized);
          break;
        }
        case 'time': {
          value = this.extractNaturalTime(normalized);
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
          value = this.extractStringEntityValue(normalized, entity);
          break;
        default:
          value = null;
          break;
      }
    }

    const found = value !== null && value !== undefined && value !== '';
    return { value, confidence: found ? 0.75 : 0, found };
  }

  private extractNaturalDate(input: string): string | null {
    const explicitDate = input.match(/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/i);
    if (explicitDate?.[0]) {
      return explicitDate[0];
    }

    const normalized = this.normalizeAiText(input);
    const date = new Date();

    if (normalized.includes('послезавтра')) {
      date.setDate(date.getDate() + 2);
    } else if (normalized.includes('завтра')) {
      date.setDate(date.getDate() + 1);
    } else if (!normalized.includes('сегодня')) {
      return null;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
  }

  private extractNaturalTime(input: string): string | null {
    const explicitTime = input.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (explicitTime?.[0]) {
      const [hour, minute] = explicitTime[0].split(':');
      return `${String(Number(hour)).padStart(2, '0')}:${minute}`;
    }

    const text = input.toLowerCase();
    const naturalTime = text.match(/(?:^|\s)(?:в|на|к)\s*(\d{1,2})(?::([0-5]\d))?\s*(утра|вечера|дня|ночи)(?=$|\s|[.,!?;:])/i)
      || text.match(/(?:^|\s)(\d{1,2})(?::([0-5]\d))?\s*(утра|вечера|дня|ночи)(?=$|\s|[.,!?;:])/i)
      || text.match(/(?:^|\s)(?:в|на|к)\s*(\d{1,2})(?::([0-5]\d))?\s*(час(?:ов|а)?)?(?=$|\s|[.,!?;:])/i)
      || (text.match(/^\s*(\d{1,2})\s*$/) as RegExpMatchArray | null);

    if (!naturalTime) {
      return null;
    }

    let hour = Number(naturalTime[1]);
    const minute = naturalTime[2] ? Number(naturalTime[2]) : 0;
    const period = naturalTime[3] || '';

    if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) {
      return null;
    }

    if ((period.includes('вечера') || period.includes('дня')) && hour < 12) {
      hour += 12;
    }
    if (period.includes('ночи') && hour === 12) {
      hour = 0;
    }

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  private extractStringEntityValue(input: string, entity: AiEntity): string | null {
    const hint = this.normalizeAiText(`${entity.name} ${entity.variableName || ''} ${entity.description || ''} ${entity.askPrompt || ''}`);
    const isNameLike = /(name|имя|пациент|фамил)/i.test(hint);

    if (!isNameLike) {
      return null;
    }

    const labels = [entity.name, entity.variableName]
      .filter((label): label is string => !!label && label.trim().length > 0)
      .map(label => this.escapeRegex(label.trim()));
    const labeledValue = labels.length > 0
      ? input.match(new RegExp(`(?:^|\\n)\\s*(?:${labels.join('|')})\\s*:\\s*([^\\n]+)`, 'i'))?.[1]
      : null;
    const source = labeledValue || input;
    const hasExplicitNameMarker = /^(?:\s*(?:меня\s+зовут|мое\s+имя|моё\s+имя|зовут|я\s+буду|я|пациент(?:ка)?|имя|фамилия|как|запишите(?:\s+меня)?(?:\s+как)?|запиши(?:\s+меня)?(?:\s+как)?)\s+)/i.test(source);

    let value = source
      .trim()
      .replace(/[.,!?;:]+$/g, '')
      .replace(/^(?:меня\s+зовут|мое\s+имя|моё\s+имя|зовут|я\s+буду|я|пациент(?:ка)?|имя|фамилия|как|запишите(?:\s+меня)?(?:\s+как)?|запиши(?:\s+меня)?(?:\s+как)?)\s+/i, '')
      .trim();

    value = value.replace(/^(?:как)\s+/i, '').trim();
    const isBareShortName = /^[a-zа-яё -]{2,80}$/i.test(value) && value.split(/\s+/).length <= 3;
    const looksLikeSchedulingAnswer = /\d|(^|\s)(врач|доктор|терапевт|кардиолог|невролог|запис|дата|время|сегодня|завтра|послезавтра|утра|вечера|дня|ночи|час)(\s|$)/i.test(value);

    if (
      !/[a-zа-яё]/i.test(value) ||
      value.length < 2 ||
      value.length > 80 ||
      looksLikeSchedulingAnswer ||
      (!labeledValue && !hasExplicitNameMarker && !isBareShortName)
    ) {
      return null;
    }

    return value
      .split(/\s+/)
      .map(part => part ? part[0]!.toUpperCase() + part.slice(1).toLowerCase() : part)
      .join(' ');
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

  private applyAiAssistantResult(block: EngineNode, result: AiAssistantResult): void {
    if (result.entities) {
      this.applyAiExtractorResult(block, {
        entities: result.entities,
        missing: result.missing || [],
      });
    }

    if (block.AiReplyVariable) {
      this.variables[block.AiReplyVariable] = result.message;
    }
    if (block.AiIntentVariable) {
      this.variables[block.AiIntentVariable] = result.intent || 'chat';
    }
    if (block.AiConfidenceVariable) {
      this.variables[block.AiConfidenceVariable] = this.clampConfidence(result.confidence);
    }
    if (block.AiReasonVariable) {
      this.variables[block.AiReasonVariable] = result.reason || '';
    }
    if (block.AiSpecialTopicVariable) {
      this.variables[block.AiSpecialTopicVariable] = !!result.isSpecialTopic;
    }
    if (block.AiButtonsVariable) {
      this.variables[block.AiButtonsVariable] = this.normalizeAiButtons(result.buttons);
    }
    if (block.AiRawResultVariable) {
      this.variables[block.AiRawResultVariable] = result;
    }
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

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private clampConfidence(value: any): number {
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) {
      return 0;
    }
    return Math.max(0, Math.min(1, numberValue));
  }

  private normalizeAiAssistantResult(result: AiAssistantResult): AiAssistantResult {
    return {
      message: typeof result.message === 'string' ? result.message : '',
      intent: typeof result.intent === 'string' ? result.intent : 'chat',
      isSpecialTopic: !!result.isSpecialTopic,
      confidence: this.clampConfidence(result.confidence),
      reason: typeof result.reason === 'string' ? result.reason : '',
      entities: result.entities && typeof result.entities === 'object' ? result.entities : {},
      missing: Array.isArray(result.missing)
        ? result.missing.filter((item): item is string => typeof item === 'string')
        : [],
      buttons: this.normalizeAiButtons(result.buttons),
    };
  }

  private sanitizeAiAssistantResult(block: EngineNode, result: AiAssistantResult): AiAssistantResult {
    if (!result.isSpecialTopic) {
      return result;
    }

    const missing = this.getMissingRequiredEntities(block, {
      entities: result.entities || {},
      missing: result.missing || [],
    });

    if (missing.length === 0) {
      return result;
    }

    return {
      ...result,
      missing: missing.map(entity => entity.name),
      buttons: this.getButtonsForMissingEntity(missing[0]),
    };
  }

  private normalizeAiButtons(buttons: any): string[] {
    if (!Array.isArray(buttons)) {
      return [];
    }

    const unique = new Set<string>();
    buttons.forEach(button => {
      if (typeof button !== 'string') {
        return;
      }
      const normalized = button.trim();
      if (normalized.length > 0 && normalized.length <= 64) {
        unique.add(normalized);
      }
    });

    return Array.from(unique).slice(0, 6);
  }

  private isAiExitMessage(input: string, block: EngineNode): boolean {
    const phrases = block.AiExitPhrases && block.AiExitPhrases.length > 0
      ? block.AiExitPhrases
      : ['/stop', 'стоп', 'завершить', 'пока'];
    const normalizedInput = this.normalizeAiText(input);
    return phrases.some(phrase => normalizedInput === this.normalizeAiText(phrase));
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
