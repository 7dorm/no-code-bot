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
  } = useStore();

  const [sessionToken, setSessionToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [createdSessionToken, setCreatedSessionToken] = useState<string | null>(null);

  useEffect(() => {
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  useEffect(() => {
    if (!currentProject) {
      createProject('Новый проект');
    }
  }, [currentProject, createProject]);


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
      const token = await connectRemote();
      setCreatedSessionToken(token);
      console.log('Connected to remote session:', token);
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const handleDisconnect = () => {
    disconnectRemote();
    setCreatedSessionToken(null);
  };

  const copyTokenToClipboard = () => {
    if (createdSessionToken) {
      navigator.clipboard.writeText(createdSessionToken);
    }
  };

  const handleJoinRemote = async () => {
    try {
      await joinRemote(sessionToken);
      console.log('Joined remote session');
      setSessionToken('');
      setShowTokenInput(false);
      setCreatedSessionToken(null);
    } catch (error) {
      console.error('Failed to join:', error);
    }
  };

  return (
    <div className="app">
      <div className="remote-controls">
        <select
          value={storeType}
          onChange={(e) => switchStore(e.target.value as 'default' | 'internal')}
        >
          <option value="default">Локальный режим</option>
          <option value="internal">Удаленный режим</option>
        </select>

        {storeType === 'internal' && (
          <>
            {!isConnected ? (
              <>
                <button onClick={handleConnectRemote}>Создать сессию</button>
                <button onClick={() => setShowTokenInput(!showTokenInput)}>
                  {showTokenInput ? 'Отмена' : 'Присоединиться'}
                </button>
                {showTokenInput && (
                  <div className="token-input">
                    <input
                      type="text"
                      placeholder="Токен сессии"
                      value={sessionToken}
                      onChange={(e) => setSessionToken(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleJoinRemote();
                      }}
                    />
                    <button onClick={handleJoinRemote}>Присоединиться</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <span className="status connected">✓ Подключено</span>
                <button onClick={handleDisconnect}>Отключиться</button>
                {createdSessionToken && (
                  <div className="created-token">
                    <span className="token-label">Токен сессии:</span>
                    <span className="token-value">{createdSessionToken}</span>
                    <button onClick={copyTokenToClipboard} className="copy-button">Копировать</button>
                  </div>
                )}
              </>
            )}
          </>
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
