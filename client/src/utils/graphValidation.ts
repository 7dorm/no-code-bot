import { Project, BlockNode, VariableBlockData, MessageBlockData, ApiBlockData, FileBlockData, ScriptBlockData, AiRouterBlockData, AiExtractorBlockData, AiAssistantBlockData, ConditionBlockData } from '../types';

export interface ValidationError {
  blockId: string;
  variableName?: string;
  type: 'undefined' | 'final_violation' | 'unassigned' | 'unreachable';
  message: string;
  severity: 'error' | 'warning';
}

export function validateProjectVariables(project: Project): ValidationError[] {
  const errors: ValidationError[] = [];
  const { blocks, connections } = project;

  if (!blocks || blocks.length === 0) return [];

  
  const blocksMap = new Map<string, BlockNode>();
  blocks.forEach(b => blocksMap.set(b.id, b));

  
  const adjacencyList = new Map<string, string[]>();
  connections.forEach(c => {
    if (!adjacencyList.has(c.target)) {
      adjacencyList.set(c.target, []);
    }
    adjacencyList.get(c.target)!.push(c.source);
  });

  
  const reachableFromMap = new Map<string, Set<string>>();

  function getReachableBlocks(blockId: string): Set<string> {
    if (reachableFromMap.has(blockId)) {
      return reachableFromMap.get(blockId)!;
    }

    const reachable = new Set<string>();
    const queue = [blockId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const parents = adjacencyList.get(currentId) || [];
      parents.forEach(p => {
        reachable.add(p);
        queue.push(p);
      });
    }

    reachableFromMap.set(blockId, reachable);
    return reachable;
  }

  
  const blockDefinitions = new Map<string, Set<{ name: string; isFinal: boolean; hasValue: boolean }>>();
  blocks.forEach(block => {
    const defs = getDefinitionsInBlock(block);
    if (defs.size > 0) {
      blockDefinitions.set(block.id, defs);
    }
  });

  
  blocks.forEach(block => {
    const uses = getUsesInBlock(block);
    if (uses.size === 0) return;

    const reachableAncestors = getReachableBlocks(block.id);
    
    uses.forEach(varName => {
      
      if (['userInput', 'lastMessage', 'intent', 'confidence'].includes(varName)) return;

      
      if (project.globalConstants && project.globalConstants[varName] !== undefined) return;

      let isDefined = false;
      let hasAnyValue = false;

      reachableAncestors.forEach(ancestorId => {
        const defs = blockDefinitions.get(ancestorId);
        if (defs) {
          defs.forEach(def => {
            if (def.name === varName) {
              isDefined = true;
              if (def.hasValue) hasAnyValue = true;
            }
          });
        }
      });

      if (!isDefined) {
        errors.push({
          blockId: block.id,
          variableName: varName,
          type: 'undefined',
          message: `Переменная "${varName}" не определена выше в графе`,
          severity: 'error',
        });
      } else if (!hasAnyValue) {
        errors.push({
          blockId: block.id,
          variableName: varName,
          type: 'unassigned',
          message: `Переменная "${varName}" инициализирована, но ей не задано значение`,
          severity: 'warning',
        });
      }
    });
  });

  
  blocks.forEach(block => {
    if (block.data.type !== 'variable') return;
    const varData = block.data as VariableBlockData;
    const varName = varData.variableName;
    if (!varName) return;

    const reachableAncestors = getReachableBlocks(block.id);
    
    let isAlreadyFinal = false;
    reachableAncestors.forEach(ancestorId => {
      const defs = blockDefinitions.get(ancestorId);
      if (defs) {
        defs.forEach(def => {
          if (def.name === varName && def.isFinal) {
            isAlreadyFinal = true;
          }
        });
      }
    });

    if (isAlreadyFinal) {
      errors.push({
        blockId: block.id,
        variableName: varName,
        type: 'final_violation',
        message: `Нельзя изменять переменную "${varName}", так как она помечена как final выше по графу`,
        severity: 'error',
      });
    } else if (project.globalConstants && project.globalConstants[varName] !== undefined) {
      errors.push({
        blockId: block.id,
        variableName: varName,
        type: 'final_violation',
        message: `Нельзя изменять переменную "${varName}", так как она определена в глобальных константах`,
        severity: 'error',
      });
    }
  });

  // Check reachability
  const reachableFromStart = getReachableBlocksFromStart('start-block', adjacencyList);
  blocks.forEach(block => {
    if (block.id !== 'start-block' && !reachableFromStart.has(block.id)) {
      errors.push({
        blockId: block.id,
        type: 'unreachable',
        message: `Блок недостижим из стартового узла (нет связи)`,
        severity: 'warning',
      });
    }
  });

  return errors;
}

function getReachableBlocksFromStart(startId: string, adjacencyList: Map<string, string[]>): Set<string> {
  const reachable = new Set<string>();
  const forwardAdjacencyList = new Map<string, string[]>();
  
  // Create forward adjacency list
  for (const [target, sources] of adjacencyList.entries()) {
    sources.forEach(source => {
      if (!forwardAdjacencyList.has(source)) forwardAdjacencyList.set(source, []);
      forwardAdjacencyList.get(source)!.push(target);
    });
  }

  const queue = [startId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (reachable.has(currentId)) continue;
    reachable.add(currentId);

    const children = forwardAdjacencyList.get(currentId) || [];
    children.forEach(child => queue.push(child));
  }

  return reachable;
}

function getDefinitionsInBlock(block: BlockNode): Set<{ name: string; isFinal: boolean; hasValue: boolean }> {
  const defs = new Set<{ name: string; isFinal: boolean; hasValue: boolean }>();
  const data = block.data;

  switch (data.type) {
    case 'variable': {
      const varData = data as VariableBlockData;
      if (varData.variableName) {
        const hasValue = !!(varData.value && varData.value.trim() !== '') || !!varData.saveNextInput;
        defs.add({ name: varData.variableName, isFinal: !!varData.isFinal, hasValue });
      }
      break;
    }
    case 'message': {
      const msgData = data as MessageBlockData;
      if (msgData.saveResponseToVariable) {
        defs.add({ name: msgData.saveResponseToVariable, isFinal: false, hasValue: true });
      }
      break;
    }
    case 'api': {
      const apiData = data as ApiBlockData;
      if (apiData.responseVariable) {
        defs.add({ name: apiData.responseVariable, isFinal: false, hasValue: true });
        defs.add({ name: `${apiData.responseVariable}_status`, isFinal: false, hasValue: true });
      }
      if (apiData.answersVariable) {
        defs.add({ name: apiData.answersVariable, isFinal: false, hasValue: true });
      }
      break;
    }
    case 'file': {
      const fileData = data as FileBlockData;
      if (fileData.fileName && (fileData.action === 'upload' || fileData.action === 'read')) {
        defs.add({ name: fileData.fileName, isFinal: false, hasValue: true });
      }
      if (fileData.action === 'upload') {
        defs.add({ name: 'lastFile', isFinal: false, hasValue: true });
      }
      break;
    }
    case 'script': {
      const scriptData = data as ScriptBlockData;
      if (scriptData.returnVariable) {
        defs.add({ name: scriptData.returnVariable, isFinal: false, hasValue: true });
      }
      const setVariableMatches = scriptData.code?.matchAll(/setVariable\(['"](\w+)['"]/g) || [];
      for (const match of setVariableMatches) {
        defs.add({ name: match[1], isFinal: false, hasValue: true });
      }
      break;
    }
    case 'aiRouter': {
      const aiData = data as AiRouterBlockData;
      if (aiData.saveNormalizedIntentTo) defs.add({ name: aiData.saveNormalizedIntentTo, isFinal: false, hasValue: true });
      if (aiData.confidenceVariable) defs.add({ name: aiData.confidenceVariable, isFinal: false, hasValue: true });
      if (aiData.reasonVariable) defs.add({ name: aiData.reasonVariable, isFinal: false, hasValue: true });
      break;
    }
    case 'aiExtractor': {
      const aiData = data as AiExtractorBlockData;
      (aiData.entities || []).forEach(e => {
        defs.add({ name: e.variableName || e.name, isFinal: false, hasValue: true });
      });
      if (aiData.rawResultVariable) defs.add({ name: aiData.rawResultVariable, isFinal: false, hasValue: true });
      break;
    }
    case 'aiAssistant': {
      const aiData = data as AiAssistantBlockData;
      (aiData.entities || []).forEach(e => {
        defs.add({ name: e.variableName || e.name, isFinal: false, hasValue: true });
      });
      [
        aiData.replyVariable,
        aiData.buttonsVariable,
        aiData.rawResultVariable,
        aiData.confidenceVariable,
        aiData.reasonVariable,
        aiData.saveNormalizedIntentTo,
        aiData.specialTopicVariable,
      ].filter(Boolean).forEach(varName => {
        if (varName) defs.add({ name: varName, isFinal: false, hasValue: true });
      });
      break;
    }
  }

  return defs;
}

function getUsesInBlock(block: BlockNode): Set<string> {
  const uses = new Set<string>();
  const data = block.data;

  switch (data.type) {
    case 'message': {
      const msgData = data as MessageBlockData;
      if (msgData.text) {
        const matches = msgData.text.matchAll(/\{\{(\w+)\}\}/g);
        for (const match of matches) uses.add(match[1]);
      }
      if (msgData.answersFromVariable) {
        uses.add(msgData.answersFromVariable);
      }
      break;
    }
    case 'variable': {
      const varData = data as VariableBlockData;
      if (varData.value) {
        const matches = varData.value.matchAll(/\{\{(\w+)\}\}/g);
        for (const match of matches) uses.add(match[1]);
      }
      break;
    }
    case 'condition': {
      const condData = data as ConditionBlockData;
      (condData.conditions || []).forEach(c => {
        if (c.condition) {
          const matches = c.condition.matchAll(/\{\{(\w+)\}\}/g);
          for (const match of matches) uses.add(match[1]);
          
          const words = c.condition.match(/\b[a-zA-Z_]\w*\b/g) || [];
          words.forEach(w => {
            if (!['userInput', 'lastMessage', 'contains', 'default', 'true', 'false', 'length'].includes(w)) {
              uses.add(w);
            }
          });
        }
      });
      break;
    }
    case 'api': {
      const apiData = data as ApiBlockData;
      if (apiData.url) {
        const matches = apiData.url.matchAll(/\{\{(\w+)\}\}/g);
        for (const match of matches) uses.add(match[1]);
      }
      if (apiData.body) {
        const matches = apiData.body.matchAll(/\{\{(\w+)\}\}/g);
        for (const match of matches) uses.add(match[1]);
      }
      break;
    }
    case 'script': {
      const scriptData = data as ScriptBlockData;
      if (scriptData.code) {
        
        const matches = scriptData.code.matchAll(/variables\.(\w+)/g);
        for (const match of matches) uses.add(match[1]);
        const getMatches = scriptData.code.matchAll(/getVariable\(['"](\w+)['"]\)/g);
        for (const match of getMatches) uses.add(match[1]);
      }
      break;
    }
    case 'aiRouter': {
      const aiData = data as AiRouterBlockData;
      if (aiData.inputVariable) uses.add(aiData.inputVariable);
      break;
    }
    case 'aiExtractor': {
      const aiData = data as AiExtractorBlockData;
      if (aiData.inputVariable) uses.add(aiData.inputVariable);
      break;
    }
    case 'aiAssistant': {
      const aiData = data as AiAssistantBlockData;
      if (aiData.inputVariable) uses.add(aiData.inputVariable);
      break;
    }
  }

  return uses;
}
