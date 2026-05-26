import { useEffect, useState } from 'react';
import { useEditorStoreSwitcher } from './store/useEditorStoreSwitcher';
import EditorWithEditor from './components/Editor/EditorWithEditor';
import Toolbar from './components/Toolbar/Toolbar';
import SettingsModal from './components/Settings/SettingsModal';
import Preview from './components/Preview/Preview';
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
    remoteSessions,
    remoteSessionState,
    refreshRemoteSessions,
    setRemoteParticipantName,
  } = useStore();
  const [sessionToken, setSessionToken] = useState('');

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
    if (storeType !== 'internal') {
      return;
    }

    void refreshRemoteSessions();
    const timer = window.setInterval(() => {
      void refreshRemoteSessions();
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [storeType, refreshRemoteSessions]);

  
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
      await connectRemote(remoteParticipantName);
      await refreshRemoteSessions();
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const handleDisconnect = () => {
    disconnectRemote();
  };

  const copyTokenToClipboard = () => {
    if (remoteSessionToken) {
      navigator.clipboard.writeText(remoteSessionToken);
    }
  };

  const handleJoinRemote = async () => {
    try {
      await joinRemote(sessionToken, remoteParticipantName);
      setSessionToken('');
      await refreshRemoteSessions();
    } catch (error) {
      console.error('Failed to join:', error);
    }
  };

  const handleJoinListedSession = async (token: string) => {
    try {
      await joinRemote(token, remoteParticipantName);
      setSessionToken(token);
      await refreshRemoteSessions();
    } catch (error) {
      console.error('Failed to join listed session:', error);
    }
  };

  const currentParticipants = remoteSessionState?.participants || [];

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
              <button onClick={() => void refreshRemoteSessions()}>
                Обновить сессии
              </button>
            </>
          )}
        </div>

        {storeType === 'internal' && (
          <div className="remote-lobby">
            <div className="remote-actions">
              {!isConnected && (
                <>
                  <button onClick={handleConnectRemote}>Создать сессию</button>
                  <div className="token-input">
                    <input
                      type="text"
                      placeholder="Токен для ручного подключения"
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
                      <span className={`status-badge ${remoteSessionState.isCurrentParticipantOwner ? 'owner' : 'viewer'}`}>
                        {remoteSessionState.isCurrentParticipantOwner ? 'Owner preview' : 'Read only preview'}
                      </span>
                      <span className={`status-badge ${remoteSessionState.preview.active ? 'active' : 'idle'}`}>
                        {remoteSessionState.preview.active ? 'Preview активен' : 'Preview не запущен'}
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
                          {participant.isOwner && <span className="participant-role">owner</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="session-footer">
                    <span className="session-owner">
                      Владелец preview: {remoteSessionState.ownerName || 'не назначен'}
                    </span>
                    <button onClick={handleDisconnect}>Отключиться</button>
                  </div>
                </div>
              )}
            </div>

            {!isConnected && (
              <div className="sessions-grid">
                {remoteSessions.length === 0 ? (
                  <div className="sessions-empty">
                    Доступных сессий пока нет. Создай первую или обнови список.
                  </div>
                ) : (
                  remoteSessions.map((session) => (
                    <div key={session.token} className="session-card">
                      <div className="session-card-header">
                        <div>
                          <strong>{session.projectName || 'Без названия'}</strong>
                          <div className="session-token">{session.token}</div>
                        </div>
                        <span className={`status-badge ${session.previewActive ? 'active' : 'idle'}`}>
                          {session.previewActive ? 'Preview активен' : 'Preview idle'}
                        </span>
                      </div>

                      <div className="session-meta">
                        <span>Owner: {session.ownerName || 'неизвестно'}</span>
                        <span>Участников: {session.participantsCount}</span>
                      </div>

                      <button
                        onClick={() => {
                          setSessionToken(session.token);
                          void handleJoinListedSession(session.token);
                        }}
                      >
                        Подключиться
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      <Toolbar useStore={useStore} />

      <div className="app-content">
        <EditorWithEditor useStore={useStore} />
        {isSettingsOpen && <SettingsModal onClose={toggleSettings} useStore={useStore} />}
        {isPreviewMode && <Preview onClose={() => useStore.setState({ isPreviewMode: false })} useStore={useStore} />}
      </div>
    </div>
  );
}

export default App;
