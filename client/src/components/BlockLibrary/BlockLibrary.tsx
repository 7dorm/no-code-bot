import React, { useState } from 'react';
import { EditorState } from '../../store/useEditorStore';
import { BlockNode, BlockType } from '../../types';
import {
  MessageBlockMeta,
  ConditionBlockMeta,
  VariableBlockMeta,
  ApiBlockMeta,
  FileBlockMeta,
  ScriptBlockMeta,
  AiRouterBlockMeta,
  AiExtractorBlockMeta,
  AiAssistantBlockMeta,
} from '../../types';
import BlockEditorModal from '../BlockEditor/BlockEditorModal';
import { createId } from '../../utils/createId';
import './BlockLibrary.css';

const BLOCK_TYPES = [
  MessageBlockMeta,
  ConditionBlockMeta,
  VariableBlockMeta,
  ApiBlockMeta,
  FileBlockMeta,
  ScriptBlockMeta,
  AiRouterBlockMeta,
  AiExtractorBlockMeta,
  AiAssistantBlockMeta,
];

interface BlockLibraryProps {
  useStore: () => EditorState;
}

const BlockLibrary: React.FC<BlockLibraryProps> = ({ useStore }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const { currentProject, addBlock, selectNode } = useStore();

  const handleAddBlock = (type: BlockType) => {
    
    let blockData: any = { type, label: `Блок ${type}` };
    
    
    switch (type) {
      case 'message':
        blockData = { ...blockData, text: '' };
        break;
      case 'condition':
        blockData = { ...blockData, conditions: [{ condition: '' }], hasDefault: false };
        break;
      case 'variable':
        blockData = { ...blockData, variableName: '', value: '' };
        break;
      case 'api':
        blockData = { ...blockData, url: '', method: 'GET' as const };
        break;
      case 'file':
        blockData = { ...blockData, action: 'upload' as const };
        break;
      case 'script':
        blockData = { ...blockData, code: '', returnVariable: '' };
        break;
      case 'aiRouter':
        blockData = {
          ...blockData,
          instruction: 'Определи намерение пользователя и выбери один из маршрутов.',
          inputVariable: 'lastMessage',
          routes: [
            {
              id: 'route_1',
              title: 'Ветка 1',
              description: 'Пользователь подходит под первый сценарий',
              examples: [],
            },
          ],
          confidenceThreshold: 0.6,
          confidenceVariable: '',
          reasonVariable: '',
          saveNormalizedIntentTo: 'intent',
          contextMode: 'last_message' as const,
        };
        break;
      case 'aiExtractor':
        blockData = {
          ...blockData,
          instruction: 'Извлеки полезные сущности из сообщения пользователя.',
          inputVariable: 'lastMessage',
          entities: [
            {
              name: 'phone',
              variableName: 'phone',
              type: 'phone' as const,
              description: 'Номер телефона пользователя',
              required: false,
              askPrompt: 'Укажите, пожалуйста, номер телефона.',
            },
          ],
          askMissing: true,
          rawResultVariable: '',
          contextMode: 'last_message' as const,
        };
        break;
      case 'aiAssistant':
        blockData = {
          ...blockData,
          instruction: 'Отвечай на обычные вопросы как AI. Если сообщение относится к специальной теме, извлеки нужные сущности и предложи кнопки только когда они полезны.',
          inputVariable: 'lastMessage',
          routes: [
            {
              id: 'appointment',
              title: 'Запись к врачу',
              description: 'Пользователь хочет записаться, перенести или подобрать прием у врача',
              examples: ['хочу записаться к врачу', 'запиши к терапевту завтра в 10:00'],
            },
          ],
          entities: [
            {
              name: 'doctor',
              variableName: 'doctor',
              type: 'enum' as const,
              description: 'Специализация врача',
              required: true,
              enumValues: ['Терапевт', 'Кардиолог', 'Невролог'],
              askPrompt: 'К какому врачу хотите записаться?',
            },
            {
              name: 'date',
              variableName: 'date',
              type: 'date' as const,
              description: 'Дата приема',
              required: true,
              askPrompt: 'На какую дату нужна запись?',
            },
            {
              name: 'time',
              variableName: 'time',
              type: 'time' as const,
              description: 'Время приема',
              required: true,
              askPrompt: 'На какое время записать?',
            },
          ],
          askMissing: true,
          loop: true,
          exitPhrases: ['/stop', 'стоп', 'пока'],
          confidenceThreshold: 0.6,
          replyVariable: 'ai_reply',
          buttonsVariable: 'ai_buttons',
          rawResultVariable: 'ai_raw',
          confidenceVariable: 'ai_confidence',
          reasonVariable: 'ai_reason',
          saveNormalizedIntentTo: 'intent',
          specialTopicVariable: 'is_special_topic',
          contextMode: 'last_n_messages' as const,
        };
        break;
      case 'start':
        blockData = { ...blockData};
        break;
    }
    
    const newBlock: BlockNode = {
      id: createId(),
      type: 'blockNode',
      position: { x: Math.random() * 300, y: Math.random() * 300 },
      data: blockData,
    };
    
    addBlock(newBlock);
    
    setEditingNodeId(newBlock.id);
    setIsEditing(true);
    selectNode(newBlock.id);
  };

  const handleCloseEditor = () => {
    setIsEditing(false);
    setEditingNodeId(null);
  };

  if (editingNodeId && isEditing) {
    return <BlockEditorModal nodeId={editingNodeId} useStore={useStore} onClose={handleCloseEditor} />;
  }

  if (!currentProject) {
    return (
      <div className="block-library">
        <div className="library-empty">
          Создайте новый проект для начала работы
        </div>
      </div>
    );
  }

  return (
    <div className="block-library">
      <div className="library-header">
        <h3>📚 Библиотека блоков</h3>
      </div>
      
      <div className="library-content">
        {BLOCK_TYPES.map((meta) => (
          <button
            key={meta.type}
            className="library-block-btn"
            onClick={() => handleAddBlock(meta.type)}
            title={meta.description}
          >
            <span className="block-icon">{meta.icon}</span>
            <span className="block-label">{meta.label}</span>
          </button>
        ))}
      </div>

      <div className="library-info">
        <small>Нажмите на блок, чтобы добавить его на канвас</small>
      </div>
    </div>
  );
};

export default BlockLibrary;
