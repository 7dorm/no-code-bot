


export type { StartBlockData } from './StartBlock';
export { StartBlockMeta } from './StartBlock';
export type { MessageBlockData } from './MessageBlock';
export { MessageBlockMeta } from './MessageBlock';
export type { ConditionBlockData, ConditionCase } from './ConditionBlock';
export { ConditionBlockMeta } from './ConditionBlock';
export type { VariableBlockData } from './VariableBlock';
export { VariableBlockMeta } from './VariableBlock';
export type { ApiBlockData } from './ApiBlock';
export { ApiBlockMeta } from './ApiBlock';
export type { FileBlockData } from './FileBlock';
export { FileBlockMeta } from './FileBlock';
export type { ScriptBlockData } from './ScriptBlock';
export { ScriptBlockMeta } from './ScriptBlock';


export type { BlockType, BlockMeta } from './blockRegistry';
export {
  BLOCK_METADATA,
  getBlockMeta,
  getBlockIcon,
  getBlockColor,
} from './blockRegistry';


export type BlockData = 
  | import('./StartBlock').StartBlockData
  | import('./MessageBlock').MessageBlockData
  | import('./ConditionBlock').ConditionBlockData
  | import('./VariableBlock').VariableBlockData
  | import('./ApiBlock').ApiBlockData
  | import('./FileBlock').FileBlockData
  | import('./ScriptBlock').ScriptBlockData;
