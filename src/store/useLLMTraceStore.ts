import { create } from 'zustand';

export type TraceStatus = 'pending' | 'success' | 'error';

export interface LLMTrace {
  id: string;
  timestamp: number;
  agentId: string;
  agentName: string;
  agentColor: string;
  provider: string;
  model: string;
  status: TraceStatus;
  duration?: number;       // ms
  systemPrompt?: string;
  userMessage?: string;
  response?: string;
  error?: string;
}

interface LLMTraceState {
  traces: LLMTrace[];
  addTrace: (t: Omit<LLMTrace, 'id' | 'timestamp'>) => string;
  updateTrace: (id: string, patch: Partial<LLMTrace>) => void;
  clearTraces: () => void;
}

export const useLLMTraceStore = create<LLMTraceState>((set) => ({
  traces: [],

  addTrace: (t) => {
    const id = `trace-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((s) => ({
      traces: [{ ...t, id, timestamp: Date.now() }, ...s.traces].slice(0, 60),
    }));
    return id;
  },

  updateTrace: (id, patch) =>
    set((s) => ({
      traces: s.traces.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  clearTraces: () => set({ traces: [] }),
}));
