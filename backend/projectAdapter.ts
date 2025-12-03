// This file is kept in backend for compatibility, but the actual implementation
// should be in the client since it depends on client types.
// This is a placeholder that exports the EngineNode interface.

export interface EngineNode {
  id: string;
  Type: 'output' | 'condition' | 'start' | 'variable' | 'skip' | 'end';
  Text?: string;
  VarName?: string;
  VarType?: string;
  Nexts: string[];
  Cond?: string[];
  skip?: boolean;
  Answers?: string[];
  VariableName?: string;
  VariableValue?: string;
}

