import { create } from 'zustand';
import { applyPatch } from 'fast-json-patch';
import { BlockNode, Connection, Project } from '../types';
import {
  RemoteEditorClient,
  type JsonPatch,
  type RemoteConfigSnapshot,
  type RemotePreviewInstance,
  type RemoteSessionState,
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

function previewInstancesEqual(
  current: RemotePreviewInstance[] | undefined,
  next: RemotePreviewInstance[],
): boolean {
  if (!current) {
    return false;
  }

  if (current.length !== next.length) {
    return false;
  }

  return current.every((item, index) => {
    const candidate = next[index];
    return (
      item.id === candidate.id
      && item.active === candidate.active
      && item.isRunning === candidate.isRunning
      && item.waitingForInput === candidate.waitingForInput
      && item.waitingForFile === candidate.waitingForFile
      && item.requestedFileName === candidate.requestedFileName
    && item.activeAnswersMessageIndex === candidate.activeAnswersMessageIndex
    && item.controllerParticipantId === candidate.controllerParticipantId
    && JSON.stringify(item.messages) === JSON.stringify(candidate.messages)
    );
  });
}

function previewStateFromInstance(preview: RemotePreviewInstance): SharedPreviewState {
  return {
    id: preview.id,
    active: preview.active,
    ownerOnly: preview.ownerOnly,
    isRunning: preview.isRunning,
    waitingForInput: preview.waitingForInput,
    waitingForFile: preview.waitingForFile,
    requestedFileName: preview.requestedFileName,
    activeAnswersMessageIndex: preview.activeAnswersMessageIndex,
    messages: preview.messages,
    controllerParticipantId: preview.controllerParticipantId,
    controllerName: preview.controllerName,
    updatedAt: preview.updatedAt,
  };
}

function canControlPreview(
  preview: RemotePreviewInstance | undefined,
  participantId: string | undefined,
): boolean {
  if (!preview || !participantId) {
    return false;
  }

  if (!preview.ownerOnly) {
    return true;
  }

  return preview.creatorParticipantId === participantId;
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
    set((state) => {
      const previews = sessionState.previews || [];
      const activePreviewStillExists = !state.activePreviewId
        || previews.some((preview) => preview.id === state.activePreviewId);

      if (
        state.remoteSessionState
        && state.remoteSessionState.token === sessionState.token
        && previewInstancesEqual(state.remoteSessionState.previews, previews)
        && state.remoteSessionState.participantsCount === sessionState.participantsCount
        && state.remoteSessionState.isCurrentParticipantOwner === sessionState.isCurrentParticipantOwner
        && activePreviewStillExists
      ) {
        return state;
      }

      return {
        ...state,
        remoteSessionToken: sessionState.token,
        remoteSessionState: sessionState,
        activePreviewId: activePreviewStillExists ? state.activePreviewId : null,
        isPreviewMode: activePreviewStillExists ? state.isPreviewMode : false,
        previewSetupPending: activePreviewStillExists ? state.previewSetupPending : false,
      };
    });
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

  client.onConnectionStatus((info) => {
    set((state) => ({
      ...state,
      remoteConnectionStatus: info.status,
      remoteReconnectAttempt: info.attempt,
      remoteReconnectMaxAttempts: info.maxAttempts,
      isConnected: info.status === 'connected',
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
  remoteConnectionStatus: 'idle',
  remoteReconnectAttempt: 0,
  remoteReconnectMaxAttempts: 10,
  remoteSessionToken: null,
  remoteParticipantName: useEditorStore.getState().remoteParticipantName,
  remoteSessionState: null,
  activePreviewId: null,
  previewSetupPending: false,

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
  },

  disconnectRemote: () => {
    const { remoteClient, activePreviewId, remoteSessionState } = get();
    const preview = remoteSessionState?.previews.find((item) => item.id === activePreviewId);
    const participantId = remoteSessionState?.currentParticipantId;

    if (
      remoteClient
      && activePreviewId
      && preview
      && preview.creatorParticipantId === participantId
    ) {
      remoteClient.closePreview(activePreviewId);
    }
    remoteClient?.disconnect();

    set((state) => ({
      ...state,
      remoteClient: null,
      isConnected: false,
      remoteConnectionStatus: 'disconnected',
      remoteReconnectAttempt: 0,
      remoteSessionToken: null,
      remoteSessionState: null,
      activePreviewId: null,
      previewSetupPending: false,
      isPreviewMode: false,
    }));
  },

  retryRemoteConnection: async () => {
    const { remoteClient, remoteSessionToken, remoteParticipantName } = get();
    if (!remoteClient || !remoteSessionToken) {
      throw new Error('No remote session to reconnect');
    }

    await remoteClient.retryConnection();
    set((state) => ({
      ...state,
      remoteClient,
      remoteSessionToken,
      remoteParticipantName,
    }));
  },

  setRemoteParticipantName: (name: string) => {
    const normalizedName = normalizeParticipantName(name);
    useEditorStore.getState().setRemoteParticipantName(normalizedName);
    set((state) => ({
      ...state,
      remoteParticipantName: normalizedName,
    }));
  },

  createRemotePreview: async (ownerOnly: boolean) => {
    const { remoteClient } = get();
    if (!remoteClient) {
      throw new Error('Not connected to remote session');
    }

    const previewId = await remoteClient.createPreview(ownerOnly);
    set((state) => ({
      ...state,
      activePreviewId: previewId,
      previewSetupPending: false,
      isPreviewMode: true,
    }));
    return previewId;
  },

  openRemotePreview: (previewId: string) => {
    set((state) => ({
      ...state,
      activePreviewId: previewId,
      previewSetupPending: false,
      isPreviewMode: true,
    }));
  },

  closeRemotePreview: () => {
    const { remoteClient, activePreviewId, remoteSessionState } = get();
    const preview = remoteSessionState?.previews.find((item) => item.id === activePreviewId);
    const participantId = remoteSessionState?.currentParticipantId;

    if (
      remoteClient
      && activePreviewId
      && preview
      && preview.creatorParticipantId === participantId
    ) {
      remoteClient.closePreview(activePreviewId);
    }

    set((state) => ({
      ...state,
      activePreviewId: null,
      previewSetupPending: false,
      isPreviewMode: false,
    }));
  },

  requestPreviewSetup: () => {
    set((state) => ({
      ...state,
      previewSetupPending: true,
    }));
  },

  updateRemotePreviewState: (previewState: SharedPreviewState) => {
    const { remoteClient, remoteSessionState, activePreviewId } = get();
    if (!remoteClient || !remoteSessionState || !activePreviewId) {
      return;
    }

    const preview = remoteSessionState.previews.find((item) => item.id === activePreviewId);
    if (!canControlPreview(preview, remoteSessionState.currentParticipantId)) {
      return;
    }

    const participantId = remoteSessionState.currentParticipantId;
    if (preview && !preview.ownerOnly) {
      if (!preview.controllerParticipantId) {
        if (previewState.controllerParticipantId !== participantId) {
          return;
        }
      } else if (preview.controllerParticipantId !== participantId) {
        return;
      }
    }

    const currentState = preview ? previewStateFromInstance(preview) : undefined;
    if (currentState && JSON.stringify(currentState) === JSON.stringify(previewState)) {
      return;
    }

    remoteClient.sendPreviewState(activePreviewId, previewState);
  },

  submitRemotePreviewInput: (inputType: 'text' | 'file' | 'restart', value: string) => {
    const { remoteClient, activePreviewId } = get();
    if (!remoteClient || !activePreviewId) {
      return;
    }

    remoteClient.sendPreviewInput(activePreviewId, inputType, value);
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
    const { isConnected, isPreviewMode } = get();
    if (isConnected) {
      if (isPreviewMode) {
        get().closeRemotePreview();
        return;
      }
      get().requestPreviewSetup();
      return;
    }

    set((state) => ({
      ...state,
      isPreviewMode: !state.isPreviewMode,
    }));
  },
}));
