import React, { useState, useEffect } from 'react';
import Editor from './Editor';
import BlockEditorModal from '../BlockEditor/BlockEditorModal';
import VariablesPanel from '../VariablesPanel/VariablesPanel';
import { useEditorStore } from '../../store/useEditorStore';
import './EditorWithEditor.css';

const EditorWithEditor: React.FC = () => {
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const { selectedNodeId, deleteBlock, isPreviewMode } = useEditorStore();

  // Обработка клавиши Delete для удаления блоков
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;

      // Не реагируем на горячие клавиши, когда:
      // - открыт предпросмотр
      // - фокус в элементах ввода текста
      // - внутри модальных окон (например, предпросмотр)
      const isTextInput = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        (target as HTMLElement).isContentEditable
      );
      const insidePreview = !!target && !!target.closest('.preview-modal');
      if (isPreviewMode || isTextInput || insidePreview) {
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        if (confirm('Удалить этот блок?')) {
          deleteBlock(selectedNodeId);
        }
      }
      
      // Escape закрывает редактор
      if (e.key === 'Escape') {
        setEditingNodeId(null);
      }

      // Enter или E открывает редактор
      if ((e.key === 'Enter' || e.key === 'e') && selectedNodeId && !e.ctrlKey && !e.metaKey) {
        setEditingNodeId(selectedNodeId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, deleteBlock]);

  useEffect(() => {
    if (!selectedNodeId) {
      setEditingNodeId(null);
    }
  }, [selectedNodeId]);

  // Слушаем изменения selectedNodeId через подписку
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const unsubscribe = useEditorStore.subscribe(
      (state) => state.selectedNodeId,
      (nodeId) => {
        // Добавляем небольшую задержку перед открытием редактора
        clearTimeout(timeoutId);
      }
    );

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="editor-with-panel">
      <div className="editor-container">
        <Editor />
      </div>
      <VariablesPanel />
      {editingNodeId && (
        <BlockEditorModal
          nodeId={editingNodeId}
          onClose={() => setEditingNodeId(null)}
        />
      )}
    </div>
  );
};

export default EditorWithEditor;
