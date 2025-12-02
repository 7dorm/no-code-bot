import React from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { createTelegramExport } from '../../utils/telegramExporter';
import './Toolbar.css';

const Toolbar: React.FC = () => {
  const {
    currentProject,
    createProject,
    exportProject,
    importProject,
    undo,
    redo,
    toggleSettings,
    togglePreview,
  } = useEditorStore();

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

  const handleExportCode = () => {
    if (!currentProject) return;
    try {
      const { code, instructions } = createTelegramExport(currentProject);

      // Скачиваем bot.js
      const codeBlob = new Blob([code], { type: 'text/javascript;charset=utf-8' });
      const codeUrl = URL.createObjectURL(codeBlob);
      const a1 = document.createElement('a');
      a1.href = codeUrl;
      a1.download = 'bot.js';
      a1.click();
      URL.revokeObjectURL(codeUrl);

      // Скачиваем README_TELEGRAM.md
      const readmeBlob = new Blob([instructions], { type: 'text/markdown;charset=utf-8' });
      const readmeUrl = URL.createObjectURL(readmeBlob);
      const a2 = document.createElement('a');
      a2.href = readmeUrl;
      a2.download = 'README_TELEGRAM.md';
      a2.click();
      URL.revokeObjectURL(readmeUrl);
    } catch (e) {
      alert('Ошибка экспорта кода. Проверьте настройки токена в проекте.');
      console.error(e);
    }
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
        <span className="project-name">{currentProject?.name || 'Нет проекта'}</span>
      </div>

      <div className="toolbar-right">
        <button className="toolbar-btn" onClick={undo}>
          ↶ Отменить
        </button>
        <button className="toolbar-btn" onClick={redo}>
          ↷ Вернуть
        </button>
        <button className="toolbar-btn" onClick={toggleSettings}>
          ⚙️ Настройки
        </button>
        <button className="toolbar-btn preview-btn" onClick={togglePreview}>
          👁️ Предпросмотр
        </button>
        <button className="toolbar-btn" onClick={handleExportCode}>
          📦 Экспорт в код
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
