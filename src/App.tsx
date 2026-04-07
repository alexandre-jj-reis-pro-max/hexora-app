// src/App.tsx
import { useState, useCallback, useEffect } from 'react';
import HUD from './components/hud/HUD';
import WorldCanvas from './components/world/WorldCanvas';
import StatePanel from './components/world/StatePanel';
import Log from './components/world/Log';
import StoryPanel from './components/panels/StoryPanel';
import ProfilePanel from './components/panels/ProfilePanel';
import TeamPanel from './components/panels/TeamPanel';
import WorkspacePanel from './components/panels/WorkspacePanel';
import AgentCanvas from './components/panels/AgentCanvas';
import AuthScreen from './components/auth/AuthScreen';
import { useUIStore } from './store/useUIStore';
import { useFlowStore } from './store/useFlowStore';
import { useProfileStore } from './store/useProfileStore';
import { useAuthStore } from './store/useAuthStore';
import { TEAM, LOUSA_POS } from './constants';
import { callAgentLLM, PO_REFINE_PROMPT, type SDDDocument } from './engine/llm';
import { buildSquadSummary, parsePOResponse, validateSDD, fillPlaceholders, renderSddMarkdown } from './engine/sdd';
import { delay } from './engine/orchestration';
import { subscribeFlow } from './engine/flow-sse';
import { flowsApi, workspacesApi, type FlowCreateParams } from './lib/api';
import { prepareBranch, commitToBranch, openPR, extractCodeBlocks, guessFilePath, guessTestFilePath, guessInfraFilePath, fileExistsInBranch, buildCodeContext, fetchExistingSDDs, fetchFileContent } from './engine/github';
import { useWorkspaceStore } from './store/useWorkspaceStore';
import { useProfileStore as useProfileStoreRaw } from './store/useProfileStore';
import type { AgentConfigs } from './types';

/**
 * Resolve as skills de um agente: concatena texto + arquivo + github content.
 * Retorna string com o conteúdo combinado, ou '' se nenhuma fonte configurada.
 */
function resolveAgentSkills(agentConfigs: AgentConfigs, wsId: string | null, agentId: string): string {
  const cfgKey = `${wsId}_${agentId}`;
  const skills = agentConfigs[cfgKey]?.skills;
  if (!skills) return '';

  const parts: string[] = [];
  if (skills.text?.trim()) parts.push(skills.text.trim());
  if (skills.fileContent?.trim()) parts.push(`--- ${skills.fileName || 'documento'} ---\n${skills.fileContent.trim()}`);
  if (skills.githubContent?.trim()) parts.push(`--- github doc ---\n${skills.githubContent.trim()}`);

  return parts.join('\n\n');
}
import { useWorkspaceStore as useWorkspaceStoreRaw } from './store/useWorkspaceStore';
import type { RuntimeAgent } from './components/world/WorldCanvas';
import type { Workspace, InfoQuestion, FlowStep } from './types';
type BubbleMap = Map<string, { text: string; isCoord: boolean }>;

const DEVOPS_INFO_QUESTIONS: InfoQuestion[] = [
  { key: 'project_name',  label: 'Nome do projeto',       placeholder: 'meu-projeto',   required: true  },
  { key: 'aws_region',    label: 'AWS Region',             placeholder: 'us-east-1',     required: true,  default: 'us-east-1' },
  { key: 'environment',   label: 'Ambiente',               placeholder: 'production',    required: true,  default: 'production' },
  { key: 'aws_account_id',label: 'AWS Account ID',         placeholder: '123456789012',  required: false },
  { key: 'vpc_id',        label: 'VPC ID existente',       placeholder: 'vpc-xxxxxxxx  (vazio = criar nova)', required: false },
  { key: 'extra',         label: 'Observações adicionais', placeholder: 'ex: usar Aurora Serverless, Redis ElastiCache...', required: false },
];

const CLICK_PHRASES: Record<string, string[]> = {
  'dev-back':  ['Commitei a feature!', 'PR aberto!', 'Bug corrigido'],
  'dev-front': ['Componente pronto!', 'UI integrada', 'Build ok'],
  'eng-dados': ['Pipeline rodando', 'Modelo atualizado!', 'Dados validados'],
  qa:          ['2 bugs achados!', 'Staging ok ✓', 'Testes passando'],
  pm:          ['Roadmap atualizado', 'Sprint planejada!'],
  po:          ['Critérios refinados', 'Backlog ok'],
  design:      ['Protótipo pronto!', 'Handoff feito', 'Design system ok'],
};


/** Monta o contexto de produto para injetar no prompt do agente */
function buildWsContext(
  activeWs: Workspace | undefined,
  linkedIds: string[],
  all: Workspace[],
): string {
  const relevant = all.filter((w) => w.id === activeWs?.id || linkedIds.includes(w.id));
  if (!relevant.length) return '';
  return relevant.map((ws) => {
    const lines = [`Produto: ${ws.name} — ${ws.desc}`];
    if (ws.stack.length)  lines.push(`Stack: ${ws.stack.join(', ')}`);
    if (ws.urls.length)   lines.push(`Documentação: ${ws.urls.join(', ')}`);
    if (ws.files.length)  lines.push(`Arquivos de referência: ${ws.files.map((f) => f.name).join(', ')}`);
    return lines.join('\n');
  }).join('\n\n');
}


export default function App() {
  const [bubbles, setBubbles] = useState<BubbleMap>(new Map());

  const wsDropOpen      = useUIStore((s) => s.wsDropOpen);
  const toggleWsDrop    = useUIStore((s) => s.toggleWsDrop);
  const openAgentCanvas = useUIStore((s) => s.openAgentCanvas);
  const activeWsId = useWorkspaceStore((s) => s.activeId);

  const { addFlow, addStep, updateStep, finishFlow, addLog, incEvents, loadFlows } = useFlowStore();
  const { incFlows } = useProfileStore();
  const { initAuth, user, initializing } = useAuthStore();

  // Init auth on mount — returns unsubscribe from Firebase listener
  useEffect(() => {
    const unsub = initAuth();
    return unsub;
  }, [initAuth]);

  // Load flows once authenticated
  useEffect(() => {
    if (user) loadFlows();
  }, [user, loadFlows]);

  useEffect(() => {
    if (!wsDropOpen) return;
    const handler = () => toggleWsDrop(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [wsDropOpen, toggleWsDrop]);

  // ── Visual helpers ────────────────────────────────────────────────────

  const showBubble = useCallback((agentId: string, text: string, isCoord = false) => {
    setBubbles((prev) => new Map(prev).set(agentId, { text, isCoord }));
  }, []);

  const clearBubble = useCallback((agentId: string) => {
    setBubbles((prev) => { const n = new Map(prev); n.delete(agentId); return n; });
  }, []);

  const moveAgent = useCallback((agentId: string, col: number, row: number): Promise<void> => {
    return new Promise((resolve) => {
      const a = (window._agents as RuntimeAgent[])?.find((x) => x.id === agentId);
      if (!a) { resolve(); return; }
      a.tx = col; a.ty = row; a.moving = true; a.interactTarget = resolve;
    });
  }, []);

  const backDesk = useCallback((agentId: string) => {
    const def = TEAM.find((t) => t.id === agentId);
    const a   = (window._agents as RuntimeAgent[])?.find((x) => x.id === agentId);
    if (!def || !a) return;
    a.tx = def.desk.col; a.ty = def.desk.row; a.moving = true;
  }, []);

  const handleAgentClick = useCallback((agentId: string) => {
    if (agentId === 'coord') {
      openAgentCanvas('coord');
      return;
    }
    const pool = CLICK_PHRASES[agentId] || ['Pronto!'];
    const text = pool[Math.floor(Math.random() * pool.length)];
    showBubble(agentId, text, false);
    setTimeout(() => clearBubble(agentId), 2200);
  }, [openAgentCanvas, showBubble, clearBubble]);

  // ── Frontend orchestration engine ────────────────────────────────────

  // ── approval gate — pausa a orquestração até o usuário confirmar ───────────
  const waitForApproval = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      (window as unknown as { _approvalCallback: ((ok: boolean) => void) | null })._approvalCallback =
        (ok: boolean) => {
          (window as unknown as { _approvalCallback: null })._approvalCallback = null;
          resolve(ok);
        };
    });
  }, []);

  // ── info gate — pausa até o usuário preencher informações necessárias ───────
  const waitForInfo = useCallback((): Promise<Record<string, string> | null> => {
    return new Promise((resolve) => {
      (window as unknown as { _infoCallback: ((answers: Record<string, string> | null) => void) | null })._infoCallback =
        (answers) => {
          (window as unknown as { _infoCallback: null })._infoCallback = null;
          resolve(answers);
        };
    });
  }, []);

  // ── PO Refinement loop (SDD) ────────────────────────────────────────────

  const runPORefinement = useCallback(async (
    story: string,
    activeWs: Workspace | undefined,
    agentModels: Record<string, string>,
    llmKeys: Record<string, string>,
    repoContext?: string,
  ): Promise<{ sddMarkdown: string; sddJson: SDDDocument; agentsNeeded: string[]; agentsOrder: string[] } | null> => {
    const poModelId = agentModels['po'];
    if (!poModelId) return null;

    const provider = poModelId.split(':')[0];
    const apiKey = llmKeys[provider] ?? '';
    if (!apiKey && provider !== 'local') return null;

    const flowId = `po-refine-${Date.now()}`;
    const poStep = {
      id: 'po-refine-step', agentId: 'po', agentName: 'Fer', agentColor: '#34d399',
      role: 'P.OWNER', desc: 'Refinando SDD', status: 'active' as const,
      llm: poModelId,
    };
    addFlow({ id: flowId, story: `SDD: ${story.slice(0, 30)}...`, status: 'running', steps: [poStep] });
    addLog({ text: 'PO iniciou refinamento SDD', tag: { label: 'po', type: 'agent' } });

    // Move PO para o kanban
    await moveAgent('po', LOUSA_POS.col + 1, LOUSA_POS.row);
    showBubble('po', 'Analisando historia...', false);
    window._setAgentWorking?.('po', true);

    // Build squad summary for PO context
    const { agentConfigs, squadAgentIds } = useProfileStoreRaw.getState();
    const { workspaces } = useWorkspaceStoreRaw.getState();
    const wsNames: Record<string, string> = {};
    workspaces.forEach((w) => { wsNames[w.id] = w.name; });
    const squadSummary = buildSquadSummary(squadAgentIds, agentConfigs, activeWs?.id ?? null, wsNames);

    // Resolve PO skills (speckit migrated to agent-level skills)
    const poSkills = resolveAgentSkills(agentConfigs, activeWs?.id ?? null, 'po');

    const speckitCtx = poSkills
      ? `\n\n=== SPECKIT/TEMPLATE DO TIME ===\n${poSkills}\n=== FIM DO TEMPLATE ===`
      : '';
    const squadCtx = `\n\n=== SQUAD DISPONIVEL ===\n${squadSummary}\n=== FIM DA SQUAD ===`;
    const repoCtx = repoContext ? `\n\n=== CODIGO EXISTENTE NO REPOSITORIO ===\n${repoContext}\n=== FIM DO CODIGO ===` : '';

    const conversationHistory: string[] = [];
    let finalSdd: SDDDocument | null = null;
    let round = 0;
    const MAX_SAFETY_ROUNDS = 10;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      round++;
      if (round > MAX_SAFETY_ROUNDS) {
        addLog({ text: `PO atingiu limite de ${MAX_SAFETY_ROUNDS} rounds`, tag: { label: 'po', type: 'agent' } });
        window._setAgentWorking?.('po', false);
        clearBubble('po');
        backDesk('po');
        finishFlow(flowId, 'error');
        return null;
      }

      const userCtx = conversationHistory.length > 0
        ? `\n\nHistorico de respostas do usuario:\n${conversationHistory.join('\n')}`
        : '';

      showBubble('po', round === 1 ? 'Analisando...' : `SDD round ${round}...`, false);

      const { text } = await callAgentLLM({
        agentId: 'po', agentRole: 'P.OWNER', modelId: poModelId, apiKey,
        story: story + speckitCtx + squadCtx + repoCtx + userCtx,
        previousSteps: [],
        customPrompt: PO_REFINE_PROMPT,
      });

      // LLM error
      if (!text || text.startsWith('Erro')) {
        addLog({ text: `PO: ${text || 'resposta vazia da LLM'}`, tag: { label: 'po', type: 'agent' } });
        window._setAgentWorking?.('po', false);
        clearBubble('po');
        backDesk('po');
        finishFlow(flowId, 'error');
        return null;
      }

      // Parse JSON
      const parsed = parsePOResponse(text);

      if (!parsed) {
        // Terminal JSON failure — save raw text in log and abort
        addLog({ text: `PO gerou resposta mas formato invalido. Tente novamente.`, tag: { label: 'alert', type: 'alert' } });
        addLog({ text: `Resposta raw: ${text.slice(0, 200)}...`, tag: { label: 'po', type: 'agent' } });
        window._setAgentWorking?.('po', false);
        clearBubble('po');
        backDesk('po');
        finishFlow(flowId, 'error');
        return null;
      }

      // PO has enough info — SDD ready
      if (parsed.status === 'ready' && parsed.sdd) {
        finalSdd = parsed.sdd;
        break;
      }

      // PO needs more info
      if (parsed.status === 'questions' && parsed.questions?.length) {
        clearBubble('po');
        const progress = parsed.confidence_sections?.length
          ? `${parsed.confidence_sections.length} secoes ok`
          : `Round ${round}`;
        showBubble('po', progress, false);

        const questions: InfoQuestion[] = parsed.questions.map((q, i) => ({
          key: `q${i}`, label: q, placeholder: 'Sua resposta...', required: false,
        }));

        updateStep(flowId, poStep.id, { status: 'info-request', infoRequest: questions });

        const answers = await waitForInfo();

        if (!answers) {
          window._setAgentWorking?.('po', false);
          clearBubble('po');
          backDesk('po');
          finishFlow(flowId, 'error');
          addLog({ text: 'Fluxo cancelado pelo usuario', tag: { label: 'po', type: 'agent' } });
          return null;
        }

        // Add answers to conversation history
        const answersText = Object.entries(answers)
          .filter(([, v]) => v.trim())
          .map(([k, v]) => `Round ${round} - ${questions.find(q => q.key === k)?.label}: ${v}`)
          .join('\n');
        if (answersText) conversationHistory.push(answersText);

        updateStep(flowId, poStep.id, { status: 'active', infoAnswers: answers });
        showBubble('po', 'Refinando SDD...', false);
      }
    }

    window._setAgentWorking?.('po', false);
    clearBubble('po');

    if (!finalSdd) {
      backDesk('po');
      finishFlow(flowId, 'error');
      return null;
    }

    // ── Validate SDD (code rules enforced here, not by LLM) ──────────────
    let validation = validateSDD(finalSdd);

    // Retry once for missing required sections
    if (!validation.valid) {
      showBubble('po', 'Completando secoes...', false);
      window._setAgentWorking?.('po', true);

      const missingList = validation.missingSections.join(', ');
      const { text: retryText } = await callAgentLLM({
        agentId: 'po', agentRole: 'P.OWNER', modelId: poModelId, apiKey,
        story: story + speckitCtx + squadCtx + repoCtx
          + `\n\nVoce gerou um SDD mas faltam as secoes obrigatorias: ${missingList}. Gere APENAS essas secoes faltantes no formato JSON: {"status":"ready","sdd":{...apenas as secoes faltantes...}}`,
        previousSteps: [],
        customPrompt: PO_REFINE_PROMPT,
      });

      const retryParsed = parsePOResponse(retryText);
      if (retryParsed?.sdd) {
        // Merge retry sections into main SDD
        for (const [key, value] of Object.entries(retryParsed.sdd)) {
          if (value && !(finalSdd as Record<string, unknown>)[key]) {
            (finalSdd as Record<string, unknown>)[key] = value;
          }
        }
      }

      window._setAgentWorking?.('po', false);
      clearBubble('po');

      // Re-validate — if still missing, fill placeholders
      validation = validateSDD(finalSdd);
      if (!validation.valid) {
        finalSdd = fillPlaceholders(finalSdd, validation.missingSections);
        validation = validateSDD(finalSdd);
      }
    }

    // Apply forced QA and order from validation
    if (finalSdd.agents) {
      finalSdd.agents.needed = validation.agentsNeeded;
      finalSdd.agents.order = validation.agentsOrder;
    }

    // ── Check if agents_needed is empty → ask user ───────────────────────
    if (validation.agentsNeeded.length === 0) {
      addLog({ text: 'PO nao definiu agentes — perguntando ao usuario', tag: { label: 'orch', type: 'orch' } });
      const typeFlowId = `type-${Date.now()}`;
      const typeStep = {
        id: 'ask-type', agentId: 'coord', agentName: 'Coord', agentColor: '#fbbf24',
        role: 'COORDENADOR', desc: 'Definir tipo da tarefa', status: 'info-request' as const,
        llm: 'none',
        infoRequest: [{
          key: 'taskType',
          label: 'Qual o tipo desta tarefa?',
          placeholder: 'back | front | full | data | infra | design',
          required: true,
          default: 'back',
        }],
      };
      addFlow({ id: typeFlowId, story: 'Tipo da tarefa', status: 'running', steps: [typeStep] });
      showBubble('coord', 'Qual o tipo?', true);
      const typeAnswers = await waitForInfo();
      clearBubble('coord');
      finishFlow(typeFlowId, 'done');

      if (typeAnswers) {
        const t = (typeAnswers.taskType || 'back').toLowerCase().trim();
        const typeMap: Record<string, string[]> = {
          'back':   ['dev-back', 'qa'],
          'front':  ['dev-front', 'qa', 'design'],
          'full':   ['dev-back', 'dev-front', 'qa'],
          'data':   ['eng-dados', 'dev-back', 'qa'],
          'infra':  ['devops', 'qa'],
          'design': ['design'],
        };
        const agents = typeMap[t] || typeMap['back'];
        validation.agentsNeeded = agents;
        validation.agentsOrder = agents;
        if (finalSdd.agents) {
          finalSdd.agents.needed = agents;
          finalSdd.agents.order = agents;
        }
      }
    }

    // ── Check squad — if agent missing, abort ────────────────────────────
    const missing = validation.agentsNeeded.filter((id) => !squadAgentIds.includes(id));
    if (missing.length > 0) {
      const names = missing.map((id) => {
        const t = TEAM.find((t) => t.id === id);
        return t ? `${t.name} (${t.role})` : id;
      }).join(', ');
      addLog({ text: `Agentes necessarios nao estao na squad: ${names}`, tag: { label: 'alert', type: 'alert' } });
      addLog({ text: 'Adicione-os na squad e execute novamente', tag: { label: 'alert', type: 'alert' } });

      const alertFlowId = `missing-${Date.now()}`;
      const alertStep = {
        id: 'missing-agents', agentId: 'coord', agentName: 'Coord', agentColor: '#fbbf24',
        role: 'COORDENADOR', desc: 'Agentes faltantes na squad', status: 'info-request' as const,
        llm: 'none',
        infoRequest: missing.map((id) => {
          const t = TEAM.find((t) => t.id === id);
          return { key: id, label: `${t?.name} (${t?.role}) — adicione na squad`, required: false, default: '' };
        }),
      };
      addFlow({ id: alertFlowId, story: 'Squad incompleta', status: 'running', steps: [alertStep] });
      showBubble('coord', `Faltam ${missing.length} agente(s)!`, true);
      await waitForInfo();
      clearBubble('coord');
      finishFlow(alertFlowId, 'error');
      backDesk('po');
      finishFlow(flowId, 'error');
      return null;
    }

    // ── Render SDD as markdown and show for approval ─────────────────────
    const sddMarkdown = renderSddMarkdown(finalSdd, story.slice(0, 60));

    showBubble('po', 'SDD pronto — aguardando aprovacao', false);
    updateStep(flowId, poStep.id, { status: 'spec-review', specDraft: sddMarkdown });
    const approved = await waitForApproval();
    clearBubble('po');

    if (!approved) {
      backDesk('po');
      finishFlow(flowId, 'error');
      addLog({ text: 'SDD rejeitado pelo usuario', tag: { label: 'po', type: 'agent' } });
      return null;
    }

    updateStep(flowId, poStep.id, { status: 'done', result: 'SDD aprovado' });
    finishFlow(flowId, 'done');
    backDesk('po');
    addLog({ text: 'SDD aprovado — iniciando orquestracao', tag: { label: 'po', type: 'agent' } });
    incEvents();

    return {
      sddMarkdown,
      sddJson: finalSdd,
      agentsNeeded: validation.agentsNeeded,
      agentsOrder: validation.agentsOrder,
    };
  }, [addFlow, addLog, incEvents, updateStep, finishFlow, showBubble, clearBubble, moveAgent, backDesk, waitForInfo, waitForApproval]);

  const runOrchestration = useCallback(async (story: string) => {
    // Lê estado atual das stores (fora dos hooks, safe em callbacks)
    const { agentModels, llmKeys, agentConfigs, githubToken, squadAgentIds } = useProfileStoreRaw.getState();
    const { workspaces } = useWorkspaceStoreRaw.getState();
    const wsId = activeWsId;
    const activeWs = workspaces.find((w) => w.id === wsId);

    const hasGithub = !!(githubToken && activeWs?.githubRepo);
    const baseBranch = activeWs?.githubBaseBranch ?? 'main';

    // Fetch repo code context + existing SDDs (once, shared by PO + all agents)
    let repoContext = '';
    if (hasGithub && activeWs?.githubRepo) {
      addLog({ text: 'Lendo repositorio para contexto...', tag: { label: 'orch', type: 'orch' } });
      const [codeCtx, sddsCtx] = await Promise.all([
        buildCodeContext(githubToken, activeWs.githubRepo, baseBranch, story).catch(() => ''),
        fetchExistingSDDs(githubToken, activeWs.githubRepo, baseBranch).catch(() => ''),
      ]);
      repoContext = [codeCtx, sddsCtx].filter(Boolean).join('\n\n');
    }

    // ── PO Refinement SDD (sempre ativo se PO tem modelo configurado) ────
    let sddMarkdown = '';
    let sddAgentsOrder: string[] = [];

    const poHasModel = !!agentModels['po'];
    if (!poHasModel) {
      addLog({ text: 'Configure um modelo para o PO antes de executar', tag: { label: 'alert', type: 'alert' } });
      return;
    }

    const result = await runPORefinement(story, activeWs, agentModels, llmKeys, repoContext || undefined);
    if (!result) return; // cancelado, falhou, ou squad incompleta
    sddMarkdown = result.sddMarkdown;
    sddAgentsOrder = result.agentsOrder;

    // A história enriquecida com o SDD (se houver)
    const enrichedStory = sddMarkdown
      ? `${story}\n\n--- SDD APROVADO ---\n${sddMarkdown}`
      : story;

    // ── Build workspace context to send to backend ─────────────────────
    // Fetch real KB context (file contents + URLs) from backend
    let wsContext = buildWsContext(activeWs, [], workspaces);
    if (wsId) {
      try {
        const kb = await workspacesApi.getKBContext(wsId);
        if (kb.context) wsContext = wsContext ? `${wsContext}\n\n${kb.context}` : kb.context;
      } catch { /* backend may not have KB yet — use basic context */ }
    }

    const fullContext = [wsContext, repoContext].filter(Boolean).join('\n\n');

    // Build per-agent skills docs, custom prompts, and workspace assignments
    const roleDocs: Record<string, string> = {};
    const customPrompts: Record<string, string> = {};
    const agentWorkspaceIds: Record<string, string[]> = {};
    const agentMcpServers: Record<string, { url: string; token?: string }[]> = {};
    const agentTools: Record<string, string[]> = {};
    for (const agentId of sddAgentsOrder.length > 0 ? sddAgentsOrder : squadAgentIds) {
      const skills = resolveAgentSkills(agentConfigs, activeWs?.id ?? null, agentId);
      if (skills) roleDocs[agentId] = skills;
      const cfgKey = `${activeWs?.id ?? null}_${agentId}`;
      const agentCfg = agentConfigs[cfgKey];
      if (agentCfg?.prompt?.trim()) customPrompts[agentId] = agentCfg.prompt;
      if (agentCfg?.workspaceIds?.length) agentWorkspaceIds[agentId] = agentCfg.workspaceIds;
      if (agentCfg?.mcpServers?.length) {
        agentMcpServers[agentId] = agentCfg.mcpServers.map((s) => ({ url: s.url, token: s.token }));
      }
      if (agentCfg?.tools?.length) agentTools[agentId] = agentCfg.tools;
    }

    const title = story.slice(0, 40) + (story.length > 40 ? '...' : '');

    // ── Create flow on backend — orchestration runs server-side ──────
    let apiFlow;
    try {
      const params: FlowCreateParams = {
        story,
        workspace_id: wsId,
        agent_models: agentModels,
        llm_keys: llmKeys,
        enriched_story: enrichedStory !== story ? enrichedStory : undefined,
        workspace_context: fullContext || undefined,
        agents_order: sddAgentsOrder.length > 0 ? sddAgentsOrder : undefined,
        role_docs: Object.keys(roleDocs).length > 0 ? roleDocs : undefined,
        custom_prompts: Object.keys(customPrompts).length > 0 ? customPrompts : undefined,
        agent_workspace_ids: Object.keys(agentWorkspaceIds).length > 0 ? agentWorkspaceIds : undefined,
        agent_mcp_servers: Object.keys(agentMcpServers).length > 0 ? agentMcpServers : undefined,
        agent_tools: Object.keys(agentTools).length > 0 ? agentTools : undefined,
      };
      apiFlow = await flowsApi.create(params);
    } catch (err) {
      addLog({ text: `Erro ao criar fluxo no backend: ${(err as Error).message}`, tag: { label: 'alert', type: 'alert' } });
      return;
    }

    const flowId = apiFlow.id;

    // Add the backend flow to local store
    addFlow({
      id: flowId,
      story: title,
      status: 'running',
      steps: apiFlow.steps.map((s) => ({
        id: s.id,
        agentId: s.agent_id,
        agentName: s.agent_name,
        agentColor: s.agent_color,
        role: s.role,
        desc: s.desc,
        status: s.status as 'pending',
        llm: s.llm,
      })),
    });
    incFlows();
    addLog({ text: `Fluxo iniciado: ${title}`, tag: { label: 'orch', type: 'orch' } });
    incEvents();

    // ── Subscribe to SSE — backend drives execution, we react visually ──
    await new Promise<void>((resolve) => {
      const unsubscribe = subscribeFlow(flowId, {
        onStepUpdate: (stepId, status, result) => {
          updateStep(flowId, stepId, {
            status: status as FlowStep['status'],
            ...(result != null ? { result } : {}),
          });
          incEvents();
        },
        onLog: (text, tag) => {
          addLog({ text, tag });
        },
        onAgentMove: (agentId, col, row) => {
          const a = (window._agents as RuntimeAgent[])?.find((x) => x.id === agentId);
          if (a) { a.tx = col; a.ty = row; a.moving = true; }
        },
        onAgentBubble: (agentId, text, isCoord) => {
          showBubble(agentId, text, isCoord);
        },
        onAgentBubbleClear: (agentId) => {
          clearBubble(agentId);
        },
        onAgentWorking: (agentId, working) => {
          window._setAgentWorking?.(agentId, working);
        },
        onFlowDone: (status) => {
          finishFlow(flowId, status);
          addLog({ text: status === 'done' ? 'Fluxo concluído' : 'Fluxo falhou', tag: { label: 'done', type: 'orch' } });
          incEvents();
          unsubscribe();
          resolve();
        },
      });
    });

    // ── GitHub delivery — runs locally after backend flow completes ────────
    // (GitHub delivery is interactive: requires user approval before each commit)
    if (hasGithub && activeWs?.githubRepo) {
      // Get the completed flow's steps from store to collect agent results
      const completedFlow = useFlowStore.getState().flows.find((f) => f.id === flowId);
      const flowSteps = completedFlow?.steps ?? [];
      const prevResults = flowSteps
        .filter((s) => s.status === 'done' && s.result)
        .map((s) => ({ role: s.role, result: s.result! }));

      // Derive effective squad from the flow steps the backend created
      const effectiveAgentIds = [...new Set(flowSteps.map((s) => s.agentId))];

      let branchCtx: Awaited<ReturnType<typeof prepareBranch>> | null = null;
      const committedPaths = new Set<string>(); // track committed files to avoid conflicts

      const deliveryAgentIds: { agentId: string; isTest: boolean; isInfra?: boolean }[] = [
        ...(effectiveAgentIds.includes('dev-back')  ? [{ agentId: 'dev-back', isTest: false }] : []),
        ...(effectiveAgentIds.includes('dev-front') ? [{ agentId: 'dev-front', isTest: false }] : []),
        ...(effectiveAgentIds.includes('qa')        ? [{ agentId: 'qa', isTest: true }] : []),
        ...(effectiveAgentIds.includes('devops')    ? [{ agentId: 'devops', isTest: false, isInfra: true }] : []),
      ];

      for (const { agentId, isTest, isInfra } of deliveryAgentIds) {
        const ag = TEAM.find((t) => t.id === agentId);
        if (!ag) continue;

        const deliveryStepId = `delivery-${agentId}-${Date.now()}-${Math.random()}`;
        const deliveryStep: FlowStep = {
          id: deliveryStepId, agentId, agentName: ag.name, agentColor: ag.color,
          role: ag.role, desc: 'Gerar e commitar codigo', status: 'active',
          llm: agentModels[agentId] || '',
        };

        // Add delivery step to the flow in store, then mark active
        addStep(flowId, deliveryStep);
        await moveAgent(agentId, LOUSA_POS.col + 1, LOUSA_POS.row);

        const modelId = agentModels[agentId] || '';
        const provider = modelId.split(':')[0];
        const apiKey = llmKeys[provider] ?? '';
        const cfg = agentConfigs[`${wsId}_${agentId}`];
        const wsCtx = buildWsContext(activeWs, cfg?.workspaceIds ?? [], workspaces);
        const baseBranch = activeWs?.githubBaseBranch ?? 'main';

        // DevOps: check if infra/main.tf already exists
        if (isInfra && activeWs?.githubRepo) {
          showBubble(agentId, 'Verificando infra...', false);
          const infraPath = guessInfraFilePath();
          const infraExists = await fileExistsInBranch(githubToken, activeWs.githubRepo, infraPath, baseBranch).catch(() => false);
          if (infraExists) {
            clearBubble(agentId);
            showBubble(agentId, 'Terraform ja existe', false);
            updateStep(flowId, deliveryStepId, { status: 'done', result: `infra/main.tf ja existe no repositorio` });
            await delay(1800);
            clearBubble(agentId);
            backDesk(agentId);
            continue;
          }
        }

        // DevOps: pede informacoes de infra
        let infraInfoCtx = '';
        if (isInfra) {
          clearBubble(agentId);
          showBubble(agentId, 'Preciso de info...', false);
          const questions = DEVOPS_INFO_QUESTIONS.map((q) => ({
            ...q,
            default: q.key === 'project_name'
              ? (activeWs?.name?.toLowerCase().replace(/\s+/g, '-') ?? q.default)
              : q.default,
          }));
          updateStep(flowId, deliveryStepId, { status: 'info-request', infoRequest: questions });
          const answers = await waitForInfo();
          if (!answers) {
            updateStep(flowId, deliveryStepId, { status: 'error', result: 'Cancelado pelo usuario' });
            clearBubble(agentId);
            backDesk(agentId);
            continue;
          }
          updateStep(flowId, deliveryStepId, { status: 'active', infoAnswers: answers });
          const filled = Object.entries(answers).filter(([, v]) => v.trim());
          if (filled.length > 0) {
            infraInfoCtx = `Configuracoes de infraestrutura definidas pelo usuario:\n${filled.map(([k, v]) => `${k}: ${v}`).join('\n')}`;
          }
        }

        // Fetch existing repo code for general context
        showBubble(agentId, 'Lendo repositorio...', false);
        const repoCodeCtx = await buildCodeContext(githubToken, activeWs.githubRepo, baseBranch, story).catch(() => '');
        const combinedCtx = [wsCtx, infraInfoCtx, repoCodeCtx].filter(Boolean).join('\n\n');

        // ── Pass 1: Plan files ──────────────────────────────────────────
        showBubble(agentId, 'Planejando arquivos...', false);
        window._setAgentWorking?.(agentId, true);

        const { text: planText } = await callAgentLLM({
          agentId, agentRole: deliveryStep.role, modelId, apiKey,
          story, previousSteps: prevResults,
          workspaceContext: combinedCtx || undefined,
          customPrompt: (await import('./engine/llm')).FILE_PLAN_PROMPT,
        });

        // Parse file plan JSON
        let filePlan: { path: string; description: string }[] = [];
        try {
          const jsonMatch = planText.match(/\[[\s\S]*\]/);
          if (jsonMatch) filePlan = JSON.parse(jsonMatch[0]);
        } catch { /* parse failed */ }

        // Fallback: if LLM didn't return valid plan, do single-file (legacy)
        if (!filePlan.length) {
          filePlan = [{ path: isInfra ? guessInfraFilePath() : isTest ? guessTestFilePath(story, '') : guessFilePath(story, ''), description: 'Arquivo principal' }];
        }

        addLog({ text: `${deliveryStep.role}: ${filePlan.length} arquivo(s) planejado(s)`, tag: { label: 'task', type: 'task' } });

        // ── Pass 2: Generate each file ──────────────────────────────────
        const generatedFiles: { path: string; code: string }[] = [];
        let deliveryFailed = false;

        for (let fi = 0; fi < filePlan.length; fi++) {
          const fp = filePlan[fi];
          showBubble(agentId, `[${fi + 1}/${filePlan.length}] ${fp.path.split('/').pop()}...`, false);

          // Build context from previously generated files
          const prevFilesCtx = generatedFiles.length > 0
            ? generatedFiles.map((g) => `=== ${g.path} ===\n\`\`\`\n${g.code}\n\`\`\``).join('\n\n')
            : '';

          // Read existing version of this file from repo
          let existingFileCtx = '';
          try {
            const existing = await fetchFileContent(githubToken, activeWs.githubRepo, fp.path, baseBranch);
            if (existing.trim()) {
              existingFileCtx = `\n\n=== CODIGO EXISTENTE EM ${fp.path} (MODIFIQUE/ESTENDA, NAO SUBSTITUA) ===\n\`\`\`\n${existing}\n\`\`\`\n=== FIM ===`;
            }
          } catch { /* file doesn't exist */ }

          const fileCtx = [combinedCtx, prevFilesCtx ? `Arquivos ja gerados neste projeto:\n${prevFilesCtx}` : '', existingFileCtx].filter(Boolean).join('\n\n');

          const fileStory = `${story}\n\nArquivo a gerar: ${fp.path}\nDescricao: ${fp.description}`;

          const { text: fileCode } = await callAgentLLM({
            agentId, agentRole: deliveryStep.role, modelId, apiKey,
            story: fileStory, previousSteps: prevResults,
            workspaceContext: fileCtx || undefined, codeGen: true,
          });

          const blocks = extractCodeBlocks(fileCode);
          const selectedBlock = blocks[0];
          if (!selectedBlock) continue;

          // Avoid path conflicts
          let filePath = fp.path;
          if (committedPaths.has(filePath)) {
            const ext = filePath.split('.').pop() || 'txt';
            const base = filePath.replace(/\.[^.]+$/, '');
            filePath = `${base}_${agentId}.${ext}`;
          }

          generatedFiles.push({ path: filePath, code: selectedBlock.code });

          // Show approval for each file
          window._setAgentWorking?.(agentId, false);
          clearBubble(agentId);
          showBubble(agentId, `Aprovar ${filePath.split('/').pop()}?`, false);

          updateStep(flowId, deliveryStepId, { status: 'approval', code: fileCode, filePath });
          const approved = await waitForApproval();
          clearBubble(agentId);

          if (approved) {
            showBubble(agentId, 'Commitando...', false);
            try {
              if (!branchCtx) {
                branchCtx = await prepareBranch(
                  githubToken, activeWs.githubRepo, story, activeWs.githubBaseBranch ?? 'main'
                );
              }
              await commitToBranch(branchCtx, filePath, selectedBlock.code, deliveryStep.role);
              committedPaths.add(filePath);
              addLog({ text: `${deliveryStep.role}: ${filePath} commitado [${fi + 1}/${filePlan.length}]`, tag: { label: 'deploy', type: 'deploy' } });
            } catch (err) {
              const msg = (err as Error).message ?? String(err);
              addLog({ text: `GitHub commit falhou: ${msg.slice(0, 70)}. Delivery interrompido.`, tag: { label: 'alert', type: 'alert' } });
              updateStep(flowId, deliveryStepId, { status: 'error', result: msg.slice(0, 80) });
              clearBubble(agentId);
              backDesk(agentId);
              deliveryFailed = true;
              break;
            }
            clearBubble(agentId);
            window._setAgentWorking?.(agentId, true);
          } else {
            addLog({ text: `${deliveryStep.role}: ${filePath} pulado pelo usuario`, tag: { label: 'agent', type: 'agent' } });
          }
        }

        window._setAgentWorking?.(agentId, false);

        if (deliveryFailed) break; // Stop entire delivery

        const committedByAgent = generatedFiles.filter((g) => committedPaths.has(g.path)).map((g) => g.path);
        if (committedByAgent.length > 0) {
          updateStep(flowId, deliveryStepId, { status: 'done', result: committedByAgent.join(', ') });
        } else {
          updateStep(flowId, deliveryStepId, { status: 'error', result: 'Nenhum arquivo commitado' });
        }
        clearBubble(agentId);
        backDesk(agentId);
        await delay(300);
      }

      // Commit SDD alongside code (blocking — not best-effort)
      if (branchCtx && sddMarkdown && committedPaths.size > 0) {
        try {
          const sddPath = `docs/sdd-${story.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
          await commitToBranch(branchCtx, sddPath, sddMarkdown, 'SDD');
          addLog({ text: `SDD commitado: ${sddPath}`, tag: { label: 'deploy', type: 'deploy' } });
        } catch (err) {
          const msg = (err as Error).message ?? String(err);
          addLog({ text: `SDD commit falhou: ${msg.slice(0, 70)}`, tag: { label: 'alert', type: 'alert' } });
        }
      }

      // Open PR only if at least one file was committed successfully
      if (branchCtx && committedPaths.size > 0) {
        showBubble('coord', 'Abrindo PR...', true);
        try {
          const prUrl = await openPR(branchCtx, story, prevResults);
          clearBubble('coord');
          addLog({
            text: `PR aberto: <a href="${prUrl}" target="_blank" style="color:#60a5fa;text-decoration:underline">${prUrl}</a>`,
            tag: { label: 'deploy', type: 'deploy' },
          });
        } catch (err) {
          const msg = (err as Error).message ?? String(err);
          clearBubble('coord');
          addLog({ text: `GitHub PR: ${msg.slice(0, 70)}`, tag: { label: 'alert', type: 'alert' } });
        }
      }

      incEvents();
    }
  }, [activeWsId, addFlow, incFlows, addLog, incEvents, updateStep, finishFlow, showBubble, clearBubble, moveAgent, backDesk, waitForApproval, waitForInfo]);

  // ── Render ─────────────────────────────────────────────────────────────

  if (initializing) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: '#0d0720' }}
      >
        <div
          className="font-pixel"
          style={{ fontSize: '7px', color: '#4b5563', letterSpacing: '0.2em' }}
        >
          HEXORA
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="w-screen h-screen overflow-hidden" style={{ background: '#0d0720' }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
      <HUD />
      <div className="relative" style={{ height: 'calc(100vh - 52px)', width: 'calc(100% - 260px)' }}>
        <WorldCanvas onAgentClick={handleAgentClick} agentBubbles={bubbles} />
      </div>
      <StatePanel />
      <Log />
      <StoryPanel onRunOrchestration={(story) => runOrchestration(story)} />
      <ProfilePanel />
      <TeamPanel />
      <WorkspacePanel />
      <AgentCanvas />
    </div>
  );
}
