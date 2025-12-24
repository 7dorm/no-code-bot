import { Project } from '../types';
import { MessageBlockData, VariableBlockData, ApiBlockData } from '../types';

export interface VariableInfo {
  name: string;
  type: 'saved' | 'defined' | 'used';
  blockId?: string;
  blockType?: string;
  description?: string;
}


export function extractVariables(project: Project): VariableInfo[] {
  const variablesMap = new Map<string, VariableInfo>();

  if (!project || !project.blocks) {
    return [];
  }

  
  project.blocks.forEach(block => {
    switch (block.data.type) {
      case 'message': {
        const msgData = block.data as MessageBlockData;
        
        
        if (msgData.saveResponseToVariable) {
          const varName = msgData.saveResponseToVariable;
          if (!variablesMap.has(varName)) {
            variablesMap.set(varName, {
              name: varName,
              type: 'saved',
              blockId: block.id,
              blockType: 'message',
              description: 'Сохраняется ответ пользователя',
            });
          }
        }

        
        if (msgData.answersFromVariable) {
          const varName = msgData.answersFromVariable;
          if (!variablesMap.has(varName)) {
            variablesMap.set(varName, {
              name: varName,
              type: 'used',
              blockId: block.id,
              blockType: 'message',
              description: 'Используется для вариантов ответов',
            });
          }
        }

        
        if (msgData.text) {
          const matches = [...msgData.text.matchAll(/\{\{(\w+)\}\}/g)];
          matches.forEach(match => {
            const varName = match[1];
            if (!variablesMap.has(varName)) {
              variablesMap.set(varName, {
                name: varName,
                type: 'used',
                blockId: block.id,
                blockType: 'message',
                description: 'Используется в тексте сообщения',
              });
            } else {
              
              const existing = variablesMap.get(varName)!;
              if (existing.type === 'defined') {
                existing.type = 'used';
              }
            }
          });
        }
        break;
      }

      case 'api': {
        const apiData = block.data as ApiBlockData;
        
        
        if (apiData.responseVariable) {
          const varName = apiData.responseVariable;
          if (!variablesMap.has(varName)) {
            variablesMap.set(varName, {
              name: varName,
              type: 'saved',
              blockId: block.id,
              blockType: 'api',
              description: 'Сохраняется ответ API',
            });
          }
        }
        
        
        if (apiData.answersVariable) {
          const varName = apiData.answersVariable;
          if (!variablesMap.has(varName)) {
            variablesMap.set(varName, {
              name: varName,
              type: 'saved',
              blockId: block.id,
              blockType: 'api',
              description: 'Сохраняется массив вариантов ответов из API',
            });
          }
        }
        break;
      }

      case 'variable': {
        const varData = block.data as VariableBlockData;
        if (varData.variableName) {
          const varName = varData.variableName;
          if (!variablesMap.has(varName)) {
            variablesMap.set(varName, {
              name: varName,
              type: 'defined',
              blockId: block.id,
              blockType: 'variable',
              description: varData.value ? `= ${varData.value.substring(0, 0)}...` : 'Не задано значение',
            });
          } else {
            
            const existing = variablesMap.get(varName)!;
            existing.type = 'defined';
            existing.blockId = block.id;
            existing.blockType = 'variable';
            existing.description = varData.value ? `= ${varData.value.substring(0, 0)}...` : 'Не задано значение';
          }
        }
        break;
      }

      case 'condition': {
        
        const condData = block.data;
        if ('conditions' in condData && Array.isArray((condData as any).conditions)) {
          (condData as any).conditions.forEach((cond: any) => {
            if (cond.condition) {
              
              const matches = [
                ...cond.condition.matchAll(/\{\{?(\w+)\}?\}/g),
                ...cond.condition.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g),
              ];
              matches.forEach(match => {
                const varName = match[1];
                
                if (!['userInput', 'lastMessage', 'contains', 'default', 'true', 'false'].includes(varName)) {
                  if (!variablesMap.has(varName)) {
                    variablesMap.set(varName, {
                      name: varName,
                      type: 'used',
                      blockId: block.id,
                      blockType: 'condition',
                      description: 'Используется в условии',
                    });
                  }
                }
              });
            }
          });
        }
        break;
      }
    }
  });

  return Array.from(variablesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

