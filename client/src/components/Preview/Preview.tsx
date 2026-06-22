import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EditorState } from '../../store/useEditorStore';
import { Engine } from '@backend/Engine';
import { WebUI } from '@backend/WebUI';
import { adaptProjectToEngine } from '../../utils/backend/projectAdapter';
import type { PreviewInputMessage, RemotePreviewInstance, SharedPreviewState } from '../../client/RemoteEditorClient';
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

function canInteractWithPreview(
  preview: RemotePreviewInstance | undefined,
  participantId: string | undefined,
): boolean {
  if (!preview || !participantId) {
    return false;
  }

  if (!preview.ownerOnly) {
    return true;
  }

  return preview.creatorParticipantId === participantId;
}

function isPreviewDriver(
  preview: RemotePreviewInstance | undefined,
  participantId: string | undefined,
): boolean {
  if (!preview || !participantId) {
    return false;
  }

  if (preview.ownerOnly) {
    return preview.creatorParticipantId === participantId;
  }

  if (!preview.controllerParticipantId) {
    return false;
  }

  return preview.controllerParticipantId === participantId;
}

const Preview: React.FC<PreviewProps> = ({ onClose, useStore }) => {
  const {
    currentProject,
    remoteConnectionStatus,
    remoteSessionState,
    activePreviewId,
    remoteClient,
    updateRemotePreviewState,
    submitRemotePreviewInput,
    closeRemotePreview,
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
  const handleRestartRef = useRef<(() => void) | null>(null);
  const waitingForInputRef = useRef(waitingForInput);
  waitingForInputRef.current = waitingForInput;

  const isRemoteSession = !!remoteSessionState;
  const isWsConnected = remoteConnectionStatus === 'connected';
  const activePreview = remoteSessionState?.previews.find((preview) => preview.id === activePreviewId);
  const participantId = remoteSessionState?.currentParticipantId;
  const canInteract = !isRemoteSession || (isWsConnected && canInteractWithPreview(activePreview, participantId));
  const isDriver = isRemoteSession && isPreviewDriver(activePreview, participantId);
  const isSharedMode = !!activePreview && !activePreview.ownerOnly;

  const applyRemoteSnapshot = useCallback((preview: RemotePreviewInstance) => {
    setMessages(preview.messages || []);
    setIsRunning(preview.isRunning || false);
    setWaitingForInput(preview.waitingForInput || false);
    setWaitingForFile(preview.waitingForFile || false);
    setRequestedFileName(preview.requestedFileName || '');
    setActiveAnswersMessageIndex(
      typeof preview.activeAnswersMessageIndex === 'number'
        ? preview.activeAnswersMessageIndex
        : null,
    );
  }, []);

  const buildSharedPreviewState = useCallback((): SharedPreviewState => ({
    id: activePreviewId || undefined,
    active: true,
    ownerOnly: activePreview?.ownerOnly ?? true,
    isRunning,
    waitingForInput,
    waitingForFile,
    requestedFileName,
    activeAnswersMessageIndex,
    messages,
    controllerParticipantId: participantId,
    controllerName: remoteSessionState?.participants.find((item) => item.id === participantId)?.name,
  }), [
    activeAnswersMessageIndex,
    activePreview?.ownerOnly,
    activePreviewId,
    isRunning,
    messages,
    participantId,
    remoteSessionState?.participants,
    requestedFileName,
    waitingForFile,
    waitingForInput,
  ]);

  useEffect(() => {
    if (!isRemoteSession || !activePreview || isDriver) {
      return;
    }

    applyRemoteSnapshot(activePreview);
  }, [activePreview, applyRemoteSnapshot, isDriver, isRemoteSession]);

  useEffect(() => {
    if (!isRemoteSession || !isSharedMode || !activePreviewId || !participantId || !canInteract || !isWsConnected) {
      return;
    }

    if (activePreview?.controllerParticipantId) {
      return;
    }

    const participantName = remoteSessionState?.participants.find((item) => item.id === participantId)?.name;
    updateRemotePreviewState({
      id: activePreviewId,
      active: true,
      ownerOnly: false,
      isRunning: activePreview?.isRunning ?? false,
      waitingForInput: activePreview?.waitingForInput ?? false,
      waitingForFile: activePreview?.waitingForFile ?? false,
      requestedFileName: activePreview?.requestedFileName ?? '',
      activeAnswersMessageIndex: activePreview?.activeAnswersMessageIndex ?? null,
      messages: activePreview?.messages ?? [],
      controllerParticipantId: participantId,
      controllerName: participantName,
    });
  }, [
    activePreview,
    activePreviewId,
    canInteract,
    isRemoteSession,
    isSharedMode,
    participantId,
    remoteSessionState?.participants,
    updateRemotePreviewState,
    isWsConnected,
  ]);

  useEffect(() => {
    if (!isRemoteSession || !isDriver || !activePreviewId || !isWsConnected) {
      return;
    }

    const timer = window.setTimeout(() => {
      updateRemotePreviewState(buildSharedPreviewState());
    }, 150);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    activePreviewId,
    buildSharedPreviewState,
    isDriver,
    isRemoteSession,
    updateRemotePreviewState,
    isWsConnected,
  ]);

  useEffect(() => {
    if (isRemoteSession && activePreviewId && !activePreview) {
      closeRemotePreview();
    }
  }, [activePreview, activePreviewId, closeRemotePreview, isRemoteSession]);

  const handleClose = useCallback(() => {
    if (isRemoteSession) {
      closeRemotePreview();
      return;
    }
    onClose();
  }, [closeRemotePreview, isRemoteSession, onClose]);

  const handleRestart = useCallback(() => {
    if (!canInteract || !currentProject) {
      return;
    }

    if (isRemoteSession && isSharedMode && !isDriver) {
      submitRemotePreviewInput('restart', '');
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

        setMessages((prev) => {
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
        setMessages((prev) => [...prev, { role: 'bot' as const, content: ' Диалог завершен.' }]);
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
        setMessages((prev) => [...prev, {
          role: 'bot' as const,
          content: ` Пожалуйста, загрузите файл: ${fileName}`,
        }]);
      },
    );

    webUIRef.current = webUI;

    const globalConstants = currentProject.globalConstants || {};
    const engine = new Engine(webUI, adaptProjectToEngine(currentProject), globalConstants);
    engineRef.current = engine;

    const executeBot = async () => {
      try {
        executionPromiseRef.current = engine.execute(true);
        await executionPromiseRef.current;
      } catch {
        setMessages((prev) => [...prev, {
          role: 'bot',
          content: ' Произошла ошибка при выполнении бота.',
        }]);
        setIsRunning(false);
        setWaitingForInput(false);
      }
    };

    void executeBot();
  }, [canInteract, currentProject, isDriver, isRemoteSession, isSharedMode, submitRemotePreviewInput, userJustResponded]);

  handleRestartRef.current = handleRestart;

  useEffect(() => {
    if (isRemoteSession) {
      if (!isWsConnected || !isDriver) {
        return;
      }
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
        setMessages((prev) => {
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
        setMessages((prev) => [...prev, { role: 'bot' as const, content: ' Диалог завершен.' }]);
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
        setMessages((prev) => [...prev, {
          role: 'bot' as const,
          content: ` Пожалуйста, загрузите файл: ${fileName}`,
        }]);
      },
    );

    webUIRef.current = webUI;

    const globalConstants = currentProject.globalConstants || {};
    const engine = new Engine(webUI, engineNodes, globalConstants);
    engineRef.current = engine;

    const executeBot = async () => {
      try {
        executionPromiseRef.current = engine.execute(true);
        await executionPromiseRef.current;
      } catch {
        setMessages((prev) => [...prev, {
          role: 'bot',
          content: ' Произошла ошибка при выполнении бота.',
        }]);
        setIsRunning(false);
        setWaitingForInput(false);
      }
    };

    void executeBot();

    return () => {
      setIsRunning(false);
      setWaitingForInput(false);
      setWaitingForFile(false);
      setRequestedFileName('');
      engineRef.current = null;
      webUIRef.current = null;
      executionPromiseRef.current = null;
    };
  }, [currentProject, isDriver, isRemoteSession, isWsConnected]);

  useEffect(() => {
    if (!remoteClient || !isDriver || !activePreviewId) {
      remoteClient?.clearPreviewInputHandler();
      return;
    }

    const handlePreviewInput = (message: PreviewInputMessage) => {
      if (message.previewId !== activePreviewId) {
        return;
      }

      if (message.inputType === 'restart') {
        handleRestartRef.current?.();
        return;
      }

      if (message.inputType === 'text' && webUIRef.current && waitingForInputRef.current) {
        setActiveAnswersMessageIndex(null);
        setWaitingForInput(false);
        setUserJustResponded(true);
        setMessages((prev) => [...prev, {
          role: 'user' as const,
          content: message.value,
        }]);
        webUIRef.current.handleUserMessage(message.value);
        return;
      }

      if (message.inputType === 'file' && webUIRef.current) {
        setMessages((prev) => [...prev, {
          role: 'user' as const,
          content: ` Файл загружен: ${message.value}`,
        }]);
        webUIRef.current.handleUserFile(message.value);
        setWaitingForFile(false);
        setRequestedFileName('');
        setWaitingForInput(false);
        setUserJustResponded(true);
      }
    };

    remoteClient.onPreviewInput(handlePreviewInput);

    return () => {
      remoteClient.clearPreviewInputHandler();
    };
  }, [activePreviewId, isDriver, remoteClient]);

  const sendToEngine = useCallback((text: string) => {
    if (!canInteract || !text || !waitingForInput) {
      return;
    }

    if (isRemoteSession && isSharedMode && !isDriver) {
      submitRemotePreviewInput('text', text);
      setUserInput('');
      return;
    }

    if (!webUIRef.current) {
      return;
    }

    setActiveAnswersMessageIndex(null);
    setWaitingForInput(false);
    setUserJustResponded(true);
    setMessages((prev) => [...prev, { role: 'user' as const, content: text }]);
    setUserInput('');
    webUIRef.current.handleUserMessage(text);
  }, [canInteract, isDriver, isRemoteSession, isSharedMode, submitRemotePreviewInput, waitingForInput]);

  const handleSendMessage = useCallback(() => {
    const inputText = userInput.trim();
    if (!inputText) {
      return;
    }
    sendToEngine(inputText);
  }, [sendToEngine, userInput]);

  const handleQuickReply = useCallback((reply: string) => {
    sendToEngine(reply);
  }, [sendToEngine]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canInteract) {
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (isRemoteSession && isSharedMode && !isDriver) {
      submitRemotePreviewInput('file', file.name);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (!webUIRef.current) {
      return;
    }

    setMessages((prev) => [...prev, {
      role: 'user' as const,
      content: ` Файл загружен: ${file.name}`,
    }]);

    webUIRef.current.handleUserFile(file.name);
    setWaitingForFile(false);
    setRequestedFileName('');
    setWaitingForInput(false);
    setUserJustResponded(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [canInteract, isDriver, isRemoteSession, isSharedMode, submitRemotePreviewInput]);

  if (!currentProject) {
    return (
      <div className="preview-overlay" onClick={handleClose}>
        <div className="preview-modal" onClick={(event) => event.stopPropagation()}>
          <p>Проект не найден</p>
          <button onClick={handleClose}>Закрыть</button>
        </div>
      </div>
    );
  }

  const previewTitle = activePreview
    ? `Preview: ${activePreview.creatorName}${activePreview.ownerOnly ? ' (только создатель)' : ' (все участники)'}`
    : ' Предпросмотр бота';

  const controlHint = isRemoteSession && isSharedMode && !isDriver && canInteract
    ? `Управление через ${activePreview?.controllerName || 'ведущего участника'}`
    : null;

  return (
    <div className="preview-overlay" onClick={handleClose}>
      <div className="preview-modal" onClick={(event) => event.stopPropagation()}>
        <div className="preview-header">
          <div>
            <h3>{previewTitle}</h3>
            {controlHint && <p className="preview-control-hint">{controlHint}</p>}
          </div>
          <button className="close-btn" onClick={handleClose}>✕</button>
        </div>

        <div className="preview-chat">
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-message bot">
                <div className="message-bubble"> Загрузка бота...</div>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role}`}>
                <div className="message-bubble">
                  {msg.content}
                  {msg.role === 'bot'
                    && msg.answers
                    && msg.answers.length > 0
                    && activeAnswersMessageIndex === idx
                    && waitingForInput && (
                      <div className="quick-replies">
                        {msg.answers.map((ans, i) => (
                          <button
                            key={`${idx}-ans-${i}`}
                            className="quick-reply-btn"
                            onClick={() => handleQuickReply(ans)}
                            disabled={!canInteract || !waitingForInput || activeAnswersMessageIndex !== idx}
                          >
                            {ans}
                          </button>
                        ))}
                      </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="chat-input-container">
            {!canInteract ? (
              <div className="restart-container">
                <button className="restart-btn" disabled>
                  Preview доступен только для просмотра
                </button>
              </div>
            ) : !isRunning && !waitingForInput ? (
              <div className="restart-container">
                <button className="restart-btn" onClick={handleRestart}>
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
                    waitingForInput && activeAnswersMessageIndex !== null
                      ? 'Выберите вариант выше или введите свой ответ...'
                      : waitingForInput
                      ? 'Введите сообщение...'
                      : isRunning
                      ? 'Ожидание...'
                      : 'Диалог завершен'
                  }
                  value={userInput}
                  onChange={(event) => setUserInput(event.target.value)}
                  onKeyPress={(event) => {
                    if (event.key === 'Enter' && canInteract && waitingForInput) {
                      handleSendMessage();
                    }
                  }}
                  disabled={!canInteract || !waitingForInput}
                />
                <button
                  className="send-btn"
                  onClick={handleSendMessage}
                  disabled={!canInteract || !waitingForInput}
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
