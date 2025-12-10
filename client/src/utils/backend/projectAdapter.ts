import { Project, BlockNode } from '../../types';
import { MessageBlockData, ConditionBlockData, VariableBlockData } from '../../types';
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

        // Получаем следующий блок (обычно один выход для message)
        const nextTarget = blockConnections?.get('output');
        if (nextTarget) {
          engineNode.Nexts.push(nextTarget);
        }
        break;
      }

      case 'condition': {
        const condData = block.data as ConditionBlockData;
        engineNode.Type = 'condition';
        const hasDefault = condData.hasDefault ?? true;

        // Преобразуем условия - только реальные условия, не "default"
        if (condData.conditions && condData.conditions.length > 0) {
          engineNode.Cond = condData.conditions
            .map(c => c.condition)
            .filter(c => c && c.trim() !== '' && c.toLowerCase() !== 'default');

          // Упорядочиваем Nexts по порядку условий
          // Каждое условие имеет свой выход output-0, output-1, etc.
          condData.conditions.forEach((_, index) => {
            const target = blockConnections?.get(`output-${index}`);
            if (target) {
              engineNode.Nexts.push(target);
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

      case 'end': {
        engineNode.Type = 'end';
        engineNode.Nexts = [];
        break;
      }

      case 'api':
      case 'file': {
        // Для api и file блоков создаем skip (пока не реализованы в Engine)
        engineNode.Type = 'skip';
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
function mapBlockTypeToEngine(blockType: string): 'output' | 'condition' | 'start' | 'variable' | 'skip' | 'end' {
  switch (blockType) {
    case 'message':
      return 'output';
    case 'condition':
      return 'condition';
    case 'start':
      return 'start';
    case 'variable':
      return 'variable';
    case 'end':
      return 'end';
    default:
      return 'skip';
  }
}
