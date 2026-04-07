import type { Provider, TeamMember, Workspace } from '../types';

export const PROVIDERS: Provider[] = [
  { id: 'claude',  name: 'Claude',  org: 'Anthropic', logo: '🟠', models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'] },
  { id: 'gpt4',   name: 'GPT-4o',  org: 'OpenAI',    logo: '🟢', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  { id: 'gemini', name: 'Gemini',  org: 'Google',    logo: '🔵', models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'] },
  { id: 'mistral',name: 'Mistral', org: 'Mistral AI',logo: '🟣', models: ['mistral-large', 'mistral-medium', 'mistral-small'] },
  { id: 'llama',  name: 'Llama 3', org: 'Meta/Groq', logo: '⚫', models: ['llama-3.3-70b', 'llama-3.1-8b'] },
  { id: 'local',  name: 'Local',   org: 'Ollama/vLLM', logo: '🦙', models: ['llama3.1', 'llama3.2', 'codellama', 'mistral', 'deepseek-coder-v2'] },
];

export const TEAM: TeamMember[] = [
  {
    id: 'coord',    name: 'Coord', role: 'COORDENADOR', color: '#fbbf24',
    bg: '#78350f',  isCoord: true,  desk: { col: 2, row: 6 }, sprite: 'coord',
    desc: 'Ponto central de orquestração. Recebe histórias e direciona o fluxo.',
    flow: ['Analisar intent', 'Decidir agentes', 'Monitorar execução'],
  },
  {
    id: 'dev-back', name: 'Leo',   role: 'DEV BACK',   color: '#60a5fa',
    bg: '#1e3a5f',  isCoord: false, desk: { col: 4, row: 4 }, sprite: 'dev',
    desc: 'Backend, APIs, banco de dados, infra de código.',
    flow: ['Implementar endpoints', 'Revisar PRs', 'Arquitetura de dados'],
  },
  {
    id: 'dev-front',name: 'Nina',  role: 'DEV FRONT',  color: '#818cf8',
    bg: '#1e1b4b',  isCoord: false, desk: { col: 4, row: 9 }, sprite: 'front',
    desc: 'Interfaces, componentes, performance de UI.',
    flow: ['Construir componentes', 'Integrar APIs', 'Testes de UI'],
  },
  {
    id: 'eng-dados',name: 'Vitor', role: 'ENG DADOS',  color: '#38bdf8',
    bg: '#0c2a4a',  isCoord: false, desk: { col: 9, row: 4 }, sprite: 'data',
    desc: 'Pipelines, modelos ML, analytics e qualidade de dados.',
    flow: ['Modelar dados', 'Treinar modelos', 'Criar pipelines'],
  },
  {
    id: 'qa',       name: 'Bia',   role: 'QA',         color: '#4ade80',
    bg: '#14532d',  isCoord: false, desk: { col: 9, row: 9 }, sprite: 'qa',
    desc: 'Testes, automação, validação de critérios de aceite.',
    flow: ['Escrever testes', 'Validar staging', 'Reportar bugs'],
  },
  {
    id: 'pm',       name: 'Ju',    role: 'P.MANAGER',  color: '#fb923c',
    bg: '#431407',  isCoord: false, desk: { col: 14, row: 4 }, sprite: 'pm',
    desc: 'Roadmap, planejamento de sprint, alinhamento com stakeholders.',
    flow: ['Priorizar backlog', 'Atualizar roadmap', 'Gerenciar riscos'],
  },
  {
    id: 'po',       name: 'Fer',   role: 'P.OWNER',    color: '#34d399',
    bg: '#0f3322',  isCoord: false, desk: { col: 14, row: 9 }, sprite: 'po',
    desc: 'Critérios de aceite, refinamento de histórias, voz do cliente.',
    flow: ['Refinar histórias', 'Validar entrega', 'Gerir backlog'],
  },
  {
    id: 'design',   name: 'Maya',  role: 'DESIGNER',   color: '#f472b6',
    bg: '#500724',  isCoord: false, desk: { col: 19, row: 4 }, sprite: 'design',
    desc: 'UI/UX, protótipos Figma, design system.',
    flow: ['Prototipar no Figma', 'Revisar UI', 'Handoff para front'],
  },
  {
    id: 'devops',   name: 'Ops',   role: 'DEVOPS',     color: '#f97316',
    bg: '#431407',  isCoord: false, desk: { col: 19, row: 9 }, sprite: 'dev',
    desc: 'Infraestrutura como código, CI/CD, cloud AWS/GCP/Azure.',
    flow: ['Gerar Terraform', 'Configurar CI/CD', 'Provisionar infra'],
  },
];

export const DEFAULT_WORKSPACES: Workspace[] = [
  { id: 'ws-1', name: 'Produto Principal', desc: 'Core da plataforma', color: '#7c3aed', files: [], urls: [], stack: [] },
  { id: 'ws-2', name: 'Mobile App',        desc: 'iOS & Android',      color: '#0ea5e9', files: [], urls: [], stack: [] },
  { id: 'ws-3', name: 'Data Platform',     desc: 'ML & Analytics',     color: '#10b981', files: [], urls: [], stack: [] },
];

export const STACK_OPTIONS = ['React', 'Next.js', 'Vue', 'Node.js', 'Python', 'FastAPI', 'PostgreSQL', 'Redis', 'Docker', 'AWS', 'Terraform', 'TypeScript'];

export const WS_COLORS = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899','#8b5cf6','#06b6d4'];

export const STORY_EXAMPLES = [
  'Login com Google OAuth',
  'Dashboard de métricas em tempo real',
  'Notificação push mobile',
  'Exportar relatório PDF',
  'Pipeline ML de recomendação',
];

// Orthogonal grid — 26 cols × 14 rows, each tile 64px on screen (16px × zoom 4)
export const GRID   = { COLS: 26, ROWS: 14 };
export const COORD_POS = { col: 11, row: 2 };
export const LOUSA_POS = { col: 11, row: 2 };
export const SPD = 0.035;

// Keep ISO for any leftover references (will clean up later)
export const ISO = { TW: 64, TH: 32, COLS: 26, ROWS: 14 };
