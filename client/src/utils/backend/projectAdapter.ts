import { Project, BlockNode } from '../../types';
import { MessageBlockData, ConditionBlockData, VariableBlockData, ScriptBlockData } from '../../types';
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


function mapBlockTypeToEngine(blockType: string): 'output' | 'condition' | 'start' | 'variable' | 'api' | 'FILE' | 'skip' | 'end' {
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
    default:
      return 'skip';
  }
}
