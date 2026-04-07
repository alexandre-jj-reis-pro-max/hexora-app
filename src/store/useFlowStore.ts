import { create } from 'zustand';
import { flowsApi, type APIFlow } from '../lib/api';
import { syncUpdateFlow, syncUpdateStep } from '../engine/flow-sync';
import type { FlowRun, FlowStep, LogEntry } from '../types';

function apiFlowToRun(f: APIFlow): FlowRun {
  return {
    id: f.id,
    story: f.story,
    status: f.status as FlowRun['status'],
    createdAt: new Date(f.created_at).getTime(),
    steps: f.steps.map((s) => ({
      id: s.id,
      agentId: s.agent_id,
      agentName: s.agent_name,
      agentColor: s.agent_color,
      role: s.role,
      desc: s.desc,
      status: s.status as FlowStep['status'],
      result: s.result,
      llm: s.llm,
      code: s.code,
      filePath: s.file_path,
      specDraft: s.spec_draft,
    })),
  };
}

interface FlowState {
  flows: FlowRun[];
  log: LogEntry[];
  eventCount: number;
  selectedFlowId: string | null;

  // Fluxos
  addFlow: (run: Omit<FlowRun, 'createdAt'>) => void;
  addStep: (flowId: string, step: FlowStep) => void;
  updateStep: (flowId: string, stepId: string, patch: Partial<FlowStep>) => void;
  finishFlow: (flowId: string, status: 'done' | 'error') => void;
  removeFlow: (flowId: string) => void;
  selectFlow: (id: string | null) => void;
  /** Load existing flows from backend (called on app init after auth) */
  loadFlows: () => Promise<void>;

  // Log
  addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  incEvents: () => void;

  // Derivados (conveniência para a UI)
  runningCount: () => number;
}

export const useFlowStore = create<FlowState>((set, get) => ({
  flows: [],
  log: [],
  eventCount: 0,
  selectedFlowId: null,

  addFlow: (run) =>
    set((s) => {
      const full: FlowRun = { ...run, createdAt: Date.now() };
      return {
        flows: [full, ...s.flows],
        selectedFlowId: run.id,
      };
    }),

  addStep: (flowId, step) =>
    set((s) => ({
      flows: s.flows.map((f) =>
        f.id !== flowId ? f : { ...f, steps: [...f.steps, step] },
      ),
    })),

  updateStep: (flowId, stepId, patch) => {
    set((s) => ({
      flows: s.flows.map((f) =>
        f.id !== flowId
          ? f
          : { ...f, steps: f.steps.map((st) => (st.id === stepId ? { ...st, ...patch } : st)) },
      ),
    }));
    // Sync to backend (fire-and-forget)
    syncUpdateStep(flowId, stepId, {
      status: patch.status,
      result: patch.result,
      code: patch.code,
      file_path: patch.filePath,
      spec_draft: patch.specDraft,
    }).catch(() => {});
  },

  finishFlow: (flowId, status) => {
    set((s) => ({
      flows: s.flows.map((f) => (f.id === flowId ? { ...f, status } : f)),
    }));
    syncUpdateFlow(flowId, { status }).catch(() => {});
  },

  removeFlow: (flowId) =>
    set((s) => {
      const flows = s.flows.filter((f) => f.id !== flowId);
      const selectedFlowId =
        s.selectedFlowId === flowId ? (flows[0]?.id ?? null) : s.selectedFlowId;
      return { flows, selectedFlowId };
    }),

  selectFlow: (id) => set({ selectedFlowId: id }),

  loadFlows: async () => {
    try {
      const apiFlows = await flowsApi.list();
      const flows = apiFlows.map(apiFlowToRun);
      set({ flows, selectedFlowId: flows[0]?.id ?? null });
    } catch {
      // backend unavailable — keep current state
    }
  },

  addLog: (entry) =>
    set((s) => ({
      log: [
        { ...entry, id: `log-${Date.now()}-${Math.random()}`, timestamp: Date.now() },
        ...s.log,
      ].slice(0, 100),
    })),

  incEvents: () => set((s) => ({ eventCount: s.eventCount + 1 })),

  runningCount: () => get().flows.filter((f) => f.status === 'running').length,
}));
