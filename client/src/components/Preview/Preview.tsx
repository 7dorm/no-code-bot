// @ts-ignore
import React, { useState, useEffect } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { ExecutionContext } from '../../types';
import { executeBlock } from '../../utils/blockExecutor';
import './Preview.css';

interface PreviewProps {
  onClose: () => void;
}

interface ChatMessage {
  role: 'bot' | 'user';
  content: string;
}

// @ts-ignore
const Preview: React.FC<PreviewProps> = ({ onClose }) => {
  const { currentProject } = useEditorStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [context, setContext] = useState<ExecutionContext>({ variables: {} });

  useEffect(() => {
    const startBlock = currentProject?.blocks.find(b => b.data.type === 'start');

    if (startBlock) {
      setCurrentNodeId(startBlock.id);
      setMessages([{ role: 'bot', content: '👋 Бот запущен! Начинаем диалог.' }]);

      if (currentProject) {
        const result = executeBlock(startBlock, { variables: {} }, currentProject.connections);
        if (result.success) {
          setTimeout(() => setCurrentNodeId(result.nextNodeId ?? null), 100);
        }
      }
    }
  }, [currentProject]);

  const handleSendMessage = () => {

  };
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
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role}`}>
                <div className="message-bubble">{msg.content}</div>
              </div>
            ))}
          </div>

          <div className="chat-input-container">
            <input
              type="text"
              className="chat-input"
              placeholder="Введите сообщение..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button className="send-btn" onClick={handleSendMessage}>➤</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Preview;
