import React, { useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { ExportPlatform } from '../../types';
import { createTelegramExport } from '../../utils/telegramExporter';
import './ExportModal.css';
import {adaptProjectToEngine} from "../../utils/backend/projectAdapter.ts";

interface ExportModalProps {
  onClose: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ onClose }) => {
  const { currentProject } = useEditorStore();
  const [exportType, setExportType] = useState<'messenger' | 'nodejs'>('messenger');
  const [selectedPlatform, setSelectedPlatform] = useState<ExportPlatform>(
    currentProject?.exportPlatform || 'telegram'
  );

  const handleExport = () => {
    if (!currentProject) return;

    if (exportType === 'messenger') {
      // Экспорт для мессенджера
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

        // Скачиваем README.md
        const readmeBlob = new Blob([instructions], { type: 'text/markdown;charset=utf-8' });
        const readmeUrl = URL.createObjectURL(readmeBlob);
        const a2 = document.createElement('a');
        a2.href = readmeUrl;
        a2.download = 'README.md';
        a2.click();
        URL.revokeObjectURL(readmeUrl);

        onClose();
      } catch (e) {
        alert('Ошибка экспорта кода. Проверьте настройки токена в проекте.');
        console.error(e);
      }
    } else {
      // Экспорт Node.js проекта
      const json = JSON.stringify(adaptProjectToEngine(currentProject), null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentProject?.name || 'project'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      alert('Экспортированно!');
    }
  };

  return (
    <div className="export-overlay" onClick={onClose}>
      <div className="export-modal" onClick={e => e.stopPropagation()}>
        <div className="export-header">
          <h2>📦 Экспорт проекта</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="export-content">
          <div className="export-group">
            <label className="export-label">Тип экспорта</label>
            <div className="export-options">
              <label className="export-option">
                <input
                  type="radio"
                  name="exportType"
                  value="messenger"
                  checked={exportType === 'messenger'}
                  onChange={(e) => setExportType(e.target.value as 'messenger')}
                />
                <span>Мессенджер (Telegram/WhatsApp)</span>
              </label>
              <label className="export-option">
                <input
                  type="radio"
                  name="exportType"
                  value="nodejs"
                  checked={exportType === 'nodejs'}
                  onChange={(e) => setExportType(e.target.value as 'nodejs')}
                />
                <span>Node.js проект для веба</span>
              </label>
            </div>
          </div>

          {exportType === 'messenger' && (
            <div className="export-group">
              <label className="export-label">Платформа</label>
              <select
                className="export-select"
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value as ExportPlatform)}
              >
                <option value="telegram">Telegram</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
          )}

          <div className="export-footer">
            <button className="cancel-btn" onClick={onClose}>
              Отмена
            </button>
            <button className="export-btn" onClick={handleExport}>
              Экспортировать
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;

