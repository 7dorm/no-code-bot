



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

