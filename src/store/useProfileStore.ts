import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile, LLMKeys, AgentModels, AgentConfigs, AgentConfig, Stats, ProxyConfig } from '../types';

interface ProfileState {
  profile: UserProfile;
  llmKeys: LLMKeys;
  agentModels: AgentModels;
  agentConfigs: AgentConfigs;
  stats: Stats;
  githubToken: string;
  proxyConfig: ProxyConfig;
  /** IDs dos agentes ativos na squad. Coord é sempre ativo. */
  squadAgentIds: string[];
  setProfile: (p: UserProfile) => void;
  setLLMKey: (providerId: string, key: string) => void;
  setAgentModel: (agentId: string, modelId: string) => void;
  setAgentConfig: (agentId: string, config: AgentConfig) => void;
  setGithubToken: (token: string) => void;
  setProxyConfig: (cfg: ProxyConfig) => void;
  toggleSquadAgent: (agentId: string) => void;
  incEvents: () => void;
  incFlows: () => void;
}

const DEFAULT_SQUAD = ['dev-back', 'dev-front', 'eng-dados', 'qa', 'pm', 'po', 'design', 'devops'];

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: { name: '', email: '', workspace: '' },
      llmKeys: {},
      agentModels: {},
      agentConfigs: {},
      stats: { events: 0, flows: 0 },
      githubToken: '',
      proxyConfig: { url: '', user: '', password: '', skipSsl: false },
      squadAgentIds: DEFAULT_SQUAD,

      setProfile: (p) => set({ profile: p }),
      setLLMKey: (id, key) => set((s) => ({ llmKeys: { ...s.llmKeys, [id]: key } })),
      setAgentModel: (id, model) => set((s) => ({ agentModels: { ...s.agentModels, [id]: model } })),
      setAgentConfig: (id, config) => set((s) => ({ agentConfigs: { ...s.agentConfigs, [id]: config } })),
      setGithubToken: (token) => set({ githubToken: token }),
      setProxyConfig: (cfg) => set({ proxyConfig: cfg }),
      toggleSquadAgent: (id) => set((s) => {
        // PO é sempre ativo — não pode ser removido da squad
        if (id === 'po' && s.squadAgentIds.includes(id)) return {};
        return {
          squadAgentIds: s.squadAgentIds.includes(id)
            ? s.squadAgentIds.filter((x) => x !== id)
            : [...s.squadAgentIds, id],
        };
      }),
      incEvents: () => set((s) => ({ stats: { ...s.stats, events: s.stats.events + 1 } })),
      incFlows: () => set((s) => ({ stats: { ...s.stats, flows: s.stats.flows + 1 } })),
    }),
    { name: 'hexora-profile' }
  )
);
