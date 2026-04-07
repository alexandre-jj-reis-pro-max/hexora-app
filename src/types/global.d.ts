interface Window {
  _agents: Array<{
    id: string;
    tx: number;
    ty: number;
    gx: number;
    gy: number;
    moving: boolean;
    state: 'walking' | 'idle' | 'working';
    interactTarget: (() => void) | null;
    path: Array<{ col: number; row: number }>;
  }>;
  _coordPos: { col: number; row: number };
  _boardPos: { x: number; y: number };
  _walkToLousa: (agentId: string, onArrive?: () => void) => void;
  _setAgentWorking: (agentId: string, working: boolean) => void;
}
