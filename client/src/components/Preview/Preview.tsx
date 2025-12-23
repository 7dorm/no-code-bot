import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { Engine } from '@backend/Engine';
import { WebUI } from '@backend/WebUI';
import { adaptProjectToEngine } from '../../utils/backend/projectAdapter';
import './Preview.css';

interface PreviewProps {
  onClose: () => void;
}

interface ChatMessage {
  role: 'bot' | 'user';
  content: string;
  answers?: string[];
}

const Preview: React.FC<PreviewProps> = ({ onClose }) => {
  const { currentProject } = useEditorStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const engineRef = useRef<Engine | null>(null);
  const webUIRef = useRef<WebUI | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [waitingForFile, setWaitingForFile] = useState(false);
  const [requestedFileName, setRequestedFileName] = useState<string>('');
  const [activeAnswersMessageIndex, setActiveAnswersMessageIndex] = useState<number | null>(null);
  const [userJustResponded, setUserJustResponded] = useState(false);
  const executionPromiseRef = useRef<Promise<void> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Инициализация Engine при открытии Preview
  useEffect(() => {
    if (!currentProject) {
      setMessages([]);
      setIsRunning(false);
      return;
    }

    // Очищаем предыдущее состояние
    setMessages([]);
    setIsRunning(true);
    setWaitingForInput(false);
    setUserJustResponded(false);

    // Преобразуем проект в формат Engine
    const engineNodes = adaptProjectToEngine(currentProject);
    
    if (engineNodes.length === 0) {
      setMessages([{ role: 'bot', content: '⚠️ Проект не содержит блоков.' }]);
      setIsRunning(false);
      return;
    }

    // Создаем WebUI с колбэками
    const webUI = new WebUI(
      (message: string, answers?: string[]) => {
        // Колбэк для отправки сообщения бота
        setMessages(prev => {
          const newMessages = [...prev, { role: 'bot' as const, content: message, answers }];
          const newIndex = newMessages.length - 1;
          
          // Устанавливаем activeAnswersMessageIndex и waitingForInput синхронно внутри setMessages
          // Используем функциональную форму setState, чтобы избежать проблем с замыканиями
          if (answers && answers.length > 0) {
            // Устанавливаем activeAnswersMessageIndex синхронно для нового сообщения
            setActiveAnswersMessageIndex(newIndex);
            // Убеждаемся, что waitingForInput установлен в true для отображения кнопок
            setWaitingForInput(true);
          } else {
            // Если сообщение отправляется без вариантов ответов, сбрасываем activeAnswersMessageIndex,
            // чтобы скрыть кнопки предыдущего сообщения
            setActiveAnswersMessageIndex(null);
          }
          
          return newMessages;
        });
      },
      () => {
        // Колбэк для завершения диалога
        setMessages(prev => [...prev, { role: 'bot' as const, content: '👋 Диалог завершен.' }]);
        setIsRunning(false);
        setWaitingForInput(false);
        setActiveAnswersMessageIndex(null);
      },
      () => {
        // Колбэк когда Engine запрашивает ввод пользователя
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/3dd875b0-2c9e-459b-8e6e-82c5c386ba6d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Preview.tsx:71',message:'onInputRequested callback called',data:{currentWaitingForInput:waitingForInput},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        // Не устанавливаем waitingForInput здесь, так как он уже устанавливается внутри setMessages
        // когда сообщение с ответами отправляется
      },
      (fileName: string) => {
        // Колбэк когда Engine запрашивает файл
        setWaitingForFile(true);
        setRequestedFileName(fileName);
        setMessages(prev => [...prev, { 
          role: 'bot' as const, 
          content: `📎 Пожалуйста, загрузите файл: ${fileName}` 
        }]);
      }
    );

    webUIRef.current = webUI;

    // Создаем Engine с глобальными константами
    const globalConstants = currentProject.globalConstants || {};
    const engine = new Engine(webUI, engineNodes, globalConstants);
    engineRef.current = engine;

    // Начинаем выполнение бота (skip=true для первого запуска, чтобы начать без ввода)
    const executeBot = async () => {
      try {
        executionPromiseRef.current = engine.execute(true);
        await executionPromiseRef.current;
      } catch (err) {
        console.error('Ошибка выполнения бота:', err);
        setMessages(prev => [...prev, { 
          role: 'bot', 
          content: '⚠️ Произошла ошибка при выполнении бота.' 
        }]);
        setIsRunning(false);
        setWaitingForInput(false);
      }
    };

    executeBot();

    // Очистка при закрытии
    return () => {
      setIsRunning(false);
      setWaitingForInput(false);
      setWaitingForFile(false);
      setRequestedFileName('');
      engineRef.current = null;
      webUIRef.current = null;
      executionPromiseRef.current = null;
    };
  }, [currentProject]);

  const sendToEngine = useCallback((text: string) => {
    console.log(`🎯 sendToEngine called with text: "${text}"`);
    console.log(`   waitingForInput:`, waitingForInput);
    console.log(`   activeAnswersMessageIndex:`, activeAnswersMessageIndex);

    if (!text || !webUIRef.current || !waitingForInput) {
      console.log(`   ❌ Early return - conditions not met`);
      return;
    }

    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/3dd875b0-2c9e-459b-8e6e-82c5c386ba6d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Preview.tsx:133',message:'sendToEngine called',data:{text,waitingForInput,activeAnswersMessageIndex},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion

    // Сбрасываем состояния после выбора ответа
    setActiveAnswersMessageIndex(null);
    setWaitingForInput(false); // Сбрасываем ожидание ввода
    setUserJustResponded(true); // Помечаем, что пользователь только что ответил

    // Добавляем сообщение пользователя
    setMessages(prev => [...prev, { role: 'user' as const, content: text }]);
    setUserInput('');
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/3dd875b0-2c9e-459b-8e6e-82c5c386ba6d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Preview.tsx:145',message:'User message sent, resetting waitingForInput',data:{previousIndex:activeAnswersMessageIndex,waitingForInput},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
    // #endregion

    webUIRef.current.handleUserMessage(text);

    if (engineRef.current) {
      const continueExecution = async () => {
        try {
          executionPromiseRef.current = engineRef.current!.execute(false);
          await executionPromiseRef.current;
        } catch (err) {
          console.error('Ошибка выполнения бота:', err);
          setMessages(prev => [...prev, { 
            role: 'bot' as const, 
            content: '⚠️ Произошла ошибка при выполнении бота.' 
          }]);
          setIsRunning(false);
          setWaitingForInput(false);
          setActiveAnswersMessageIndex(null);
        }
      };
      continueExecution();
    }
  }, [waitingForInput]);

  const handleSendMessage = useCallback(() => {
    const inputText = userInput.trim();
    if (!inputText) return;
    sendToEngine(inputText);
  }, [userInput, sendToEngine]);

  const handleQuickReply = useCallback((reply: string) => {
    console.log(`🚀 handleQuickReply called with reply: "${reply}"`);
    sendToEngine(reply);
  }, [sendToEngine]);

  const handleRestart = useCallback(() => {
    // Очищаем состояние
    setMessages([]);
    setUserInput('');
    setIsRunning(true);
    setWaitingForInput(false);
    setWaitingForFile(false);
    setRequestedFileName('');
    setActiveAnswersMessageIndex(null);
    setUserJustResponded(false);

    // Очищаем refs
    executionPromiseRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Создаем новый Engine и WebUI
    const webUI = new WebUI(
      (message: string, answers?: string[]) => {
        console.log(`🔄 Preview: Received message from bot: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
        console.log(`   Has answers:`, !!(answers && answers.length > 0));
        console.log(`   userJustResponded:`, userJustResponded);

        // Если пользователь только что ответил и сообщение содержит кнопки, игнорируем его
        // Это предотвратит повторное отображение того же сообщения
        if (userJustResponded && answers && answers.length > 0) {
          console.log(`   ⚠️  Ignoring message with answers because user just responded`);
          setUserJustResponded(false); // Сбрасываем флаг
          return; // Не добавляем сообщение
        }

        setMessages(prev => {
          console.log(`   Adding message to chat, current messages count:`, prev.length);
          const newMessages = [...prev, { role: 'bot' as const, content: message, answers }];
          const newIndex = newMessages.length - 1;

          if (answers && answers.length > 0) {
            setActiveAnswersMessageIndex(newIndex);
            // Не устанавливаем waitingForInput = true, если пользователь только что ответил
            // (это предотвратит повторное выполнение того же блока)
            if (!userJustResponded) {
              setWaitingForInput(true);
            }
            setUserJustResponded(false); // Сбрасываем флаг
          } else {
            setActiveAnswersMessageIndex(null);
            // Если сообщение без кнопок ответов, сбрасываем ожидание ввода
            // (бот либо завершился, либо ждет другого типа ввода)
            setWaitingForInput(false);
            setUserJustResponded(false); // Сбрасываем флаг
          }

          return newMessages;
        });
      },
      () => {
        setMessages(prev => [...prev, { role: 'bot' as const, content: '👋 Диалог завершен.' }]);
        setIsRunning(false);
        setWaitingForInput(false);
        setActiveAnswersMessageIndex(null);
      },
      () => {
        // Не устанавливаем waitingForInput здесь, так как он уже устанавливается внутри setMessages
        // когда сообщение с ответами отправляется
      },
      (fileName: string) => {
        setWaitingForFile(true);
        setRequestedFileName(fileName);
        setMessages(prev => [...prev, {
          role: 'bot' as const,
          content: `📎 Пожалуйста, загрузите файл: ${fileName}`
        }]);
      }
    );

    webUIRef.current = webUI;

    // Создаем Engine с глобальными константами
    const globalConstants = currentProject.globalConstants || {};
    const engine = new Engine(webUI, adaptProjectToEngine(currentProject), globalConstants);
    engineRef.current = engine;

    // Начинаем выполнение бота
    const executeBot = async () => {
      try {
        executionPromiseRef.current = engine.execute(true);
        await executionPromiseRef.current;
      } catch (err) {
        console.error('Ошибка выполнения бота:', err);
        setMessages(prev => [...prev, {
          role: 'bot',
          content: '⚠️ Произошла ошибка при выполнении бота.'
        }]);
        setIsRunning(false);
        setWaitingForInput(false);
      }
    };

    executeBot();
  }, [currentProject]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log(`📎 handleFileUpload called with file:`, file?.name);
    if (!file || !webUIRef.current) {
      console.log(`   ❌ No file or webUI not ready`);
      return;
    }

    // Добавляем сообщение пользователя о загрузке файла
    setMessages(prev => [...prev, {
      role: 'user' as const,
      content: `📎 Файл загружен: ${file.name}`
    }]);

    // Передаем имя файла в WebUI
    webUIRef.current.handleUserFile(file.name);

    // Сбрасываем состояния после загрузки файла
    setWaitingForFile(false);
    setRequestedFileName('');
    setWaitingForInput(false); // Сбрасываем ожидание ввода, так как файл загружен
    setUserJustResponded(true); // Помечаем, что пользователь ответил (файлом)

    // Очищаем input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Продолжаем выполнение бота
    if (engineRef.current) {
      const continueExecution = async () => {
        try {
          executionPromiseRef.current = engineRef.current!.execute(false);
          await executionPromiseRef.current;
        } catch (err) {
          console.error('Ошибка выполнения бота:', err);
          setMessages(prev => [...prev, {
            role: 'bot' as const,
            content: '⚠️ Произошла ошибка при выполнении бота.'
          }]);
          setIsRunning(false);
          setWaitingForInput(false);
          setWaitingForFile(false);
          setActiveAnswersMessageIndex(null);
        }
      };
      continueExecution();
    }
  }, []);

  if (!currentProject) {
    return (
      <div className="preview-overlay" onClick={onClose}>
        <div className="preview-modal" onClick={e => e.stopPropagation()}>
          <p>Проект не найден</p>
          <button onClick={onClose}>Закрыть</button>
        </div>
      </div>
    );
  }

  return (
    <div className="preview-overlay" onClick={onClose}>
      <div className="preview-modal" onClick={e => e.stopPropagation()}>
        <div className="preview-header">
          <h3>👁️ Предпросмотр бота</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="preview-chat">
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-message bot">
                <div className="message-bubble">👋 Загрузка бота...</div>
              </div>
            )}
            {messages.map((msg, idx) => {
              // #region agent log
              const shouldShowButtons = msg.role === 'bot' && 
                                       msg.answers && 
                                       msg.answers.length > 0 && 
                                       activeAnswersMessageIndex === idx && 
                                       waitingForInput;
              if (msg.role === 'bot' && msg.answers && msg.answers.length > 0) {
                fetch('http://127.0.0.1:7245/ingest/3dd875b0-2c9e-459b-8e6e-82c5c386ba6d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Preview.tsx:204',message:'Rendering message with answers',data:{idx,activeAnswersMessageIndex,waitingForInput,shouldShowButtons,answersCount:msg.answers.length,answers:msg.answers},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'N'})}).catch(()=>{});
              }
              // #endregion
              return (
                <div key={idx} className={`chat-message ${msg.role}`}>
                  <div className="message-bubble">
                  {msg.content}
                  {msg.role === 'bot' && 
                   msg.answers && 
                   msg.answers.length > 0 && 
                   activeAnswersMessageIndex === idx && 
                   waitingForInput && (
                    <div className="quick-replies">
                      {msg.answers.map((ans, i) => (
                        <button
                          key={`${idx}-ans-${i}`}
                          className="quick-reply-btn"
                          onClick={() => {
                            // #region agent log
                            fetch('http://127.0.0.1:7245/ingest/3dd875b0-2c9e-459b-8e6e-82c5c386ba6d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Preview.tsx:228',message:'Button clicked',data:{idx,answerIndex:i,answer:ans,activeAnswersMessageIndex,waitingForInput},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'N'})}).catch(()=>{});
                            // #endregion
                            handleQuickReply(ans);
                          }}
                          disabled={!waitingForInput || activeAnswersMessageIndex !== idx}
                        >
                          {ans}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>

          <div className="chat-input-container">
            {!isRunning && !waitingForInput ? (
              <div className="restart-container">
                <button
                  className="restart-btn"
                  onClick={handleRestart}
                >
                  🔄 Начать заново
                </button>
              </div>
            ) : waitingForFile ? (
              <div className="file-upload-container">
                <label className="file-upload-label">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="file-input"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <span className="file-upload-button">📎 Выбрать файл: {requestedFileName}</span>
                </label>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className="chat-input"
                  placeholder={
                    waitingForInput && activeAnswersMessageIndex !== null
                      ? "Выберите вариант выше или введите свой ответ..."
                      : waitingForInput
                      ? "Введите сообщение..."
                      : isRunning
                      ? "Ожидание..."
                      : "Диалог завершен"
                  }
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && waitingForInput) {
                      handleSendMessage();
                    }
                  }}
                  disabled={!waitingForInput}
                />
                <button
                  className="send-btn"
                  onClick={handleSendMessage}
                  disabled={!waitingForInput}
                >
                  ➤
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Preview;
