import {
  Operation,
  applyPatch as applyJsonPatch,
} from 'fast-json-patch';
import { HttpError } from './errors';
import { ProjectConfig } from './projectTypes';
import { serializeProject } from './projectValidation';

type PatchMode = 'json-patch' | 'merge-patch';

interface ResolvedPatch {
  mode: PatchMode;
  patch: Operation[] | Record<string, unknown>;
}

export function resolvePatchRequest(
  body: unknown,
  contentType?: string,
): ResolvedPatch {
  if (Array.isArray(body) || contentType === 'application/json-patch+json') {
    if (!Array.isArray(body)) {
      throw new HttpError(400, 'JSON Patch body must be an array of operations');
    }
    return {
      mode: 'json-patch',
      patch: body as Operation[],
    };
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Patch body must be an object or an array');
  }

  const raw = body as Record<string, unknown>;

  if (raw.format === 'json-patch') {
    if (!Array.isArray(raw.patch)) {
      throw new HttpError(400, 'format=json-patch requires patch array');
    }
    return {
      mode: 'json-patch',
      patch: raw.patch as Operation[],
    };
  }

  if (raw.format === 'merge-patch') {
    if (!isRecord(raw.patch)) {
      throw new HttpError(400, 'format=merge-patch requires patch object');
    }
    return {
      mode: 'merge-patch',
      patch: raw.patch,
    };
  }

  if (Array.isArray(raw.patch)) {
    return {
      mode: 'json-patch',
      patch: raw.patch as Operation[],
    };
  }

  if (isRecord(raw.patch)) {
    return {
      mode: 'merge-patch',
      patch: raw.patch,
    };
  }

  return {
    mode: 'merge-patch',
    patch: raw,
  };
}

export function applyPatchToProject(
  project: ProjectConfig,
  resolvedPatch: ResolvedPatch,
): unknown {
  const serializableProject = serializeProject(project);

  if (resolvedPatch.mode === 'json-patch') {
    try {
      const patched = applyJsonPatch(
        serializableProject as unknown as object,
        resolvedPatch.patch as Operation[],
        true,
        true,
        true,
      );
      return patched.newDocument;
    } catch (error: unknown) {
      throw new HttpError(
        400,
        'Failed to apply JSON Patch',
        error instanceof Error ? error.message : error,
      );
    }
  }

  return applyMergePatch(
    serializableProject as unknown as Record<string, unknown>,
    resolvedPatch.patch as Record<string, unknown>,
  );
}

function applyMergePatch(
  target: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result = deepClone(target);

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete result[key];
      continue;
    }

    if (isRecord(value) && isRecord(result[key])) {
      result[key] = applyMergePatch(
        result[key] as Record<string, unknown>,
        value,
      );
      continue;
    }

    result[key] = deepClone(value);
  }

  return result;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
