/**
 * Flow SSE Client — connects to backend SSE stream and dispatches events.
 *
 * Events handled:
 *   step_update  → updates flow step in store
 *   log          → adds log entry
 *   agent_move   → moves agent sprite on canvas
 *   agent_bubble → shows speech bubble
 *   agent_bubble_clear → clears speech bubble
 *   agent_working → toggles agent working animation
 *   flow_done    → marks flow as complete
 */

import { flowsApi } from '../lib/api';

export interface SSECallbacks {
  onStepUpdate: (stepId: string, status: string, result?: string) => void;
  onLog: (text: string, tag?: { label: string; type: string }) => void;
  onAgentMove: (agentId: string, col: number, row: number) => void;
  onAgentBubble: (agentId: string, text: string, isCoord: boolean) => void;
  onAgentBubbleClear: (agentId: string) => void;
  onAgentWorking: (agentId: string, working: boolean) => void;
  onFlowDone: (status: 'done' | 'error') => void;
}

/**
 * Subscribes to SSE events for a flow.
 * Returns a cleanup function to close the connection.
 */
export function subscribeFlow(flowId: string, callbacks: SSECallbacks): () => void {
  const url = flowsApi.sseUrl(flowId);
  const source = new EventSource(url);

  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'step_update':
          callbacks.onStepUpdate(data.step_id, data.status, data.result);
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
          source.close();
          break;
      }
    } catch {
      // Ignore parse errors (keepalive comments, etc.)
    }
  };

  source.onerror = () => {
    // EventSource auto-reconnects, but if the flow is done the server closes
    // the stream. We close on our side to stop reconnection attempts.
    if (source.readyState === EventSource.CLOSED) {
      return;
    }
    // After a few retries, give up
    setTimeout(() => {
      if (source.readyState !== EventSource.OPEN) {
        source.close();
        callbacks.onFlowDone('error');
      }
    }, 10000);
  };

  return () => source.close();
}
