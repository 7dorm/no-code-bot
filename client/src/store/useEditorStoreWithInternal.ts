import { create } from 'zustand';
import { BlockNode, Connection, Project } from '../types';
import { useEditorStore, type EditorState } from './useEditorStore';
import { RemoteEditorClient, JsonPatch, RemoteConfigSnapshot } from '../client/RemoteEditorClient';
import { applyPatch } from 'fast-json-patch';

function toProjectFromSnapshot(snapshot: RemoteConfigSnapshot): Project | null {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const rawProject = snapshot.config ?? snapshot;
  if (!rawProject || typeof rawProject !== 'object') {
    return null;
  }

  const candidate = rawProject as Record<string, unknown>;
  if (!Array.isArray(candidate.blocks) || !Array.isArray(candidate.connections)) {
    return null;
  }

  return {
    ...(candidate as Project),
    createdAt: new Date(candidate.createdAt as string | number | Date),
    updatedAt: new Date(candidate.updatedAt as string | number | Date),
  };
}

export const useEditorStoreWithInternal = create<EditorState>((set, get) => ({

  currentProject: null,
  history: [],
  historyIndex: -1,
  selectedNodeId: null,
  isSettingsOpen: false,
  isPreviewMode: false,

  remoteClient: null,
  isConnected: false,

  connectRemote: async () => {
    const client = new RemoteEditorClient();
    let currentProject = useEditorStore.getState().currentProject;

    // Create a default project if none exists
    if (!currentProject) {
      useEditorStore.getState().createProject('New Project');
      currentProject = useEditorStore.getState().currentProject;
      console.log('Created default project', currentProject);
    }

    set({ currentProject });

    client.onConfig((snapshot) => {
      const remoteProject = toProjectFromSnapshot(snapshot);
      if (!remoteProject) {
        return;
      }

      useEditorStore.setState({
        currentProject: remoteProject,
        history: [remoteProject],
        historyIndex: 0,
      });
      set({ currentProject: remoteProject, selectedNodeId: null });
      get().saveToLocalStorage();
    });

    client.onPatch((patch: JsonPatch) => {
      const current = useEditorStore.getState().currentProject;
      if (!current) return;

      try {
        const updated = applyPatch(current, patch as any).newDocument;
        useEditorStore.setState({ currentProject: updated });
        set({ currentProject: updated });
        get().saveToHistory();
        get().saveToLocalStorage();
      } catch (error) {
        console.error('Failed to apply patch:', error);
      }
    });

    client.onConnect(() => {
      set({ isConnected: true });
    });

    client.onDisconnect(() => {
      set({ isConnected: false });
    });

    const token = await client.connect(currentProject);

    set({ remoteClient: client });
    return token;
  },

  joinRemote: async (token: string) => {
    const client = new RemoteEditorClient();

    client.onConfig((snapshot) => {
      const remoteProject = toProjectFromSnapshot(snapshot);
      if (!remoteProject) {
        return;
      }

      useEditorStore.setState({
        currentProject: remoteProject,
        history: [remoteProject],
        historyIndex: 0,
      });
      set({ currentProject: remoteProject, selectedNodeId: null });
      get().saveToLocalStorage();
    });

    client.onPatch((patch: JsonPatch) => {
      const current = useEditorStore.getState().currentProject;
      if (!current) return;

      try {
        const updated = applyPatch(current, patch as any).newDocument;
        useEditorStore.setState({ currentProject: updated });
        set({ currentProject: updated });
        get().saveToHistory();
        get().saveToLocalStorage();
      } catch (error) {
        console.error('Failed to apply patch:', error);
      }
    });

    client.onConnect(() => {
      set({ isConnected: true });
    });

    client.onDisconnect(() => {
      set({ isConnected: false });
    });

    await client.join(token);

    set({ remoteClient: client });
  },

  disconnectRemote: () => {
    const { remoteClient } = get();
    if (remoteClient) {
      remoteClient.disconnect();
      set({ remoteClient: null, isConnected: false });
    }
  },


  createProject: (name: string) => {
    useEditorStore.getState().createProject(name);
    const syncedProject = useEditorStore.getState().currentProject;
    set({ currentProject: syncedProject });

    const { remoteClient } = get();
    if (remoteClient && syncedProject) {
      const patch: JsonPatch = [
        {
          op: 'add',
          path: '/',
          value: syncedProject
        }
      ];
      remoteClient.sendPatch(patch);
    }
  },

  updateProject: (updates: Partial<Project>) => {
    const current = useEditorStore.getState().currentProject;
    if (!current) return;

    useEditorStore.getState().updateProject(updates);
    set({ currentProject: useEditorStore.getState().currentProject });

    const { remoteClient } = get();
    if (remoteClient) {
      const patch: JsonPatch = Object.keys(updates).map(key => ({
        op: 'replace',
        path: `/${key}`,
        value: updates[key as keyof Project]
      }));
      remoteClient.sendPatch(patch);
    }
  },

  addBlock: (block: BlockNode) => {
    const current = useEditorStore.getState().currentProject;
    if (!current) return;

    useEditorStore.getState().addBlock(block);
    set({ currentProject: useEditorStore.getState().currentProject });

    const { remoteClient } = get();
    if (remoteClient) {
      const patch: JsonPatch = [
        {
          op: 'add',
          path: '/blocks/-',
          value: block
        }
      ];
      remoteClient.sendPatch(patch);
    }
  },

  updateBlock: (id: string, updates: Partial<BlockNode>, saveToHistory?: boolean) => {
    const current = useEditorStore.getState().currentProject;
    if (!current) return;

    const blockIndex = current.blocks.findIndex(b => b.id === id);
    if (blockIndex === -1) return;

    useEditorStore.getState().updateBlock(id, updates, saveToHistory);
    set({ currentProject: useEditorStore.getState().currentProject });

    const { remoteClient } = get();
    if (remoteClient) {
      const patch: JsonPatch = Object.keys(updates).map(key => ({
        op: 'replace',
        path: `/blocks/${blockIndex}/${key}`,
        value: updates[key as keyof BlockNode]
      }));
      remoteClient.sendPatch(patch);
    }
  },

  deleteBlock: (id: string) => {
    const current = useEditorStore.getState().currentProject;
    if (!current) return;

    const blockIndex = current.blocks.findIndex(b => b.id === id);
    if (blockIndex === -1) return;

    useEditorStore.getState().deleteBlock(id);
    set({ currentProject: useEditorStore.getState().currentProject });

    const { remoteClient } = get();
    if (remoteClient) {
      const patch: JsonPatch = [
        {
          op: 'remove',
          path: `/blocks/${blockIndex}`
        }
      ];
      remoteClient.sendPatch(patch);
    }
  },

  addConnection: (connection: Connection) => {
    const current = useEditorStore.getState().currentProject;
    if (!current) return;

    useEditorStore.getState().addConnection(connection);
    set({ currentProject: useEditorStore.getState().currentProject });

    const { remoteClient } = get();
    if (remoteClient) {
      const patch: JsonPatch = [
        {
          op: 'add',
          path: '/connections/-',
          value: connection
        }
      ];
      remoteClient.sendPatch(patch);
    }
  },

  deleteConnection: (id: string) => {
    const current = useEditorStore.getState().currentProject;
    if (!current) return;

    const connIndex = current.connections.findIndex(c => c.id === id);
    if (connIndex === -1) return;

    useEditorStore.getState().deleteConnection(id);
    set({ currentProject: useEditorStore.getState().currentProject });

    const { remoteClient } = get();
    if (remoteClient) {
      const patch: JsonPatch = [
        {
          op: 'remove',
          path: `/connections/${connIndex}`
        }
      ];
      remoteClient.sendPatch(patch);
    }
  },

  selectNode: (id: string | null) => {
    useEditorStore.getState().selectNode(id);
    set({ selectedNodeId: id });

    const { remoteClient } = get();
    if (remoteClient) {
      const patch: JsonPatch = [
        {
          op: 'replace',
          path: '/selectedNodeId',
          value: id
        }
      ];
      remoteClient.sendPatch(patch);
    }
  },


  undo: () => {
    useEditorStore.getState().undo();
  },

  redo: () => {
    useEditorStore.getState().redo();
  },

  saveToHistory: () => {
    useEditorStore.getState().saveToHistory();
  },


  exportProject: () => {
    return useEditorStore.getState().exportProject();
  },

  importProject: (json: string) => {
    useEditorStore.getState().importProject(json);
    set({ currentProject: useEditorStore.getState().currentProject });
  },

  saveToLocalStorage: () => {
    useEditorStore.getState().saveToLocalStorage();
  },

  loadFromLocalStorage: () => {
    useEditorStore.getState().loadFromLocalStorage();
    set({ currentProject: useEditorStore.getState().currentProject });
  },

  migrateBlockData: (block: BlockNode): BlockNode => {
    return useEditorStore.getState().migrateBlockData(block);
  },


  toggleSettings: () => {
    useEditorStore.getState().toggleSettings();
  },

  updateSettings: (settings) => {
    const current = useEditorStore.getState().currentProject;
    if (!current) return;

    useEditorStore.getState().updateSettings(settings);
    set({ currentProject: useEditorStore.getState().currentProject });

    const { remoteClient } = get();
    if (remoteClient) {
      const patch: JsonPatch = Object.keys(settings).map(key => ({
        op: 'replace',
        path: `/${key}`,
        value: settings[key as keyof typeof settings],
      }));
      remoteClient.sendPatch(patch);
    }
  },


  togglePreview: () => {
    useEditorStore.getState().togglePreview();
  },
}));
