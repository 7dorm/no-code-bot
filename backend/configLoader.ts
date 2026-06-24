import { readFileSync } from "node:fs";
import { EngineNode } from "./Engine";

type JsonRecord = Record<string, any>;

interface LoadedBotConfig {
  nodes: EngineNode[];
  globalConstants: Record<string, any>;
}

export function loadBotConfig(path: string): LoadedBotConfig {
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw);
  return normalizeBotConfig(parsed);
}

export function normalizeBotConfig(config: unknown): LoadedBotConfig {
  if (Array.isArray(config)) {
    return {
      nodes: config as EngineNode[],
      globalConstants: {},
    };
  }

  if (!isRecord(config) || !Array.isArray(config.blocks) || !Array.isArray(config.connections)) {
    throw new Error("Config must be an EngineNode[] or a project object with blocks and connections");
  }

  return {
    nodes: adaptProjectToEngine(config),
    globalConstants: isRecord(config.globalConstants) ? config.globalConstants : {},
  };
}

function adaptProjectToEngine(project: JsonRecord): EngineNode[] {
  const connectionsMap = new Map<string, Map<string, string>>();

  project.connections.forEach((connection: JsonRecord) => {
    if (!connectionsMap.has(connection.source)) {
      connectionsMap.set(connection.source, new Map());
    }
    connectionsMap
      .get(connection.source)!
      .set(connection.sourceHandle || "output", connection.target);
  });

  return project.blocks.map((block: JsonRecord) => {
    const data = block.data || {};
    const blockConnections = connectionsMap.get(block.id);
    const engineNode: EngineNode = {
      id: block.id,
      Type: mapBlockTypeToEngine(data.type),
      Nexts: [],
    };

    switch (data.type) {
      case "start": {
        engineNode.Type = "start";
        engineNode.skip = true;
        pushNext(engineNode, blockConnections?.get("output"));
        break;
      }
      case "message": {
        engineNode.Type = "output";
        engineNode.Text = data.text || "";
        if (data.saveResponseToVariable) {
          engineNode.VarName = data.saveResponseToVariable;
          engineNode.VarType = "string";
        }
        if (Array.isArray(data.answers) && data.answers.length > 0) {
          engineNode.Answers = data.answers;
          data.answers.forEach(() => pushNext(engineNode, blockConnections?.get("output")));
        } else {
          engineNode.AnswersFromVariable = data.answersFromVariable;
          engineNode.AnswersPath = data.answersPath;
          pushNext(engineNode, blockConnections?.get("output"));
        }
        break;
      }
      case "condition": {
        engineNode.Type = "condition";
        const conditions = Array.isArray(data.conditions) ? data.conditions : [];
        engineNode.Cond = conditions
          .map((condition: JsonRecord) => condition.condition)
          .filter((condition: string) => condition && condition.toLowerCase() !== "default");
        engineNode.Cond.forEach((_condition, index) => {
          pushNext(engineNode, blockConnections?.get(`output-${index}`));
        });
        if (data.hasDefault !== false) {
          pushNext(engineNode, blockConnections?.get("output-default"));
        }
        break;
      }
      case "variable": {
        engineNode.Type = "variable";
        engineNode.VariableName = data.variableName;
        engineNode.VariableValue = data.value;
        if (data.saveNextInput) {
          engineNode.SaveNextToVariable = data.variableName;
        }
        pushNext(engineNode, blockConnections?.get("output"));
        break;
      }
      case "script": {
        engineNode.Type = "script";
        engineNode.ScriptCode = data.code || "";
        engineNode.ScriptReturnVariable = data.returnVariable;
        pushNext(engineNode, blockConnections?.get("output"));
        break;
      }
      case "api": {
        engineNode.Type = "api";
        engineNode.ApiUrl = data.url;
        engineNode.ApiMethod = data.method || "GET";
        engineNode.ApiHeaders = data.headers;
        engineNode.ApiBody = data.body;
        engineNode.ApiResponseVariable = data.responseVariable;
        engineNode.ApiAnswersPath = data.answersPath;
        engineNode.ApiAnswersVariable = data.answersVariable;
        pushNext(engineNode, blockConnections?.get("output"));
        break;
      }
      case "file": {
        engineNode.Type = "FILE";
        engineNode.FILEAct = mapFileAction(data.action);
        engineNode.FileName = data.fileName;
        engineNode.PathToFile = data.filePath;
        engineNode.PathToSave = data.filePath;
        pushNext(engineNode, blockConnections?.get("output"));
        break;
      }
      case "aiRouter": {
        engineNode.Type = "aiRouter";
        engineNode.AiSettings = project.aiSettings;
        engineNode.AiInputVariable = data.inputVariable;
        engineNode.AiInstruction = data.instruction;
        engineNode.AiContextMode = data.contextMode || project.aiSettings?.contextWindowMode || "last_message";
        engineNode.AiRoutes = data.routes || [];
        engineNode.AiFallbackRoute = data.fallbackRoute;
        engineNode.AiConfidenceThreshold = data.confidenceThreshold ?? project.aiSettings?.confidenceThreshold ?? 0.6;
        engineNode.AiConfidenceVariable = data.confidenceVariable;
        engineNode.AiReasonVariable = data.reasonVariable;
        engineNode.AiIntentVariable = data.saveNormalizedIntentTo;
        (data.routes || []).forEach((_route: JsonRecord, index: number) => {
          pushNext(engineNode, blockConnections?.get(`route-${index}`));
        });
        pushNext(engineNode, blockConnections?.get("fallback"));
        break;
      }
      case "aiExtractor": {
        engineNode.Type = "aiExtractor";
        engineNode.AiSettings = project.aiSettings;
        engineNode.AiInputVariable = data.inputVariable;
        engineNode.AiInstruction = data.instruction;
        engineNode.AiContextMode = data.contextMode || project.aiSettings?.contextWindowMode || "last_message";
        engineNode.AiEntities = data.entities || [];
        engineNode.AiAskMissing = data.askMissing ?? true;
        engineNode.AiRawResultVariable = data.rawResultVariable;
        pushNext(engineNode, blockConnections?.get("complete"));
        pushNext(engineNode, blockConnections?.get("missing"));
        break;
      }
      case "aiAssistant": {
        engineNode.Type = "aiAssistant";
        engineNode.AiSettings = project.aiSettings;
        engineNode.AiInputVariable = data.inputVariable;
        engineNode.AiInstruction = data.instruction;
        engineNode.AiContextMode = data.contextMode || project.aiSettings?.contextWindowMode || "last_n_messages";
        engineNode.AiRoutes = data.routes || [];
        engineNode.AiEntities = data.entities || [];
        engineNode.AiAskMissing = data.askMissing ?? true;
        engineNode.AiLoop = data.loop ?? true;
        engineNode.AiExitPhrases = data.exitPhrases || [];
        engineNode.AiConfidenceThreshold = data.confidenceThreshold ?? project.aiSettings?.confidenceThreshold ?? 0.6;
        engineNode.AiReplyVariable = data.replyVariable;
        engineNode.AiButtonsVariable = data.buttonsVariable;
        engineNode.AiRawResultVariable = data.rawResultVariable;
        engineNode.AiConfidenceVariable = data.confidenceVariable;
        engineNode.AiReasonVariable = data.reasonVariable;
        engineNode.AiIntentVariable = data.saveNormalizedIntentTo;
        engineNode.AiSpecialTopicVariable = data.specialTopicVariable;
        pushNext(engineNode, blockConnections?.get("task-complete"));
        pushNext(engineNode, blockConnections?.get("task-missing"));
        pushNext(engineNode, blockConnections?.get("chat"));
        break;
      }
      default:
        pushNext(engineNode, blockConnections?.get("output"));
    }

    return engineNode;
  });
}

function pushNext(engineNode: EngineNode, nextTarget?: string): void {
  if (nextTarget) {
    engineNode.Nexts.push(nextTarget);
  }
}

function mapBlockTypeToEngine(blockType: string): EngineNode["Type"] {
  switch (blockType) {
    case "message":
      return "output";
    case "condition":
      return "condition";
    case "start":
      return "start";
    case "variable":
      return "variable";
    case "api":
      return "api";
    case "file":
      return "FILE";
    case "script":
      return "script";
    case "aiRouter":
      return "aiRouter";
    case "aiExtractor":
      return "aiExtractor";
    case "aiAssistant":
      return "aiAssistant";
    default:
      return "skip";
  }
}

function mapFileAction(action?: string): "Upload" | "DownLoad" | "Delete" | "Read" {
  switch (action) {
    case "download":
      return "DownLoad";
    case "delete":
      return "Delete";
    case "read":
      return "Read";
    case "upload":
    default:
      return "Upload";
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
