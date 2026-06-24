import { BlockNode, BlockExecutionResult, ExecutionContext, MessageBlockData, ConditionBlockData, VariableBlockData, ApiBlockData, FileBlockData, ScriptBlockData, AiRouterBlockData, AiExtractorBlockData, AiAssistantBlockData } from '../types';


export function executeBlock(
  block: BlockNode,
  context: ExecutionContext,
  connections: Array<{ source: string; target: string; sourceHandle?: string }>
): BlockExecutionResult {
  switch (block.data.type) {
    case 'start':
      return executeStart(block, context, connections);
    case 'message':
      return executeMessage(block, context, connections);
    case 'condition':
      return executeCondition(block, context, connections);
    case 'variable':
      return executeVariable(block, context, connections);
    case 'api':
      return executeAPI(block, context, connections);
    case 'file':
      return executeFile(block, context, connections);
    case 'script':
      return executeScript(block, context, connections);
    case 'aiRouter':
      return executeAiRouter(block, context, connections);
    case 'aiExtractor':
      return executeAiExtractor(block, context, connections);
    case 'aiAssistant':
      return executeAiAssistant(block, context, connections);
    default:
      return {
        success: false,
        error: `Неизвестный тип блока: ${(block.data as any).type}`,
      };
  }
}


function executeStart(
  block: BlockNode,
  _context: ExecutionContext,
  connections: Array<{ source: string; target: string }>
): BlockExecutionResult {
  const nextConnection = connections.find(c => c.source === block.id);

  return {
    success: true,
    nextNodeId: nextConnection?.target || null,
    output: 'Бот запущен',
  };
}


function executeMessage(
  block: BlockNode,
  context: ExecutionContext,
  connections: Array<{ source: string; target: string }>
): BlockExecutionResult {
  const messageData = block.data as MessageBlockData;
  const message = messageData.text || block.data.label || 'Сообщение без текста';

  
  const processedMessage = replaceVariables(message, context.variables, context.globalConstants);

  
  

  const nextConnection = connections.find(c => c.source === block.id);

  return {
    success: true,
    nextNodeId: nextConnection?.target || null,
    output: processedMessage,
    
    saveResponseToVariable: messageData.saveResponseToVariable,
  };
}


function executeCondition(
  block: BlockNode,
  context: ExecutionContext,
  connections: Array<{ source: string; target: string; sourceHandle?: string }>
): BlockExecutionResult {
  const conditionData = block.data as ConditionBlockData;
  const conditions = conditionData.conditions || [];
  const hasDefault = conditionData.hasDefault ?? true;
  
  if (conditions.length === 0) {
    return {
      success: false,
      error: 'Нет условий для проверки',
    };
  }

  
  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    const result = evaluateCondition(condition.condition, context);
    
    if (result) {
      
      const targetConnection = connections.find(
        c => c.source === block.id && c.sourceHandle === `output-${i}`
      );
      
      return {
        success: true,
        nextNodeId: targetConnection?.target || null,
        output: `Condition ${i + 1}: TRUE`,
      };
    }
  }

  
  if (hasDefault) {
    const defaultConnection = connections.find(
      c => c.source === block.id && c.sourceHandle === 'output-default'
    );
    
    return {
      success: true,
      nextNodeId: defaultConnection?.target || null,
      output: 'Default branch',
    };
  }

  return {
    success: true,
    nextNodeId: null,
    output: 'No condition matched',
  };
}


function evaluateCondition(condition: string, context: ExecutionContext): boolean {
  const userInput = context.userInput || '';
  const normalized = condition.replace(/\buserInput\b/g, userInput);

  try {
    const orParts = normalized.split('||').map(part => part.trim()).filter(Boolean);
    if (orParts.length > 0) {
      return orParts.some(orPart => {
        const andParts = orPart.split('&&').map(part => part.trim()).filter(Boolean);
        return andParts.every(part => evaluateBasicCondition(part, context));
      });
    }
    return evaluateBasicCondition(normalized, context);
  } catch (e) {
    return false;
  }
}

function evaluateBasicCondition(condition: string, context: ExecutionContext): boolean {
  try {
    if (condition.includes('===')) {
      const [left, right] = condition.split('===').map(s => s.trim());
      const leftValue = getVariableValue(left, context);
      const rightValue = getVariableValue(right, context);
      return String(leftValue) === String(rightValue);
    } else if (condition.includes('!==')) {
      const [left, right] = condition.split('!==').map(s => s.trim());
      const leftValue = getVariableValue(left, context);
      const rightValue = getVariableValue(right, context);
      return String(leftValue) !== String(rightValue);
    } else if (condition.toLowerCase().includes('contains')) {
      const parts = condition.toLowerCase().split('contains');
      if (parts.length === 2) {
        const left = parts[0].trim();
        const right = parts[1].trim().replace(/['"]/g, '');
        const leftValue = getVariableValue(left, context);
        return String(leftValue).toLowerCase().includes(right.toLowerCase());
      }
    } else if (condition.includes('>=')) {
      const [left, right] = condition.split('>=').map(s => s.trim());
      const leftValue = getVariableValue(left, context);
      const rightValue = getVariableValue(right, context);
      return Number(leftValue) >= Number(rightValue);
    } else if (condition.includes('<=')) {
      const [left, right] = condition.split('<=').map(s => s.trim());
      const leftValue = getVariableValue(left, context);
      const rightValue = getVariableValue(right, context);
      return Number(leftValue) <= Number(rightValue);
    } else if (condition.includes('>')) {
      const [left, right] = condition.split('>').map(s => s.trim());
      const leftValue = getVariableValue(left, context);
      const rightValue = getVariableValue(right, context);
      return Number(leftValue) > Number(rightValue);
    } else if (condition.includes('<')) {
      const [left, right] = condition.split('<').map(s => s.trim());
      const leftValue = getVariableValue(left, context);
      const rightValue = getVariableValue(right, context);
      return Number(leftValue) < Number(rightValue);
    } else if (condition.trim().toLowerCase() === 'default') {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}


function executeVariable(
  block: BlockNode,
  context: ExecutionContext,
  connections: Array<{ source: string; target: string }>
): BlockExecutionResult {
  const variableData = block.data as VariableBlockData;
  const variableName = variableData.variableName || 'var';
  const value = variableData.value || '';

  
  const processedValue = replaceVariables(value, context.variables, context.globalConstants);

  
  const variableDataForCheck = block.data as any;
  if (variableDataForCheck.isFinal && context.variables[variableName] !== undefined) {
    return {
      success: false,
      error: `Ошибка: Переменная "${variableName}" помечена как final и не может быть изменена`,
    };
  }

  
  context.variables[variableName] = processedValue;

  const nextConnection = connections.find(c => c.source === block.id);

  return {
    success: true,
    nextNodeId: nextConnection?.target || null,
    output: `${variableName} = ${processedValue}`,
  };
}


function executeAPI(
  block: BlockNode,
  context: ExecutionContext,
  connections: Array<{ source: string; target: string }>
): BlockExecutionResult {
  const apiData = block.data as ApiBlockData;
  const url = apiData.url || '';
  const method = apiData.method || 'GET';
  const processedUrl = replaceVariables(url, context.variables, context.globalConstants);

  
  const isBadStatus = !processedUrl || processedUrl.toLowerCase().includes('error');
  const status = isBadStatus ? 500 : 200;
  const body = isBadStatus ? { error: 'Bad status' } : { ok: true, url: processedUrl };

  
  if (!isBadStatus && method === 'GET' && apiData.responseVariable) {
    context.variables[apiData.responseVariable] = body;
  }

  const nextConnection = connections.find(c => c.source === block.id);

  return {
    success: !isBadStatus,
    nextNodeId: nextConnection?.target || null,
    output: isBadStatus
      ? `API ${method} ${processedUrl} - Ошибка, статус ${status}`
      : `API ${method} ${processedUrl} - Успех, статус ${status}`,
  };
}


function executeFile(
  block: BlockNode,
  context: ExecutionContext,
  connections: Array<{ source: string; target: string }>
): BlockExecutionResult {
  const fileData = block.data as FileBlockData;
  const action = fileData.action || 'upload';
  const fileName = fileData.fileName || 'file';
  const processedFileName = replaceVariables(fileName, context.variables, context.globalConstants);

  const result = `Файл ${processedFileName} обработан (${action})`;

  const nextConnection = connections.find(c => c.source === block.id);

  return {
    success: true,
    nextNodeId: nextConnection?.target || null,
    output: result,
  };
}


function executeScript(
  block: BlockNode,
  context: ExecutionContext,
  connections: Array<{ source: string; target: string }>
): BlockExecutionResult {
  const scriptData = block.data as ScriptBlockData;
  const code = scriptData.code || '';

  if (!code.trim()) {
    const nextConnection = connections.find(c => c.source === block.id);
    return {
      success: true,
      nextNodeId: nextConnection?.target || null,
      output: 'Скрипт пуст',
    };
  }

  try {
    
    const scriptContext = {
      variables: context.variables,
      globalConstants: context.globalConstants,
      
      setVariable: (name: string, value: any) => {
        context.variables[name] = value;
      },
      getVariable: (name: string) => {
        return context.variables[name] !== undefined ? context.variables[name] : 
               (context.globalConstants && context.globalConstants[name] !== undefined ? context.globalConstants[name] : undefined);
      },
    };

    
    const scriptFunction = new Function(
      'variables',
      'globalConstants',
      'setVariable',
      'getVariable',
      `
      try {
        ${code}
      } catch (error) {
        throw new Error('Script execution error: ' + error.message);
      }
      `
    );

    
    const result = scriptFunction.call(
      scriptContext,
      context.variables,
      context.globalConstants,
      scriptContext.setVariable,
      scriptContext.getVariable
    );

    
    if (scriptData.returnVariable && result !== undefined) {
      context.variables[scriptData.returnVariable] = result;
    }

    const nextConnection = connections.find(c => c.source === block.id);

    return {
      success: true,
      nextNodeId: nextConnection?.target || null,
      output: result !== undefined ? `Скрипт выполнен. Результат: ${String(result)}` : 'Скрипт выполнен',
    };
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    const nextConnection = connections.find(c => c.source === block.id);

    
    if (scriptData.returnVariable) {
      context.variables[scriptData.returnVariable] = { 
        error: errorMessage,
        errorType: 'ScriptExecutionError'
      };
    }

    return {
      success: false,
      nextNodeId: nextConnection?.target || null,
      error: `Ошибка выполнения скрипта: ${errorMessage}`,
    };
  }
}



function replaceVariables(text: string, variables: Record<string, any>, globalConstants?: Record<string, any>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    
    if (variables[varName] !== undefined) {
      return String(variables[varName]);
    }
    if (globalConstants && globalConstants[varName] !== undefined) {
      return String(globalConstants[varName]);
    }
    return match;
  });
}

function getVariableValue(varRef: string, context: ExecutionContext): any {
  
  if (context.variables[varRef] !== undefined) {
    return context.variables[varRef];
  }
  
  if (context.globalConstants && context.globalConstants[varRef] !== undefined) {
    return context.globalConstants[varRef];
  }
  
  if ((varRef.startsWith('"') && varRef.endsWith('"')) ||
      (varRef.startsWith("'") && varRef.endsWith("'"))) {
    return varRef.slice(1, -1);
  }
  
  const num = Number(varRef);
  if (!isNaN(num)) {
    return num;
  }
  
  return varRef;
}

function executeAiRouter(
  block: BlockNode,
  context: ExecutionContext,
  connections: Array<{ source: string; target: string; sourceHandle?: string }>
): BlockExecutionResult {
  const aiData = block.data as AiRouterBlockData;
  const input = getAiInput(aiData.inputVariable, context);
  const routes = aiData.routes || [];
  const normalizedInput = input.toLowerCase();
  let bestIndex = -1;
  let bestScore = 0;

  routes.forEach((route, index) => {
    const text = [route.id, route.title, route.description || '', ...(route.examples || [])].join(' ').toLowerCase();
    const tokens = Array.from(new Set(text.split(/[^a-zа-яё0-9_]+/gi).filter(token => token.length > 2)));
    const score = tokens.reduce((sum, token) => normalizedInput.includes(token) ? sum + 1 : sum, 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  const confidence = bestScore ? Math.min(0.95, 0.55 + bestScore * 0.1) : 0.25;
  const threshold = aiData.confidenceThreshold ?? 0.6;
  const route = bestIndex >= 0 ? routes[bestIndex] : null;

  if (aiData.saveNormalizedIntentTo) {
    context.variables[aiData.saveNormalizedIntentTo] = route?.id || 'fallback';
  }
  if (aiData.confidenceVariable) {
    context.variables[aiData.confidenceVariable] = confidence;
  }
  if (aiData.reasonVariable) {
    context.variables[aiData.reasonVariable] = bestScore ? 'Выбрано локальной эвристикой' : 'Нет уверенного совпадения';
  }

  const handle = route && confidence >= threshold ? `route-${bestIndex}` : 'fallback';
  const targetConnection = connections.find(c => c.source === block.id && c.sourceHandle === handle);

  return {
    success: true,
    nextNodeId: targetConnection?.target || null,
    output: `AI Router: ${route?.id || 'fallback'} (${confidence})`,
  };
}

function executeAiExtractor(
  block: BlockNode,
  context: ExecutionContext,
  connections: Array<{ source: string; target: string; sourceHandle?: string }>
): BlockExecutionResult {
  const aiData = block.data as AiExtractorBlockData;
  const input = getAiInput(aiData.inputVariable, context);
  const missing: string[] = [];

  (aiData.entities || []).forEach(entity => {
    const variableName = entity.variableName || entity.name;
    const extracted = extractEntityLocally(input, entity.type, entity.enumValues, entity.validationRegex, entity);
    if (extracted.found) {
      context.variables[variableName] = extracted.value;
      context.variables[`${variableName}_status`] = 'filled';
    } else if (entity.required && (
      context.variables[variableName] === undefined ||
      context.variables[variableName] === null ||
      context.variables[variableName] === ''
    )) {
      missing.push(entity.name);
      context.variables[`${variableName}_status`] = 'undefined';
    }
  });

  const handle = missing.length === 0 ? 'complete' : 'missing';
  const targetConnection = connections.find(c => c.source === block.id && c.sourceHandle === handle);

  return {
    success: true,
    nextNodeId: targetConnection?.target || null,
    output: missing.length === 0 ? 'AI Extractor: complete' : `AI Extractor: missing ${missing.join(', ')}`,
  };
}

function executeAiAssistant(
  block: BlockNode,
  context: ExecutionContext,
  connections: Array<{ source: string; target: string; sourceHandle?: string }>
): BlockExecutionResult {
  const aiData = block.data as AiAssistantBlockData;
  const input = getAiInput(aiData.inputVariable, context);
  const routes = aiData.routes || [];
  const normalizedInput = input.toLowerCase();
  let bestIndex = -1;
  let bestScore = 0;

  routes.forEach((route, index) => {
    const text = [route.id, route.title, route.description || '', ...(route.examples || [])].join(' ').toLowerCase();
    const tokens = Array.from(new Set(text.split(/[^a-zа-яё0-9_]+/gi).filter(token => token.length > 2)));
    const score = tokens.reduce((sum, token) => normalizedInput.includes(token) ? sum + 1 : sum, 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  const confidence = bestScore ? Math.min(0.95, 0.55 + bestScore * 0.1) : 0.25;
  const threshold = aiData.confidenceThreshold ?? 0.6;
  const activeSpecialTopicValue = aiData.specialTopicVariable
    ? context.variables[aiData.specialTopicVariable]
    : context.variables.is_special_topic;
  const isActiveSpecialTopic = activeSpecialTopicValue === true || activeSpecialTopicValue === 'true';
  const activeRouteIndex = bestIndex >= 0 ? bestIndex : 0;
  const isSpecialTopic = (bestIndex >= 0 && confidence >= threshold) || isActiveSpecialTopic;
  const missing: string[] = [];

  if (isSpecialTopic) {
    (aiData.entities || []).forEach(entity => {
      const variableName = entity.variableName || entity.name;
      const extracted = extractEntityLocally(input, entity.type, entity.enumValues, entity.validationRegex, entity);
      if (extracted.found) {
        context.variables[variableName] = extracted.value;
        context.variables[`${variableName}_status`] = 'filled';
      } else if (entity.required && (
        context.variables[variableName] === undefined ||
        context.variables[variableName] === null ||
        context.variables[variableName] === ''
      )) {
        missing.push(entity.name);
        context.variables[`${variableName}_status`] = 'undefined';
      }
    });
  }

  if (aiData.replyVariable) {
    context.variables[aiData.replyVariable] = isSpecialTopic ? 'Специальная тема распознана' : 'Обычный AI-ответ';
  }
  if (aiData.buttonsVariable) {
    context.variables[aiData.buttonsVariable] = [];
  }
  if (aiData.saveNormalizedIntentTo) {
    context.variables[aiData.saveNormalizedIntentTo] = isSpecialTopic && routes[activeRouteIndex] ? routes[activeRouteIndex].id : 'chat';
  }
  if (aiData.confidenceVariable) {
    context.variables[aiData.confidenceVariable] = isActiveSpecialTopic ? Math.max(confidence, threshold) : confidence;
  }
  if (aiData.specialTopicVariable) {
    context.variables[aiData.specialTopicVariable] = isSpecialTopic;
  }

  const handle = isSpecialTopic ? (missing.length === 0 ? 'task-complete' : 'task-missing') : 'chat';
  const targetConnection = connections.find(c => c.source === block.id && c.sourceHandle === handle);

  return {
    success: true,
    nextNodeId: targetConnection?.target || null,
    output: isSpecialTopic
      ? `AI Assistant: ${missing.length === 0 ? 'task complete' : `missing ${missing.join(', ')}`}`
      : 'AI Assistant: chat',
  };
}

function getAiInput(inputVariable: string | undefined, context: ExecutionContext): string {
  if (inputVariable && context.variables[inputVariable] !== undefined && context.variables[inputVariable] !== null) {
    return String(context.variables[inputVariable]);
  }
  return String(context.variables.lastMessage || context.variables.userInput || context.userInput || '');
}

function extractEntityLocally(
  input: string,
  type: string,
  enumValues?: string[],
  validationRegex?: string,
  entity?: { name?: string; variableName?: string; description?: string; askPrompt?: string }
): { value: any; found: boolean } {
  let value: any = null;

  if (validationRegex) {
    try {
      value = input.match(new RegExp(validationRegex, 'i'))?.[0] || null;
    } catch (e) {
      
    }
  }

  if (value === null) {
    switch (type) {
      case 'phone':
        value = input.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.replace(/[^\d+]/g, '') || null;
        break;
      case 'email':
        value = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
        break;
      case 'date':
        value = extractNaturalDate(input);
        break;
      case 'time':
        value = extractNaturalTime(input);
        break;
      case 'number':
        value = Number(input.match(/-?\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.'));
        if (Number.isNaN(value)) value = null;
        break;
      case 'enum':
        value = (enumValues || []).find(option => input.toLowerCase().includes(option.toLowerCase())) || null;
        break;
      case 'string':
        value = entity ? extractStringEntityValue(input, entity) : null;
        break;
      default:
        value = null;
        break;
    }
  }

  return { value, found: value !== null && value !== undefined && value !== '' };
}

function normalizeAiText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-zа-яё0-9_]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractNaturalDate(input: string): string | null {
  const explicitDate = input.match(/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/i);
  if (explicitDate?.[0]) {
    return explicitDate[0];
  }

  const normalized = normalizeAiText(input);
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

function extractNaturalTime(input: string): string | null {
  const explicitTime = input.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (explicitTime?.[0]) {
    const [hour, minute] = explicitTime[0].split(':');
    return `${String(Number(hour)).padStart(2, '0')}:${minute}`;
  }

  const text = input.toLowerCase();
  const naturalTime = text.match(/(?:^|\s)(?:в|на|к)\s*(\d{1,2})(?::([0-5]\d))?\s*(утра|вечера|дня|ночи)(?=$|\s|[.,!?;:])/i)
    || text.match(/(?:^|\s)(\d{1,2})(?::([0-5]\d))?\s*(утра|вечера|дня|ночи)(?=$|\s|[.,!?;:])/i)
    || text.match(/(?:^|\s)(?:в|на|к)\s*(\d{1,2})(?::([0-5]\d))?\s*(час(?:ов|а)?)?(?=$|\s|[.,!?;:])/i)
    || text.match(/^\s*(\d{1,2})\s*$/);

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

function extractStringEntityValue(
  input: string,
  entity: { name?: string; variableName?: string; description?: string; askPrompt?: string }
): string | null {
  const hint = normalizeAiText(`${entity.name || ''} ${entity.variableName || ''} ${entity.description || ''} ${entity.askPrompt || ''}`);
  const isNameLike = /(name|имя|пациент|фамил)/i.test(hint);

  if (!isNameLike) {
    return null;
  }

  const labels = [entity.name, entity.variableName]
    .filter((label): label is string => !!label && label.trim().length > 0)
    .map(label => escapeRegex(label.trim()));
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
