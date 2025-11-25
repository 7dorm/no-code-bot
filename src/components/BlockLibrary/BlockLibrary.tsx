import React, { useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { BlockNode, BlockType } from '../../types';
import BlockEditorModal from '../BlockEditor/BlockEditorModal';
import './BlockLibrary.css';

const BLOCK_TYPES: Array<{ type: BlockType; label: string; icon: string }> = [
  { type: 'message', label: 'Сообщение', icon: '💬' },
  { type: 'condition', label: 'Условие', icon: '🔀' },
  { type: 'variable', label: 'Переменная', icon: '📝' },
  { type: 'api', label: 'API', icon: '🔌' },
  { type: 'file', label: 'Файл', icon: '📎' },
];

const BlockLibrary: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  
  const { currentProject, addBlock, selectNode, selectedNodeId } = useEditorStore();

  const handleAddBlock = (type: BlockType) => {
    const newBlock: BlockNode = {
      id: crypto.randomUUID(),
      type: 'blockNode',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        type,
        label: `Блок ${type}`,
        params: {},
      },
    };
    
    addBlock(newBlock);
    // Открываем редактор для нового блока
    setEditingNodeId(newBlock.id);
    setIsEditing(true);
    selectNode(newBlock.id);
  };

  const handleCloseEditor = () => {
    setIsEditing(false);
    setEditingNodeId(null);
  };

  if (editingNodeId && isEditing) {
    return <BlockEditorModal nodeId={editingNodeId} onClose={handleCloseEditor} />;
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
        {BLOCK_TYPES.map(({ type, label, icon }) => (
          <button
            key={type}
            className="library-block-btn"
            onClick={() => handleAddBlock(type)}
            title={label}
          >
            <span className="block-icon">{icon}</span>
            <span className="block-label">{label}</span>
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