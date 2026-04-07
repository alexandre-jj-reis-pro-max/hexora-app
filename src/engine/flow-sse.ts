/**
 * Flow SSE Client — connects to backend SSE stream and dispatches events.
 * Reconnects with exponential backoff if connection drops.
 */

import { flowsApi } from '../lib/api';

export interface SSECallbacks {
  onStepUpdate: (stepId: string, status: string, result?: string, tokensInput?: number, tokensOutput?: number) => void;
  onLog: (text: string, tag?: { label: string; type: string }) => void;
  onAgentMove: (agentId: string, col: number, row: number) => void;
  onAgentBubble: (agentId: string, text: string, isCoord: boolean) => void;
  onAgentBubbleClear: (agentId: string) => void;
  onAgentWorking: (agentId: string, working: boolean) => void;
  onFlowDone: (status: 'done' | 'error') => void;
}

export function subscribeFlow(flowId: string, callbacks: SSECallbacks): () => void {
  let source: EventSource | null = null;
  let closed = false;
  let retryCount = 0;
  const MAX_RETRIES = 5;

  function connect() {
    if (closed) return;
    const url = flowsApi.sseUrl(flowId);
    source = new EventSource(url);

    source.onopen = () => {
      retryCount = 0; // Reset on successful connection
    };

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'step_update':
            callbacks.onStepUpdate(data.step_id, data.status, data.result, data.tokens_input, data.tokens_output);
            break;
          case 'log':
            callbacks.onLog(data.text, data.tag);
            break;
          case 'agent_move':
            callbacks.onAgentMove(data.agent_id, data.col, data.row);
            break;
          case 'agent_bubble':
            callbacks.onAgentBubble(data.agent_id, data.text, data.is_coord ?? false);
            break;
          case 'agent_bubble_clear':
            callbacks.onAgentBubbleClear(data.agent_id);
            break;
          case 'agent_working':
            callbacks.onAgentWorking(data.agent_id, data.working);
            break;
          case 'flow_done':
            callbacks.onFlowDone(data.status);
            cleanup();
            break;
        }
      } catch {
        // Ignore parse errors (keepalive comments, etc.)
      }
    };

    source.onerror = () => {
      if (closed || source?.readyState === EventSource.CLOSED) return;

      source?.close();
      retryCount++;

      if (retryCount > MAX_RETRIES) {
        callbacks.onLog('Conexao SSE perdida apos 5 tentativas. Verifique se o backend esta rodando.', { label: 'alert', type: 'alert' });
        callbacks.onFlowDone('error');
        closed = true;
        return;
      }

      // Exponential backoff: 2s, 4s, 8s, 16s, 32s
      const delay = Math.min(2000 * Math.pow(2, retryCount - 1), 32000);
      callbacks.onLog(`Reconectando ao backend em ${delay / 1000}s... (tentativa ${retryCount}/${MAX_RETRIES})`, { label: 'sync', type: 'sync' });
      setTimeout(connect, delay);
    };
  }

  function cleanup() {
    closed = true;
    source?.close();
  }

  connect();
  return cleanup;
}
