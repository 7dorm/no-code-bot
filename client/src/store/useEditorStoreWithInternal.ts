import { create } from 'zustand';
import { applyPatch } from 'fast-json-patch';
import { BlockNode, Connection, Project } from '../types';
import {
  RemoteEditorClient,
  type JsonPatch,
  type RemoteConfigSnapshot,
  type RemoteSessionState,
  type RemoteSessionSummary,
  type SharedPreviewState,
} from '../client/RemoteEditorClient';
import { useEditorStore, type EditorState } from './useEditorStore';

function normalizeProjectDates(project: Project): Project {
  return {
    ...project,
    createdAt: new Date(project.createdAt),
    updatedAt: new Date(project.updatedAt),
  };
}

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

  return normalizeProjectDates(candidate as unknown as Project);
}

function toProjectFromPatch(current: Project, patch: JsonPatch): Project {
  const cloned = JSON.parse(JSON.stringify(current)) as Project;
  const updated = applyPatch(cloned, patch as any).newDocument as Project;
  return normalizeProjectDates(updated);
}

function toSessionSummary(state: RemoteSessionState): RemoteSessionSummary {
  return {
    token: state.token,
    projectName: state.projectName,
    ownerName: state.ownerName,
    participantsCount: state.participantsCount,
    previewActive: state.preview.active,
    updatedAt: state.updatedAt || new Date().toISOString(),
  };
}

function mergeSessionSummary(
  sessions: RemoteSessionSummary[],
  summary: RemoteSessionSummary,
): RemoteSessionSummary[] {
  const next = sessions.filter((item) => item.token !== summary.token);
  next.unshift(summary);
  return next;
}

function normalizeParticipantName(name?: string): string {
  const trimmed = name?.trim();
  return trimmed || 'Участник';
}

type BoundSet = (updater: (state: EditorState) => EditorState) => void;

function bindClient(
  client: RemoteEditorClient,
  set: BoundSet,
  get: () => EditorState,
) {
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

    set((state) => ({
      ...state,
      currentProject: remoteProject,
      selectedNodeId: null,
    }));

    get().saveToLocalStorage();
  });

  client.onPatch((patch) => {
    const current = useEditorStore.getState().currentProject;
    if (!current) {
      return;
    }

    try {
      const updated = toProjectFromPatch(current, patch);
      useEditorStore.setState({ currentProject: updated });
      set((state) => ({
        ...state,
        currentProject: updated,
      }));
      get().saveToHistory();
      get().saveToLocalStorage();
    } catch (error) {
      console.error('Failed to apply remote patch:', error);
    }
  });

  client.onSessionState((sessionState) => {
    set((state) => ({
      ...state,
      remoteSessionToken: sessionState.token,
      remoteSessionState: sessionState,
      remoteSessions: mergeSessionSummary(state.remoteSessions, toSessionSummary(sessionState)),
    }));
  });

  client.onConnect(() => {
    set((state) => ({
      ...state,
      isConnected: true,
    }));
  });

  client.onDisconnect(() => {
    set((state) => ({
      ...state,
      isConnected: false,
    }));
  });
}

export const useEditorStoreWithInternal = create<EditorState>((set, get) => ({
  currentProject: useEditorStore.getState().currentProject,
  history: [],
  historyIndex: -1,
  selectedNodeId: null,
  isSettingsOpen: false,
  isPreviewMode: false,

  remoteClient: null,
  isConnected: false,
  remoteSessionToken: null,
  remoteParticipantName: useEditorStore.getState().remoteParticipantName,
  remoteSessions: [],
  remoteSessionState: null,

  connectRemote: async (participantName?: string) => {
    const client = new RemoteEditorClient();
    const normalizedName = normalizeParticipantName(
      participantName || get().remoteParticipantName,
    );
    get().setRemoteParticipantName(normalizedName);

    bindClient(client, set, get);

    let currentProject = useEditorStore.getState().currentProject;
    if (!currentProject) {
      useEditorStore.getState().createProject('Новый проект');
      currentProject = useEditorStore.getState().currentProject;
    }

    if (!currentProject) {
      throw new Error('Failed to prepare project for collaborative session');
    }

    set((state) => ({
      ...state,
      currentProject,
    }));

    const token = await client.connect(currentProject, normalizedName);
    set((state) => ({
      ...state,
      remoteClient: client,
      remoteSessionToken: token,
    }));

    await get().refreshRemoteSessions();
    return token;
  },

  joinRemote: async (token: string, participantName?: string) => {
    const client = new RemoteEditorClient();
    const normalizedName = normalizeParticipantName(
      participantName || get().remoteParticipantName,
    );
    get().setRemoteParticipantName(normalizedName);

    bindClient(client, set, get);
    await client.join(token, normalizedName);

    set((state) => ({
      ...state,
      remoteClient: client,
      remoteSessionToken: token,
    }));

    await get().refreshRemoteSessions();
  },

  disconnectRemote: () => {
    const { remoteClient } = get();
    remoteClient?.disconnect();

    set((state) => ({
      ...state,
      remoteClient: null,
      isConnected: false,
      remoteSessionToken: null,
      remoteSessionState: null,
      isPreviewMode: false,
    }));

    void get().refreshRemoteSessions();
  },

  refreshRemoteSessions: async () => {
    try {
      const client = get().remoteClient ?? new RemoteEditorClient();
      const sessions = await client.listSessions();
      set((state) => ({
        ...state,
        remoteSessions: sessions,
      }));
    } catch (error) {
      console.error('Failed to refresh remote sessions:', error);
    }
  },

  setRemoteParticipantName: (name: string) => {
    const normalizedName = normalizeParticipantName(name);
    useEditorStore.getState().setRemoteParticipantName(normalizedName);
    set((state) => ({
      ...state,
      remoteParticipantName: normalizedName,
    }));
  },

  updateRemotePreviewState: (previewState: SharedPreviewState) => {
    const { remoteClient, remoteSessionState } = get();
    if (!remoteClient || !remoteSessionState?.isCurrentParticipantOwner) {
      return;
    }

    remoteClient.sendPreviewState(previewState);
    set((state) => ({
      ...state,
      remoteSessionState: state.remoteSessionState
        ? {
            ...state.remoteSessionState,
            preview: previewState,
          }
        : state.remoteSessionState,
    }));
  },

  createProject: (name: string) => {
    useEditorStore.getState().createProject(name);
    const syncedProject = useEditorStore.getState().currentProject;
    set((state) => ({
      ...state,
      currentProject: syncedProject,
    }));

    const { remoteClient } = get();
    if (remoteClient && syncedProject) {
      const patch: JsonPatch = [
        {
          op: 'add',
          path: '/',
          value: syncedProject,
        },
      ];
      remoteClient.sendPatch(patch);
    }
  },

  updateProject: (updates: Partial<Project>) => {
    const current = useEditorStore.getState().currentProject;
    if (!current) {
      return;
    }

    useEditorStore.getState().updateProject(updates);
    set((state) => ({
      ...state,
      currentProject: useEditorStore.getState().currentProject,
    }));

    const { remoteClient } = get();
    if (remoteClient) {
      const patch: JsonPatch = Object.keys(updates).map((key) => ({
        op: 'replace',
        path: `/${key}`,
        value: updates[key as keyof Project],
      }));
      remoteClient.sendPatch(patch);
    }
  },

  addBlock: (block: BlockNode) => {
    const current = useEditorStore.getState().currentProject;
    if (!current) {
      return;
    }

    useEditorStore.getState().addBlock(block);
    set((state) => ({
      ...state,
      currentProject: useEditorStore.getState().currentProject,
    }));

    const { remoteClient } = get();
    if (remoteClient) {
      remoteClient.sendPatch([
        {
          op: 'add',
          path: '/blocks/-',
          value: block,
        },
      ]);
    }
  },

  updateBlock: (id: string, updates: Partial<BlockNode>, saveToHistory?: boolean) => {
    const current = useEditorStore.getState().currentProject;
    if (!current) {
      return;
    }

    const blockIndex = current.blocks.findIndex((block) => block.id === id);
    if (blockIndex === -1) {
      return;
    }

    useEditorStore.getState().updateBlock(id, updates, saveToHistory);
    set((state) => ({
      ...state,
      currentProject: useEditorStore.getState().currentProject,
    }));

    const { remoteClient } = get();
    if (remoteClient) {
      const patch: JsonPatch = Object.keys(updates).map((key) => ({
        op: 'replace',
        path: `/blocks/${blockIndex}/${key}`,
        value: updates[key as keyof BlockNode],
      }));
      remoteClient.sendPatch(patch);
    }
  },

  deleteBlock: (id: string) => {
    const current = useEditorStore.getState().currentProject;
    if (!current) {
      return;
    }

    const blockIndex = current.blocks.findIndex((block) => block.id === id);
    if (blockIndex === -1) {
      return;
    }

    useEditorStore.getState().deleteBlock(id);
    set((state) => ({
      ...state,
      currentProject: useEditorStore.getState().currentProject,
      selectedNodeId: null,
    }));

    const { remoteClient } = get();
    if (remoteClient) {
      remoteClient.sendPatch([
        {
          op: 'remove',
          path: `/blocks/${blockIndex}`,
        },
      ]);
    }
  },

  addConnection: (connection: Connection) => {
    const current = useEditorStore.getState().currentProject;
    if (!current) {
      return;
    }

    useEditorStore.getState().addConnection(connection);
    set((state) => ({
      ...state,
      currentProject: useEditorStore.getState().currentProject,
    }));

    const { remoteClient } = get();
    if (remoteClient) {
      remoteClient.sendPatch([
        {
          op: 'add',
          path: '/connections/-',
          value: connection,
        },
      ]);
    }
  },

  deleteConnection: (id: string) => {
    const current = useEditorStore.getState().currentProject;
    if (!current) {
      return;
    }

    const connectionIndex = current.connections.findIndex((connection) => connection.id === id);
    if (connectionIndex === -1) {
      return;
    }

    useEditorStore.getState().deleteConnection(id);
    set((state) => ({
      ...state,
      currentProject: useEditorStore.getState().currentProject,
    }));

    const { remoteClient } = get();
    if (remoteClient) {
      remoteClient.sendPatch([
        {
          op: 'remove',
          path: `/connections/${connectionIndex}`,
        },
      ]);
    }
  },

  selectNode: (id: string | null) => {
    set((state) => ({
      ...state,
      selectedNodeId: id,
    }));
  },

  undo: () => {
    useEditorStore.getState().undo();
    set((state) => ({
      ...state,
      currentProject: useEditorStore.getState().currentProject,
    }));
  },

  redo: () => {
    useEditorStore.getState().redo();
    set((state) => ({
      ...state,
      currentProject: useEditorStore.getState().currentProject,
    }));
  },

  saveToHistory: () => {
    useEditorStore.getState().saveToHistory();
    const localState = useEditorStore.getState();
    set((state) => ({
      ...state,
      history: localState.history,
      historyIndex: localState.historyIndex,
    }));
  },

  exportProject: () => {
    return useEditorStore.getState().exportProject();
  },

  importProject: (json: string) => {
    useEditorStore.getState().importProject(json);
    set((state) => ({
      ...state,
      currentProject: useEditorStore.getState().currentProject,
    }));
  },

  saveToLocalStorage: () => {
    useEditorStore.getState().saveToLocalStorage();
  },

  loadFromLocalStorage: () => {
    useEditorStore.getState().loadFromLocalStorage();
    const localState = useEditorStore.getState();
    set((state) => ({
      ...state,
      currentProject: localState.currentProject,
      history: localState.history,
      historyIndex: localState.historyIndex,
      remoteParticipantName: localState.remoteParticipantName,
    }));
  },

  migrateBlockData: (block: BlockNode): BlockNode => {
    return useEditorStore.getState().migrateBlockData(block);
  },

  toggleSettings: () => {
    set((state) => ({
      ...state,
      isSettingsOpen: !state.isSettingsOpen,
    }));
  },

  updateSettings: (settings) => {
    const current = useEditorStore.getState().currentProject;
    if (!current) {
      return;
    }

    useEditorStore.getState().updateSettings(settings);
    set((state) => ({
      ...state,
      currentProject: useEditorStore.getState().currentProject,
    }));

    const { remoteClient } = get();
    if (remoteClient) {
      const patch: JsonPatch = Object.keys(settings).map((key) => ({
        op: 'replace',
        path: `/${key}`,
        value: settings[key as keyof typeof settings],
      }));
      remoteClient.sendPatch(patch);
    }
  },

  togglePreview: () => {
    set((state) => ({
      ...state,
      isPreviewMode: !state.isPreviewMode,
    }));
  },
}));
