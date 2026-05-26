import React, { useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import BlockEditorModal from '../BlockEditor/BlockEditorModal';

const BlockEditor: React.FC = () => {
  const { selectedNodeId } = useEditorStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  
  React.useEffect(() => {
    if (selectedNodeId && !isModalOpen) {
      
      
    }
  }, [selectedNodeId]);

  if (!selectedNodeId || !isModalOpen) {
    return null;
  }

  return (
    <BlockEditorModal
      nodeId={selectedNodeId}
      useStore={useEditorStore}
      onClose={() => setIsModalOpen(false)}
    />
  );
};

export default BlockEditor;
