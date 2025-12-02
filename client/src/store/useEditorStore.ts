import { create } from 'zustand';
import { BlockNode, Connection, Project } from '../types';

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
  updateBlock: (id: string, updates: Partial<BlockNode>) => void;
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
  
  // Settings
  toggleSettings: () => void;
  updateSettings: (settings: { telegramToken?: string; globalConstants?: Record<string, any> }) => void;
  
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
        params: {},
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
  updateBlock: (id: string, updates: Partial<BlockNode>) => {
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
    get().saveToHistory();
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
    if (existing && !current.blocks.find(b => b.id === connection.source)?.data.type?.includes('condition')) {
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

  // Import project
  importProject: (json: string) => {
    try {
      const project: Project = JSON.parse(json);
      
      // Валидация
      if (!project.blocks || !project.connections) {
        alert('Неверный формат файла проекта');
        return;
      }
      
      set({
        currentProject: project,
        history: [project],
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
        set({
          currentProject: project,
          history: [project],
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
    
    const updated = {
      ...current,
      ...settings,
      updatedAt: new Date(),
    };
    
    set({ currentProject: updated });
    get().saveToLocalStorage();
  },

  // Toggle preview
  togglePreview: () => {
    set(state => ({ isPreviewMode: !state.isPreviewMode }));
  },
}));
