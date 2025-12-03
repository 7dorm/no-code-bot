import { create } from 'zustand';
import { BlockNode, Connection, Project, ConditionBlockData } from '../types';

interface EditorState {
  // Состояние проекта
  currentProject: Project | null;

  // История для undo/redo
  history: Project[];
  historyIndex: number;

  // UI состояние
  selectedNodeId: string | null;
  isSettingsOpen: boolean;
  isPreviewMode: boolean;

  // Actions
  createProject: (name: string) => void;
  updateProject: (updates: Partial<Project>) => void;
  addBlock: (block: BlockNode) => void;
  updateBlock: (id: string, updates: Partial<BlockNode>, saveToHistory?: boolean) => void;
  deleteBlock: (id: string) => void;
  addConnection: (connection: Connection) => void;
  deleteConnection: (id: string) => void;
  selectNode: (id: string | null) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;

  // Сохранение/загрузка
  exportProject: () => string;
  importProject: (json: string) => void;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
  migrateBlockData: (block: BlockNode) => BlockNode;

  // Settings
  toggleSettings: () => void;
  updateSettings: (settings: {
    exportPlatform?: string;
    botToken?: string;
    telegramToken?: string;
    globalConstants?: Record<string, any>
  }) => void;

  // Preview
  togglePreview: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  // Initial state
  currentProject: null,
  history: [],
  historyIndex: -1,
  selectedNodeId: null,
  isSettingsOpen: false,
  isPreviewMode: false,

  // Create new project
  createProject: (name: string) => {
    // Создаем автоматический START блок
    const startBlock: BlockNode = {
      id: 'start-block',
      type: 'blockNode',
      position: { x: 250, y: 100 },
      data: {
        type: 'start',
        label: 'Старт',
      },
    };

    const newProject: Project = {
      id: crypto.randomUUID(),
      name,
      blocks: [startBlock],
      connections: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({
      currentProject: newProject,
      history: [newProject],
      historyIndex: 0,
    });

    get().saveToLocalStorage();
  },

  // Update project
  updateProject: (updates: Partial<Project>) => {
    const current = get().currentProject;
    if (!current) return;

    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date(),
    };

    set({ currentProject: updated });
    get().saveToHistory();
    get().saveToLocalStorage();
  },

  // Add block
  addBlock: (block: BlockNode) => {
    const current = get().currentProject;
    if (!current) return;

    // Проверка лимита блоков (например, макс 100)
    if (current.blocks.length >= 100) {
      alert('Достигнут лимит блоков в проекте (макс. 100)');
      return;
    }

    const updated = {
      ...current,
      blocks: [...current.blocks, block],
      updatedAt: new Date(),
    };

    set({ currentProject: updated });
    get().saveToHistory();
    get().saveToLocalStorage();
  },

  // Update block
  updateBlock: (id: string, updates: Partial<BlockNode>, saveToHistory: boolean = true) => {
    const current = get().currentProject;
    if (!current) return;

    const updated = {
      ...current,
      blocks: current.blocks.map(block =>
        block.id === id ? { ...block, ...updates } : block
      ),
      updatedAt: new Date(),
    };

    set({ currentProject: updated });

    // Сохраняем в историю только если явно указано (для значимых изменений)
    if (saveToHistory) {
      get().saveToHistory();
    }
    get().saveToLocalStorage();
  },

  // Delete block
  deleteBlock: (id: string) => {
    const current = get().currentProject;
    if (!current) return;

    if (!confirm('Удалить этот блок?')) return;

    const updated = {
      ...current,
      blocks: current.blocks.filter(b => b.id !== id),
      connections: current.connections.filter(
        c => c.source !== id && c.target !== id
      ),
      updatedAt: new Date(),
    };

    set({ currentProject: updated, selectedNodeId: null });
    get().saveToHistory();
    get().saveToLocalStorage();
  },

  // Add connection
  addConnection: (connection: Connection) => {
    const current = get().currentProject;
    if (!current) return;

    const existing = current.connections.find(c => c.source === connection.source);

    // Если уже есть соединение от этого блока, удаляем старое (кроме condition блоков)
    const sourceBlock = current.blocks.find(b => b.id === connection.source);
    if (existing && sourceBlock?.data.type !== 'condition') {
      const filtered = current.connections.filter(c => c.id !== existing.id);

      const updated = {
        ...current,
        connections: [...filtered, connection],
        updatedAt: new Date(),
      };

      set({ currentProject: updated });
    } else {
      const updated = {
        ...current,
        connections: [...current.connections, connection],
        updatedAt: new Date(),
      };

      set({ currentProject: updated });
    }

    get().saveToHistory();
    get().saveToLocalStorage();
  },

  // Delete connection
  deleteConnection: (id: string) => {
    const current = get().currentProject;
    if (!current) return;

    const updated = {
      ...current,
      connections: current.connections.filter(c => c.id !== id),
      updatedAt: new Date(),
    };

    set({ currentProject: updated });
    get().saveToHistory();
    get().saveToLocalStorage();
  },

  // Select node
  selectNode: (id: string | null) => {
    set({ selectedNodeId: id });
  },

  // Undo
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({
        currentProject: history[newIndex],
        historyIndex: newIndex,
      });
      get().saveToLocalStorage();
    }
  },

  // Redo
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({
        currentProject: history[newIndex],
        historyIndex: newIndex,
      });
      get().saveToLocalStorage();
    }
  },

  // Save to history
  saveToHistory: () => {
    const { currentProject, history, historyIndex } = get();
    if (!currentProject) return;

    // Ограничиваем историю 50 состояниями
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(currentProject)));

    set({
      history: newHistory.slice(-50),
      historyIndex: newHistory.length - 1,
    });
  },

  // Export project
  exportProject: () => {
    const current = get().currentProject;
    if (!current) return '';
    return JSON.stringify(current, null, 2);
  },

  // Миграция старых блоков с params в новые типизированные интерфейсы
  migrateBlockData: (block: BlockNode): BlockNode => {
    // Если блок уже использует новый формат (нет params или params пустой), возвращаем как есть
    if (!(block.data as any).params || Object.keys((block.data as any).params || {}).length === 0) {
      return block;
    }

    const oldParams = (block.data as any).params || {};
    const blockType = block.data.type;

    // Миграция каждого типа блока
    let newData: any = { ...block.data };

    switch (blockType) {
      case 'message':
        newData = {
          type: 'message',
          label: block.data.label,
          text: oldParams.text || '',
        };
        break;
      case 'condition':
        // Проверяем, есть ли старый формат с одним условием
        if ((block.data as any).condition) {
          // Миграция из старого формата с одним условием
          newData = {
            type: 'condition',
            label: block.data.label,
            conditions: [{ condition: (block.data as any).condition || '' }],
            hasDefault: false,
          };
        } else if (oldParams.condition) {
          // Миграция из params
          newData = {
            type: 'condition',
            label: block.data.label,
            conditions: [{ condition: oldParams.condition || '' }],
            hasDefault: false,
          };
        } else {
          // Уже новый формат
          newData = {
            type: 'condition',
            label: block.data.label,
            conditions: (block.data as ConditionBlockData).conditions || [{ condition: '' }],
            hasDefault: (block.data as ConditionBlockData).hasDefault || false,
          };
        }
        break;
      case 'variable':
        newData = {
          type: 'variable',
          label: block.data.label,
          variableName: oldParams.variableName || '',
          value: oldParams.value || '',
        };
        break;
      case 'api':
        newData = {
          type: 'api',
          label: block.data.label,
          url: oldParams.url || '',
          method: (oldParams.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
          headers: oldParams.headers,
          body: oldParams.body,
        };
        break;
      case 'file':
        newData = {
          type: 'file',
          label: block.data.label,
          action: (oldParams.action || 'upload') as 'upload' | 'download' | 'delete' | 'read',
          fileName: oldParams.fileName,
          filePath: oldParams.filePath,
        };
        break;
      case 'end':
        newData = {
          type: 'end',
          label: block.data.label,
          message: oldParams.message || '',
        };
        break;
      case 'start':
        // start не требует миграции, просто удаляем params
        newData = {
          type: 'start',
          label: block.data.label,
        };
        break;
      default:
        // Если тип неизвестен, оставляем как есть
        break;
    }

    return {
      ...block,
      data: newData,
    };
  },

  // Import project
  importProject: (json: string) => {
    try {
      const project: Project = JSON.parse(json);

      // Валидация
      if (!project.blocks || !project.connections) {
        alert('Неверный формат файла проекта');
        return;
      }

      // Миграция блоков из старого формата в новый
      const migratedBlocks = project.blocks.map(block => get().migrateBlockData(block));
      const migratedProject = {
        ...project,
        blocks: migratedBlocks,
      };

      set({
        currentProject: migratedProject,
        history: [migratedProject],
        historyIndex: 0,
      });

      get().saveToLocalStorage();
      alert('Проект успешно загружен');
    } catch (e) {
      alert('Ошибка при загрузке проекта');
      console.error(e);
    }
  },

  // Save to localStorage
  saveToLocalStorage: () => {
    const current = get().currentProject;
    if (current) {
      localStorage.setItem('visual-chatbot-editor-current', JSON.stringify(current));
    }
  },

  // Load from localStorage
  loadFromLocalStorage: () => {
    const saved = localStorage.getItem('visual-chatbot-editor-current');
    if (saved) {
      try {
        const project: Project = JSON.parse(saved);
        // Миграция блоков из старого формата в новый
        const migratedBlocks = project.blocks.map(block => get().migrateBlockData(block));
        const migratedProject = {
          ...project,
          blocks: migratedBlocks,
        };
        set({
          currentProject: migratedProject,
          history: [migratedProject],
          historyIndex: 0,
        });
      } catch (e) {
        console.error('Ошибка загрузки из localStorage:', e);
      }
    }
  },

  // Toggle settings
  toggleSettings: () => {
    set(state => ({ isSettingsOpen: !state.isSettingsOpen }));
  },

  // Update settings
  updateSettings: (settings) => {
    const current = get().currentProject;
    if (!current) return;

    // Объединяем настройки, поддерживая обратную совместимость
    const updated = {
      ...current,
      ...settings,
      // Если установлен botToken и нет exportPlatform, используем старый telegramToken для совместимости
      ...(settings.botToken && !settings.exportPlatform && !current.exportPlatform
        ? { telegramToken: settings.botToken }
        : {}),
      updatedAt: new Date(),
    };

    // @ts-ignore
    set({ currentProject: updated });
    get().saveToLocalStorage();
  },

  // Toggle preview
  togglePreview: () => {
    set(state => ({ isPreviewMode: !state.isPreviewMode }));
  },
}));
