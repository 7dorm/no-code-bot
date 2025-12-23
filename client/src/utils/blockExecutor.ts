import { BlockNode, BlockExecutionResult, ExecutionContext, MessageBlockData, ConditionBlockData, VariableBlockData, ApiBlockData, FileBlockData, ScriptBlockData } from '../types';

// Функция выполнения блока по типу
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
    default:
      return {
        success: false,
        error: `Неизвестный тип блока: ${(block.data as any).type}`,
      };
  }
}

// START блок - точка входа, просто перенаправляет к следующему блоку
function executeStart(
  block: BlockNode,
  context: ExecutionContext,
  connections: Array<{ source: string; target: string }>
): BlockExecutionResult {
  const nextConnection = connections.find(c => c.source === block.id);

  return {
    success: true,
    nextNodeId: nextConnection?.target || null,
    output: 'Бот запущен',
  };
}

// MESSAGE блок - отправка сообщения пользователю
function executeMessage(
  block: BlockNode,
  context: ExecutionContext,
  connections: Array<{ source: string; target: string }>
): BlockExecutionResult {
  const messageData = block.data as MessageBlockData;
  const message = messageData.text || block.data.label || 'Сообщение без текста';

  // Заменяем переменные в сообщении
  const processedMessage = replaceVariables(message, context.variables, context.globalConstants);

  // Если указана переменная для сохранения ответа, она будет сохранена в Preview компоненте
  // после получения ответа пользователя

  const nextConnection = connections.find(c => c.source === block.id);

  return {
    success: true,
    nextNodeId: nextConnection?.target || null,
    output: processedMessage,
    // Сохраняем информацию о том, нужно ли сохранять ответ пользователя
    saveResponseToVariable: messageData.saveResponseToVariable,
  };
}

// CONDITION блок - проверка нескольких условий и ветвление
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

  // Проверяем каждое условие по порядку
  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    const result = evaluateCondition(condition.condition, context);
    
    if (result) {
      // Находим соединение для этого условия
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

  // Если ни одно условие не выполнилось, проверяем дефолтную ветку
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

// Функция для оценки условия
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

// VARIABLE блок - работа с переменными
function executeVariable(
  block: BlockNode,
  context: ExecutionContext,
  connections: Array<{ source: string; target: string }>
): BlockExecutionResult {
  const variableData = block.data as VariableBlockData;
  const variableName = variableData.variableName || 'var';
  const value = variableData.value || '';

  // Заменяем переменные в значении
  const processedValue = replaceVariables(value, context.variables, context.globalConstants);

  // Обновляем контекст
  context.variables[variableName] = processedValue;

  const nextConnection = connections.find(c => c.source === block.id);

  return {
    success: true,
    nextNodeId: nextConnection?.target || null,
    output: `${variableName} = ${processedValue}`,
  };
}

// API блок - вызов внешнего API (имитация)
function executeAPI(
  block: BlockNode,
  context: ExecutionContext,
  connections: Array<{ source: string; target: string }>
): BlockExecutionResult {
  const apiData = block.data as ApiBlockData;
  const url = apiData.url || '';
  const method = apiData.method || 'GET';
  const processedUrl = replaceVariables(url, context.variables, context.globalConstants);

  // Имитация ответа API с простым определением статуса
  const isBadStatus = !processedUrl || processedUrl.toLowerCase().includes('error');
  const status = isBadStatus ? 500 : 200;
  const body = isBadStatus ? { error: 'Bad status' } : { ok: true, url: processedUrl };

  // Для GET сохраняем ответ в переменную, если указано
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

// FILE блок - обработка файлов (имитация)
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

// SCRIPT блок - выполнение JavaScript кода
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
    // Создаем безопасный контекст для выполнения скрипта
    const scriptContext = {
      variables: context.variables,
      globalConstants: context.globalConstants,
      // Предоставляем функции для работы с переменными
      setVariable: (name: string, value: any) => {
        context.variables[name] = value;
      },
      getVariable: (name: string) => {
        return context.variables[name] !== undefined ? context.variables[name] : 
               (context.globalConstants && context.globalConstants[name] !== undefined ? context.globalConstants[name] : undefined);
      },
    };

    // Выполняем скрипт в изолированном контексте
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

    // Выполняем скрипт
    const result = scriptFunction.call(
      scriptContext,
      context.variables,
      context.globalConstants,
      scriptContext.setVariable,
      scriptContext.getVariable
    );

    // Если указана переменная для результата и скрипт вернул значение
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

    // В случае ошибки сохраняем информацию об ошибке в переменную
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

// Вспомогательные функции

function replaceVariables(text: string, variables: Record<string, any>, globalConstants?: Record<string, any>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    // Сначала проверяем переменные, затем глобальные константы
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
  // Если это ссылка на переменную
  if (context.variables[varRef] !== undefined) {
    return context.variables[varRef];
  }
  // Проверяем глобальные константы
  if (context.globalConstants && context.globalConstants[varRef] !== undefined) {
    return context.globalConstants[varRef];
  }
  // Если это строка в кавычках
  if ((varRef.startsWith('"') && varRef.endsWith('"')) ||
      (varRef.startsWith("'") && varRef.endsWith("'"))) {
    return varRef.slice(1, -1);
  }
  // Попытка преобразовать в число
  const num = Number(varRef);
  if (!isNaN(num)) {
    return num;
  }
  // Возвращаем как есть
  return varRef;
}
