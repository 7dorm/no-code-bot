

import { StartBlockMeta } from './StartBlock';
import { MessageBlockMeta } from './MessageBlock';
import { ConditionBlockMeta } from './ConditionBlock';
import { VariableBlockMeta } from './VariableBlock';
import { ApiBlockMeta } from './ApiBlock';
import { FileBlockMeta } from './FileBlock';
import { ScriptBlockMeta } from './ScriptBlock';
import { AiRouterBlockMeta, AiExtractorBlockMeta, AiAssistantBlockMeta } from './AiBlock';

export type BlockType = 
  | 'start'
  | 'message'
  | 'condition'
  | 'variable'
  | 'api'
  | 'file'
  | 'script'
  | 'aiRouter'
  | 'aiExtractor'
  | 'aiAssistant';


export type BlockMeta = {
  type: BlockType;
  label: string;
  icon: string;
  color: string;
  description: string;
  hasInput: boolean;
  hasOutput: boolean;
  hasMultipleOutputs: boolean;
};


export const BLOCK_METADATA: Record<BlockType, BlockMeta> = {
  start: StartBlockMeta,
  message: MessageBlockMeta,
  condition: ConditionBlockMeta,
  variable: VariableBlockMeta,
  api: ApiBlockMeta,
  file: FileBlockMeta,
  script: ScriptBlockMeta,
  aiRouter: AiRouterBlockMeta,
  aiExtractor: AiExtractorBlockMeta,
  aiAssistant: AiAssistantBlockMeta,
};


export function getBlockMeta(type: BlockType): BlockMeta {
  return BLOCK_METADATA[type];
}


export function getBlockIcon(type: BlockType): string {
  return BLOCK_METADATA[type].icon;
}


export function getBlockColor(type: BlockType): string {
  return BLOCK_METADATA[type].color;
}
