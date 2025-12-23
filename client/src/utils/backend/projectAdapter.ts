import { Project, BlockNode } from '../../types';
import { MessageBlockData, ConditionBlockData, VariableBlockData, ScriptBlockData } from '../../types';
import { EngineNode } from '@backend/Engine';

// Re-export EngineNode for convenience
export type { EngineNode };

/**
 * Преобразует Project структуру в формат, понятный Engine
 */
export function adaptProjectToEngine(project: Project): EngineNode[] {
  const nodes: EngineNode[] = [];
  const blockMap = new Map<string, BlockNode>();

  // Создаем карту блоков для быстрого доступа
  project.blocks.forEach(block => {
    blockMap.set(block.id, block);
  });

  // Создаем карту связей: source -> Map<handle, target>
  const connectionsMap = new Map<string, Map<string | undefined, string>>();

  project.connections.forEach(conn => {
    if (!connectionsMap.has(conn.source)) {
      connectionsMap.set(conn.source, new Map());
    }
    const sourceMap = connectionsMap.get(conn.source)!;
    sourceMap.set(conn.sourceHandle || 'output', conn.target);
  });

  // Преобразуем каждый блок
  project.blocks.forEach(block => {
    const engineNode: EngineNode = {
      id: block.id,
      Type: mapBlockTypeToEngine(block.data.type),
      Nexts: [],
    };

    // Получаем связи для этого блока
    const blockConnections = connectionsMap.get(block.id);

    // Обрабатываем специфичные данные блока
    switch (block.data.type) {
      case 'message': {
        const msgData = block.data as MessageBlockData;
        engineNode.Type = 'output';
        engineNode.Text = msgData.text || '';

        // Если нужно сохранять ответ пользователя
        if (msgData.saveResponseToVariable) {
          engineNode.VarName = msgData.saveResponseToVariable;
          engineNode.VarType = 'string';
        }

        // Варианты ответов
        if (msgData.answers && msgData.answers.length > 0) {
          engineNode.Answers = msgData.answers;
        } else if (msgData.answersFromVariable) {
          // Answers будут получены из переменной во время выполнения
          engineNode.AnswersFromVariable = msgData.answersFromVariable;
          engineNode.AnswersPath = msgData.answersPath;
        }

        // Получаем следующий блок (один выход для message)
        const nextTarget = blockConnections?.get('output');
        if (nextTarget) {
          // Если есть answers, создаем несколько Nexts (по количеству вариантов)
          // Все они ведут к одному и тому же следующему блоку
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

        // Преобразуем условия - только реальные условия, не "default"
        if (condData.conditions && condData.conditions.length > 0) {
          // Сначала собираем валидные условия и их индексы
          const validConditions: Array<{ condition: string; originalIndex: number }> = [];
          condData.conditions.forEach((c, index) => {
            const condStr = c.condition;
            if (condStr && condStr.trim() !== '' && condStr.toLowerCase() !== 'default') {
              validConditions.push({ condition: condStr, originalIndex: index });
            }
          });

          // Сохраняем только валидные условия
          engineNode.Cond = validConditions.map(vc => vc.condition);

          // Упорядочиваем Nexts по порядку валидных условий
          // Каждое условие имеет свой выход output-{originalIndex}
          validConditions.forEach(vc => {
            const target = blockConnections?.get(`output-${vc.originalIndex}`);
            if (target) {
              engineNode.Nexts.push(target);
            } else {
              // Если связи нет, добавляем пустую строку для сохранения индекса
              engineNode.Nexts.push('');
            }
          });
        } else {
          engineNode.Cond = [];
        }

        // Дефолтная ветка всегда включена
        const defaultTarget = blockConnections?.get('output-default');
        if (hasDefault) {
          if (defaultTarget) {
            engineNode.Nexts.push(defaultTarget);
          } else {
            // Добавляем пустую ветку, чтобы индекс соответствовал наличию else
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
        
        // Проверяем, нужно ли сохранять следующий ответ пользователя
        if (varData.saveNextInput) {
          engineNode.SaveNextToVariable = varData.variableName;
        }

        // Получаем следующий блок
        const nextTarget = blockConnections?.get('output');
        if (nextTarget) {
          engineNode.Nexts.push(nextTarget);
        }
        break;
      }

      case 'start': {
        engineNode.Type = 'start';
        // Стартовый блок переходит к следующему без ожидания ввода
        engineNode.skip = true;

        // Получаем следующий блок
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
        
        // Получаем следующий блок
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
        // Сохраняем переменную для ответа, даже если она пустая (для отладки)
        engineNode.ApiResponseVariable = apiData.responseVariable?.trim() || undefined;
        // Сохраняем путь к массиву для вариантов ответов
        engineNode.ApiAnswersPath = apiData.answersPath?.trim() || undefined;
        engineNode.ApiAnswersVariable = apiData.answersVariable?.trim() || undefined;

        // Получаем следующий блок
        const nextTarget = blockConnections?.get('output');
        if (nextTarget) {
          engineNode.Nexts.push(nextTarget);
        }
        break;
      }

      case 'file': {
        const fileData = block.data as FileBlockData;
        engineNode.Type = 'FILE';
        
        // Преобразуем действие файла
        const actionMap: Record<string, 'Upload' | 'DownLoad' | 'Delete' | 'Read'> = {
          'upload': 'Upload',
          'download': 'DownLoad',
          'delete': 'Delete',
          'read': 'Read',
        };
        engineNode.FILEAct = actionMap[fileData.action || 'upload'];
        engineNode.FileName = fileData.fileName;
        engineNode.PathToFile = fileData.filePath;
        engineNode.PathToSave = fileData.filePath; // Для upload используем filePath как путь сохранения

        // Получаем следующий блок
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

/**
 * Преобразует тип блока в тип Engine
 */
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
