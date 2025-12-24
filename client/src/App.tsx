import React, { useEffect } from 'react';
import { useEditorStore } from './store/useEditorStore';
import EditorWithEditor from './components/Editor/EditorWithEditor';
import Toolbar from './components/Toolbar/Toolbar';
import SettingsModal from './components/Settings/SettingsModal';
import Preview from './components/Preview/Preview';
import './App.css';

function App() {
  const {
    currentProject,
    isSettingsOpen,
    isPreviewMode,
    loadFromLocalStorage,
    toggleSettings,
    createProject,
    undo,
    redo,
  } = useEditorStore();

  useEffect(() => {
    loadFromLocalStorage();
    
    
    if (!currentProject) {
      createProject('Новый проект');
    }
  }, []);

  
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

  return (
    <div className="app">
      <Toolbar />
      
      <div className="app-content">
        <EditorWithEditor />
        {isSettingsOpen && <SettingsModal onClose={toggleSettings} />}
        {isPreviewMode && <Preview onClose={() => useEditorStore.setState({ isPreviewMode: false })} />}
      </div>
    </div>
  );
}

export default App;
