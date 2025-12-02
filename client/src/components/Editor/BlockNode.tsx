import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { BlockData } from '../../types';
import './BlockNode.css';

const getBlockIcon = (type: string) => {
  switch (type) {
    case 'start':
      return '▶️';
    case 'message':
      return '💬';
    case 'condition':
      return '🔀';
    case 'variable':
      return '📝';
    case 'api':
      return '🔌';
    case 'file':
      return '📎';
    default:
      return '📦';
  }
};

const getBlockColor = (type: string) => {
  switch (type) {
    case 'start':
      return '#4caf50';
    case 'message':
      return '#2196f3';
    case 'condition':
      return '#ff9800';
    case 'variable':
      return '#9c27b0';
    case 'api':
      return '#00bcd4';
    case 'file':
      return '#795548';
    default:
      return '#757575';
  }
};

const BlockNode: React.FC<NodeProps<BlockData>> = ({ data, selected }) => {
  const backgroundColor = getBlockColor(data.type);
  const icon = getBlockIcon(data.type);

  return (
    <div
      className={`block-node ${selected ? 'selected' : ''}`}
      style={{ borderColor: selected ? backgroundColor : undefined }}
    >
      <Handle type="target" position={Position.Top} />
      
      <div className="block-header" style={{ background: backgroundColor }}>
        <span className="block-icon">{icon}</span>
        <span className="block-type">{data.type.toUpperCase()}</span>
      </div>
      
      <div className="block-content">
        {data.label && <div className="block-label">{data.label}</div>}
        {data.params && Object.keys(data.params).length > 0 && (
          <div className="block-params">
            {Object.entries(data.params).slice(0, 2).map(([key, value]) => (
              <div key={key} className="param-item">
                <span className="param-key">{key}:</span>
                <span className="param-value">{String(value).substring(0, 20)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
      />
      {data.type === 'condition' && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="output-else"
          style={{ left: '50%' }}
        />
      )}
    </div>
  );
};

export default BlockNode;
