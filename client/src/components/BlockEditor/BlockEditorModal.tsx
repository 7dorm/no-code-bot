import React, { useState, useEffect } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { BlockNode, BlockData, StartBlockData, MessageBlockData, ConditionBlockData, ConditionCase, VariableBlockData, ApiBlockData, FileBlockData, EndBlockData } from '../../types';
import './BlockEditorModal.css';

interface BlockEditorModalProps {
  nodeId: string;
  onClose: () => void;
}

const BlockEditorModal: React.FC<BlockEditorModalProps> = ({ nodeId, onClose }) => {
  const { currentProject, updateBlock } = useEditorStore();
  
  const node = currentProject?.blocks.find(b => b.id === nodeId);
  
  const [label, setLabel] = useState(node?.data.label || '');
  const [blockData, setBlockData] = useState<BlockData>(node?.data || { type: 'start' });

  useEffect(() => {
    if (node) {
      setLabel(node.data.label || '');
      setBlockData(node.data);
    }
  }, [node]);

  const handleSave = () => {
    if (node) {
      updateBlock(nodeId, {
        data: {
          ...blockData,
          label,
        } as BlockData,
      });
    }
    onClose();
  };

  const updateBlockData = <T extends BlockData>(updates: Partial<T>) => {
    setBlockData(prev => ({ ...prev, ...updates } as BlockData));
  };

  const handleModalKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) {
      return;
    }

    const target = event.target as HTMLElement | null;
    const tagName = target?.tagName.toLowerCase();
    if (tagName === 'textarea') {
      return;
    }

    event.preventDefault();
    handleSave();
  };

  if (!node) return null;

  const renderBlockSpecificFields = () => {
    switch (blockData.type) {
      case 'start':
        return (
          <div className="editor-info">
            <p>Стартовый блок - точка входа в диалог бота. Не требует дополнительных параметров.</p>
          </div>
        );

      case 'message':
        const messageData = blockData as MessageBlockData;
        return (
          <>
            <div className="editor-group">
              <label className="editor-label">Текст сообщения</label>
              <textarea
                className="editor-textarea"
                value={messageData.text || ''}
                onChange={(e) => updateBlockData<MessageBlockData>({ text: e.target.value })}
                placeholder="Введите текст сообщения для отправки пользователю. Можно использовать {{переменные}}"
                rows={4}
              />
              <small className="editor-hint">Используйте {'{{'}имя_переменной{'}}'} для подстановки переменных</small>
            </div>
            <div className="editor-group">
              <label className="editor-label">Сохранить ответ пользователя в переменную (опционально)</label>
              <input
                type="text"
                className="editor-input"
                value={messageData.saveResponseToVariable || ''}
                onChange={(e) => updateBlockData<MessageBlockData>({ saveResponseToVariable: e.target.value || undefined })}
                placeholder="Например: userResponse, answer, reply"
              />
              <small className="editor-hint">Если указано, ответ пользователя на это сообщение будет сохранен в указанную переменную</small>
            </div>
          </>
        );

      case 'condition':
        const conditionData = blockData as ConditionBlockData;
        const conditions = conditionData.conditions || [];
        
        const addCondition = () => {
          const newCondition: ConditionCase = { condition: '', label: '' };
          updateBlockData<ConditionBlockData>({
            conditions: [...conditions, newCondition],
          });
        };
        
        const removeCondition = (index: number) => {
          const newConditions = conditions.filter((_, i) => i !== index);
          updateBlockData<ConditionBlockData>({ conditions: newConditions });
        };
        
        const updateCondition = (index: number, field: keyof ConditionCase, value: string) => {
          const newConditions = [...conditions];
          newConditions[index] = { ...newConditions[index], [field]: value };
          updateBlockData<ConditionBlockData>({ conditions: newConditions });
        };
        
        return (
          <>
            <div className="editor-group">
              <div className="editor-group-header">
                <label className="editor-label">Условия</label>
                <button
                  type="button"
                  className="add-param-btn"
                  onClick={addCondition}
                >
                  + Добавить условие
                </button>
              </div>
              
              {conditions.length === 0 && (
                <div className="empty-params">
                  Нет условий. Добавьте хотя бы одно условие.
                </div>
              )}
              
              {conditions.map((condition, index) => (
                <div key={index} className="condition-item" style={{ marginBottom: '16px', padding: '12px', border: '1px solid #ddd', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>Условие {index + 1}</span>
                    <button
                      type="button"
                      className="remove-param-btn"
                      onClick={() => removeCondition(index)}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      ✕ Удалить
                    </button>
                  </div>
                  
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Подпись (опционально)</label>
                    <input
                      type="text"
                      className="editor-input"
                      value={condition.label || ''}
                      onChange={(e) => updateCondition(index, 'label', e.target.value)}
                      placeholder="Например: Возраст больше 18"
                      style={{ fontSize: '13px' }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Выражение</label>
                    <input
                      type="text"
                      className="editor-input"
                      value={condition.condition}
                      onChange={(e) => updateCondition(index, 'condition', e.target.value)}
                      placeholder="Например: age > 18 или userInput === 'yes'"
                      style={{ fontSize: '13px' }}
                    />
                    <small className="editor-hint" style={{ display: 'block', marginTop: '4px' }}>
                      Поддерживаемые операторы: ===, !==, &gt;, &lt;, &gt;=, &lt;=, contains, &&, ||. Можно использовать переменные.
                    </small>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="editor-group">
              <label className="editor-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={conditionData.hasDefault || false}
                  onChange={(e) => updateBlockData<ConditionBlockData>({ hasDefault: e.target.checked })}
                />
                <span>Дефолтная ветка (else)</span>
              </label>
              <small className="editor-hint">
                Если ни одно условие не выполнится, переход произойдет по дефолтной ветке
              </small>
            </div>
          </>
        );

      case 'variable':
        const variableData = blockData as VariableBlockData;
        return (
          <>
            <div className="editor-group">
              <label className="editor-label">Имя переменной</label>
              <input
                type="text"
                className="editor-input"
                value={variableData.variableName || ''}
                onChange={(e) => updateBlockData<VariableBlockData>({ variableName: e.target.value })}
                placeholder="Например: userName, count, status"
              />
              <small className="editor-hint">Имя переменной без пробелов и специальных символов</small>
            </div>
            <div className="editor-group">
              <label className="editor-label">Значение</label>
              <input
                type="text"
                className="editor-input"
                value={variableData.value || ''}
                onChange={(e) => updateBlockData<VariableBlockData>({ value: e.target.value })}
                placeholder="Значение переменной. Можно использовать {{другие_переменные}}"
              />
              <small className="editor-hint">Используйте {'{{'}переменная{'}}'} для подстановки других переменных</small>
            </div>
          </>
        );

      case 'api':
        const apiData = blockData as ApiBlockData;
        return (
          <>
            <div className="editor-group">
              <label className="editor-label">URL</label>
              <input
                type="text"
                className="editor-input"
                value={apiData.url || ''}
                onChange={(e) => updateBlockData<ApiBlockData>({ url: e.target.value })}
                placeholder="https://api.example.com/endpoint"
              />
            </div>
            <div className="editor-group">
              <label className="editor-label">HTTP Метод</label>
              <select
                className="editor-select"
                value={apiData.method || 'GET'}
                onChange={(e) => updateBlockData<ApiBlockData>({ method: e.target.value as ApiBlockData['method'] })}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>
            {(apiData.method === 'POST' || apiData.method === 'PUT' || apiData.method === 'PATCH') && (
              <div className="editor-group">
                <label className="editor-label">Тело запроса (Body)</label>
                <textarea
                  className="editor-textarea"
                  value={apiData.body || ''}
                  onChange={(e) => updateBlockData<ApiBlockData>({ body: e.target.value })}
                  placeholder='{"key": "value"}'
                  rows={4}
                />
              </div>
            )}
          </>
        );

      case 'file':
        const fileData = blockData as FileBlockData;
        return (
          <>
            <div className="editor-group">
              <label className="editor-label">Действие</label>
              <select
                className="editor-select"
                value={fileData.action || 'upload'}
                onChange={(e) => updateBlockData<FileBlockData>({ action: e.target.value as FileBlockData['action'] })}
              >
                <option value="upload">Загрузить (Upload)</option>
                <option value="download">Скачать (Download)</option>
                <option value="delete">Удалить (Delete)</option>
                <option value="read">Прочитать (Read)</option>
              </select>
            </div>
            <div className="editor-group">
              <label className="editor-label">Имя файла</label>
              <input
                type="text"
                className="editor-input"
                value={fileData.fileName || ''}
                onChange={(e) => updateBlockData<FileBlockData>({ fileName: e.target.value })}
                placeholder="document.pdf"
              />
            </div>
            <div className="editor-group">
              <label className="editor-label">Путь к файлу (опционально)</label>
              <input
                type="text"
                className="editor-input"
                value={fileData.filePath || ''}
                onChange={(e) => updateBlockData<FileBlockData>({ filePath: e.target.value })}
                placeholder="/path/to/file"
              />
            </div>
          </>
        );

      case 'end':
        const endData = blockData as EndBlockData;
        return (
          <div className="editor-group">
            <label className="editor-label">Финальное сообщение (опционально)</label>
            <textarea
              className="editor-textarea"
              value={endData.message || ''}
              onChange={(e) => updateBlockData<EndBlockData>({ message: e.target.value })}
              placeholder="Сообщение перед завершением диалога"
              rows={3}
            />
            <small className="editor-hint">Если оставить пустым, диалог завершится без сообщения</small>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="block-editor-overlay" onClick={onClose}>
      <div className="block-editor-modal" onClick={e => e.stopPropagation()} onKeyDown={handleModalKeyDown}>
        <div className="editor-header">
          <h3>✏️ Редактирование блока</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="editor-content">
          <div className="editor-group">
            <label className="editor-label">Тип блока</label>
            <div className="block-type-display">{blockData.type.toUpperCase()}</div>
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

          {renderBlockSpecificFields()}

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
