import { useEffect, useState } from 'react';
import { useEditorStoreSwitcher } from './store/useEditorStoreSwitcher';
import EditorWithEditor from './components/Editor/EditorWithEditor';
import Toolbar from './components/Toolbar/Toolbar';
import SettingsModal from './components/Settings/SettingsModal';
import Preview from './components/Preview/Preview';
import PreviewSetupModal from './components/Preview/PreviewSetupModal';
import SessionManagerModal from './components/Session/SessionManagerModal';
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
  const [isSessionManagerOpen, setIsSessionManagerOpen] = useState(false);
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
        setRemoteError('');
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

  const copyTokenToClipboard = async () => {
    if (remoteSessionToken) {
      try {
        await navigator.clipboard.writeText(remoteSessionToken);
      } catch (error) {
        console.error('Failed to copy token:', error);
        setRemoteError('Не удалось скопировать токен');
      }
    }
  };

  const handleJoinRemote = async (token: string) => {
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setRemoteError('Введите токен сессии');
      return;
    }

    try {
      setRemoteError('');
      await joinRemote(trimmedToken, remoteParticipantName);
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
      setIsSessionManagerOpen(true);
    }
  };

  return (
    <div className="app">
      <Toolbar
        useStore={useStore}
        storeType={storeType}
        isRemoteConnected={isConnected}
        onOpenSessionManager={() => setIsSessionManagerOpen(true)}
      />

      <div className="app-content">
        <EditorWithEditor useStore={useStore} />
        {isSettingsOpen && <SettingsModal onClose={toggleSettings} useStore={useStore} />}
        {previewSetupPending && (
          <PreviewSetupModal
            onConfirm={(ownerOnly) => void handleCreatePreview(ownerOnly)}
            onCancel={() => useStore.setState({ previewSetupPending: false })}
          />
        )}
        {isSessionManagerOpen && (
          <SessionManagerModal
            currentProjectName={currentProject?.name}
            storeType={storeType}
            switchStore={switchStore}
            remoteError={remoteError}
            onClearRemoteError={() => setRemoteError('')}
            onClose={() => setIsSessionManagerOpen(false)}
            onConnectRemote={() => void handleConnectRemote()}
            onJoinRemote={(token) => void handleJoinRemote(token)}
            onDisconnectRemote={handleDisconnect}
            onCopyToken={() => void copyTokenToClipboard()}
            onOpenRemotePreview={openRemotePreview}
            isConnected={isConnected}
            remoteConnectionStatus={remoteConnectionStatus}
            remoteReconnectAttempt={remoteReconnectAttempt}
            remoteReconnectMaxAttempts={remoteReconnectMaxAttempts}
            remoteParticipantName={remoteParticipantName}
            remoteSessionState={remoteSessionState}
            remoteSessionToken={remoteSessionToken}
            retryRemoteConnection={() => void retryRemoteConnection().catch(console.error)}
            setRemoteParticipantName={setRemoteParticipantName}
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
