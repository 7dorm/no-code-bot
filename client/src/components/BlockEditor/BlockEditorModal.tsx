import React, { useState, useEffect } from 'react';
import { BlockData, MessageBlockData, ConditionBlockData, ConditionCase, VariableBlockData, ApiBlockData, FileBlockData, ScriptBlockData, AiRouterBlockData, AiExtractorBlockData, AiAssistantBlockData, AiRoute, AiEntity, AiEntityType } from '../../types';
import { EditorState } from '../../store/useEditorStore';
import './BlockEditorModal.css';

interface BlockEditorModalProps {
  nodeId: string;
  onClose: () => void;
  useStore: () => EditorState;
}

const BlockEditorModal: React.FC<BlockEditorModalProps> = ({ nodeId, onClose, useStore }) => {
  const { currentProject, updateBlock, deleteBlock } = useStore();
  
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
                    placeholder="Введите варианты ответов, каждый с новой строки&#0;Например:&#0;0:00&#0;:00&#0;:00"
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
                <div key={index} className="condition-item" style={{ marginBottom: '6px', padding: 'px', border: 'px solid #ddd', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: 'px' }}>Условие {index + 1}</span>
                    <button
                      type="button"
                      className="remove-param-btn"
                      onClick={() => removeCondition(index)}
                      style={{ padding: 'px 8px', fontSize: 'px' }}
                    >
                      ✕ Удалить
                    </button>
                  </div>
                  
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: 'px', fontWeight: 600, display: 'block', marginBottom: 'px' }}>Подпись (опционально)</label>
                    <input
                      type="text"
                      className="editor-input"
                      value={condition.label || ''}
                      onChange={(e) => updateCondition(index, 'label', e.target.value)}
                      placeholder="Например: Возраст больше 8"
                      style={{ fontSize: 'px' }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ fontSize: 'px', fontWeight: 600, display: 'block', marginBottom: 'px' }}>Выражение</label>
                    <input
                      type="text"
                      className="editor-input"
                      value={condition.condition}
                      onChange={(e) => updateCondition(index, 'condition', e.target.value)}
                      placeholder="Например: age > 8 или userInput === 'yes'"
                      style={{ fontSize: 'px' }}
                    />
                    <small className="editor-hint" style={{ display: 'block', marginTop: 'px' }}>
                      Поддерживаемые операторы: ===, !==, &gt;, &lt;, &gt;=, &lt;=, contains, &&, ||. Можно использовать переменные. 
                      Для проверки длины массива используйте: переменная.length (например: doctorsList.length &gt; 0)
                    </small>
                    {condition.condition && (
                      <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {getConditionVariables(condition.condition).map(v => (
                          <span key={v} style={{ background: '#e8fe9', color: '#be0', padding: 'px 8px', borderRadius: '0px', fontSize: 'px' }}>
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
            <div className="editor-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={variableData.isFinal || false}
                  onChange={(e) => updateBlockData<VariableBlockData>({ isFinal: e.target.checked })}
                />
                <span>Final (нельзя изменять после первого заполнения)</span>
              </label>
              <small className="editor-hint">Если включено, переменная станет доступна только для чтения после первого присвоения значения</small>
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
                placeholder="https:"
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
                placeholder="return variables.userName || 'Гость';"
                rows={8}
                style={{ fontFamily: 'monospace' }}
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

      case 'aiRouter': {
        const routerData = blockData as AiRouterBlockData;
        const routes = routerData.routes || [];

        const addRoute = () => {
          const nextIndex = routes.length + 1;
          updateBlockData<AiRouterBlockData>({
            routes: [
              ...routes,
              {
                id: `route_${nextIndex}`,
                title: `Ветка ${nextIndex}`,
                description: '',
                examples: [],
              },
            ],
          });
        };

        const removeRoute = (index: number) => {
          updateBlockData<AiRouterBlockData>({
            routes: routes.filter((_, i) => i !== index),
          });
        };

        const updateRoute = (index: number, updates: Partial<AiRoute>) => {
          const updatedRoutes = [...routes];
          updatedRoutes[index] = { ...updatedRoutes[index], ...updates };
          updateBlockData<AiRouterBlockData>({ routes: updatedRoutes });
        };

        return (
          <>
            <div className="editor-info">
              <p>AI Router классифицирует сообщение пользователя и выбирает одну из веток. Пользовательский текст передается как данные, а не как инструкция.</p>
            </div>
            <div className="editor-group">
              <label className="editor-label">Переменная с текстом пользователя</label>
              <input
                type="text"
                className="editor-input"
                value={routerData.inputVariable || ''}
                onChange={(e) => updateBlockData<AiRouterBlockData>({ inputVariable: e.target.value.trim() || undefined })}
                placeholder="lastMessage"
              />
              <small className="editor-hint">Если пусто, блок возьмет lastMessage или запросит ввод.</small>
            </div>
            <div className="editor-group">
              <label className="editor-label">Инструкция для классификации</label>
              <textarea
                className="editor-textarea"
                value={routerData.instruction || ''}
                onChange={(e) => updateBlockData<AiRouterBlockData>({ instruction: e.target.value })}
                placeholder="Определи намерение пользователя и выбери самый подходящий route."
                rows={4}
              />
            </div>
            <div className="editor-group">
              <label className="editor-label">Контекст диалога</label>
              <select
                className="editor-select"
                value={routerData.contextMode || 'last_message'}
                onChange={(e) => updateBlockData<AiRouterBlockData>({ contextMode: e.target.value as AiRouterBlockData['contextMode'] })}
              >
                <option value="none">Не передавать</option>
                <option value="last_message">Последнее сообщение</option>
                <option value="last_n_messages">Последние сообщения</option>
              </select>
            </div>
            <div className="editor-group">
              <label className="editor-label">Порог уверенности</label>
              <input
                type="number"
                className="editor-input"
                min={0}
                max={1}
                step={0.05}
                value={routerData.confidenceThreshold ?? 0.6}
                onChange={(e) => updateBlockData<AiRouterBlockData>({ confidenceThreshold: Number(e.target.value) })}
              />
            </div>
            <div className="editor-group">
              <label className="editor-label">Переменные результата</label>
              <input
                type="text"
                className="editor-input"
                value={routerData.saveNormalizedIntentTo || ''}
                onChange={(e) => updateBlockData<AiRouterBlockData>({ saveNormalizedIntentTo: e.target.value.trim() || undefined })}
                placeholder="intent"
                style={{ marginBottom: '8px' }}
              />
              <input
                type="text"
                className="editor-input"
                value={routerData.confidenceVariable || ''}
                onChange={(e) => updateBlockData<AiRouterBlockData>({ confidenceVariable: e.target.value.trim() || undefined })}
                placeholder="intent_confidence"
                style={{ marginBottom: '8px' }}
              />
              <input
                type="text"
                className="editor-input"
                value={routerData.reasonVariable || ''}
                onChange={(e) => updateBlockData<AiRouterBlockData>({ reasonVariable: e.target.value.trim() || undefined })}
                placeholder="intent_reason"
              />
              <small className="editor-hint">Сюда можно сохранить route, confidence и короткое объяснение выбора.</small>
            </div>
            <div className="editor-group">
              <div className="editor-group-header">
                <label className="editor-label">Ветки</label>
                <button type="button" className="add-param-btn" onClick={addRoute}>
                  + Добавить ветку
                </button>
              </div>
              {routes.length === 0 && (
                <div className="empty-params">Добавьте хотя бы одну ветку.</div>
              )}
              {routes.map((route, index) => (
                <div key={index} className="ai-item">
                  <div className="ai-item-header">
                    <span>Ветка {index + 1}</span>
                    <button type="button" className="remove-param-btn" onClick={() => removeRoute(index)}>
                      Удалить
                    </button>
                  </div>
                  <input
                    type="text"
                    className="editor-input"
                    value={route.id}
                    onChange={(e) => updateRoute(index, { id: e.target.value.trim() })}
                    placeholder="route_id"
                    style={{ marginBottom: '8px' }}
                  />
                  <input
                    type="text"
                    className="editor-input"
                    value={route.title}
                    onChange={(e) => updateRoute(index, { title: e.target.value })}
                    placeholder="Название ветки"
                    style={{ marginBottom: '8px' }}
                  />
                  <textarea
                    className="editor-textarea"
                    value={route.description || ''}
                    onChange={(e) => updateRoute(index, { description: e.target.value })}
                    placeholder="Когда выбирать эту ветку"
                    rows={3}
                    style={{ marginBottom: '8px' }}
                  />
                  <textarea
                    className="editor-textarea"
                    value={(route.examples || []).join('\n')}
                    onChange={(e) => updateRoute(index, {
                      examples: e.target.value.split('\n').map(line => line.trim()).filter(Boolean),
                    })}
                    placeholder="Примеры фраз, каждая с новой строки"
                    rows={3}
                  />
                </div>
              ))}
            </div>
          </>
        );
      }

      case 'aiExtractor': {
        const extractorData = blockData as AiExtractorBlockData;
        const entities = extractorData.entities || [];
        const entityTypes: AiEntityType[] = ['string', 'number', 'phone', 'email', 'date', 'time', 'enum', 'boolean'];

        const addEntity = () => {
          const nextIndex = entities.length + 1;
          updateBlockData<AiExtractorBlockData>({
            entities: [
              ...entities,
              {
                name: `entity_${nextIndex}`,
                variableName: `entity_${nextIndex}`,
                type: 'string',
                description: '',
                required: false,
                askPrompt: '',
              },
            ],
          });
        };

        const removeEntity = (index: number) => {
          updateBlockData<AiExtractorBlockData>({
            entities: entities.filter((_, i) => i !== index),
          });
        };

        const updateEntity = (index: number, updates: Partial<AiEntity>) => {
          const updatedEntities = [...entities];
          updatedEntities[index] = { ...updatedEntities[index], ...updates };
          updateBlockData<AiExtractorBlockData>({ entities: updatedEntities });
        };

        return (
          <>
            <div className="editor-info">
              <p>AI Extractor достает сущности из свободного текста и сохраняет их в переменные. Недостающие обязательные поля можно запросить у пользователя.</p>
            </div>
            <div className="editor-group">
              <label className="editor-label">Переменная с текстом пользователя</label>
              <input
                type="text"
                className="editor-input"
                value={extractorData.inputVariable || ''}
                onChange={(e) => updateBlockData<AiExtractorBlockData>({ inputVariable: e.target.value.trim() || undefined })}
                placeholder="lastMessage"
              />
            </div>
            <div className="editor-group">
              <label className="editor-label">Инструкция для извлечения</label>
              <textarea
                className="editor-textarea"
                value={extractorData.instruction || ''}
                onChange={(e) => updateBlockData<AiExtractorBlockData>({ instruction: e.target.value })}
                placeholder="Извлеки только явно упомянутые данные. Не придумывай значения."
                rows={4}
              />
            </div>
            <div className="editor-group">
              <label className="editor-label">Контекст диалога</label>
              <select
                className="editor-select"
                value={extractorData.contextMode || 'last_message'}
                onChange={(e) => updateBlockData<AiExtractorBlockData>({ contextMode: e.target.value as AiExtractorBlockData['contextMode'] })}
              >
                <option value="none">Не передавать</option>
                <option value="last_message">Последнее сообщение</option>
                <option value="last_n_messages">Последние сообщения</option>
              </select>
            </div>
            <div className="editor-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={extractorData.askMissing ?? true}
                  onChange={(e) => updateBlockData<AiExtractorBlockData>({ askMissing: e.target.checked })}
                />
                <span>Запрашивать недостающие обязательные сущности</span>
              </label>
            </div>
            <div className="editor-group">
              <label className="editor-label">Сохранить сырой JSON-результат (опционально)</label>
              <input
                type="text"
                className="editor-input"
                value={extractorData.rawResultVariable || ''}
                onChange={(e) => updateBlockData<AiExtractorBlockData>({ rawResultVariable: e.target.value.trim() || undefined })}
                placeholder="ai_extract_raw"
              />
            </div>
            <div className="editor-group">
              <div className="editor-group-header">
                <label className="editor-label">Сущности</label>
                <button type="button" className="add-param-btn" onClick={addEntity}>
                  + Добавить сущность
                </button>
              </div>
              {entities.length === 0 && (
                <div className="empty-params">Добавьте сущности, которые нужно искать в тексте.</div>
              )}
              {entities.map((entity, index) => (
                <div key={index} className="ai-item">
                  <div className="ai-item-header">
                    <span>Сущность {index + 1}</span>
                    <button type="button" className="remove-param-btn" onClick={() => removeEntity(index)}>
                      Удалить
                    </button>
                  </div>
                  <input
                    type="text"
                    className="editor-input"
                    value={entity.name}
                    onChange={(e) => updateEntity(index, { name: e.target.value.trim() })}
                    placeholder="phone"
                    style={{ marginBottom: '8px' }}
                  />
                  <input
                    type="text"
                    className="editor-input"
                    value={entity.variableName}
                    onChange={(e) => updateEntity(index, { variableName: e.target.value.trim() })}
                    placeholder="phone"
                    style={{ marginBottom: '8px' }}
                  />
                  <select
                    className="editor-select"
                    value={entity.type}
                    onChange={(e) => updateEntity(index, { type: e.target.value as AiEntityType })}
                    style={{ marginBottom: '8px' }}
                  >
                    {entityTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <textarea
                    className="editor-textarea"
                    value={entity.description || ''}
                    onChange={(e) => updateEntity(index, { description: e.target.value })}
                    placeholder="Что искать в сообщении"
                    rows={3}
                    style={{ marginBottom: '8px' }}
                  />
                  {entity.type === 'enum' && (
                    <textarea
                      className="editor-textarea"
                      value={(entity.enumValues || []).join('\n')}
                      onChange={(e) => updateEntity(index, {
                        enumValues: e.target.value.split('\n').map(line => line.trim()).filter(Boolean),
                      })}
                      placeholder="Допустимые значения, каждое с новой строки"
                      rows={3}
                      style={{ marginBottom: '8px' }}
                    />
                  )}
                  <input
                    type="text"
                    className="editor-input"
                    value={entity.validationRegex || ''}
                    onChange={(e) => updateEntity(index, { validationRegex: e.target.value || undefined })}
                    placeholder="Regex валидации (опционально)"
                    style={{ marginBottom: '8px' }}
                  />
                  <input
                    type="text"
                    className="editor-input"
                    value={entity.askPrompt || ''}
                    onChange={(e) => updateEntity(index, { askPrompt: e.target.value })}
                    placeholder="Вопрос, если значение не найдено"
                    style={{ marginBottom: '8px' }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={!!entity.required}
                      onChange={(e) => updateEntity(index, { required: e.target.checked })}
                    />
                    <span>Обязательная сущность</span>
                  </label>
                </div>
              ))}
            </div>
          </>
        );
      }

      case 'aiAssistant': {
        const assistantData = blockData as AiAssistantBlockData;
        const updateJsonField = <T,>(raw: string, onParsed: (value: T) => void) => {
          try {
            onParsed(JSON.parse(raw) as T);
          } catch (error) {
            
          }
        };

        return (
          <>
            <div className="editor-info">
              <p>AI Assistant отвечает на обычные вопросы, а при совпадении со специальной темой извлекает сущности, сохраняет переменные и может вернуть кнопки.</p>
            </div>
            <div className="editor-group">
              <label className="editor-label">Переменная с текстом пользователя</label>
              <input
                type="text"
                className="editor-input"
                value={assistantData.inputVariable || ''}
                onChange={(e) => updateBlockData<AiAssistantBlockData>({ inputVariable: e.target.value.trim() || undefined })}
                placeholder="lastMessage"
              />
            </div>
            <div className="editor-group">
              <label className="editor-label">Инструкция</label>
              <textarea
                className="editor-textarea"
                value={assistantData.instruction || ''}
                onChange={(e) => updateBlockData<AiAssistantBlockData>({ instruction: e.target.value })}
                placeholder="Отвечай на обычные вопросы. Если есть спецтема, извлекай данные и предлагай кнопки только когда они полезны."
                rows={4}
              />
            </div>
            <div className="editor-group">
              <label className="editor-label">Контекст диалога</label>
              <select
                className="editor-select"
                value={assistantData.contextMode || 'last_n_messages'}
                onChange={(e) => updateBlockData<AiAssistantBlockData>({ contextMode: e.target.value as AiAssistantBlockData['contextMode'] })}
              >
                <option value="none">Не передавать</option>
                <option value="last_message">Последнее сообщение</option>
                <option value="last_n_messages">Последние сообщения</option>
              </select>
            </div>
            <div className="editor-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={assistantData.loop ?? true}
                  onChange={(e) => updateBlockData<AiAssistantBlockData>({ loop: e.target.checked })}
                />
                <span>Продолжать диалог в этом блоке</span>
              </label>
            </div>
            <div className="editor-group">
              <label className="editor-label">Порог спецтемы</label>
              <input
                type="number"
                className="editor-input"
                min={0}
                max={1}
                step={0.05}
                value={assistantData.confidenceThreshold ?? 0.6}
                onChange={(e) => updateBlockData<AiAssistantBlockData>({ confidenceThreshold: Number(e.target.value) })}
              />
            </div>
            <div className="editor-group">
              <label className="editor-label">Переменные результата</label>
              <input
                type="text"
                className="editor-input"
                value={assistantData.replyVariable || ''}
                onChange={(e) => updateBlockData<AiAssistantBlockData>({ replyVariable: e.target.value.trim() || undefined })}
                placeholder="ai_reply"
                style={{ marginBottom: '8px' }}
              />
              <input
                type="text"
                className="editor-input"
                value={assistantData.buttonsVariable || ''}
                onChange={(e) => updateBlockData<AiAssistantBlockData>({ buttonsVariable: e.target.value.trim() || undefined })}
                placeholder="ai_buttons"
                style={{ marginBottom: '8px' }}
              />
              <input
                type="text"
                className="editor-input"
                value={assistantData.saveNormalizedIntentTo || ''}
                onChange={(e) => updateBlockData<AiAssistantBlockData>({ saveNormalizedIntentTo: e.target.value.trim() || undefined })}
                placeholder="intent"
                style={{ marginBottom: '8px' }}
              />
              <input
                type="text"
                className="editor-input"
                value={assistantData.specialTopicVariable || ''}
                onChange={(e) => updateBlockData<AiAssistantBlockData>({ specialTopicVariable: e.target.value.trim() || undefined })}
                placeholder="is_special_topic"
              />
            </div>
            <div className="editor-group">
              <label className="editor-label">Специальные темы routes (JSON)</label>
              <textarea
                className="editor-textarea"
                value={JSON.stringify(assistantData.routes || [], null, 2)}
                onChange={(e) => updateJsonField<AiRoute[]>(e.target.value, value => updateBlockData<AiAssistantBlockData>({ routes: value }))}
                rows={7}
              />
            </div>
            <div className="editor-group">
              <label className="editor-label">Сущности entities (JSON)</label>
              <textarea
                className="editor-textarea"
                value={JSON.stringify(assistantData.entities || [], null, 2)}
                onChange={(e) => updateJsonField<AiEntity[]>(e.target.value, value => updateBlockData<AiAssistantBlockData>({ entities: value }))}
                rows={9}
              />
            </div>
            <div className="editor-group">
              <label className="editor-label">Фразы завершения</label>
              <textarea
                className="editor-textarea"
                value={(assistantData.exitPhrases || []).join('\n')}
                onChange={(e) => updateBlockData<AiAssistantBlockData>({
                  exitPhrases: e.target.value.split('\n').map(line => line.trim()).filter(Boolean),
                })}
                placeholder={'/stop\nстоп\nпока'}
                rows={3}
              />
            </div>
          </>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="block-editor-overlay" onClick={onClose}>
      <div className="block-editor-modal" onClick={e => e.stopPropagation()} onKeyDown={handleModalKeyDown}>
        <div className="editor-header">
          <h3>Редактирование блока</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            {node.data.type !== 'start' && (
              <button 
                className="delete-btn" 
                onClick={handleDelete}
                style={{
                  background: '#f6',
                  color: 'white',
                  border: 'none',
                  padding: '6px px',
                  borderRadius: 'px',
                  cursor: 'pointer',
                  fontSize: 'px'
                }}
                title="Удалить блок"
              >
                 Удалить
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
