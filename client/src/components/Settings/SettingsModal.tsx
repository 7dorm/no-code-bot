import React, { useState, useEffect } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import './SettingsModal.css';

interface SettingsModalProps {
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { currentProject, updateSettings } = useEditorStore();
  
  const [telegramToken, setTelegramToken] = useState(currentProject?.telegramToken || '');
  const [constants, setConstants] = useState<Array<{ key: string; value: string }>>(
    currentProject?.globalConstants
      ? Object.entries(currentProject.globalConstants).map(([k, v]) => ({ key: k, value: String(v) }))
      : []
  );

  const handleAddConstant = () => {
    setConstants([...constants, { key: '', value: '' }]);
  };

  const handleRemoveConstant = (index: number) => {
    setConstants(constants.filter((_, i) => i !== index));
  };

  const handleConstantChange = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...constants];
    updated[index][field] = value;
    setConstants(updated);
  };

  const handleApplyAndSave = () => {
    const globalConstants = constants.reduce((acc, { key, value }) => {
      if (key) acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    updateSettings({
      telegramToken,
      globalConstants,
    });
    
    onClose();
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ Настройки проекта</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-content">
          <div className="setting-group">
            <label className="setting-label">Telegram Bot Token</label>
            <input
              type="text"
              className="setting-input"
              placeholder="Введите токен вашего Telegram бота"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
            />
            <small className="setting-hint">
              Токен можно получить у @BotFather в Telegram
            </small>
          </div>

          <div className="setting-group">
            <div className="setting-group-header">
              <label className="setting-label">Глобальные константы</label>
              <button className="add-btn" onClick={handleAddConstant}>
                + Добавить
              </button>
            </div>

            {constants.length === 0 && (
              <div className="empty-state">
                Нет добавленных констант
              </div>
            )}

            {constants.map((constant, index) => (
              <div key={index} className="constant-item">
                <input
                  type="text"
                  placeholder="Имя переменной"
                  className="constant-key"
                  value={constant.key}
                  onChange={(e) => handleConstantChange(index, 'key', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Значение"
                  className="constant-value"
                  value={constant.value}
                  onChange={(e) => handleConstantChange(index, 'value', e.target.value)}
                />
                <button
                  className="remove-btn"
                  onClick={() => handleRemoveConstant(index)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="settings-footer">
            <button className="cancel-btn" onClick={onClose}>
              Отмена
            </button>
            <button className="apply-btn" onClick={handleApplyAndSave}>
              Применить и сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
