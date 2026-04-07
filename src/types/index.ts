export interface Provider {
  id: string;
  name: string;
  org: string;
  logo: string;
  models: string[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  color: string;
  bg: string;
  isCoord: boolean;
  desk: { col: number; row: number };
  sprite: string;
  desc: string;
  flow: string[];
}

export interface Agent extends TeamMember {
  llmId: string;
  gx: number;
  gy: number;
  tx: number;
  ty: number;
  px: number;
  py: number;
  moving: boolean;
  dir: 'up' | 'down' | 'left' | 'right';
  ws: number;
  cooldown: number;
  bubble: string | null;
  interactTarget: (() => void) | null;
}

export interface Workspace {
  id: string;
  name: string;
  desc: string;
  color: string;
  files: KBFile[];
  urls: string[];
  stack: string[];
  githubRepo?: string;        // "owner/repo"
  githubBaseBranch?: string;  // default: "main"
}

export interface KBFile {
  name: string;
  size: number;
  type: string;
}

export interface MCPServer {
  id: string;
  name: string;
  url: string;
  description?: string;
  token?: string;
}

export interface AgentSkills {
  text: string;              // texto livre com instruções/docs do agente
  fileName: string;          // nome do .md uploaded (exibição)
  fileContent: string;       // conteúdo do .md uploaded
  githubUrl: string;         // URL do GitHub apontando pra um .md
  githubContent: string;     // conteúdo já fetched do GitHub URL
}

export interface AgentConfig {
  prompt: string;
  workspaceIds: string[];   // workspaces que o agente consulta via RAG
  mcpServers: MCPServer[];
  tools: string[];
  skills: AgentSkills;       // instruções e docs específicas deste agente
}

export interface AgentConfigs {
  [agentId: string]: AgentConfig;
}

export interface UserProfile {
  name: string;
  email: string;
  workspace: string;
}

export interface LLMKeys {
  [providerId: string]: string;
}

export interface AgentModels {
  [agentId: string]: string;
}

export interface FlowRun {
  id: string;
  story: string;
  steps: FlowStep[];
  status: 'running' | 'done' | 'error';
  createdAt: number;
}

export interface InfoQuestion {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  default?: string;
}

export interface FlowStep {
  id: string;
  agentId: string;
  agentName: string;
  agentColor: string;
  role: string;
  desc: string;
  status: 'pending' | 'active' | 'done' | 'error' | 'approval' | 'info-request' | 'spec-review';
  result?: string;
  llm?: string;
  code?: string;           // código gerado aguardando aprovação
  filePath?: string;       // caminho onde o código será commitado
  specDraft?: string;      // spec gerado pelo PO aguardando aprovação
  infoRequest?: InfoQuestion[];   // perguntas aguardando resposta do usuário
  infoAnswers?: Record<string, string>;
}

export interface LogEntry {
  id: string;
  text: string;
  tag?: { label: string; type: string };
  timestamp: number;
}

export interface Stats {
  events: number;
  flows: number;
}

export interface ProxyConfig {
  url: string;
  user: string;
  password: string;
  skipSsl: boolean;
}
