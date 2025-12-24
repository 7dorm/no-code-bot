import React, { useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { ExportPlatform } from '../../types';
import { createTelegramExport } from '../../utils/telegramExporter';
import { createWebExport } from '../../utils/webExporter';
import './ExportModal.css';
import { adaptProjectToEngine } from "../../utils/backend/projectAdapter.ts";
import JSZip from 'jszip';

interface ExportModalProps {
  onClose: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ onClose }) => {
  const { currentProject } = useEditorStore();
  const [exportType, setExportType] = useState<'messenger' | 'webpage' | 'nodejs'>('messenger');
  const [selectedPlatform, setSelectedPlatform] = useState<ExportPlatform>(
    currentProject?.exportPlatform || 'telegram'
  );

  const handleExport = async () => {
    if (!currentProject) return;

    if (exportType === 'messenger') {
      
      try {
        const { files } = createTelegramExport(currentProject);

        
        const zip = new JSZip();

        
        files.forEach(file => {
          zip.file(file.name, file.content);
        });

        
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        
        const zipUrl = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = zipUrl;
        a.download = `${currentProject.name.replace(/[^a-zA-Z0-9]/g, '_')}_telegram_bot.zip`;
        a.click();
        URL.revokeObjectURL(zipUrl);

        onClose();
        alert('ZIP архив с Telegram ботом успешно создан и скачан!');
      } catch (e) {
        alert('Ошибка экспорта кода. Проверьте настройки токена в проекте.');
      }
    } else if (exportType === 'webpage') {
      
      try {
        const { files } = createWebExport(currentProject);

        
        const zip = new JSZip();

        
        files.forEach(file => {
          zip.file(file.name, file.content);
        });

        
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        
        const zipUrl = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = zipUrl;
        a.download = `${currentProject.name.replace(/[^a-zA-Z0-9]/g, '_')}_web_bot.zip`;
        a.click();
        URL.revokeObjectURL(zipUrl);

        onClose();
        alert('ZIP архив с веб-ботом успешно создан и скачан!');
      } catch (e) {
        alert('Ошибка экспорта веб-приложения.');
      }
    } else {
      
      const json = JSON.stringify(adaptProjectToEngine(currentProject), null, );
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
          <h>📦 Экспорт проекта</h>
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
                  onChange={(e) => setExportType(e.target.value as 'messenger' | 'webpage' | 'nodejs')}
                />
                <span>Мессенджер (Telegram/WhatsApp)</span>
              </label>
              <label className="export-option">
                <input
                  type="radio"
                  name="exportType"
                  value="webpage"
                  checked={exportType === 'webpage'}
                  onChange={(e) => setExportType(e.target.value as 'webpage')}
                />
                <span>Веб-страница (HTML/CSS/JS)</span>
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

