import React, { useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import BlockEditorModal from '../BlockEditor/BlockEditorModal';

const BlockEditor: React.FC = () => {
  const { selectedNodeId } = useEditorStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Открываем модальное окно при выборе блока
  React.useEffect(() => {
    if (selectedNodeId && !isModalOpen) {
      // Можно добавить здесь логику для автоматического открытия
      // setIsModalOpen(true);
    }
  }, [selectedNodeId]);

  if (!selectedNodeId || !isModalOpen) {
    return null;
  }

  return (
    <BlockEditorModal
      nodeId={selectedNodeId}
      onClose={() => setIsModalOpen(false)}
    />
  );
};

export default BlockEditor;
