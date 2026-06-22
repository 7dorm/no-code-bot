import React from 'react';
import './PreviewSetupModal.css';

interface PreviewSetupModalProps {
  onConfirm: (ownerOnly: boolean) => void;
  onCancel: () => void;
}

const PreviewSetupModal: React.FC<PreviewSetupModalProps> = ({ onConfirm, onCancel }) => {
  return (
    <div className="preview-setup-overlay" onClick={onCancel}>
      <div className="preview-setup-modal" onClick={(event) => event.stopPropagation()}>
        <h3>Запуск preview</h3>
        <p>Выберите, кто сможет управлять этим preview в сессии.</p>

        <div className="preview-setup-options">
          <button
            type="button"
            className="preview-setup-option"
            onClick={() => onConfirm(true)}
          >
            <strong>Только я</strong>
            <span>Управляет только создатель. При отключении создателя preview удалится.</span>
          </button>

          <button
            type="button"
            className="preview-setup-option"
            onClick={() => onConfirm(false)}
          >
            <strong>Все участники</strong>
            <span>Любой участник сессии может управлять этим preview.</span>
          </button>
        </div>

        <button type="button" className="preview-setup-cancel" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
};

export default PreviewSetupModal;
