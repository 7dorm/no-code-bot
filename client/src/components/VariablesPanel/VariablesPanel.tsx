import React from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { extractVariables, VariableInfo } from '../../utils/extractVariables';
import './VariablesPanel.css';

const VariablesPanel: React.FC = () => {
  const { currentProject } = useEditorStore();
  
  const variables = currentProject ? extractVariables(currentProject) : [];

  const getVariableIcon = (type: VariableInfo['type']): string => {
    switch (type) {
      case 'saved':
        return '💾';
      case 'defined':
        return '📝';
      case 'used':
        return '';
      default:
        return '📌';
    }
  };

  const getVariableTypeLabel = (type: VariableInfo['type']): string => {
    switch (type) {
      case 'saved':
        return 'Сохраняется';
      case 'defined':
        return 'Определена';
      case 'used':
        return 'Используется';
      default:
        return 'Переменная';
    }
  };

  if (variables.length === 0) {
    return (
      <div className="variables-panel">
        <div className="variables-panel-header">
          <h2>📊 Переменные</h2>
        </div>
        <div className="variables-panel-content">
          <div className="variables-empty">
            В проекте нет переменных
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="variables-panel">
      <div className="variables-panel-header">
        <h2>📊 Переменные</h2>
        <span className="variables-count">{variables.length}</span>
      </div>
      <div className="variables-panel-content">
        <div className="variables-list">
          {variables.map((variable, index) => (
            <div key={`${variable.name}-${index}`} className="variable-item">
              <div className="variable-header">
                <span className="variable-icon">{getVariableIcon(variable.type)}</span>
                <span className="variable-name">{variable.name}</span>
                <span className="variable-type-badge">{getVariableTypeLabel(variable.type)}</span>
              </div>
              {variable.description && (
                <div className="variable-description">{variable.description}</div>
              )}
              {variable.blockType && (
                <div className="variable-source">
                  <span className="variable-source-label">Тип блока:</span>
                  <span className="variable-source-value">{variable.blockType}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VariablesPanel;

