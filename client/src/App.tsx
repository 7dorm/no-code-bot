import { useEffect, useState } from 'react';
import { useEditorStoreSwitcher } from './store/useEditorStoreSwitcher';
import EditorWithEditor from './components/Editor/EditorWithEditor';
import Toolbar from './components/Toolbar/Toolbar';
import SettingsModal from './components/Settings/SettingsModal';
import Preview from './components/Preview/Preview';
import PreviewSetupModal from './components/Preview/PreviewSetupModal';
import ConnectionStatusBadge from './components/Remote/ConnectionStatusBadge';
import './App.css';

function App() {
  const { useStore, storeType, switchStore } = useEditorStoreSwitcher();
  const {
    currentProject,
    isSettingsOpen,
    isPreviewMode,
    loadFromLocalStorage,
    toggleSettings,
    createProject,
    undo,
    redo,
    connectRemote,
    joinRemote,
    disconnectRemote,
    isConnected,
    remoteSessionToken,
    remoteParticipantName,
    remoteSessionState,
    previewSetupPending,
    remoteConnectionStatus,
    remoteReconnectAttempt,
    remoteReconnectMaxAttempts,
    createRemotePreview,
    openRemotePreview,
    retryRemoteConnection,
    setRemoteParticipantName,
  } = useStore();
  const [sessionToken, setSessionToken] = useState('');
  const [remoteError, setRemoteError] = useState('');

  useEffect(() => {
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  useEffect(() => {
    if (storeType === 'internal') {
      return;
    }

    if (!currentProject) {
      createProject('Новый проект');
    }
  }, [currentProject, createProject, storeType]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key === 'z') || e.key === 'y')) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo]);

  const handleConnectRemote = async () => {
    try {
      setRemoteError('');
      const token = await connectRemote(remoteParticipantName);
      if (token) {
        setSessionToken('');
      }
    } catch (error) {
      console.error('Failed to connect:', error);
      setRemoteError(error instanceof Error ? error.message : 'Не удалось создать совместную сессию');
    }
  };

  const handleDisconnect = () => {
    setRemoteError('');
    disconnectRemote();
  };

  const copyTokenToClipboard = () => {
    if (remoteSessionToken) {
      navigator.clipboard.writeText(remoteSessionToken);
    }
  };

  const handleJoinRemote = async () => {
    try {
      setRemoteError('');
      await joinRemote(sessionToken, remoteParticipantName);
      setSessionToken('');
    } catch (error) {
      console.error('Failed to join:', error);
      setRemoteError(error instanceof Error ? error.message : 'Не удалось подключиться к совместной сессии');
    }
  };

  const handleCreatePreview = async (ownerOnly: boolean) => {
    try {
      setRemoteError('');
      await createRemotePreview(ownerOnly);
    } catch (error) {
      console.error('Failed to create preview:', error);
      setRemoteError(error instanceof Error ? error.message : 'Не удалось создать общий предпросмотр');
    }
  };

  const currentParticipants = remoteSessionState?.participants || [];
  const sessionPreviews = remoteSessionState?.previews || [];

  return (
    <div className="app">
      <div className="remote-controls">
        <div className="remote-controls-top">
          <select
            value={storeType}
            onChange={(e) => switchStore(e.target.value as 'default' | 'internal')}
          >
            <option value="default">Локальный режим</option>
            <option value="internal">Совместный режим</option>
          </select>

          {storeType === 'internal' && (
            <>
              <input
                type="text"
                className="participant-input"
                value={remoteParticipantName}
                onChange={(e) => setRemoteParticipantName(e.target.value)}
                placeholder="Ваше имя в сессии"
                maxLength={64}
              />
              {(isConnected || remoteConnectionStatus !== 'idle') && (
                <ConnectionStatusBadge
                  status={remoteConnectionStatus}
                  attempt={remoteReconnectAttempt}
                  maxAttempts={remoteReconnectMaxAttempts}
                  onRetry={() => void retryRemoteConnection().catch(console.error)}
                />
              )}
            </>
          )}
        </div>

        {storeType === 'internal' && (
          <div className="remote-lobby">
            {remoteError && (
              <div className="remote-error" role="alert">
                {remoteError}
              </div>
            )}
            <div className="remote-actions">
              {!isConnected && (
                <>
                  <button onClick={handleConnectRemote}>Создать сессию</button>
                  <div className="token-input">
                    <input
                      type="text"
                      placeholder="Токен для подключения"
                      value={sessionToken}
                      onChange={(e) => setSessionToken(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          void handleJoinRemote();
                        }
                      }}
                    />
                    <button onClick={() => void handleJoinRemote()}>
                      Подключиться по токену
                    </button>
                  </div>
                </>
              )}

              {isConnected && remoteSessionState && (
                <div className="session-card current-session">
                  <div className="session-card-header">
                    <div>
                      <strong>{remoteSessionState.projectName || 'Совместная сессия'}</strong>
                      <div className="session-token">
                        <span>{remoteSessionState.token}</span>
                        <button onClick={copyTokenToClipboard} className="copy-button">
                          Копировать токен
                        </button>
                      </div>
                    </div>
                    <div className="session-badges">
                      <span className="status-badge active">
                        Участников: {currentParticipants.length}
                      </span>
                    </div>
                  </div>

                  <div className="participants-panel">
                    <div className="participants-title">
                      Участники ({currentParticipants.length})
                    </div>
                    <div className="participants-list">
                      {currentParticipants.map((participant) => (
                        <div key={participant.id} className="participant-chip">
                          <span>{participant.name}</span>
                          {participant.isOwner && <span className="participant-role">создатель сессии</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="previews-panel">
                    <div className="participants-title">
                      Preview в этой сессии ({sessionPreviews.length})
                    </div>
                    {sessionPreviews.length === 0 ? (
                      <div className="sessions-empty">
                        Активных preview пока нет. Любой участник может запустить preview через кнопку «Предпросмотр».
                      </div>
                    ) : (
                      <div className="previews-list">
                        {sessionPreviews.map((preview) => (
                          <div key={preview.id} className="preview-card">
                            <div className="preview-card-main">
                              <strong>{preview.creatorName}</strong>
                              <span className="preview-card-meta">
                                {preview.ownerOnly ? 'Управляет только создатель' : 'Управляют все участники'}
                              </span>
                              <span className="preview-card-meta">
                                {preview.isRunning ? 'Диалог идет' : 'Диалог завершен или еще не начат'}
                              </span>
                            </div>
                            <button onClick={() => openRemotePreview(preview.id)}>
                              Открыть
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="session-footer">
                    <span className="session-owner">
                      Поделитесь токеном сессии, чтобы другие могли подключиться
                    </span>
                    <button onClick={handleDisconnect}>Отключиться</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Toolbar useStore={useStore} />

      <div className="app-content">
        <EditorWithEditor useStore={useStore} />
        {isSettingsOpen && <SettingsModal onClose={toggleSettings} useStore={useStore} />}
        {previewSetupPending && (
          <PreviewSetupModal
            onConfirm={(ownerOnly) => void handleCreatePreview(ownerOnly)}
            onCancel={() => useStore.setState({ previewSetupPending: false })}
          />
        )}
        {isPreviewMode && (
          <Preview
            onClose={() => {
              const state = useStore.getState();
              if (state.isConnected) {
                state.closeRemotePreview();
              } else {
                useStore.setState({ isPreviewMode: false });
              }
            }}
            useStore={useStore}
          />
        )}
      </div>
    </div>
  );
}

export default App;
