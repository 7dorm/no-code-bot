import { Project } from '../types';
import { MessageBlockData, VariableBlockData } from '../types';

export interface VariableInfo {
  name: string;
  type: 'saved' | 'defined' | 'used';
  blockId?: string;
  blockType?: string;
  description?: string;
}

/**
 * Извлекает все переменные, используемые в проекте
 */
export function extractVariables(project: Project): VariableInfo[] {
  const variablesMap = new Map<string, VariableInfo>();

  if (!project || !project.blocks) {
    return [];
  }

  // Проходим по всем блокам
  project.blocks.forEach(block => {
    switch (block.data.type) {
      case 'message': {
        const msgData = block.data as MessageBlockData;
        
        // Переменная для сохранения ответа пользователя
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

        // Извлекаем переменные, используемые в тексте сообщения ({{varName}})
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
              // Обновляем тип, если переменная уже используется
              const existing = variablesMap.get(varName)!;
              if (existing.type === 'defined') {
                existing.type = 'used';
              }
            }
          });
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
              description: varData.value ? `= ${varData.value.substring(0, 30)}...` : 'Не задано значение',
            });
          } else {
            // Обновляем информацию, если переменная уже существует
            const existing = variablesMap.get(varName)!;
            existing.type = 'defined';
            existing.blockId = block.id;
            existing.blockType = 'variable';
            existing.description = varData.value ? `= ${varData.value.substring(0, 30)}...` : 'Не задано значение';
          }
        }
        break;
      }

      case 'condition': {
        // Извлекаем переменные из условий
        const condData = block.data;
        if ('conditions' in condData && Array.isArray((condData as any).conditions)) {
          (condData as any).conditions.forEach((cond: any) => {
            if (cond.condition) {
              // Ищем переменные в условиях (простые имена или в фигурных скобках)
              const matches = [
                ...cond.condition.matchAll(/\{\{?(\w+)\}?\}/g),
                ...cond.condition.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g),
              ];
              matches.forEach(match => {
                const varName = match[1];
                // Пропускаем ключевые слова
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

