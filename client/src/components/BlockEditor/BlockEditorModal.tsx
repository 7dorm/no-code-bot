import React, { useState, useEffect } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { BlockNode } from '../../types';
import './BlockEditorModal.css';

interface BlockEditorModalProps {
  nodeId: string;
  onClose: () => void;
}

const BlockEditorModal: React.FC<BlockEditorModalProps> = ({ nodeId, onClose }) => {
  const { currentProject, updateBlock } = useEditorStore();
  
  const node = currentProject?.blocks.find(b => b.id === nodeId);
  
  const [label, setLabel] = useState(node?.data.label || '');
  const [params, setParams] = useState<Record<string, any>>(node?.data.params || {});

  useEffect(() => {
    if (node) {
      setLabel(node.data.label || '');
      setParams(node.data.params || {});
    }
  }, [node]);

  const handleSave = () => {
    if (node) {
      updateBlock(nodeId, {
        data: {
          ...node.data,
          label,
          params,
        },
      });
    }
    onClose();
  };

  const handleAddParam = () => {
    const key = prompt('Введите имя параметра:');
    if (key && !params[key]) {
      setParams({ ...params, [key]: '' });
    }
  };

  const handleParamChange = (key: string, value: string) => {
    setParams({ ...params, [key]: value });
  };

  const handleRemoveParam = (key: string) => {
    const { [key]: removed, ...rest } = params;
    setParams(rest);
  };

  if (!node) return null;

  return (
    <div className="block-editor-overlay" onClick={onClose}>
      <div className="block-editor-modal" onClick={e => e.stopPropagation()}>
        <div className="editor-header">
          <h3>✏️ Редактирование блока</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="editor-content">
          <div className="editor-group">
            <label className="editor-label">Тип блока</label>
            <div className="block-type-display">{node.data.type.toUpperCase()}</div>
          </div>

          <div className="editor-group">
            <label className="editor-label">Название</label>
            <input
              type="text"
              className="editor-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Введите название блока"
            />
          </div>

          <div className="editor-group">
            <div className="editor-group-header">
              <label className="editor-label">Параметры</label>
              <button className="add-param-btn" onClick={handleAddParam}>
                + Добавить
              </button>
            </div>

            {Object.keys(params).length === 0 && (
              <div className="empty-params">
                Нет параметров
              </div>
            )}

            {Object.entries(params).map(([key, value]) => (
              <div key={key} className="param-row">
                <input
                  type="text"
                  className="param-name"
                  value={key}
                  readOnly
                />
                <input
                  type="text"
                  className="param-value-input"
                  value={value}
                  onChange={(e) => handleParamChange(key, e.target.value)}
                  placeholder="Значение"
                />
                <button
                  className="remove-param-btn"
                  onClick={() => handleRemoveParam(key)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="editor-footer">
            <button className="cancel-edit-btn" onClick={onClose}>
              Отмена
            </button>
            <button className="save-edit-btn" onClick={handleSave}>
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockEditorModal;
