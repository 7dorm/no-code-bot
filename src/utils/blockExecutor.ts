import { BlockNode, BlockType, BlockExecutionResult, ExecutionContext } from '../types';

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
    default:
      return {
        success: false,
        error: `Неизвестный тип блока: ${block.data.type}`,
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
  const message = block.data.params?.text || block.data.label || 'Сообщение без текста';
  
  // Заменяем переменные в сообщении
  const processedMessage = replaceVariables(message, context.variables);
  
  const nextConnection = connections.find(c => c.source === block.id);
  
  return {
    success: true,
    nextNodeId: nextConnection?.target || null,
    output: processedMessage,
  };
}

// CONDITION блок - проверка условия и ветвление
function executeCondition(
  block: BlockNode,
  context: ExecutionContext,
  connections: Array<{ source: string; target: string; sourceHandle?: string }>
): BlockExecutionResult {
  const condition = block.data.params?.condition || '';
  const userInput = context.userInput || '';
  
  let result = false;
  
  try {
    // Простая логика проверки условий
    if (condition.includes('===')) {
      const [left, right] = condition.split('===').map(s => s.trim());
      const leftValue = getVariableValue(left, context);
      const rightValue = getVariableValue(right, context);
      result = String(leftValue) === String(rightValue);
    } else if (condition.includes('Sounds')) {
      // Проверка наличия текста
      result = userInput.toLowerCase().includes(condition.replace(/contains|Contains/g, '').trim().toLowerCase());
    } else if (condition.includes('>')) {
      const [left, right] = condition.split('>').map(s => s.trim());
      const leftValue = getVariableValue(left, context);
      const rightValue = getVariableValue(right, context);
      result = Number(leftValue) > Number(rightValue);
    } else if (condition.includes('<')) {
      const [left, right] = condition.split('<').map(s => s.trim());
      const leftValue = getVariableValue(left, context);
      const rightValue = getVariableValue(right, context);
      result = Number(leftValue) < Number(rightValue);
    } else {
      // Простая проверка на правдивость
      result = Boolean(condition);
    }
  } catch (e) {
    return {
      success: false,
      error: 'Ошибка в условии',
    };
  }
  
  // Находим соединение в зависимости от результата
  const targetConnection = result
    ? connections.find(c => c.source === block.id && c.sourceHandle === 'output')
    : connections.find(c => c.source === block.id && c.sourceHandle === 'output-else');
  
  return {
    success: true,
    nextNodeId: targetConnection?.target || null,
    output: result ? 'TRUE' : 'FALSE',
  };
}

// VARIABLE блок - работа с переменными
function executeVariable(
  block: BlockNode,
  context: ExecutionContext,
  connections: Array<{ source: string; target: string }>
): BlockExecutionResult {
  const variableName = block.data.params?.variableName || 'var';
  const value = block.data.params?.value || '';
  
  // Заменяем переменные в значении
  const processedValue = replaceVariables(value, context.variables);
  
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
  const url = block.data.params?.url || '';
  const method = block.data.params?.method || 'GET';
  
  // Имитация API вызова
  const result = `API ${method} ${url} - Результат получен`;
  
  const nextConnection = connections.find(c => c.source === block.id);
  
  return {
    success: true,
    nextNodeId: nextConnection?.target || null,
    output: result,
  };
}

// FILE блок - обработка файлов (имитация)
function executeFile(
  block: BlockNode,
  context: ExecutionContext,
  connections: Array<{ source: string; target: string }>
): BlockExecutionResult {
  const action = block.data.params?.action || 'upload';
  const fileName = block.data.params?.fileName || 'file';
  
  const result = `Файл ${fileName} обработан (${action})`;
  
  const nextConnection = connections.find(c => c.source === block.id);
  
  return {
    success: true,
    nextNodeId: nextConnection?.target || null,
    output: result,
  };
}

// Вспомогательные функции

function replaceVariables(text: string, variables: Record<string, any>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] !== undefined ? String(variables[varName]) : match;
  });
}

function getVariableValue(varRef: string, context: ExecutionContext): any {
  // Если это ссылка на переменную
  if (context.variables[varRef] !== undefined) {
    return context.variables[varRef];
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
