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
  } = useEditorStore();

  useEffect(() => {
    loadFromLocalStorage();
    
    // Проверяем, есть ли проект
    if (!currentProject) {
      createProject('Новый проект');
    }
  }, []);

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
