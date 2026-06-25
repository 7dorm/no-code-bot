import React, { useEffect, useState } from 'react';
import type { RemoteConnectionStatus, RemoteSessionState } from '../../client/RemoteEditorClient';
import type { EditorStoreType } from '../../store/useEditorStoreSwitcher';
import ConnectionStatusBadge from '../Remote/ConnectionStatusBadge';
import './SessionManagerModal.css';

interface SessionManagerModalProps {
  currentProjectName?: string;
  storeType: EditorStoreType;
  switchStore: (type: EditorStoreType) => void;
  remoteError: string;
  onClearRemoteError: () => void;
  onClose: () => void;
  onConnectRemote: () => void;
  onJoinRemote: (token: string) => void;
  onDisconnectRemote: () => void;
  onCopyToken: () => void;
  onOpenRemotePreview: (previewId: string) => void;
  isConnected: boolean;
  remoteConnectionStatus: RemoteConnectionStatus;
  remoteReconnectAttempt: number;
  remoteReconnectMaxAttempts: number;
  remoteParticipantName: string;
  remoteSessionState: RemoteSessionState | null;
  remoteSessionToken: string | null;
  retryRemoteConnection: () => void;
  setRemoteParticipantName: (name: string) => void;
}

const SessionManagerModal: React.FC<SessionManagerModalProps> = ({
  currentProjectName,
  storeType,
  switchStore,
  remoteError,
  onClearRemoteError,
  onClose,
  onConnectRemote,
  onJoinRemote,
  onDisconnectRemote,
  onCopyToken,
  onOpenRemotePreview,
  isConnected,
  remoteConnectionStatus,
  remoteReconnectAttempt,
  remoteReconnectMaxAttempts,
  remoteParticipantName,
  remoteSessionState,
  remoteSessionToken,
  retryRemoteConnection,
  setRemoteParticipantName,
}) => {
  const [sessionToken, setSessionToken] = useState('');
  const currentParticipants = remoteSessionState?.participants || [];
  const sessionPreviews = remoteSessionState?.previews || [];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleModeChange = (type: EditorStoreType) => {
    onClearRemoteError();
    switchStore(type);
  };

  const handleJoin = () => {
    onJoinRemote(sessionToken);
    setSessionToken('');
  };

  return (
    <div className="session-modal-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="session-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="session-modal-header">
          <div>
            <h2 id="session-modal-title">Сессия</h2>
            <span className="session-modal-subtitle">
              {storeType === 'internal' ? 'Совместный режим' : 'Локальный режим'}
            </span>
          </div>
          <button className="session-icon-button" type="button" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="session-mode-switch" role="group" aria-label="Режим сессии">
          <button
            type="button"
            className={storeType === 'default' ? 'active' : ''}
            aria-pressed={storeType === 'default'}
            onClick={() => handleModeChange('default')}
          >
            Локальная
          </button>
          <button
            type="button"
            className={storeType === 'internal' ? 'active' : ''}
            aria-pressed={storeType === 'internal'}
            onClick={() => handleModeChange('internal')}
          >
            Совместная
          </button>
        </div>

        {storeType === 'default' ? (
          <div className="session-local-panel">
            <div className="session-section-title">Текущий проект</div>
            <div className="session-local-name">{currentProjectName || 'Новый проект'}</div>
            <div className="session-local-status">Локальные изменения сохраняются в этом браузере.</div>
          </div>
        ) : (
          <div className="session-remote-panel">
            <div className="session-field-row">
              <label className="session-field">
                <span>Имя участника</span>
                <input
                  type="text"
                  value={remoteParticipantName}
                  onChange={(event) => setRemoteParticipantName(event.target.value)}
                  placeholder="Ваше имя"
                  maxLength={64}
                />
              </label>

              {(isConnected || remoteConnectionStatus !== 'idle') && (
                <ConnectionStatusBadge
                  status={remoteConnectionStatus}
                  attempt={remoteReconnectAttempt}
                  maxAttempts={remoteReconnectMaxAttempts}
                  onRetry={retryRemoteConnection}
                />
              )}
            </div>

            {remoteError && (
              <div className="session-error" role="alert">
                {remoteError}
              </div>
            )}

            {!isConnected && (
              <div className="session-connect-panel">
                <button className="session-primary-button" type="button" onClick={onConnectRemote}>
                  Создать сессию
                </button>
                <div className="session-token-row">
                  <input
                    type="text"
                    placeholder="Токен для подключения"
                    value={sessionToken}
                    onChange={(event) => setSessionToken(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        handleJoin();
                      }
                    }}
                  />
                  <button type="button" onClick={handleJoin}>
                    Подключиться
                  </button>
                </div>
              </div>
            )}

            {isConnected && remoteSessionState && (
              <div className="session-current-panel">
                <div className="session-current-header">
                  <div>
                    <div className="session-section-title">
                      {remoteSessionState.projectName || 'Совместная сессия'}
                    </div>
                    <div className="session-token-value">
                      <span>{remoteSessionToken || remoteSessionState.token}</span>
                      <button type="button" onClick={onCopyToken}>
                        Копировать
                      </button>
                    </div>
                  </div>
                  <span className="session-count-badge">
                    {currentParticipants.length} участн.
                  </span>
                </div>

                <div className="session-participants">
                  <div className="session-section-title">Участники</div>
                  <div className="session-participants-list">
                    {currentParticipants.map((participant) => (
                      <div key={participant.id} className="session-participant-chip">
                        <span>{participant.name}</span>
                        {participant.isOwner && <span>создатель</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="session-previews">
                  <div className="session-section-title">Preview ({sessionPreviews.length})</div>
                  {sessionPreviews.length === 0 ? (
                    <div className="session-empty-state">Активных preview нет</div>
                  ) : (
                    <div className="session-previews-list">
                      {sessionPreviews.map((preview) => (
                        <div key={preview.id} className="session-preview-item">
                          <div>
                            <strong>{preview.creatorName}</strong>
                            <span>
                              {preview.ownerOnly ? 'Только создатель' : 'Все участники'}
                            </span>
                          </div>
                          <button type="button" onClick={() => onOpenRemotePreview(preview.id)}>
                            Открыть
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="session-modal-footer">
                  <button type="button" onClick={onDisconnectRemote}>
                    Отключиться
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionManagerModal;
