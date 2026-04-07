import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Workspace, KBFile } from '../types';
import { DEFAULT_WORKSPACES } from '../constants';

interface WorkspaceState {
  workspaces: Workspace[];
  activeId: string;
  getActive: () => Workspace | undefined;
  setActive: (id: string) => void;
  addWorkspace: (ws: Omit<Workspace, 'id' | 'files' | 'urls' | 'stack'>) => void;
  deleteWorkspace: (id: string) => void;
  addFile: (wsId: string, file: KBFile) => void;
  removeFile: (wsId: string, name: string) => void;
  addUrl: (wsId: string, url: string) => void;
  removeUrl: (wsId: string, url: string) => void;
  toggleStack: (wsId: string, tech: string) => void;
  setGithubConfig: (wsId: string, repo: string, baseBranch: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: DEFAULT_WORKSPACES,
      activeId: DEFAULT_WORKSPACES[0].id,

      getActive: () => get().workspaces.find((w) => w.id === get().activeId),
      setActive: (id) => set({ activeId: id }),

      addWorkspace: (ws) =>
        set((s) => ({
          workspaces: [...s.workspaces, { ...ws, id: `ws-${Date.now()}`, files: [], urls: [], stack: [] }],
        })),

      deleteWorkspace: (id) =>
        set((s) => {
          const remaining = s.workspaces.filter((w) => w.id !== id);
          return {
            workspaces: remaining,
            activeId: s.activeId === id ? (remaining[0]?.id ?? '') : s.activeId,
          };
        }),

      addFile: (wsId, file) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === wsId ? { ...w, files: [...w.files, file] } : w
          ),
        })),

      removeFile: (wsId, name) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === wsId ? { ...w, files: w.files.filter((f) => f.name !== name) } : w
          ),
        })),

      addUrl: (wsId, url) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === wsId ? { ...w, urls: [...w.urls, url] } : w
          ),
        })),

      removeUrl: (wsId, url) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === wsId ? { ...w, urls: w.urls.filter((u) => u !== url) } : w
          ),
        })),

      toggleStack: (wsId, tech) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === wsId
              ? { ...w, stack: w.stack.includes(tech) ? w.stack.filter((t) => t !== tech) : [...w.stack, tech] }
              : w
          ),
        })),

      setGithubConfig: (wsId, repo, baseBranch) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === wsId ? { ...w, githubRepo: repo, githubBaseBranch: baseBranch } : w
          ),
        })),
    }),
    { name: 'hexora-workspaces' }
  )
);
