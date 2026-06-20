import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EditorState } from '../../store/useEditorStore';
import { Engine } from '@backend/Engine';
import { WebUI } from '@backend/WebUI';
import { adaptProjectToEngine } from '../../utils/backend/projectAdapter';
import type { SharedPreviewState } from '../../client/RemoteEditorClient';
import './Preview.css';

interface PreviewProps {
  onClose: () => void;
  useStore: () => EditorState;
}

interface ChatMessage {
  role: 'bot' | 'user';
  content: string;
  answers?: string[];
}

const Preview: React.FC<PreviewProps> = ({ onClose, useStore }) => {
  const {
    currentProject,
    isConnected,
    remoteSessionState,
    updateRemotePreviewState,
  } = useStore();
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
  const isRemoteSession = isConnected && !!remoteSessionState;
  const isPreviewOwner = !!remoteSessionState?.isCurrentParticipantOwner;
  const canControlPreview = !isRemoteSession || isPreviewOwner;
  const sharedPreview = remoteSessionState?.preview;

  const buildSharedPreviewState = useCallback((): SharedPreviewState => ({
    active: true,
    ownerOnly: true,
    isRunning,
    waitingForInput,
    waitingForFile,
    requestedFileName,
    activeAnswersMessageIndex,
    messages,
    controllerParticipantId: remoteSessionState?.currentParticipantId,
    controllerName: remoteSessionState?.ownerName,
  }), [
    activeAnswersMessageIndex,
    isRunning,
    messages,
    remoteSessionState?.currentParticipantId,
    remoteSessionState?.ownerName,
    requestedFileName,
    waitingForFile,
    waitingForInput,
  ]);

  useEffect(() => {
    if (!isRemoteSession || canControlPreview) {
      return;
    }

    setMessages(sharedPreview?.messages || []);
    setIsRunning(sharedPreview?.isRunning || false);
    setWaitingForInput(sharedPreview?.waitingForInput || false);
    setWaitingForFile(sharedPreview?.waitingForFile || false);
    setRequestedFileName(sharedPreview?.requestedFileName || '');
    setActiveAnswersMessageIndex(
      typeof sharedPreview?.activeAnswersMessageIndex === 'number'
        ? sharedPreview.activeAnswersMessageIndex
        : null,
    );
  }, [canControlPreview, isRemoteSession, sharedPreview]);

  useEffect(() => {
    if (!isRemoteSession || !isPreviewOwner) {
      return;
    }

    const timer = window.setTimeout(() => {
      updateRemotePreviewState(buildSharedPreviewState());
    }, 150);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    buildSharedPreviewState,
    isPreviewOwner,
    isRemoteSession,
    updateRemotePreviewState,
  ]);

  useEffect(() => {
    return () => {
      if (!isRemoteSession || !isPreviewOwner) {
        return;
      }

      updateRemotePreviewState({
        active: false,
        ownerOnly: true,
        isRunning: false,
        waitingForInput: false,
        waitingForFile: false,
        requestedFileName: '',
        activeAnswersMessageIndex: null,
        messages: [],
        controllerParticipantId: remoteSessionState?.currentParticipantId,
        controllerName: remoteSessionState?.ownerName,
        updatedAt: new Date().toISOString(),
      });
    };
  }, [
    isPreviewOwner,
    isRemoteSession,
    remoteSessionState?.currentParticipantId,
    remoteSessionState?.ownerName,
    updateRemotePreviewState,
  ]);

  
  useEffect(() => {
    if (isRemoteSession && !isPreviewOwner) {
      return;
    }

    if (!currentProject) {
      setMessages([]);
      setIsRunning(false);
      return;
    }

    
    setMessages([]);
    setIsRunning(true);
    setWaitingForInput(false);
    setUserJustResponded(false);

    
    const engineNodes = adaptProjectToEngine(currentProject);
    
    if (engineNodes.length === 0) {
      setMessages([{ role: 'bot', content: ' Проект не содержит блоков.' }]);
      setIsRunning(false);
      return;
    }

    
    const webUI = new WebUI(
      (message: string, answers?: string[]) => {
        
        setMessages(prev => {
          const newMessages = [...prev, { role: 'bot' as const, content: message, answers }];
          const newIndex = newMessages.length - 1;
          
          
          
          if (answers && answers.length > 0) {
            
            setActiveAnswersMessageIndex(newIndex);
            
            setWaitingForInput(true);
          } else {
            
            
            setActiveAnswersMessageIndex(null);
          }
          
          return newMessages;
        });
      },
      () => {
        
        setMessages(prev => [...prev, { role: 'bot' as const, content: ' Диалог завершен.' }]);
        setIsRunning(false);
        setWaitingForInput(false);
        setActiveAnswersMessageIndex(null);
      },
      () => {
        
        setWaitingForInput(true);
      },
      (fileName: string) => {
        
        setWaitingForFile(true);
        setRequestedFileName(fileName);
        setMessages(prev => [...prev, { 
          role: 'bot' as const, 
          content: ` Пожалуйста, загрузите файл: ${fileName}` 
        }]);
      }
    );

    webUIRef.current = webUI;

    
    const globalConstants = currentProject.globalConstants || {};
    const engine = new Engine(webUI, engineNodes, globalConstants);
    engineRef.current = engine;

    
    const executeBot = async () => {
      try {
        executionPromiseRef.current = engine.execute(true);
        await executionPromiseRef.current;
      } catch (err) {
        setMessages(prev => [...prev, { 
          role: 'bot', 
          content: ' Произошла ошибка при выполнении бота.' 
        }]);
        setIsRunning(false);
        setWaitingForInput(false);
      }
    };

    executeBot();

    
    return () => {
      setIsRunning(false);
      setWaitingForInput(false);
      setWaitingForFile(false);
      setRequestedFileName('');
      engineRef.current = null;
      webUIRef.current = null;
      executionPromiseRef.current = null;
    };
  }, [currentProject, isPreviewOwner, isRemoteSession]);

  const sendToEngine = useCallback((text: string) => {
    if (!canControlPreview || !text || !webUIRef.current || !waitingForInput) {
      return;
    }

    
    setActiveAnswersMessageIndex(null);
    setWaitingForInput(false); 
    setUserJustResponded(true); 

    
    setMessages(prev => [...prev, { role: 'user' as const, content: text }]);
    setUserInput('');

    webUIRef.current.handleUserMessage(text);

    
  }, [canControlPreview, waitingForInput]);

  const handleSendMessage = useCallback(() => {
    const inputText = userInput.trim();
    if (!inputText) return;
    sendToEngine(inputText);
  }, [userInput, sendToEngine]);

  const handleQuickReply = useCallback((reply: string) => {
    sendToEngine(reply);
  }, [sendToEngine]);

  const handleRestart = useCallback(() => {
    if (!canControlPreview || !currentProject) {
      return;
    }
    
    setMessages([]);
    setUserInput('');
    setIsRunning(true);
    setWaitingForInput(false);
    setWaitingForFile(false);
    setRequestedFileName('');
    setActiveAnswersMessageIndex(null);
    setUserJustResponded(false);

    
    executionPromiseRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    
    const webUI = new WebUI(
      (message: string, answers?: string[]) => {
        
        
        if (userJustResponded && answers && answers.length > 0) {
          setUserJustResponded(false); 
          return; 
        }

        setMessages(prev => {
          const newMessages = [...prev, { role: 'bot' as const, content: message, answers }];
          const newIndex = newMessages.length - 1;

          if (answers && answers.length > 0) {
            setActiveAnswersMessageIndex(newIndex);
            
            
            if (!userJustResponded) {
              setWaitingForInput(true);
            }
            setUserJustResponded(false); 
          } else {
            setActiveAnswersMessageIndex(null);
            
            
            setWaitingForInput(false);
            setUserJustResponded(false); 
          }

          return newMessages;
        });
      },
      () => {
        setMessages(prev => [...prev, { role: 'bot' as const, content: ' Диалог завершен.' }]);
        setIsRunning(false);
        setWaitingForInput(false);
        setActiveAnswersMessageIndex(null);
      },
      () => {
        setWaitingForInput(true);
        setWaitingForFile(false);
      },
      (fileName: string) => {
        setWaitingForFile(true);
        setRequestedFileName(fileName);
        setMessages(prev => [...prev, {
          role: 'bot' as const,
          content: ` Пожалуйста, загрузите файл: ${fileName}`
        }]);
      }
    );

    webUIRef.current = webUI;

    
    const globalConstants = currentProject.globalConstants || {};
    const engine = new Engine(webUI, adaptProjectToEngine(currentProject), globalConstants);
    engineRef.current = engine;

    
    const executeBot = async () => {
      try {
        executionPromiseRef.current = engine.execute(true);
        await executionPromiseRef.current;
      } catch (err) {
        setMessages(prev => [...prev, {
          role: 'bot',
          content: ' Произошла ошибка при выполнении бота.'
        }]);
        setIsRunning(false);
        setWaitingForInput(false);
      }
    };

    executeBot();
  }, [canControlPreview, currentProject, userJustResponded]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canControlPreview) {
      return;
    }

    const file = event.target.files?.[0];
    if (!file || !webUIRef.current) {
      return;
    }

    
    setMessages(prev => [...prev, {
      role: 'user' as const,
      content: ` Файл загружен: ${file.name}`
    }]);

    
    webUIRef.current.handleUserFile(file.name);

    
    setWaitingForFile(false);
    setRequestedFileName('');
    setWaitingForInput(false); 
    setUserJustResponded(true); 

    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    
  }, [canControlPreview]);

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
          <h2> Предпросмотр бота</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="preview-chat">
          <div className="chat-messages">
            {isRemoteSession && !canControlPreview && !sharedPreview?.active && (
              <div className="chat-message bot">
                <div className="message-bubble">
                  Владелец сессии еще не запустил preview. Когда он откроет предпросмотр, диалог появится здесь.
                </div>
              </div>
            )}
            {messages.length === 0 && (!isRemoteSession || canControlPreview || sharedPreview?.active) && (
              <div className="chat-message bot">
                <div className="message-bubble"> Загрузка бота...</div>
              </div>
            )}
            {messages.map((msg, idx) => {
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
                            handleQuickReply(ans);
                          }}
                          disabled={!canControlPreview || !waitingForInput || activeAnswersMessageIndex !== idx}
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
            {!canControlPreview ? (
              <div className="restart-container">
                <button
                  className="restart-btn"
                  disabled
                >
                  Preview управляется владельцем
                </button>
              </div>
            ) : !isRunning && !waitingForInput ? (
              <div className="restart-container">
                <button
                  className="restart-btn"
                  onClick={handleRestart}
                >
                   Начать заново
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
                  <span className="file-upload-button"> Выбрать файл: {requestedFileName}</span>
                </label>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className="chat-input"
                  placeholder={
                    !canControlPreview
                      ? "Preview управляется владельцем сессии"
                      : waitingForInput && activeAnswersMessageIndex !== null
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
                    if (e.key === 'Enter' && canControlPreview && waitingForInput) {
                      handleSendMessage();
                    }
                  }}
                  disabled={!canControlPreview || !waitingForInput}
                />
                <button
                  className="send-btn"
                  onClick={handleSendMessage}
                  disabled={!canControlPreview || !waitingForInput}
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
