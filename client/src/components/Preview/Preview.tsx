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
  const executionPromiseRef = useRef<Promise<void> | null>(null);

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
        setMessages(prev => [...prev, { role: 'bot', content: message, answers }]);
      },
      () => {
        // Колбэк для завершения диалога
        setMessages(prev => [...prev, { role: 'bot', content: '👋 Диалог завершен.' }]);
        setIsRunning(false);
        setWaitingForInput(false);
      },
      () => {
        // Колбэк когда Engine запрашивает ввод пользователя
        setWaitingForInput(true);
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
      engineRef.current = null;
      webUIRef.current = null;
      executionPromiseRef.current = null;
    };
  }, [currentProject]);

  const sendToEngine = useCallback((text: string) => {
    if (!text || !webUIRef.current || !waitingForInput) return;

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setUserInput('');
    setWaitingForInput(false);

    webUIRef.current.handleUserMessage(text);

    if (engineRef.current) {
      const continueExecution = async () => {
        try {
          executionPromiseRef.current = engineRef.current!.execute(false);
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
      continueExecution();
    }
  }, [waitingForInput]);

  const handleSendMessage = useCallback(() => {
    const inputText = userInput.trim();
    if (!inputText) return;
    sendToEngine(inputText);
  }, [userInput, sendToEngine]);

  const handleQuickReply = useCallback((reply: string) => {
    sendToEngine(reply);
  }, [sendToEngine]);

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
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role}`}>
                <div className="message-bubble">
                  {msg.content}
                  {msg.role === 'bot' && msg.answers && msg.answers.length > 0 && (
                    <div className="quick-replies">
                      {msg.answers.map((ans, i) => (
                        <button
                          key={`${idx}-ans-${i}`}
                          className="quick-reply-btn"
                          onClick={() => handleQuickReply(ans)}
                          disabled={!waitingForInput}
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
            <input
              type="text"
              className="chat-input"
              placeholder={waitingForInput ? "Введите сообщение..." : (isRunning ? "Ожидание..." : "Диалог завершен")}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Preview;
