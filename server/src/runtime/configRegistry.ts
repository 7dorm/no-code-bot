import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ConfigSnapshot,
  EngineNode,
  ProjectConfig,
  RuntimeSummary,
} from './projectTypes';
import { adaptProjectToEngine } from './adaptProjectToEngine';
import { HeadlessUI } from './headlessUI';
import { HttpError } from './errors';
import {
  buildStarterProject,
  normalizeProject,
  unwrapProjectPayload,
} from './projectValidation';
import {
  applyPatchToProject,
  resolvePatchRequest,
} from './patching';

interface RuntimeRecord {
  engine: unknown;
  ui: HeadlessUI;
  engineNodes: EngineNode[];
  revision: number;
  compiledAt: Date;
}

export class ConfigRegistry {
  private readonly configs = new Map<string, ProjectConfig>();
  private readonly runtimes = new Map<string, RuntimeRecord>();

  async create(rawPayload: unknown): Promise<ConfigSnapshot> {
    const configId = randomUUID();
    const payload = unwrapProjectPayload(rawPayload);
    const basePayload =
      payload && typeof payload === 'object'
        ? payload
        : buildStarterProject();

    const project = normalizeProject(basePayload, {
      id: configId,
      fallbackName: `Project ${configId.slice(0, 8)}`,
      createStarterIfMissing: true,
    });

    const runtime = await this.buildRuntime(project, 1);
    this.configs.set(configId, project);
    this.runtimes.set(configId, runtime);

    return this.toSnapshot(configId, project, runtime);
  }

  get(id: string): ConfigSnapshot {
    const project = this.configs.get(id);
    const runtime = this.runtimes.get(id);

    if (!project || !runtime) {
      throw new HttpError(404, `Config "${id}" was not found`);
    }

    return this.toSnapshot(id, project, runtime);
  }

  list(): Array<Omit<ConfigSnapshot, 'config'> & { name: string }> {
    return [...this.configs.entries()].map(([id, project]) => {
      const runtime = this.runtimes.get(id);
      if (!runtime) {
        throw new HttpError(500, `Runtime for config "${id}" is missing`);
      }

      return {
        id,
        name: project.name,
        revision: runtime.revision,
        runtime: this.toRuntimeSummary(project, runtime),
      };
    });
  }

  delete(id: string): { id: string; deleted: true } {
    const hasConfig = this.configs.delete(id);
    const hasRuntime = this.runtimes.delete(id);

    if (!hasConfig && !hasRuntime) {
      throw new HttpError(404, `Config "${id}" was not found`);
    }

    return { id, deleted: true };
  }

  async applyPatch(
    id: string,
    patchBody: unknown,
    contentType?: string,
  ): Promise<ConfigSnapshot> {
    const current = this.configs.get(id);
    const currentRuntime = this.runtimes.get(id);

    if (!current || !currentRuntime) {
      throw new HttpError(404, `Config "${id}" was not found`);
    }

    const patch = resolvePatchRequest(patchBody, contentType);
    const patchedPayload = applyPatchToProject(current, patch);
    const nextProject = normalizeProject(patchedPayload, {
      id,
      createdAt: current.createdAt,
      updatedAt: new Date(),
      fallbackName: current.name,
    });

    const nextRuntime = await this.buildRuntime(
      nextProject,
      currentRuntime.revision + 1,
    );
    this.configs.set(id, nextProject);
    this.runtimes.set(id, nextRuntime);

    return this.toSnapshot(id, nextProject, nextRuntime);
  }

  private async buildRuntime(
    project: ProjectConfig,
    revision: number,
  ): Promise<RuntimeRecord> {
    const engineNodes = adaptProjectToEngine(project);
    if (engineNodes.length === 0) {
      throw new HttpError(400, 'Config does not contain executable nodes');
    }

    const engineModulePath = pathToFileURL(
      resolve(__dirname, '../../../backend/Engine.js'),
    ).href;
    const engineModule = await import(engineModulePath);
    const EngineCtor = (
      (engineModule as { Engine?: unknown }).Engine ??
      (engineModule as { default?: { Engine?: unknown } }).default?.Engine ??
      (engineModule as { default?: unknown }).default
    ) as new (
      ui: HeadlessUI,
      botStructure: EngineNode[],
      globalConstants?: Record<string, unknown>,
    ) => unknown;
    const ui = new HeadlessUI();
    const engine = new EngineCtor(ui, engineNodes, project.globalConstants ?? {});

    return {
      engine,
      ui,
      engineNodes,
      revision,
      compiledAt: new Date(),
    };
  }

  private toSnapshot(
    id: string,
    project: ProjectConfig,
    runtime: RuntimeRecord,
  ): ConfigSnapshot {
    return {
      id,
      revision: runtime.revision,
      config: project,
      runtime: this.toRuntimeSummary(project, runtime),
    };
  }

  private toRuntimeSummary(
    project: ProjectConfig,
    runtime: RuntimeRecord,
  ): RuntimeSummary {
    return {
      status: 'ready',
      compiledAt: runtime.compiledAt,
      nodesCount: runtime.engineNodes.length,
      blockCount: project.blocks.length,
      connectionCount: project.connections.length,
    };
  }
}
