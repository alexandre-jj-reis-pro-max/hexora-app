/**
 * Flow Sync — sincroniza estado de flows/steps com o backend.
 * Todas as chamadas são fire-and-forget (não bloqueiam a orquestração).
 * Se o backend estiver offline, falha silenciosamente.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function getToken(): string {
  return localStorage.getItem('hexora_token') || '';
}

async function api(path: string, method: 'POST' | 'PUT' | 'GET' = 'GET', body?: unknown) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null; // backend offline — fail silently
  }
}

// ── Flow CRUD ─────────────────────────────────────────────────────────────────

export async function syncCreateFlow(flow: {
  id: string;
  story: string;
  status: string;
  workspaceId?: string;
  spec?: string;
  enrichedStory?: string;
}) {
  return api('/flows', 'POST', {
    story: flow.story,
    workspace_id: flow.workspaceId,
  });
}

export async function syncUpdateFlow(flowId: string, data: {
  status?: string;
  spec?: string;
  enriched_story?: string;
}) {
  return api(`/flows/${flowId}`, 'PUT', data);
}

export async function syncUpdateStep(flowId: string, stepId: string, data: {
  status?: string;
  result?: string;
  code?: string;
  file_path?: string;
  spec_draft?: string;
}) {
  return api(`/flows/${flowId}/steps/${stepId}`, 'PUT', data);
}

export async function syncAddStep(flowId: string, step: {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_color: string;
  role: string;
  desc: string;
  status?: string;
  llm?: string;
  order?: number;
}) {
  return api(`/flows/${flowId}/steps`, 'POST', step);
}

export async function syncLoadFlows(): Promise<unknown[] | null> {
  return api('/flows');
}

export async function syncGetFlow(flowId: string) {
  return api(`/flows/${flowId}`);
}
