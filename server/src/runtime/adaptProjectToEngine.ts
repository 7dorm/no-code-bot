import {
  EngineNode,
  ProjectConfig,
} from './projectTypes';

export function adaptProjectToEngine(project: ProjectConfig): EngineNode[] {
  const nodes: EngineNode[] = [];
  const connectionsMap = new Map<string, Map<string, string>>();

  for (const connection of project.connections) {
    if (!connectionsMap.has(connection.source)) {
      connectionsMap.set(connection.source, new Map<string, string>());
    }
    connectionsMap
      .get(connection.source)!
      .set(connection.sourceHandle ?? 'output', connection.target);
  }

  for (const block of project.blocks) {
    const engineNode: EngineNode = {
      id: block.id,
      Type: mapBlockTypeToEngine(block.data.type),
      Nexts: [],
    };

    const blockConnections = connectionsMap.get(block.id);
    const data = block.data as Record<string, unknown>;

    switch (block.data.type) {
      case 'message': {
        engineNode.Type = 'output';
        engineNode.Text = readString(data.text, '');

        const saveResponseToVariable = readString(data.saveResponseToVariable);
        if (saveResponseToVariable) {
          engineNode.VarName = saveResponseToVariable;
          engineNode.VarType = 'string';
        }

        const answers = readStringArray(data.answers);
        if (answers.length > 0) {
          engineNode.Answers = answers;
        } else {
          engineNode.AnswersFromVariable = readString(data.answersFromVariable);
          engineNode.AnswersPath = readString(data.answersPath);
        }

        pushSimpleNext(engineNode, blockConnections?.get('output'));
        break;
      }

      case 'condition': {
        engineNode.Type = 'condition';
        const conditions = normalizeConditions(data.conditions);
        engineNode.Cond = conditions
          .filter((entry) => entry.condition.toLowerCase() !== 'default')
          .map((entry) => entry.condition);

        for (const entry of conditions) {
          if (entry.condition.toLowerCase() === 'default') {
            continue;
          }
          engineNode.Nexts.push(
            blockConnections?.get(`output-${entry.index}`) ?? '',
          );
        }

        if (readBoolean(data.hasDefault, true)) {
          engineNode.Nexts.push(blockConnections?.get('output-default') ?? '');
        }
        break;
      }

      case 'variable': {
        engineNode.Type = 'variable';
        engineNode.VariableName = readString(data.variableName);
        engineNode.VariableValue = stringifyValue(data.value);

        if (readBoolean(data.saveNextInput, false)) {
          engineNode.SaveNextToVariable = readString(data.variableName);
        }

        pushSimpleNext(engineNode, blockConnections?.get('output'));
        break;
      }

      case 'start': {
        engineNode.Type = 'start';
        engineNode.skip = true;
        pushSimpleNext(engineNode, blockConnections?.get('output'));
        break;
      }

      case 'script': {
        engineNode.Type = 'script';
        engineNode.ScriptCode = readString(data.code, '');
        engineNode.ScriptReturnVariable = readString(data.returnVariable);
        pushSimpleNext(engineNode, blockConnections?.get('output'));
        break;
      }

      case 'api': {
        engineNode.Type = 'api';
        engineNode.ApiUrl = readString(data.url);
        engineNode.ApiMethod = readApiMethod(data.method);
        engineNode.ApiHeaders = normalizeHeaders(data.headers);
        engineNode.ApiBody = readString(data.body);
        engineNode.ApiResponseVariable = readString(data.responseVariable);
        engineNode.ApiAnswersPath = readString(data.answersPath);
        engineNode.ApiAnswersVariable = readString(data.answersVariable);
        pushSimpleNext(engineNode, blockConnections?.get('output'));
        break;
      }

      case 'file': {
        engineNode.Type = 'FILE';
        engineNode.FILEAct = mapFileAction(readString(data.action));
        engineNode.FileName = readString(data.fileName);
        engineNode.PathToFile = readString(data.filePath);
        engineNode.PathToSave = readString(data.filePath);
        pushSimpleNext(engineNode, blockConnections?.get('output'));
        break;
      }

      default: {
        engineNode.Type = mapBlockTypeToEngine(block.data.type);
        pushSimpleNext(engineNode, blockConnections?.get('output'));
      }
    }

    nodes.push(engineNode);
  }

  return nodes;
}

function pushSimpleNext(engineNode: EngineNode, nextTarget?: string) {
  if (!nextTarget) {
    return;
  }

  if (engineNode.Answers && engineNode.Answers.length > 0) {
    for (let index = 0; index < engineNode.Answers.length; index += 1) {
      engineNode.Nexts.push(nextTarget);
    }
    return;
  }

  engineNode.Nexts.push(nextTarget);
}

function normalizeConditions(value: unknown): Array<{ index: number; condition: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return [];
    }
    const condition = readString((entry as Record<string, unknown>).condition);
    if (!condition) {
      return [];
    }
    return [{ index, condition }];
  });
}

function normalizeHeaders(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const headers: Record<string, string> = {};
  for (const [key, headerValue] of Object.entries(value)) {
    if (typeof headerValue === 'string' && headerValue.trim() !== '') {
      headers[key] = headerValue;
    }
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}

function readString(value: unknown, fallback?: string): string | undefined {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed === '' ? fallback : trimmed;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function stringifyValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
}

function readApiMethod(
  value: unknown,
): 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | undefined {
  if (
    value === 'GET' ||
    value === 'POST' ||
    value === 'PUT' ||
    value === 'DELETE' ||
    value === 'PATCH'
  ) {
    return value;
  }
  return 'GET';
}

function mapFileAction(
  action?: string,
): 'Upload' | 'DownLoad' | 'Delete' | 'Read' {
  switch (action) {
    case 'download':
      return 'DownLoad';
    case 'delete':
      return 'Delete';
    case 'read':
      return 'Read';
    case 'upload':
    default:
      return 'Upload';
  }
}

function mapBlockTypeToEngine(
  blockType: string,
): 'output' | 'condition' | 'start' | 'variable' | 'api' | 'FILE' | 'skip' | 'script' {
  switch (blockType) {
    case 'message':
      return 'output';
    case 'condition':
      return 'condition';
    case 'start':
      return 'start';
    case 'variable':
      return 'variable';
    case 'api':
      return 'api';
    case 'file':
      return 'FILE';
    case 'script':
      return 'script';
    default:
      return 'skip';
  }
}
