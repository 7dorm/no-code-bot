import React, { useState, useEffect } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { BlockData, MessageBlockData, ConditionBlockData, ConditionCase, VariableBlockData, ApiBlockData, FileBlockData, ScriptBlockData } from '../../types';
import './BlockEditorModal.css';

interface BlockEditorModalProps {
  nodeId: string;
  onClose: () => void;
}

const BlockEditorModal: React.FC<BlockEditorModalProps> = ({ nodeId, onClose }) => {
  const { currentProject, updateBlock, deleteBlock } = useEditorStore();
  
  const node = currentProject?.blocks.find(b => b.id === nodeId);
  
  const [label, setLabel] = useState(node?.data.label || '');
  const [blockData, setBlockData] = useState<BlockData>(node?.data || { type: 'start' });
  const [messageCaretInVar, setMessageCaretInVar] = useState(false);

  useEffect(() => {
    if (node) {
      setLabel(node.data.label || '');
      const dataWithDefault = (node.data.type === 'condition')
        ? { ...node.data, hasDefault: true }
        : node.data;
      setBlockData(dataWithDefault);
      setMessageCaretInVar(false);
    }
  }, [node]);

  const handleSave = () => {
    if (node) {
      updateBlock(nodeId, {
        data: {
          ...blockData,
          ...(blockData.type === 'condition' ? { hasDefault: true } : {}),
          label,
        } as BlockData,
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (!node) return;
    
    // Нельзя удалить стартовый блок
    if (node.data.type === 'start') {
      alert('Нельзя удалить стартовый блок');
      return;
    }
    
    if (confirm('Вы уверены, что хотите удалить этот блок? Все соединения с ним также будут удалены.')) {
      deleteBlock(nodeId);
      onClose();
    }
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
        const renderMessagePreview = (text: string) => {
          if (!text) return null;
          const parts = text.split(/(\{\{\w+\}\})/g).filter(Boolean);
          return (
            <div className="editor-message-preview">
              {parts.map((part, idx) => {
                const match = part.match(/^\{\{(\w+)\}\}$/);
                if (match) {
                  return (
                    <React.Fragment key={idx}>
                      <span className="editor-message-brace">{'{{'}</span>
                      <strong className="editor-message-var">{match[1]}</strong>
                      <span className="editor-message-brace">{'}}'}</span>
                    </React.Fragment>
                  );
                }
                return <span key={idx}>{part}</span>;
              })}
            </div>
          );
        };
        const isCaretInsidePlaceholder = (text: string, caret: number | null): boolean => {
          if (caret == null) return false;
          const regex = /\{\{\s*\w+\s*\}\}/g;
          let match: RegExpExecArray | null;
          while ((match = regex.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (caret > start && caret <= end) {
              return true;
            }
          }
          return false;
        };
        const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
          const val = e.target.value;
          const caret = e.target.selectionStart;
          setMessageCaretInVar(isCaretInsidePlaceholder(val, caret));
          updateBlockData<MessageBlockData>({ text: val });
        };
        const handleMessageSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
          const target = e.target as HTMLTextAreaElement;
          const caret = target.selectionStart;
          setMessageCaretInVar(isCaretInsidePlaceholder(target.value, caret));
        };
        return (
          <>
            <div className="editor-group">
              <label className="editor-label">Текст сообщения</label>
              <div className="editor-textarea-wrapper">
                <div className="editor-textarea-overlay">
                  {messageCaretInVar
                    ? <pre className="editor-textarea-overlay-raw">{messageData.text || ''}</pre>
                    : renderMessagePreview(messageData.text || '')}
                </div>
                <textarea
                  className="editor-textarea editor-textarea--transparent"
                  value={messageData.text || ''}
                  onChange={handleMessageChange}
                  onSelect={handleMessageSelect}
                  onKeyUp={handleMessageSelect}
                  placeholder="Введите текст сообщения для отправки пользователю. Можно использовать {{переменные}}"
                  rows={4}
                />
              </div>
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
            <div className="editor-group">
              <label className="editor-label">Варианты ответов (опционально)</label>
              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="radio"
                    name="answers-source"
                    checked={!messageData.answersFromVariable}
                    onChange={() => updateBlockData<MessageBlockData>({ 
                      answersFromVariable: undefined,
                      answersPath: undefined
                    })}
                  />
                  <span>Указать вручную</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="radio"
                    name="answers-source"
                    checked={!!messageData.answersFromVariable}
                    onChange={() => updateBlockData<MessageBlockData>({ 
                      answers: undefined,
                      answersFromVariable: messageData.answersFromVariable || 'apiResponse'
                    })}
                  />
                  <span>Взять из переменной</span>
                </label>
              </div>
              {!messageData.answersFromVariable ? (
                <>
                  <textarea
                    className="editor-textarea"
                    value={(messageData.answers || []).join('\n')}
                    onChange={(e) => {
                      const lines = e.target.value.split('\n').filter(line => line.trim() !== '');
                      updateBlockData<MessageBlockData>({ answers: lines.length > 0 ? lines : undefined });
                    }}
                    placeholder="Введите варианты ответов, каждый с новой строки&#10;Например:&#10;10:00&#10;11:00&#10;12:00"
                    rows={4}
                  />
                  <small className="editor-hint">Введите варианты ответов, каждый с новой строки. Пользователь сможет выбрать один из них.</small>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    className="editor-input"
                    value={messageData.answersFromVariable || ''}
                    onChange={(e) => updateBlockData<MessageBlockData>({ answersFromVariable: e.target.value || undefined })}
                    placeholder="Например: apiResponse, times"
                    style={{ marginBottom: '8px' }}
                  />
                  <input
                    type="text"
                    className="editor-input"
                    value={messageData.answersPath || ''}
                    onChange={(e) => updateBlockData<MessageBlockData>({ answersPath: e.target.value || undefined })}
                    placeholder="Путь к массиву (например: data.times или data) - оставьте пустым если переменная уже массив"
                  />
                  <small className="editor-hint">Укажите имя переменной и путь к массиву (например, "data.times" для доступа к data.times в переменной). Если переменная уже массив, оставьте путь пустым.</small>
                </>
              )}
            </div>
          </>
        );

      case 'condition':
        const conditionData = blockData as ConditionBlockData;
        const conditions = conditionData.conditions || [];
        const getConditionVariables = (expr: string): string[] => {
          const vars = new Set<string>();
          const matches = expr.match(/\b[a-zA-Z_]\w*\b/g) || [];
          matches.forEach(v => vars.add(v));
          return Array.from(vars);
        };
        
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
                      Для проверки длины массива используйте: переменная.length (например: doctorsList.length &gt; 0)
                    </small>
                    {condition.condition && (
                      <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {getConditionVariables(condition.condition).map(v => (
                          <span key={v} style={{ background: '#e8f5e9', color: '#1b5e20', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>
                            {v}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={variableData.saveNextInput || false}
                  onChange={(e) => {
                    updateBlockData<VariableBlockData>({ 
                      saveNextInput: e.target.checked,
                      value: e.target.checked ? '' : variableData.value || ''
                    });
                  }}
                />
                <span>Сохранить следующий ответ пользователя в эту переменную</span>
              </label>
              <small className="editor-hint">Если включено, следующий ответ пользователя будет автоматически сохранен в эту переменную</small>
            </div>
            {!variableData.saveNextInput && (
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
            )}
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
            <div className="editor-group">
              <label className="editor-label">Переменная для ответа</label>
              <input
                type="text"
                className="editor-input"
                value={apiData.responseVariable || ''}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  updateBlockData<ApiBlockData>({ responseVariable: value || undefined });
                }}
                placeholder="Например: apiResponse"
              />
              <small className="editor-hint">Ответ API будет сохранен в эту переменную. Укажите имя переменной без пробелов.</small>
            </div>
            <div className="editor-group">
              <label className="editor-label">Извлечь массив для вариантов ответов (опционально)</label>
              <input
                type="text"
                className="editor-input"
                value={apiData.answersPath || ''}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  updateBlockData<ApiBlockData>({ answersPath: value || undefined });
                }}
                placeholder="Например: doctors, data.times или data"
                style={{ marginBottom: '8px' }}
              />
              <input
                type="text"
                className="editor-input"
                value={apiData.answersVariable || ''}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  updateBlockData<ApiBlockData>({ answersVariable: value || undefined });
                }}
                placeholder="Переменная для сохранения массива (например: doctorsList)"
              />
              <small className="editor-hint">
                Укажите путь к массиву в ответе API. Например, если API возвращает {"{"}"doctors": ["Терапевт", "Кардиолог"]{"}"}, укажите путь "doctors". 
                Массив будет сохранен в указанную переменную и может использоваться в блоке Сообщение как варианты ответов.
              </small>
            </div>
            <div className="editor-group">
              <label className="editor-label">Заголовки (JSON, опционально)</label>
              <textarea
                className="editor-textarea"
                value={apiData.headers ? JSON.stringify(apiData.headers, null, 2) : ''}
                onChange={(e) => {
                  try {
                    const headers = e.target.value.trim() ? JSON.parse(e.target.value) : undefined;
                    updateBlockData<ApiBlockData>({ headers });
                  } catch (err) {
                    // Игнорируем ошибки парсинга во время ввода
                  }
                }}
                placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
                rows={4}
              />
              <small className="editor-hint">JSON объект с заголовками HTTP запроса</small>
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

      case 'script':
        const scriptData = blockData as ScriptBlockData;
        return (
          <>
            <div className="editor-group">
              <label className="editor-label">JavaScript код</label>
              <textarea
                className="editor-textarea"
                value={scriptData.code || ''}
                onChange={(e) => updateBlockData<ScriptBlockData>({ code: e.target.value })}
                placeholder="// Доступны переменные: variables, globalConstants&#10;// Пример: variables.result = variables.a + variables.b;&#10;// Или: return variables.userInput.toUpperCase();"
                rows={10}
                style={{ fontFamily: 'monospace', fontSize: '13px' }}
              />
              <small className="editor-hint">
                Выполняется JavaScript код. Доступны объекты: <code>variables</code> (все переменные), <code>globalConstants</code> (глобальные константы).
                Используйте <code>return</code> для возврата значения или изменяйте переменные напрямую.
              </small>
            </div>
            <div className="editor-group">
              <label className="editor-label">Переменная для результата (опционально)</label>
              <input
                type="text"
                className="editor-input"
                value={scriptData.returnVariable || ''}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  updateBlockData<ScriptBlockData>({ returnVariable: value || undefined });
                }}
                placeholder="Например: result"
              />
              <small className="editor-hint">
                Если указано, результат выполнения скрипта (значение return) будет сохранен в эту переменную.
                Если не указано, результат будет проигнорирован.
              </small>
            </div>
          </>
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
          <div style={{ display: 'flex', gap: '8px' }}>
            {node.data.type !== 'start' && (
              <button 
                className="delete-btn" 
                onClick={handleDelete}
                style={{
                  background: '#f44336',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
                title="Удалить блок"
              >
                🗑️ Удалить
              </button>
            )}
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
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
