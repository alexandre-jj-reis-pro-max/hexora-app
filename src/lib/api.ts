/**
 * API Client — Hexora Backend
 *
 * Thin fetch wrapper. All API calls go through here.
 * Base URL controlled by VITE_API_URL env var.
 */

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// ── Token storage ──────────────────────────────────────────────────────────────

const TOKEN_KEY = 'hexora_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Token refresh ─────────────────────────────────────────────────────────────

let _refreshing: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  try {
    // 1. Try local refresh endpoint first (works in both modes)
    const oldToken = getToken();
    if (oldToken) {
      const refreshRes = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${oldToken}` },
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setToken(data.access_token);
        return true;
      }
    }

    // 2. Fallback: Firebase sync (if Firebase is active)
    const { auth } = await import('./firebase').catch(() => ({ auth: null }));
    const user = auth?.currentUser;
    if (!user) return false;

    const res = await fetch(`${BASE}/auth/firebase-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firebase_uid: user.uid,
        email: user.email,
        name: user.displayName || user.email?.split('@')[0] || 'User',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setToken(data.access_token);
      return true;
    }
  } catch { /* backend offline */ }
  return false;
}

// ── Base fetch ─────────────────────────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  // Auto-refresh on 401 — retry once with new token
  if (res.status === 401 && path !== '/auth/firebase-sync') {
    if (!_refreshing) _refreshing = tryRefreshToken().finally(() => { _refreshing = null; });
    const refreshed = await _refreshing;
    if (refreshed) {
      const newToken = getToken();
      const retry = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
          ...(options.headers ?? {}),
        },
      });
      if (retry.ok) {
        if (retry.status === 204) return undefined as T;
        return retry.json() as Promise<T>;
      }
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((body as { detail?: string }).detail ?? 'Erro na requisição');
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Auth ───────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export const authApi = {
  register: (name: string, email: string, password: string) =>
    request<TokenResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string) =>
    request<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<AuthUser>('/auth/me'),
};

// ── Profile ────────────────────────────────────────────────────────────────────

export const profileApi = {
  updateMe: (name: string) =>
    request<AuthUser>('/profile/me', {
      method: 'PUT',
      body: JSON.stringify({ name }),
    }),

  getLLMKeys: () =>
    request<{ configured: string[] }>('/profile/llm-keys'),

  setLLMKeys: (keys: Record<string, string>) =>
    request<{ configured: string[] }>('/profile/llm-keys', {
      method: 'PUT',
      body: JSON.stringify({ keys }),
    }),

  getAgentModels: () =>
    request<Record<string, string>>('/profile/agent-models'),

  setAgentModels: (models: Record<string, string>) =>
    request<Record<string, string>>('/profile/agent-models', {
      method: 'PUT',
      body: JSON.stringify({ models }),
    }),

  getProxyConfig: () =>
    request<{ url: string; user: string; skip_ssl: boolean; configured: boolean }>('/profile/proxy-config'),

  setProxyConfig: (url: string, user: string, password: string, skipSsl: boolean) =>
    request<{ url: string; user: string; skip_ssl: boolean; configured: boolean }>('/profile/proxy-config', {
      method: 'PUT',
      body: JSON.stringify({ url, user, password, skip_ssl: skipSsl }),
    }),

  getGithubApiUrl: () =>
    request<{ url: string }>('/profile/github-api-url'),

  setGithubApiUrl: (url: string) =>
    request<{ url: string }>('/profile/github-api-url', {
      method: 'PUT',
      body: JSON.stringify({ url }),
    }),
};

// ── Flows ──────────────────────────────────────────────────────────────────────

export interface APIFlowStep {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_color: string;
  role: string;
  desc: string;
  status: string;
  result?: string;
  llm?: string;
  code?: string;
  file_path?: string;
  spec_draft?: string;
  order: number;
  tokens_input?: number;
  tokens_output?: number;
  llm_duration_ms?: number;
}

export interface APIFlow {
  id: string;
  story: string;
  status: string;
  spec?: string;
  enriched_story?: string;
  created_at: string;
  steps: APIFlowStep[];
}

export interface FlowCreateParams {
  story: string;
  workspace_id?: string;
  agent_models?: Record<string, string>;
  llm_keys?: Record<string, string>;
  enriched_story?: string;
  workspace_context?: string;
  agents_order?: string[];  // execution order defined by PO in SDD
  role_docs?: Record<string, string>;  // per-role docs: { "dev-back": "techDocs...", "qa": "testDocs..." }
  custom_prompts?: Record<string, string>;  // per-agent custom system prompts from AgentCanvas
  agent_workspace_ids?: Record<string, string[]>;  // per-agent workspace assignments: { "dev-back": ["ws1","ws2"] }
}

export const flowsApi = {
  create: (params: FlowCreateParams) =>
    request<APIFlow>('/flows', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  list: () => request<APIFlow[]>('/flows'),

  get: (id: string) => request<APIFlow>(`/flows/${id}`),

  delete: (id: string) => request<void>(`/flows/${id}`, { method: 'DELETE' }),

  /** SSE URL — passes token as query param since EventSource can't set headers */
  sseUrl: (id: string): string => {
    const token = getToken();
    return `${BASE}/flows/${id}/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
};

// ── Workspaces ─────────────────────────────────────────────────────────────────

export interface APIWorkspace {
  id: string;
  name: string;
  desc: string;
  color: string;
  files: { name: string; size: number; type: string }[];
  urls: string[];
  stack: string[];
}

// ── GitHub Proxy ──────────────────────────────────────────────────────────────

export interface GHProxyResponse {
  status: number;
  data: unknown;
  error?: string;
}

export const githubApi = {
  proxy: (path: string, githubToken: string, method: string = 'GET', body?: unknown) =>
    request<GHProxyResponse>('/github/proxy', {
      method: 'POST',
      body: JSON.stringify({ path, method, body, github_token: githubToken }),
    }),
};

// ── Workspaces ─────────────────────────────────────────────────────────────────

export const workspacesApi = {
  list: () => request<APIWorkspace[]>('/workspaces'),

  create: (name: string, desc: string, color: string) =>
    request<APIWorkspace>('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name, desc, color }),
    }),

  delete: (id: string) => request<void>(`/workspaces/${id}`, { method: 'DELETE' }),

  addUrl: (id: string, url: string) =>
    request<APIWorkspace>(`/workspaces/${id}/urls`, {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  removeUrl: (id: string, url: string) =>
    request<void>(`/workspaces/${id}/urls/${encodeURIComponent(url)}`, {
      method: 'DELETE',
    }),

  updateStack: (id: string, stack: string[]) =>
    request<APIWorkspace>(`/workspaces/${id}/stack`, {
      method: 'PUT',
      body: JSON.stringify({ stack }),
    }),

  getKBContext: (id: string) =>
    request<{ context: string }>(`/workspaces/${id}/kb-context`),

  getFileContent: (wsId: string, filename: string) =>
    request<{ name: string; content: string }>(`/workspaces/${wsId}/files/${encodeURIComponent(filename)}/content`),
};
