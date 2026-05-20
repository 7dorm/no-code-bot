import React, { useCallback, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useEditorStore } from '../../store/useEditorStore';
import BlockNode from './BlockNode';
import BlockLibrary from '../BlockLibrary/BlockLibrary';
import ErrorPanel from './ErrorPanel';
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
      
      updateBlock(node.id, { position: node.position }, false);
    },
    [updateBlock]
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      
      updateBlock(node.id, { position: node.position }, true);
    },
    [updateBlock]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      selectNode(node.id);
      const openEvent = new CustomEvent('open-block-editor', { detail: { nodeId: node.id } });
      window.dispatchEvent(openEvent);
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

  const onEdgesDelete = useCallback(
    (edges: Edge[]) => {
      edges.forEach(edge => {
        deleteConnection(edge.id);
      });
    },
    [deleteConnection]
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
          onEdgesDelete={onEdgesDelete}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Background color="#aaa" gap={6} />
          <Controls />
          <MiniMap />
        </ReactFlow>
        <ErrorPanel />
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
