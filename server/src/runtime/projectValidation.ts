import { randomUUID } from 'node:crypto';
import { HttpError } from './errors';
import {
  BlockData,
  BlockNodeConfig,
  ConnectionConfig,
  ProjectConfig,
  ProjectConfigPayload,
} from './projectTypes';

type JsonObject = Record<string, unknown>;

interface NormalizeProjectOptions {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
  fallbackName?: string;
  createStarterIfMissing?: boolean;
}

export function buildStarterProject(name = 'New project'): ProjectConfigPayload {
  return {
    id: randomUUID(),
    name,
    blocks: [createStartBlock()],
    connections: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeProject(
  input: unknown,
  options: NormalizeProjectOptions = {},
): ProjectConfig {
  const raw = asObject(input) ?? {};
  const now = new Date();
  const name = readOptionalString(raw.name) ?? options.fallbackName ?? 'Untitled project';

  let blocks = Array.isArray(raw.blocks)
    ? raw.blocks.map(normalizeBlock)
    : [];
  const connections = Array.isArray(raw.connections)
    ? raw.connections.map(normalizeConnection)
    : [];

  if (blocks.length === 0 && options.createStarterIfMissing) {
    blocks = [createStartBlock()];
  }

  if (blocks.length === 0) {
    throw new HttpError(400, 'Config must contain at least one block');
  }

  if (!blocks.some((block) => block.data.type === 'start')) {
    throw new HttpError(400, 'Config must contain a start block');
  }

  ensureUnique(blocks.map((block) => block.id), 'Duplicate block id detected');
  ensureUnique(
    connections.map((connection) => connection.id),
    'Duplicate connection id detected',
  );

  const blockIds = new Set(blocks.map((block) => block.id));
  for (const connection of connections) {
    if (!blockIds.has(connection.source) || !blockIds.has(connection.target)) {
      throw new HttpError(
        400,
        `Connection "${connection.id}" references missing blocks`,
      );
    }
  }

  const globalConstants = normalizeRecord(raw.globalConstants);
  const aiSettings = normalizeRecord(raw.aiSettings) as ProjectConfig['aiSettings'];
  const createdAt = options.createdAt ?? parseDate(raw.createdAt) ?? now;
  const updatedAt = options.updatedAt ?? parseDate(raw.updatedAt) ?? now;

  return {
    id: options.id ?? readOptionalString(raw.id) ?? randomUUID(),
    name,
    exportPlatform: normalizeExportPlatform(raw.exportPlatform),
    botToken: readOptionalString(raw.botToken),
    telegramToken: readOptionalString(raw.telegramToken),
    aiSettings,
    globalConstants,
    blocks,
    connections,
    createdAt,
    updatedAt,
  };
}

export function serializeProject(project: ProjectConfig): ProjectConfigPayload {
  return {
    ...project,
    blocks: project.blocks.map((block) => ({
      ...block,
      position: { ...block.position },
      data: cloneJsonValue(block.data) as BlockData,
    })),
    connections: project.connections.map((connection) => ({ ...connection })),
    globalConstants: project.globalConstants
      ? (cloneJsonValue(project.globalConstants) as Record<string, unknown>)
      : undefined,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export function unwrapProjectPayload(input: unknown): unknown {
  const raw = asObject(input);
  if (!raw) {
    return input;
  }

  const config = asObject(raw.config);
  if (config) {
    return {
      ...config,
      ...(typeof raw.name === 'string' && raw.name.trim() !== ''
        ? { name: raw.name.trim() }
        : {}),
    };
  }

  return input;
}

function normalizeBlock(input: unknown): BlockNodeConfig {
  const raw = asObject(input);
  if (!raw) {
    throw new HttpError(400, 'Block must be an object');
  }

  const dataRaw = asObject(raw.data);
  if (!dataRaw) {
    throw new HttpError(400, 'Block data must be an object');
  }

  const dataType = readOptionalString(dataRaw.type);
  if (!dataType) {
    throw new HttpError(400, 'Block data.type is required');
  }

  return {
    id: readRequiredString(raw.id, 'Block id is required'),
    type: readOptionalString(raw.type) ?? 'blockNode',
    position: normalizePosition(raw.position),
    data: {
      ...cloneJsonValue(dataRaw),
      type: dataType,
      label: readOptionalString(dataRaw.label) ?? dataType,
    } as BlockData,
  };
}

function normalizeConnection(input: unknown): ConnectionConfig {
  const raw = asObject(input);
  if (!raw) {
    throw new HttpError(400, 'Connection must be an object');
  }

  return {
    id: readRequiredString(raw.id, 'Connection id is required'),
    source: readRequiredString(raw.source, 'Connection source is required'),
    target: readRequiredString(raw.target, 'Connection target is required'),
    sourceHandle: readOptionalString(raw.sourceHandle),
    targetHandle: readOptionalString(raw.targetHandle),
    type: readOptionalString(raw.type),
  };
}

function normalizePosition(input: unknown) {
  const raw = asObject(input);
  if (!raw) {
    return { x: 0, y: 0 };
  }

  return {
    x: readNumber(raw.x, 0),
    y: readNumber(raw.y, 0),
  };
}

function normalizeRecord(input: unknown): Record<string, unknown> | undefined {
  const raw = asObject(input);
  if (!raw) {
    return undefined;
  }

  return cloneJsonValue(raw) as Record<string, unknown>;
}

function normalizeExportPlatform(value: unknown) {
  if (value === 'telegram' || value === 'whatsapp' || value === 'web') {
    return value;
  }
  return undefined;
}

function createStartBlock(): BlockNodeConfig {
  return {
    id: 'start-block',
    type: 'blockNode',
    position: { x: 250, y: 100 },
    data: {
      type: 'start',
      label: 'Старт',
    },
  };
}

function parseDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function ensureUnique(values: string[], message: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new HttpError(400, message);
    }
    seen.add(value);
  }
}

function readRequiredString(value: unknown, message: string): string {
  const normalized = readOptionalString(value);
  if (!normalized) {
    throw new HttpError(400, message);
  }
  return normalized;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asObject(value: unknown): JsonObject | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as JsonObject;
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
