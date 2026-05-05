import { create } from 'zustand';
import { BlockNode, Connection, Project, ConditionBlockData, AiSettings, ExportPlatform } from '../types';

interface EditorState {
  
  currentProject: Project | null;

  
  history: Project[];
  historyIndex: number;

  
  selectedNodeId: string | null;
  isSettingsOpen: boolean;
  isPreviewMode: boolean;

  
  createProject: (name: string) => void;
  updateProject: (updates: Partial<Project>) => void;
  addBlock: (block: BlockNode) => void;
  updateBlock: (id: string, updates: Partial<BlockNode>, saveToHistory?: boolean) => void;
  deleteBlock: (id: string) => void;
  addConnection: (connection: Connection) => void;
  deleteConnection: (id: string) => void;
  selectNode: (id: string | null) => void;

  
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;

  
  exportProject: () => string;
  importProject: (json: string) => void;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
  migrateBlockData: (block: BlockNode) => BlockNode;

  
  toggleSettings: () => void;
  updateSettings: (settings: {
    exportPlatform?: ExportPlatform;
    botToken?: string;
    telegramToken?: string;
    globalConstants?: Record<string, any>;
    aiSettings?: AiSettings;
  }) => void;

  
  togglePreview: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  
  currentProject: null,
  history: [],
  historyIndex: -1,
  selectedNodeId: null,
  isSettingsOpen: false,
  isPreviewMode: false,

  
  createProject: (name: string) => {
    
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

  
  addBlock: (block: BlockNode) => {
    const current = get().currentProject;
    if (!current) return;

    
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

    
    if (saveToHistory) {
      get().saveToHistory();
    }
    get().saveToLocalStorage();
  },

  
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

  
  addConnection: (connection: Connection) => {
    const current = get().currentProject;
    if (!current) return;

    const existing = current.connections.find(c => c.source === connection.source);

    
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

  
  selectNode: (id: string | null) => {
    set({ selectedNodeId: id });
  },

  
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

  
  saveToHistory: () => {
    const { currentProject, history, historyIndex } = get();
    if (!currentProject) return;

    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(currentProject)));
    const limitedHistory = newHistory.slice(-50);

    set({
      history: limitedHistory,
      historyIndex: limitedHistory.length - 1,
    });
  },

  
  exportProject: () => {
    const current = get().currentProject;
    if (!current) return '';
    return JSON.stringify(current, null, 2);
  },

  
  migrateBlockData: (block: BlockNode): BlockNode => {
    
    if (!(block.data as any).params || Object.keys((block.data as any).params || {}).length === 0) {
      return block;
    }

    const oldParams = (block.data as any).params || {};
    const blockType = block.data.type;

    
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
        
        if ((block.data as any).condition) {
          
          newData = {
            type: 'condition',
            label: block.data.label,
            conditions: [{ condition: (block.data as any).condition || '' }],
            hasDefault: false,
          };
        } else if (oldParams.condition) {
          
          newData = {
            type: 'condition',
            label: block.data.label,
            conditions: [{ condition: oldParams.condition || '' }],
            hasDefault: false,
          };
        } else {
          
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
      case 'script':
        newData = {
          type: 'script',
          label: block.data.label,
          code: oldParams.code || '',
          returnVariable: oldParams.returnVariable || '',
        };
        break;
      case 'aiRouter':
        newData = {
          type: 'aiRouter',
          label: block.data.label,
          inputVariable: oldParams.inputVariable || (block.data as any).inputVariable || 'lastMessage',
          instruction: oldParams.instruction || (block.data as any).instruction || '',
          routes: (block.data as any).routes || oldParams.routes || [],
          fallbackRoute: oldParams.fallbackRoute || (block.data as any).fallbackRoute,
          confidenceThreshold: oldParams.confidenceThreshold ?? (block.data as any).confidenceThreshold ?? 0.6,
          confidenceVariable: oldParams.confidenceVariable || (block.data as any).confidenceVariable,
          reasonVariable: oldParams.reasonVariable || (block.data as any).reasonVariable,
          saveNormalizedIntentTo: oldParams.saveNormalizedIntentTo || (block.data as any).saveNormalizedIntentTo || 'intent',
          contextMode: oldParams.contextMode || (block.data as any).contextMode || 'last_message',
        };
        break;
      case 'aiExtractor':
        newData = {
          type: 'aiExtractor',
          label: block.data.label,
          inputVariable: oldParams.inputVariable || (block.data as any).inputVariable || 'lastMessage',
          instruction: oldParams.instruction || (block.data as any).instruction || '',
          entities: (block.data as any).entities || oldParams.entities || [],
          askMissing: oldParams.askMissing ?? (block.data as any).askMissing ?? true,
          rawResultVariable: oldParams.rawResultVariable || (block.data as any).rawResultVariable,
          contextMode: oldParams.contextMode || (block.data as any).contextMode || 'last_message',
        };
        break;
      case 'start':
        
        newData = {
          type: 'start',
          label: block.data.label,
        };
        break;
      default:
        
        break;
    }

    return {
      ...block,
      data: newData,
    };
  },

  
  importProject: (json: string) => {
    try {
      const project: Project = JSON.parse(json);

      
      if (!project.blocks || !project.connections) {
        alert('Неверный формат файла проекта');
        return;
      }

      
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
    }
  },

  
  saveToLocalStorage: () => {
    const current = get().currentProject;
    if (current) {
      localStorage.setItem('visual-chatbot-editor-current', JSON.stringify(current));
    }
  },

  
  loadFromLocalStorage: () => {
    const saved = localStorage.getItem('visual-chatbot-editor-current');
    if (saved) {
      try {
        const project: Project = JSON.parse(saved);
        
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
        
      }
    }
  },

  
  toggleSettings: () => {
    set(state => ({ isSettingsOpen: !state.isSettingsOpen }));
  },

  
  updateSettings: (settings) => {
    const current = get().currentProject;
    if (!current) return;

    
    const updated = {
      ...current,
      ...settings,
      
      ...(settings.botToken && !settings.exportPlatform && !current.exportPlatform
        ? { telegramToken: settings.botToken }
        : {}),
      updatedAt: new Date(),
    };

    
    set({ currentProject: updated });
    get().saveToLocalStorage();
  },

  
  togglePreview: () => {
    set(state => ({ isPreviewMode: !state.isPreviewMode }));
  },
}));
