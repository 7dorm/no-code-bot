import React, { useMemo } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { validateProjectVariables } from '../../utils/graphValidation';
import { useReactFlow } from 'reactflow';
import './ErrorPanel.css';

const ErrorPanel: React.FC = () => {
  const { currentProject, selectNode } = useEditorStore();
  const { setCenter, getNodes } = useReactFlow();

  const errors = useMemo(() => {
    if (!currentProject) return [];
    return validateProjectVariables(currentProject);
  }, [currentProject]);

  if (errors.length === 0) {
    return null;
  }

  const handleErrorClick = (blockId: string) => {
    selectNode(blockId);
    
    // Find node and center view
    const nodes = getNodes();
    const node = nodes.find(n => n.id === blockId);
    
    if (node) {
      // Zoom in to the node
      setCenter(node.position.x + 150, node.position.y + 100, { zoom: 1.2, duration: 800 });
    }
  };

  const criticalErrors = errors.filter(e => e.severity === 'error');
  const warnings = errors.filter(e => e.severity === 'warning');

  return (
    <div className="error-panel">
      <div className="error-panel-header">
        <h3>Проблемы ({errors.length})</h3>
      </div>
      <div className="error-panel-content">
        {criticalErrors.length > 0 && (
          <div className="error-group">
            <h4>Ошибки ({criticalErrors.length})</h4>
            <ul>
              {criticalErrors.map((error, idx) => (
                <li key={`error-${idx}`} className="error-item critical" onClick={() => handleErrorClick(error.blockId)}>
                  <span className="error-icon">🔴</span>
                  <span className="error-text">{error.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {warnings.length > 0 && (
          <div className="error-group">
            <h4>Предупреждения ({warnings.length})</h4>
            <ul>
              {warnings.map((warning, idx) => (
                <li key={`warning-${idx}`} className="error-item warning" onClick={() => handleErrorClick(warning.blockId)}>
                  <span className="error-icon">🟡</span>
                  <span className="error-text">{warning.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorPanel;
