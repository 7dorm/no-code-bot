import React from 'react';
import type { RemoteConnectionStatus } from '../client/RemoteEditorClient';
import './ConnectionStatusBadge.css';

interface ConnectionStatusBadgeProps {
  status: RemoteConnectionStatus;
  attempt: number;
  maxAttempts: number;
  onRetry?: () => void;
}

function getStatusLabel(status: RemoteConnectionStatus, attempt: number, maxAttempts: number): string {
  switch (status) {
    case 'connected':
      return 'Подключено';
    case 'connecting':
      return 'Подключение...';
    case 'reconnecting':
      return `Переподключение (${attempt}/${maxAttempts})...`;
    case 'failed':
      return 'Соединение потеряно';
    case 'disconnected':
      return 'Отключено';
    default:
      return 'Не подключено';
  }
}

const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({
  status,
  attempt,
  maxAttempts,
  onRetry,
}) => {
  return (
    <div className={`connection-status connection-status--${status}`}>
      <span className="connection-status-dot" aria-hidden="true" />
      <span className="connection-status-label">
        {getStatusLabel(status, attempt, maxAttempts)}
      </span>
      {status === 'failed' && onRetry && (
        <button type="button" className="connection-status-retry" onClick={onRetry}>
          Переподключиться
        </button>
      )}
    </div>
  );
};

export default ConnectionStatusBadge;
