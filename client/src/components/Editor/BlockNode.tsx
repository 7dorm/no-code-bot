import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { BlockData, MessageBlockData, ConditionBlockData, VariableBlockData, ApiBlockData, FileBlockData, ScriptBlockData, AiRouterBlockData, AiExtractorBlockData, AiAssistantBlockData, getBlockIcon, getBlockColor } from '../../types';
import { EditorState } from '../../store/useEditorStore';
import { validateProjectVariables } from '../../utils/graphValidation';
import './BlockNode.css';


const getBlockPreview = (data: BlockData): string => {
  switch (data.type) {
    case 'message': {
      const msgData = data as MessageBlockData;
      let preview = msgData.text ? msgData.text.substring(0, 60) : 'Текст сообщения...';
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
        return `Условий: ${conditions.length}${condData.hasDefault ? ' + else' : ''}`;
      }
      return 'Условие...';
    }
    case 'variable': {
      const varData = data as VariableBlockData;
      if (varData.variableName) {
        return `${varData.variableName} = ${varData.value ? varData.value.substring(0, 40) : 'undefined'}`;
      }
      return 'Переменная...';
    }
    case 'api': {
      const apiData = data as ApiBlockData;
      return apiData.url ? `${apiData.method || 'GET'} ${apiData.url.substring(0, 48)}` : 'API запрос...';
    }
    case 'file': {
      const fileData = data as FileBlockData;
      const actionLabel = {
        'upload': 'Загрузить',
        'download': 'Скачать',
        'delete': 'Удалить',
        'read': 'Прочитать',
      }[fileData.action || 'upload'];
      return fileData.fileName ? `${actionLabel}: ${fileData.fileName.substring(0, 40)}` : `${actionLabel} файл...`;
    }
    case 'script': {
      const scriptData = data as ScriptBlockData;
      const codePreview = scriptData.code ? scriptData.code.substring(0, 44).replace(/\n/g, ' ') : 'JavaScript код...';
      return scriptData.returnVariable ? `⚡ ${codePreview} → ${scriptData.returnVariable}` : `⚡ ${codePreview}`;
    }
    case 'aiRouter': {
      const aiData = data as AiRouterBlockData;
      return `${aiData.routes?.length || 0} веток${aiData.fallbackRoute ? `, fallback: ${aiData.fallbackRoute}` : ''}`;
    }
    case 'aiExtractor': {
      const aiData = data as AiExtractorBlockData;
      const requiredCount = (aiData.entities || []).filter(entity => entity.required).length;
      return `${aiData.entities?.length || 0} сущностей${requiredCount ? `, ${requiredCount} обязательных` : ''}`;
    }
    case 'aiAssistant': {
      const aiData = data as AiAssistantBlockData;
      const requiredCount = (aiData.entities || []).filter(entity => entity.required).length;
      return `${aiData.routes?.length || 0} тем, ${aiData.entities?.length || 0} сущностей${requiredCount ? `, ${requiredCount} обязательных` : ''}${aiData.loop ? ', loop' : ''}`;
    }
    case 'start':
    default:
      return '';
  }
};


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

interface BlockNodeProps extends NodeProps<BlockData> {
  useStore: {
    (): EditorState;
    <T>(selector: (state: EditorState) => T): T;
  };
}

const BlockNode: React.FC<BlockNodeProps> = ({ id, data, selected, useStore }) => {
  const currentProject = useStore((state) => state.currentProject);
  const backgroundColor = getBlockColor(data.type as any);
  const icon = getBlockIcon(data.type as any);
  const preview = getBlockPreview(data);

  const blockValidations = currentProject ? validateProjectVariables(currentProject).filter(e => e.blockId === id) : [];
  const hasError = blockValidations.some(v => v.severity === 'error');
  const hasWarning = blockValidations.some(v => v.severity === 'warning') && !hasError;
  const borderColor = hasError ? '#f44336' : (hasWarning ? '#ff9800' : (selected ? backgroundColor : undefined));
  const boxShadow = hasError ? '0 0 0 2px #f44336' : (hasWarning ? '0 0 0 2px #ff9800' : undefined);
  const headerBg = hasError ? '#f44336' : (hasWarning ? '#ff9800' : backgroundColor);
  
  const conditionData = data.type === 'condition' ? data as ConditionBlockData : null;
  const conditionCount = conditionData ? (conditionData.conditions?.length || 0) : 0;
  const hasDefault = conditionData ? true : false;
  const aiRouterData = data.type === 'aiRouter' ? data as AiRouterBlockData : null;

  return (
    <div
      className={`block-node ${selected ? 'selected' : ''} ${hasError ? 'has-error' : ''} ${hasWarning ? 'has-warning' : ''}`}
      style={{ 
        borderColor,
        boxShadow
      }}
      title={blockValidations.map(e => e.message).join('\n')}
    >
      {data.type !== 'start' && (
        <Handle type="target" position={Position.Top} />
      )}
      
      <div className="block-header" style={{ background: headerBg }}>
        <span className="block-icon">{hasError || hasWarning ? '⚠️' : icon}</span>
        <span className="block-type">{data.type.toUpperCase()}</span>
      </div>
      
      <div className="block-content">
        {data.label && <div className="block-label">{data.label}</div>}
        {preview && (
          <div className="block-preview">
            {preview}
          </div>
        )}
        {(hasError || hasWarning) && blockValidations.length > 0 && (
          <div className="block-error-message" style={{ color: hasError ? '#f44336' : '#856404', backgroundColor: hasError ? '#fdeced' : '#fff3cd', padding: '4px', borderRadius: '4px', marginTop: '4px', fontSize: '11px' }}>
            {blockValidations[0].message}
          </div>
        )}
      </div>

      {data.type !== 'condition' && data.type !== 'aiRouter' && data.type !== 'aiExtractor' && data.type !== 'aiAssistant' && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="output"
        />
      )}
      
      {data.type === 'condition' && (
        <>
          {}
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
          {}
          {hasDefault && (
            <Handle
              type="source"
              position={Position.Bottom}
              id="output-default"
              style={{ 
                left: `${100 - (100 / (conditionCount + 1))}%`,
              }}
            />
          )}
        </>
      )}

      {data.type === 'aiRouter' && aiRouterData && (
        <>
          {(aiRouterData.routes || []).map((route, index) => (
            <Handle
              key={`route-${index}`}
              type="source"
              position={Position.Bottom}
              id={`route-${index}`}
              title={route.title || route.id}
              style={{
                left: `${(index + 1) * (100 / ((aiRouterData.routes?.length || 0) + 2))}%`,
              }}
            />
          ))}
          <Handle
            type="source"
            position={Position.Bottom}
            id="fallback"
            title="Fallback"
            style={{ left: `${100 - (100 / ((aiRouterData.routes?.length || 0) + 2))}%` }}
          />
        </>
      )}

      {data.type === 'aiExtractor' && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="complete"
            title="Все обязательные сущности найдены"
            style={{ left: '33%' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="missing"
            title="Есть недостающие сущности"
            style={{ left: '67%' }}
          />
        </>
      )}

      {data.type === 'aiAssistant' && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="task-complete"
            title="Спецтема, все обязательные данные найдены"
            style={{ left: '25%' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="task-missing"
            title="Спецтема, нужно уточнить данные"
            style={{ left: '50%' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="chat"
            title="Обычный AI-ответ"
            style={{ left: '75%' }}
          />
        </>
      )}
    </div>
  );
};

export default BlockNode;
