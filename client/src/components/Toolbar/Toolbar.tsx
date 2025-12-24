import React, { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import ExportModal from '../Export/ExportModal';
import './Toolbar.css';

const Toolbar: React.FC = () => {
  const {
    currentProject,
    createProject,
    exportProject,
    importProject,
    updateProject,
    undo,
    redo,
    toggleSettings,
    togglePreview,
  } = useEditorStore();

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  
  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  
  useEffect(() => {
    if (currentProject?.name) {
      setEditName(currentProject.name);
    }
  }, [currentProject?.name]);

  const handleNameClick = () => {
    if (currentProject) {
      setEditName(currentProject.name);
      setIsEditingName(true);
    }
  };

  const handleNameSubmit = () => {
    const trimmedName = editName.trim();
    if (trimmedName && trimmedName !== currentProject?.name) {
      updateProject({ name: trimmedName });
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setEditName(currentProject?.name || '');
      setIsEditingName(false);
    }
  };

  const handleNameBlur = () => {
    handleNameSubmit();
  };

  const handleSave = () => {
    const json = exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject?.name || 'project'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          importProject(content);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };


  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn" onClick={() => createProject('Новый проект')}>
          🆕 Создать
        </button>
        <button className="toolbar-btn" onClick={handleSave}>
          💾 Сохранить
        </button>
        <button className="toolbar-btn" onClick={handleLoad}>
          📁 Загрузить
        </button>
      </div>

      <div className="toolbar-center">
        {isEditingName ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            className="project-name-input"
            placeholder="Название проекта"
            maxLength={100}
          />
        ) : (
          <span
            className="project-name"
            onClick={handleNameClick}
            title="Нажмите для редактирования названия проекта"
          >
            {currentProject?.name || 'Нет проекта'}
          </span>
        )}
      </div>

      <div className="toolbar-right">
        <button className="toolbar-btn" onClick={undo}>
          ↶ Отменить
        </button>
        <button className="toolbar-btn" onClick={redo}>
          ↷ Вернуть
        </button>
        <button className="toolbar-btn" onClick={toggleSettings}>
           Настройки
        </button>
        <button className="toolbar-btn preview-btn" onClick={togglePreview}>
           Предпросмотр
        </button>
        <button className="toolbar-btn" onClick={() => setIsExportModalOpen(true)}>
          📦 Экспорт
        </button>
      </div>

      {isExportModalOpen && (
        <ExportModal onClose={() => setIsExportModalOpen(false)} />
      )}
    </div>
  );
};

export default Toolbar;
