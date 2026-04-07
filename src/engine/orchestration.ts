import { TEAM, COORD_POS } from '../constants';
import type { FlowStep } from '../types';

export interface StoryAnalysis {
  hasInfo: boolean;
  needsData: boolean;
  needsDesign: boolean;
  needsFrontend: boolean;
  needsInfra: boolean;
  poFeedback: string;
  poFeedback2?: string;
  tlFeedback: string;
  devTask: string;
  qaTask: string;
  engTask?: string;
}

export const STORY_EXAMPLES_DATA: Array<{ title: string; text: string; a: StoryAnalysis }> = [
  {
    title: 'Login com Google OAuth',
    text: 'Como usuário quero fazer login com Google OAuth para acessar o sistema sem criar senha.',
    a: { hasInfo: true, needsData: false, needsDesign: false, needsFrontend: true, needsInfra: false, poFeedback: 'Aceite: OAuth 2.0, refresh token, logout.', tlFeedback: 'Passport.js. Risco: segurança de tokens.', devTask: 'OAuth callback, session storage, rota /auth/google.', qaTask: 'Fluxo happy path, token expirado, login duplicado.' },
  },
  {
    title: 'Dashboard de métricas',
    text: 'Quero um dashboard mostrando métricas em tempo real do sistema.',
    a: { hasInfo: false, needsData: true, needsDesign: false, needsFrontend: true, needsInfra: false, poFeedback: 'Info insuficiente — quais métricas? intervalo? público?', poFeedback2: 'p95 latência, RPS, error rate. Atualização 5s.', tlFeedback: 'WebSocket real-time. ENG DADOS modela as queries.', devTask: 'Componente React + charts. WS /metrics/stream.', qaTask: 'Reconexão WS, edge cases, responsividade.' },
  },
  {
    title: 'Notificação push mobile',
    text: 'Usuários devem receber push notification quando tiverem nova mensagem.',
    a: { hasInfo: true, needsData: false, needsDesign: false, needsFrontend: false, needsInfra: false, poFeedback: 'iOS e Android, deep link, opt-out nas config.', tlFeedback: 'Firebase FCM. Atenção: APNS para iOS.', devTask: 'FCM SDK, device token, endpoint de envio.', qaTask: 'Background, foreground e dispositivo offline.' },
  },
  {
    title: 'Exportar relatório PDF',
    text: 'Como gestor quero exportar o relatório mensal em PDF com gráficos.',
    a: { hasInfo: true, needsData: false, needsDesign: false, needsFrontend: true, needsInfra: false, poFeedback: 'Resumo executivo, gráficos KPIs. Max 2MB.', tlFeedback: 'Puppeteer server-side. Fila Bull para geração async.', devTask: 'Endpoint /reports/:id/pdf, template HTML, job queue.', qaTask: 'Dados grandes, timeout, download correto.' },
  },
  {
    title: 'Pipeline ML de recomendação',
    text: 'Quero sistema de recomendação de produtos baseado no histórico do usuário.',
    a: { hasInfo: false, needsData: true, needsDesign: false, needsFrontend: false, needsInfra: false, poFeedback: 'Cold start? Quantos itens? A/B test?', poFeedback2: '5 itens, collaborative filtering, cold start top trending.', tlFeedback: 'ENG DADOS lidera. FastAPI para serving. Redis cache.', engTask: 'Spark ALS. Pipeline retreino semanal.', devTask: 'Endpoint /recommendations/:userId.', qaTask: 'Diversidade, latência <200ms, fallback cold start.' },
  },
];

/** Analisa a história de usuário por palavras-chave para montar o fluxo de agentes */
export function analyzeStory(story: string): StoryAnalysis {
  const s = story.toLowerCase();

  // Story has a clear directive (action verb) → PO only once
  const hasDirective = /criar|crie|implementar|implemente|desenvolver|desenvolva|build|make|criar|adicionar|adicione|create|implement|add\b/.test(s);

  // Needs data/analytics layer
  const needsData = /dados|data|m[eé]trica|metrics|pipeline|ml|machine.learning|analytics|relat[oó]rio|spark|query|sql/.test(s);

  // Needs frontend work
  const hasFrontendKw = /\bui\b|interface|tela|screen|componente|dashboard|layout|\bfront|\breact\b|\bnext\b|\bvue\b/.test(s);

  // Needs design / figma
  const needsDesign = /design|figma|\bux\b|prot[oó]tipo|wireframe/.test(s);

  // Needs infra — only explicit infra/cloud keywords (NOT just any action verb)
  const needsInfra = /deploy|infra|terraform|cloud|aws|gcp|azure|docker|container|kubernetes|k8s|lambda|serverless|ecs|ec2|rds|s3\b|api.?gateway|fargate|ci.?cd|pipeline.?deploy/.test(s);

  return {
    hasInfo: story.trim().length > 70 || hasDirective,
    needsData,
    needsDesign,
    needsFrontend: hasFrontendKw,
    needsInfra,
    poFeedback: '',
    tlFeedback: '',
    devTask: '',
    qaTask: '',
  };
}

export function buildFlowSteps(
  an: StoryAnalysis,
  agentModels: Record<string, string>,
  squadAgentIds?: string[],
): FlowStep[] {
  const steps: FlowStep[] = [];
  const getAgent = (id: string) => TEAM.find((t) => t.id === id)!;
  const llmOf = (id: string) => agentModels[id] || '';
  // coord is always active; squad filter only applies to non-coord agents
  const inSquad = (id: string) => id === 'coord' || !squadAgentIds || squadAgentIds.includes(id);

  const push = (agentId: string, desc: string): void => {
    if (!inSquad(agentId)) return;
    const ag = getAgent(agentId);
    steps.push({
      id: `step-${Date.now()}-${Math.random()}`,
      agentId,
      agentName: ag.name,
      agentColor: ag.color,
      role: ag.role,
      desc,
      status: 'pending',
      llm: llmOf(agentId),
    });
  };

  push('coord', 'Analisar história e mapear fluxo');
  push('po', 'Refinar critérios de aceite');
  if (!an.hasInfo) push('po', 'Coletar informações adicionais');
  if (an.needsData) push('eng-dados', 'Modelagem e pipeline de dados');
  if (an.needsDesign) push('design', 'Especificação UI/UX');
  // Dev back: always unless story is purely frontend/design
  if (!an.needsFrontend || an.needsData || an.needsInfra || !an.needsDesign) push('dev-back', 'Implementar backend');
  if (an.needsFrontend) push('dev-front', 'Implementar frontend');
  push('qa', 'Validação e testes');
  if (an.needsInfra) push('devops', 'Avaliar e provisionar infraestrutura');
  push('coord', 'Entrega confirmada');

  return steps;
}

export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function isoPos(col: number, row: number, vw: number) {
  const ox = vw / 2 - 160, oy = 135;
  return { x: ox + (col - row) * 32, y: oy + (col + row) * 16 };
}

export const COORD_SCREEN_COL = COORD_POS.col - 1;
export const COORD_SCREEN_ROW = COORD_POS.row + 1;
