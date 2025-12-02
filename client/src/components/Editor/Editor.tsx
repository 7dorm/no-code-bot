import React, { useCallback, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useEditorStore } from '../../store/useEditorStore';
import BlockNode from './BlockNode';
import BlockLibrary from '../BlockLibrary/BlockLibrary';
import './Editor.css';

const nodeTypes = {
  blockNode: BlockNode,
};

const EditorInner: React.FC = () => {
  const {
    currentProject,
    addConnection,
    deleteConnection,
    selectNode,
    selectedNodeId,
    updateBlock,
    deleteBlock,
  } = useEditorStore();
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project } = useReactFlow();

  const onConnect = useCallback(
    (params: Connection) => {
      addConnection({
        id: `e-${params.source}-${params.target}`,
        source: params.source || '',
        target: params.target || '',
        sourceHandle: params.sourceHandle || undefined,
        targetHandle: params.targetHandle || undefined,
      });
    },
    [addConnection]
  );

  const onNodeDrag = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // Обновляем позицию без сохранения в историю (только для визуального отображения)
      updateBlock(node.id, { position: node.position }, false);
    },
    [updateBlock]
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // Сохраняем финальную позицию в историю только при завершении перетаскивания
      updateBlock(node.id, { position: node.position }, true);
    },
    [updateBlock]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const onNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Двойной клик открывает редактор блока - обрабатывается в EditorWithEditor
      selectNode(node.id);
    },
    [selectNode]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const onNodesDelete = useCallback(
    (nodes: Node[]) => {
      nodes.forEach(node => {
        deleteBlock(node.id);
      });
    },
    [deleteBlock]
  );

  const nodes: Node[] = currentProject?.blocks.map(block => ({
    id: block.id,
    type: 'blockNode',
    position: block.position,
    data: block.data,
    selected: block.id === selectedNodeId,
  })) || [];

  const edges: Edge[] = currentProject?.connections.map(conn => ({
    id: conn.id,
    source: conn.source,
    target: conn.target,
    sourceHandle: conn.sourceHandle,
    targetHandle: conn.targetHandle,
    type: conn.type || 'smoothstep',
  })) || [];

  return (
    <>
      <BlockLibrary />
      <div className="editor-wrapper" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onConnect={onConnect}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onPaneClick={onPaneClick}
          onNodesDelete={onNodesDelete}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Background color="#aaa" gap={16} />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </>
  );
};

const Editor: React.FC = () => {
  return (
    <ReactFlowProvider>
      <EditorInner />
    </ReactFlowProvider>
  );
};

export default Editor;
