/**
 * LLM Engine — Hexora
 *
 * Chamadas reais para todos os provedores configurados.
 * Fallback automático para mock se a chave não estiver configurada.
 * Emite traces para useLLMTraceStore (visível no painel REQUESTS).
 */

import { useLLMTraceStore } from '../store/useLLMTraceStore';
import { useAuthStore } from '../store/useAuthStore';
import { TEAM } from '../constants';
import { getToken, setToken } from '../lib/api';

function getFirebaseUserId(): string {
  return useAuthStore.getState().user?.id || '';
}

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface LLMCallParams {
  agentId: string;
  agentRole: string;
  modelId: string;        // ex: "claude:claude-sonnet-4-5"
  apiKey: string;
  story: string;
  previousSteps: { role: string; result: string }[];
  customPrompt?: string;  // prompt configurado no AgentCanvas pelo usuário
  workspaceContext?: string;
  codeGen?: boolean;      // gera código real ao invés de análise
}

export interface LLMResult {
  text: string;
  tokensInput?: number;
  tokensOutput?: number;
}

// ── System prompts por papel ─────────────────────────────────────────────────
//
// Usados quando o usuário NÃO configurou um prompt customizado no AgentCanvas.
// São intencionalmente concisos para que a resposta caiba em uma bolha.

export const ROLE_PROMPTS: Record<string, string> = {
  po: `Você é Product Owner sênior em um time ágil de software.
Analise a história de usuário fornecida e entregue:
- Critérios de aceite claros e testáveis (formato: "Dado/Quando/Então")
- Identificação de ambiguidades ou informações faltantes
- Definition of Done em 1 frase

Responda em português, de forma direta e técnica. Máximo 3 frases.`,

  pm: `Você é Product Manager experiente.
Para a história de usuário fornecida, avalie:
- Impacto no roadmap e prioridade relativa
- Principais riscos de escopo ou dependências externas
- Recomendação de sprint ou milestone

Responda em português, objetivo e direto. Máximo 2 frases.`,

  'dev-back': `Você é Engenheiro Backend sênior (Node.js/Python/Go).
Para a história de usuário fornecida, defina:
- Endpoints REST/GraphQL necessários (verbo + rota)
- Modelo de dados ou migration relevante
- Principal risco técnico ou ponto de atenção

Responda em português, com termos técnicos precisos. Máximo 3 frases.`,

  'dev-front': `Você é Engenheiro Frontend sênior (React/TypeScript).
Para a história de usuário fornecida, descreva:
- Componentes React e hooks necessários
- Integração com API e gerenciamento de estado
- Decisão técnica crítica de implementação

Responda em português, de forma técnica e concisa. Máximo 3 frases.`,

  'eng-dados': `Você é Engenheiro de Dados sênior (Spark/dbt/SQL).
Para a história de usuário fornecida, especifique:
- Modelagem de dados ou pipeline necessário
- Queries, views ou transformações relevantes
- Latência esperada e riscos de qualidade de dados

Responda em português, com termos técnicos. Máximo 3 frases.`,

  qa: `Você é QA Engineer sênior especializado em automação de testes.
Para a história de usuário fornecida, liste:
- 3 casos de teste críticos (happy path + 2 edge cases)
- Principal risco de regressão
- Critério de bloqueio para release

Responda em português, de forma específica e testável. Máximo 3 frases.`,

  design: `Você é Designer UX/UI sênior com domínio de design systems.
Para a história de usuário fornecida, especifique:
- Componentes visuais do design system a utilizar ou criar
- Principal decisão de UX (fluxo, feedback, estados)
- Ponto de handoff para o time de front-end

Responda em português, de forma clara e orientada à implementação. Máximo 3 frases.`,

  devops: `Você é Engenheiro DevOps sênior especializado em IaC e cloud AWS.
Para a história de usuário e código gerado pela equipe, identifique:
- Recursos de infraestrutura necessários (compute, banco, fila, storage, rede)
- Estratégia de deploy recomendada (ECS Fargate, Lambda, EC2, etc.)
- Riscos de segurança ou custo a considerar

Responda em português, de forma técnica e concisa. Máximo 3 frases.`,
};

// ── PO Refinement prompts ────────────────────────────────────────────────────

// ── SDD Section enum ────────────────────────────────────────────────────────
export const SDD_SECTIONS = [
  'overview',        // Visão geral / Problema
  'requirements',    // Requisitos funcionais
  'non_functional',  // Requisitos não-funcionais
  'architecture',    // Arquitetura proposta
  'data_model',      // Modelagem de dados
  'api_contracts',   // Contratos de API
  'ui_components',   // Componentes de UI / Telas
  'test_strategy',   // Estratégia de testes
  'infrastructure',  // Infraestrutura / Deploy
  'risks',           // Riscos e trade-offs
  'agents',          // Agentes designados
] as const;

export type SDDSectionKey = typeof SDD_SECTIONS[number];

export const SDD_REQUIRED_SECTIONS: SDDSectionKey[] = ['overview', 'requirements', 'test_strategy', 'agents'];

export const SDD_SECTION_LABELS: Record<SDDSectionKey, string> = {
  overview: 'Visão Geral',
  requirements: 'Requisitos Funcionais',
  non_functional: 'Requisitos Não-Funcionais',
  architecture: 'Arquitetura Proposta',
  data_model: 'Modelagem de Dados',
  api_contracts: 'Contratos de API',
  ui_components: 'Componentes de UI',
  test_strategy: 'Estratégia de Testes',
  infrastructure: 'Infraestrutura / Deploy',
  risks: 'Riscos e Trade-offs',
  agents: 'Agentes Designados',
};

export interface SDDAgents {
  needed: string[];
  justification: string;
  order: string[];
}

export interface SDDDocument {
  [key: string]: unknown;
  overview?: string;
  requirements?: string;
  non_functional?: string;
  architecture?: string;
  data_model?: string;
  api_contracts?: string;
  ui_components?: string;
  test_strategy?: string;
  infrastructure?: string;
  risks?: string;
  agents?: SDDAgents;
  extra?: Record<string, string>;
}

export interface POResponse {
  status: 'questions' | 'ready';
  confidence_sections?: string[];
  missing_sections?: string[];
  questions?: string[];
  sdd?: SDDDocument;
}

// Agentes que geram código — se qualquer um estiver em agents_needed, QA é obrigatório
export const CODE_AGENTS = ['dev-back', 'dev-front', 'eng-dados', 'devops'];

export const PO_REFINE_PROMPT = `Você é Product Owner sênior seguindo metodologia SDD (Spec-Driven Development).
Seu objetivo é refinar uma história de usuário até produzir um Software Design Document (SDD) completo.

## SEÇÕES DO SDD

Você deve decidir quais seções são necessárias com base na história. As seções possíveis são:

- overview: Visão geral do problema e contexto (OBRIGATÓRIA)
- requirements: Requisitos funcionais detalhados (OBRIGATÓRIA)
- non_functional: Requisitos não-funcionais (performance, segurança, escala) — quando relevante
- architecture: Arquitetura proposta (componentes, serviços, integrações) — quando tem backend/infra
- data_model: Modelagem de dados (entidades, relações, migrations) — quando tem dados
- api_contracts: Contratos de API (endpoints, payloads, responses) — quando tem endpoints
- ui_components: Componentes de UI e telas (estrutura, estados, interações) — quando tem frontend/design
- test_strategy: Estratégia de testes (cenários, cobertura, ferramentas) (OBRIGATÓRIA)
- infrastructure: Infraestrutura e deploy (recursos, CI/CD, cloud) — quando tem infra
- risks: Riscos e trade-offs identificados — quando relevante
- agents: Agentes designados com justificativa e ordem de execução (OBRIGATÓRIA)

Seções que não se encaixam no enum acima devem ir no campo "extra".

## SQUAD DISPONÍVEL

Você receberá um resumo das capacidades de cada agente da squad (skills, tools, MCP servers, knowledge).
Use essa informação para:
1. Saber o que é POSSÍVEL fazer com o time disponível
2. Designar agentes com base nas skills reais deles
3. Se precisar de uma capacidade que nenhum agente tem → informe ao usuário

## PROCESSO

1. Analise a história e identifique quais seções do SDD são necessárias
2. Se falta informação para preencher alguma seção → faça perguntas objetivas (2-4 por round)
3. Se NÃO consegue identificar o tipo da tarefa (backend, frontend, etc.) → pergunte
4. Quando tiver informação suficiente para todas as seções necessárias → gere o SDD completo

## FORMATO DA RESPOSTA

Retorne APENAS JSON no formato abaixo. Sem markdown, sem texto fora do JSON.

Se precisa de mais informação:
{"status":"questions","confidence_sections":["overview","requirements"],"missing_sections":["architecture","api_contracts"],"questions":["pergunta 1","pergunta 2"]}

Se já tem informação suficiente para gerar o SDD:
{"status":"ready","confidence_sections":["overview","requirements","architecture","test_strategy","agents"],"missing_sections":[],"sdd":{"overview":"...","requirements":"...","architecture":"...","test_strategy":"...","agents":{"needed":["dev-back","qa"],"justification":"...","order":["dev-back","qa"]}}}

## REGRAS DE DESIGNAÇÃO DE AGENTES

- Analise a história e decida quais agentes são necessários — SEM regra fixa de mapeamento
- Se a história envolve múltiplas áreas (front + back + infra) → chame TODOS os envolvidos
- O campo agents.order define a ordem de execução dos agentes
- Adicione "pm" só se tiver impacto em roadmap/sprint
- NUNCA adicione agentes desnecessários
- A validação de QA obrigatório será feita pelo sistema — você NÃO precisa se preocupar com isso

## IMPORTANTE

- Retorne APENAS JSON válido
- Seja objetivo nas perguntas — máximo 4 por round
- Se um SpecKit/template do time foi fornecido, SIGA a estrutura dele como base
- As seções obrigatórias (overview, requirements, test_strategy, agents) DEVEM estar presentes no SDD final
- O SDD deve ser completo o suficiente para que cada agente possa executar sua parte sem ambiguidade`;

export const PO_SPEC_FINAL_PROMPT = `Você é Product Owner sênior.
Recebeu uma especificação aprovada pelo usuário. Resuma em 2 frases o que será implementado.
Responda em português, direto ao ponto.`;

const EXISTING_CODE_INSTRUCTION = `
IMPORTANTE — CÓDIGO EXISTENTE:
Se o contexto contiver uma seção "CODIGO EXISTENTE EM <arquivo>", você DEVE:
1. Manter toda a funcionalidade existente que NÃO conflita com a nova história
2. Adicionar/modificar APENAS o necessário para atender à história de usuário
3. Preservar imports, estrutura e convenções do código existente
4. Retornar o arquivo COMPLETO com as modificações integradas (não apenas o diff)
Se NÃO houver código existente, crie do zero.`;

const CODE_GEN_PROMPTS: Record<string, string> = {
  'dev-back': `Você é um engenheiro backend sênior.
Com base na análise da equipe, implemente o código backend completo e funcional.
${EXISTING_CODE_INSTRUCTION}

Regras obrigatórias:
- Retorne APENAS o código em um único bloco markdown (\`\`\`linguagem ... \`\`\`)
- Código completo, executável, com tratamento de erros e boas práticas
- Use a linguagem/framework mais adequado para a história (Java, Python, Node.js, Go, etc.)
- Nenhum texto fora do bloco de código`,

  'dev-front': `Você é um engenheiro frontend sênior (React/TypeScript).
Com base na análise da equipe, implemente o componente ou página React completo.
${EXISTING_CODE_INSTRUCTION}

Regras obrigatórias:
- Retorne APENAS o código em um único bloco markdown (\`\`\`tsx ... \`\`\`)
- Componente React funcional completo com TypeScript, props tipadas e hooks necessários
- Inclua imports, estilos inline básicos e estados necessários
- Nenhum texto fora do bloco de código`,

  'devops': `Você é um Engenheiro DevOps sênior especializado em Terraform e AWS.
Com base na análise da equipe e no código gerado, crie a infraestrutura como código completa.
${EXISTING_CODE_INSTRUCTION}

Regras obrigatórias:
- Retorne APENAS código Terraform em um único bloco markdown (\`\`\`hcl ... \`\`\`)
- Estruture em um único arquivo main.tf com: terraform{}, provider "aws"{}, recursos principais, outputs
- Use variáveis para region, environment, project_name, e valores sensíveis
- Recursos mínimos obrigatórios: VPC ou use default, security group, recurso de compute adequado ao stack
- Ajuste os recursos ao stack identificado no código (Lambda para funções simples, ECS Fargate para containers, RDS para banco relacional, DynamoDB para NoSQL, S3 para storage)
- Tags em todos os recursos: Environment, Project, ManagedBy = "hexora"
- Nenhum texto fora do bloco de código`,

  'qa': `Você é um QA engineer sênior especializado em automação de testes.
Com base na análise da equipe e na implementação descrita, escreva os testes completos.
${EXISTING_CODE_INSTRUCTION}

Regras obrigatórias:
- Retorne APENAS o código de teste em um único bloco markdown
- Cubra: happy path, entradas inválidas e pelo menos 2 edge cases
- Use o framework de testes padrão para a linguagem (JUnit para Java, pytest para Python, Jest para TS/JS, etc.)
- Nenhum texto fora do bloco de código`,
};

const CODE_GEN_DEFAULT = `Você é um engenheiro de software sênior.
Com base na análise da equipe, implemente o código completo e funcional.
${EXISTING_CODE_INSTRUCTION}

Regras obrigatórias:
- Retorne APENAS o código em um único bloco markdown (\`\`\`linguagem ... \`\`\`)
- Código completo, executável, seguindo boas práticas
- Nenhum texto fora do bloco de código`;

// ── Token estimation & context budget ───────────────────────────────────────

/** Aproximação rápida: 1 token ≈ 4 chars (funciona bem pra PT/EN misturado) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Limites de contexto conhecidos por provider:model (input tokens).
 * Mantém margem de segurança de 10% pra overhead de formatação da API.
 */
const MODEL_INPUT_LIMITS: Record<string, number> = {
  // Anthropic
  'claude:claude-sonnet-4-5-20250514': 180_000,
  'claude:claude-sonnet-4-5': 180_000,
  'claude:claude-opus-4-0-20250514': 180_000,
  'claude:claude-opus-4': 180_000,
  'claude:claude-haiku-3-5': 180_000,
  // OpenAI
  'gpt4:gpt-4o': 115_000,
  'gpt4:gpt-4o-mini': 115_000,
  'gpt4:gpt-4-turbo': 115_000,
  // Gemini
  'gemini:gemini-2.0-flash': 900_000,
  'gemini:gemini-2.5-pro-preview-05-06': 900_000,
  'gemini:gemini-1.5-pro': 900_000,
  // Mistral
  'mistral:mistral-large-latest': 28_000,
  'mistral:mistral-medium-latest': 28_000,
  // Groq / Llama
  'llama:llama-3.3-70b-versatile': 115_000,
  'llama:llama-3.1-8b-instant': 115_000,
  // Local
  'local:*': 7_000,
};

/** Retorna o limite de input tokens pra um modelId, com fallback conservador */
function getModelInputLimit(modelId: string): number {
  if (MODEL_INPUT_LIMITS[modelId]) return MODEL_INPUT_LIMITS[modelId];
  const provider = modelId.split(':')[0];
  // Fallback por provider
  const providerDefaults: Record<string, number> = {
    claude: 180_000,
    gpt4: 115_000,
    gemini: 900_000,
    mistral: 28_000,
    llama: 115_000,
    local: 7_000,
  };
  return providerDefaults[provider] ?? 28_000; // conservador
}

/**
 * Trunca o contexto pra caber no budget de tokens do modelo.
 * Ordem de corte: previous_outputs (mais antigos primeiro) → workspace_context → story
 */
function fitContextToBudget(
  sys: string,
  story: string,
  prev: { role: string; result: string }[],
  workspaceCtx: string | undefined,
  maxOutputTokens: number,
  modelId: string,
): { user: string; truncated: boolean } {
  const inputLimit = getModelInputLimit(modelId);
  const budget = inputLimit - maxOutputTokens - estimateTokens(sys) - 200; // 200 = overhead

  // Monta as partes e mede
  let currentPrev = [...prev];
  let currentWs = workspaceCtx ?? '';
  let truncated = false;

  const measure = () => {
    const parts: string[] = [`História de usuário:\n"${story}"`];
    if (currentWs) parts.push(`Contexto do produto:\n${currentWs}`);
    if (currentPrev.length > 0) {
      parts.push(`Análises anteriores da equipe:\n${currentPrev.map((s) => `${s.role}: ${s.result}`).join('\n')}`);
    }
    parts.push('Sua análise/contribuição:');
    return parts.join('\n\n');
  };

  let msg = measure();

  // 1) Remove previous_outputs mais antigos primeiro
  while (estimateTokens(msg) > budget && currentPrev.length > 1) {
    currentPrev = currentPrev.slice(1); // remove o mais antigo
    truncated = true;
    msg = measure();
  }

  // 2) Trunca workspace context pela metade até caber
  while (estimateTokens(msg) > budget && currentWs.length > 500) {
    currentWs = currentWs.slice(0, Math.floor(currentWs.length / 2)) + '\n... (contexto truncado)';
    truncated = true;
    msg = measure();
  }

  // 3) Remove workspace inteiro se ainda não couber
  if (estimateTokens(msg) > budget && currentWs) {
    currentWs = '';
    truncated = true;
    msg = measure();
  }

  // 4) Último recurso: trunca a story
  if (estimateTokens(msg) > budget) {
    const storyBudget = (budget - 500) * 4; // chars disponíveis
    if (story.length > storyBudget) {
      story = story.slice(0, storyBudget) + '\n... (história truncada)';
      truncated = true;
      msg = measure();
    }
  }

  if (truncated) {
    console.warn(`[HEXORA LLM] Contexto truncado pra caber no modelo ${modelId} (budget: ${budget} tokens, usado: ${estimateTokens(msg)} tokens)`);
  }

  return { user: msg, truncated };
}

function systemPrompt(agentId: string, customPrompt?: string, codeGen?: boolean): string {
  if (codeGen) return CODE_GEN_PROMPTS[agentId] ?? CODE_GEN_DEFAULT;
  if (customPrompt?.trim()) return customPrompt.trim();
  return ROLE_PROMPTS[agentId] ?? `Você é especialista em ${agentId}. Responda de forma técnica e concisa em português. Máximo 2 frases.`;
}

// ── Config ───────────────────────────────────────────────────────────────────
// API_BASE_URL: URL do backend Hexora. Se vazio, chamadas vão direto pro provider (legacy).
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── Backend proxy call ──────────────────────────────────────────────────────

async function callViaBackend(
  modelId: string,
  agentId: string,
  agentRole: string,
  apiKey: string,
  sys: string,
  user: string,
  maxTok: number,
): Promise<LLMResult> {
  const userId = getFirebaseUserId();

  const payload = {
    agent_id: agentId,
    agent_role: agentRole,
    model_id: modelId,
    system_prompt: sys,
    user_message: user,
    max_tokens: maxTok,
    user_id: userId,
    api_key: apiKey,  // fallback until keys are migrated to backend DB
  };

  const buildHeaders = () => {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/llm/chat`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    });
  } catch (fetchErr) {
    const hint = modelId.startsWith('local:')
      ? ' Verifique se o Ollama esta rodando e se localhost nao esta sendo bloqueado pelo proxy corporativo.'
      : ' Verifique se o backend esta rodando e acessivel.';
    throw new Error(`Falha na conexao com o backend (${API_BASE_URL}).${hint}`);
  }

  // Auto-refresh token on 401
  if (res.status === 401) {
    try {
      const authUser = useAuthStore.getState().user;
      if (authUser) {
        // Try firebase-sync first (if Firebase is active), then re-login is up to user
        const { auth: fbAuth } = await import('../lib/firebase').catch(() => ({ auth: null }));
        const fbUser = fbAuth?.currentUser;
        if (fbUser) {
          const syncRes = await fetch(`${API_BASE_URL}/auth/firebase-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firebase_uid: fbUser.uid,
              email: fbUser.email,
              name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
            }),
          });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            setToken(syncData.access_token);
            res = await fetch(`${API_BASE_URL}/llm/chat`, {
              method: 'POST',
              headers: buildHeaders(),
              body: JSON.stringify(payload),
            });
          }
        }
      }
    } catch { /* ignore refresh failure */ }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err?.detail ?? res.statusText);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { text: data.text ?? '', tokensInput: data.tokens_input ?? 0, tokensOutput: data.tokens_output ?? 0 };
}

// ── Entry point ──────────────────────────────────────────────────────────────

export async function callAgentLLM(params: LLMCallParams): Promise<LLMResult> {
  const { modelId, apiKey, agentId } = params;
  const agentDef = TEAM.find((t) => t.id === agentId);
  const { addTrace, updateTrace } = useLLMTraceStore.getState();

  const sys    = systemPrompt(agentId, params.customPrompt, params.codeGen);
  const isPO = agentId === 'po';
  const maxTok = params.codeGen ? 4096 : isPO ? 2000 : 800;

  // Ajusta contexto pra caber no budget do modelo
  const { user, truncated } = fitContextToBudget(
    sys, params.story, params.previousSteps, params.workspaceContext,
    maxTok, modelId,
  );
  if (truncated) {
    console.warn(`[HEXORA LLM] Contexto do agente ${agentId} foi truncado pra caber no modelo`);
  }

  // ── Validação de configuração ──────────────────────────────────────────────
  const missingModel = !modelId || !modelId.includes(':');
  const provider     = missingModel ? 'config' : modelId.split(':')[0];
  const model        = missingModel ? '' : modelId.split(':').slice(1).join(':');

  const traceId = addTrace({
    agentId,
    agentName: agentDef?.name ?? agentId,
    agentColor: agentDef?.color ?? '#9ca3af',
    provider,
    model: model || '—',
    status: 'pending',
    systemPrompt: sys,
    userMessage: user,
  });

  if (missingModel) {
    const msg = `${agentDef?.name ?? agentId}: nenhum modelo selecionado. Abra Agent Config → selecione provedor e modelo.`;
    updateTrace(traceId, { status: 'error', error: msg, duration: 0 });
    console.warn('[HEXORA LLM]', msg);
    return { text: `⚠ ${msg}` };
  }

  // ── Chamada via backend proxy (todas chamadas LLM passam pelo backend) ────
  console.group(`%c[HEXORA LLM] ${provider.toUpperCase()} → ${agentDef?.name ?? agentId}`, 'color:#7c3aed;font-weight:bold');
  console.log('%cMODEL',  'color:#fbbf24', model);
  console.log('%cROUTE',  'color:#38bdf8', 'backend proxy');

  const t0 = Date.now();
  try {
    const result = await callViaBackend(modelId, agentId, params.agentRole, apiKey, sys, user, maxTok);

    const duration = Date.now() - t0;
    updateTrace(traceId, { status: 'success', response: result.text, duration, tokensInput: result.tokensInput, tokensOutput: result.tokensOutput });
    console.log(`%cRESPONSE %c(${duration}ms)`, 'color:#4ade80;font-weight:bold', 'color:#6b7280', result.text);
    console.groupEnd();
    return result;
  } catch (err) {
    const duration = Date.now() - t0;
    const msg = (err as Error).message ?? String(err);
    updateTrace(traceId, { status: 'error', error: msg, duration });
    console.error(`%cERROR %c(${duration}ms)`, 'color:#f87171;font-weight:bold', 'color:#6b7280', err);
    console.groupEnd();
    return { text: `Erro ${provider}: ${msg.slice(0, 100)}` };
  }
}

// All LLM calls go through the backend proxy — no direct external calls from browser.

