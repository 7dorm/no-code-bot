import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { BlockData, MessageBlockData, ConditionBlockData, VariableBlockData, ApiBlockData, FileBlockData, EndBlockData, getBlockIcon, getBlockColor } from '../../types';
import './BlockNode.css';

// Функция для получения отображаемой информации о блоке
const getBlockPreview = (data: BlockData): string => {
  switch (data.type) {
    case 'message': {
      const msgData = data as MessageBlockData;
      let preview = msgData.text ? msgData.text.substring(0, 30) : 'Текст сообщения...';
      if (msgData.saveResponseToVariable) {
        preview += ` [→${msgData.saveResponseToVariable}]`;
      }
      if (msgData.answers && msgData.answers.length > 0) {
        preview += ` [${msgData.answers.length} вариантов]`;
      } else if (msgData.answersFromVariable) {
        preview += ` [answers: ${msgData.answersFromVariable}${msgData.answersPath ? '.' + msgData.answersPath : ''}]`;
      }
      return preview;
    }
    case 'condition': {
      const condData = data as ConditionBlockData;
      const conditions = condData.conditions || [];
      if (conditions.length > 0) {
        const firstCondition = conditions[0].condition || '';
        return `Условий: ${conditions.length}${condData.hasDefault ? ' + else' : ''}`;
      }
      return 'Условие...';
    }
    case 'variable': {
      const varData = data as VariableBlockData;
      if (varData.variableName) {
        return `${varData.variableName} = ${varData.value ? varData.value.substring(0, 15) : '...'}`;
      }
      return 'Переменная...';
    }
    case 'api': {
      const apiData = data as ApiBlockData;
      return apiData.url ? `${apiData.method || 'GET'} ${apiData.url.substring(0, 25)}` : 'API запрос...';
    }
    case 'file': {
      const fileData = data as FileBlockData;
      const actionLabel = {
        'upload': 'Загрузить',
        'download': 'Скачать',
        'delete': 'Удалить',
        'read': 'Прочитать',
      }[fileData.action || 'upload'];
      return fileData.fileName ? `${actionLabel}: ${fileData.fileName.substring(0, 20)}` : `${actionLabel} файл...`;
    }
    case 'end': {
      const endData = data as EndBlockData;
      return endData.message ? `Завершить: ${endData.message.substring(0, 25)}` : 'Завершить диалог';
    }
    case 'start':
    default:
      return '';
  }
};

// Функция для проверки условия (используется в blockExecutor)
export function evaluateCondition(condition: string, context: { variables: Record<string, any>; userInput?: string }): boolean {
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

function evaluateBasicCondition(condition: string, context: { variables: Record<string, any>; userInput?: string }): boolean {
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

function getVariableValue(varRef: string, context: { variables: Record<string, any>; userInput?: string }): any {
  if (context.variables[varRef] !== undefined) {
    return context.variables[varRef];
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

const BlockNode: React.FC<NodeProps<BlockData>> = ({ data, selected }) => {
  const backgroundColor = getBlockColor(data.type as any);
  const icon = getBlockIcon(data.type as any);
  const preview = getBlockPreview(data);

  // Получаем количество выходов для condition блока
  const conditionData = data.type === 'condition' ? data as ConditionBlockData : null;
  const conditionCount = conditionData ? (conditionData.conditions?.length || 0) : 0;
  const hasDefault = conditionData ? true : false;

  return (
    <div
      className={`block-node ${selected ? 'selected' : ''}`}
      style={{ borderColor: selected ? backgroundColor : undefined }}
    >
      {data.type !== 'start' && (
        <Handle type="target" position={Position.Top} />
      )}
      
      <div className="block-header" style={{ background: backgroundColor }}>
        <span className="block-icon">{icon}</span>
        <span className="block-type">{data.type.toUpperCase()}</span>
      </div>
      
      <div className="block-content">
        {data.label && <div className="block-label">{data.label}</div>}
        {preview && (
          <div className="block-preview">
            {preview}
          </div>
        )}
      </div>

      {data.type !== 'end' && data.type !== 'condition' && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="output"
        />
      )}
      
      {data.type === 'condition' && (
        <>
          {/* Выходы для каждого условия */}
          {Array.from({ length: conditionCount }).map((_, index) => (
            <Handle
              key={`output-${index}`}
              type="source"
              position={Position.Bottom}
              id={`output-${index}`}
              style={{ 
                left: `${(index + 1) * (100 / (conditionCount + (hasDefault ? 1 : 0) + 1))}%`,
              }}
            />
          ))}
          {/* Выход для дефолтной ветки */}
          {hasDefault && (
            <Handle
              type="source"
              position={Position.Bottom}
              id="output-default"
              style={{ 
                left: `${100 - (100 / (conditionCount + 2))}%`,
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

export default BlockNode;
