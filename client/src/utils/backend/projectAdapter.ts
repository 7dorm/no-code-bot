import { Project, BlockNode } from '../../types';
import { MessageBlockData, ConditionBlockData, VariableBlockData, ScriptBlockData, ApiBlockData, FileBlockData, AiRouterBlockData, AiExtractorBlockData, AiAssistantBlockData } from '../../types';
import { EngineNode } from '@backend/Engine';


export type { EngineNode };


export function adaptProjectToEngine(project: Project): EngineNode[] {
  const nodes: EngineNode[] = [];
  const blockMap = new Map<string, BlockNode>();

  
  project.blocks.forEach(block => {
    blockMap.set(block.id, block);
  });

  
  const connectionsMap = new Map<string, Map<string | undefined, string>>();

  project.connections.forEach(conn => {
    if (!connectionsMap.has(conn.source)) {
      connectionsMap.set(conn.source, new Map());
    }
    const sourceMap = connectionsMap.get(conn.source)!;
    sourceMap.set(conn.sourceHandle || 'output', conn.target);
  });

  
  project.blocks.forEach(block => {
    const engineNode: EngineNode = {
      id: block.id,
      Type: mapBlockTypeToEngine(block.data.type),
      Nexts: [],
    };

    
    const blockConnections = connectionsMap.get(block.id);

    
    switch (block.data.type) {
      case 'message': {
        const msgData = block.data as MessageBlockData;
        engineNode.Type = 'output';
        engineNode.Text = msgData.text || '';

        
        if (msgData.saveResponseToVariable) {
          engineNode.VarName = msgData.saveResponseToVariable;
          engineNode.VarType = 'string';
        }

        
        if (msgData.answers && msgData.answers.length > 0) {
          engineNode.Answers = msgData.answers;
        } else if (msgData.answersFromVariable) {
          
          engineNode.AnswersFromVariable = msgData.answersFromVariable;
          engineNode.AnswersPath = msgData.answersPath;
        }

        
        const nextTarget = blockConnections?.get('output');
        if (nextTarget) {
          
          
          if (engineNode.Answers && engineNode.Answers.length > 0) {
            engineNode.Answers.forEach(() => {
              engineNode.Nexts.push(nextTarget);
            });
          } else {
            engineNode.Nexts.push(nextTarget);
          }
        }
        break;
      }

      case 'condition': {
        const condData = block.data as ConditionBlockData;
        engineNode.Type = 'condition';
        const hasDefault = condData.hasDefault ?? true;

        
        if (condData.conditions && condData.conditions.length > 0) {
          
          const validConditions: Array<{ condition: string; originalIndex: number }> = [];
          condData.conditions.forEach((c, index) => {
            const condStr = c.condition;
            if (condStr && condStr.trim() !== '' && condStr.toLowerCase() !== 'default') {
              validConditions.push({ condition: condStr, originalIndex: index });
            }
          });

          
          engineNode.Cond = validConditions.map(vc => vc.condition);

          
          
          validConditions.forEach(vc => {
            const target = blockConnections?.get(`output-${vc.originalIndex}`);
            if (target) {
              engineNode.Nexts.push(target);
            } else {
              
              engineNode.Nexts.push('');
            }
          });
        } else {
          engineNode.Cond = [];
        }

        
        const defaultTarget = blockConnections?.get('output-default');
        if (hasDefault) {
          if (defaultTarget) {
            engineNode.Nexts.push(defaultTarget);
          } else {
            
            engineNode.Nexts.push('');
          }
        }
        break;
      }

      case 'variable': {
        const varData = block.data as VariableBlockData;
        engineNode.Type = 'variable';
        engineNode.VariableName = varData.variableName;
        engineNode.VariableValue = varData.value;
        
        
        if (varData.saveNextInput) {
          engineNode.SaveNextToVariable = varData.variableName;
        }

        
        const nextTarget = blockConnections?.get('output');
        if (nextTarget) {
          engineNode.Nexts.push(nextTarget);
        }
        break;
      }

      case 'start': {
        engineNode.Type = 'start';
        
        engineNode.skip = true;

        
        const nextTarget = blockConnections?.get('output');
        if (nextTarget) {
          engineNode.Nexts.push(nextTarget);
        }
        break;
      }

      case 'script': {
        const scriptData = block.data as ScriptBlockData;
        engineNode.Type = 'script';
        engineNode.ScriptCode = scriptData.code || '';
        engineNode.ScriptReturnVariable = scriptData.returnVariable;
        
        
        const nextTarget = blockConnections?.get('output');
        if (nextTarget) {
          engineNode.Nexts.push(nextTarget);
        }
        break;
      }

      case 'aiRouter': {
        const aiData = block.data as AiRouterBlockData;
        engineNode.Type = 'aiRouter';
        engineNode.AiSettings = project.aiSettings;
        engineNode.AiInputVariable = aiData.inputVariable;
        engineNode.AiInstruction = aiData.instruction;
        engineNode.AiContextMode = aiData.contextMode || project.aiSettings?.contextWindowMode || 'last_message';
        engineNode.AiRoutes = aiData.routes || [];
        engineNode.AiFallbackRoute = aiData.fallbackRoute;
        engineNode.AiConfidenceThreshold = aiData.confidenceThreshold ?? project.aiSettings?.confidenceThreshold ?? 0.6;
        engineNode.AiConfidenceVariable = aiData.confidenceVariable;
        engineNode.AiReasonVariable = aiData.reasonVariable;
        engineNode.AiIntentVariable = aiData.saveNormalizedIntentTo;

        (aiData.routes || []).forEach((_, index) => {
          engineNode.Nexts.push(blockConnections?.get(`route-${index}`) || '');
        });
        engineNode.Nexts.push(blockConnections?.get('fallback') || '');
        break;
      }

      case 'aiExtractor': {
        const aiData = block.data as AiExtractorBlockData;
        engineNode.Type = 'aiExtractor';
        engineNode.AiSettings = project.aiSettings;
        engineNode.AiInputVariable = aiData.inputVariable;
        engineNode.AiInstruction = aiData.instruction;
        engineNode.AiContextMode = aiData.contextMode || project.aiSettings?.contextWindowMode || 'last_message';
        engineNode.AiEntities = aiData.entities || [];
        engineNode.AiAskMissing = aiData.askMissing ?? true;
        engineNode.AiRawResultVariable = aiData.rawResultVariable;
        engineNode.Nexts.push(blockConnections?.get('complete') || '');
        engineNode.Nexts.push(blockConnections?.get('missing') || '');
        break;
      }

      case 'aiAssistant': {
        const aiData = block.data as AiAssistantBlockData;
        engineNode.Type = 'aiAssistant';
        engineNode.AiSettings = project.aiSettings;
        engineNode.AiInputVariable = aiData.inputVariable;
        engineNode.AiInstruction = aiData.instruction;
        engineNode.AiContextMode = aiData.contextMode || project.aiSettings?.contextWindowMode || 'last_message';
        engineNode.AiRoutes = aiData.routes || [];
        engineNode.AiEntities = aiData.entities || [];
        engineNode.AiAskMissing = aiData.askMissing ?? true;
        engineNode.AiLoop = aiData.loop ?? false;
        engineNode.AiExitPhrases = aiData.exitPhrases || [];
        engineNode.AiConfidenceThreshold = aiData.confidenceThreshold ?? project.aiSettings?.confidenceThreshold ?? 0.6;
        engineNode.AiRawResultVariable = aiData.rawResultVariable;
        engineNode.AiReplyVariable = aiData.replyVariable;
        engineNode.AiButtonsVariable = aiData.buttonsVariable;
        engineNode.AiConfidenceVariable = aiData.confidenceVariable;
        engineNode.AiReasonVariable = aiData.reasonVariable;
        engineNode.AiIntentVariable = aiData.saveNormalizedIntentTo;
        engineNode.AiSpecialTopicVariable = aiData.specialTopicVariable;
        engineNode.Nexts.push(blockConnections?.get('task-complete') || '');
        engineNode.Nexts.push(blockConnections?.get('task-missing') || '');
        engineNode.Nexts.push(blockConnections?.get('chat') || '');
        break;
      }

      case 'api': {
        const apiData = block.data as ApiBlockData;
        engineNode.Type = 'api';
        engineNode.ApiUrl = apiData.url;
        engineNode.ApiMethod = apiData.method || 'GET';
        engineNode.ApiHeaders = apiData.headers;
        engineNode.ApiBody = apiData.body;
        
        engineNode.ApiResponseVariable = apiData.responseVariable?.trim() || undefined;
        
        engineNode.ApiAnswersPath = apiData.answersPath?.trim() || undefined;
        engineNode.ApiAnswersVariable = apiData.answersVariable?.trim() || undefined;

        
        const nextTarget = blockConnections?.get('output');
        if (nextTarget) {
          engineNode.Nexts.push(nextTarget);
        }
        break;
      }

      case 'file': {
        const fileData = block.data as FileBlockData;
        engineNode.Type = 'FILE';
        
        
        const actionMap: Record<string, 'Upload' | 'DownLoad' | 'Delete' | 'Read'> = {
          'upload': 'Upload',
          'download': 'DownLoad',
          'delete': 'Delete',
          'read': 'Read',
        };
        engineNode.FILEAct = actionMap[fileData.action || 'upload'];
        engineNode.FileName = fileData.fileName;
        engineNode.PathToFile = fileData.filePath;
        engineNode.PathToSave = fileData.filePath; 

        
        const nextTarget = blockConnections?.get('output');
        if (nextTarget) {
          engineNode.Nexts.push(nextTarget);
        }
        break;
      }
    }

    nodes.push(engineNode);
  });
  return nodes;
}


function mapBlockTypeToEngine(blockType: string): 'output' | 'condition' | 'start' | 'variable' | 'api' | 'FILE' | 'skip' | 'script' | 'aiRouter' | 'aiExtractor' | 'aiAssistant' {
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
    case 'aiRouter':
      return 'aiRouter';
    case 'aiExtractor':
      return 'aiExtractor';
    case 'aiAssistant':
      return 'aiAssistant';
    default:
      return 'skip';
  }
}
