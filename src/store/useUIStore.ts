import { create } from 'zustand';

type PanelId = 'story' | 'profile' | 'team' | 'ws' | null;
type WsTab = 'list' | 'kb' | 'stack';

interface UIState {
  openPanel: PanelId;
  wsTab: WsTab;
  wsDropOpen: boolean;
  configAgentId: string | null;
  setPanel: (p: PanelId) => void;
  togglePanel: (p: Exclude<PanelId, null>) => void;
  setWsTab: (t: WsTab) => void;
  toggleWsDrop: (force?: boolean) => void;
  openAgentCanvas: (agentId: string) => void;
  closeAgentCanvas: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  openPanel: null,
  wsTab: 'list',
  wsDropOpen: false,
  configAgentId: null,

  setPanel: (p) => set({ openPanel: p }),
  togglePanel: (p) => set((s) => ({ openPanel: s.openPanel === p ? null : p, wsDropOpen: false })),
  setWsTab: (t) => set({ wsTab: t }),
  toggleWsDrop: (force) => set((s) => ({ wsDropOpen: force !== undefined ? !force : !s.wsDropOpen })),
  openAgentCanvas: (agentId) => set({ configAgentId: agentId, openPanel: null }),
  closeAgentCanvas: () => set({ configAgentId: null }),
}));
