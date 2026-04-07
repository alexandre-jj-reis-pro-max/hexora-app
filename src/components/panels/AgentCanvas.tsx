// src/components/panels/AgentCanvas.tsx
import { useState, useEffect } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { TEAM, PROVIDERS } from '../../constants';
import { makePreview } from '../../engine/sprites';
import { ROLE_PROMPTS } from '../../engine/llm';
import type { MCPServer, AgentConfig, AgentSkills } from '../../types';

type Tab = 'prompt' | 'skills' | 'knowledge' | 'mcp' | 'tools';

const TOOLS_LIST = [
  { id: 'web_search',  label: 'Web Search',    desc: 'Busca na internet',          icon: '🔍' },
  { id: 'code_exec',  label: 'Code Exec',      desc: 'Executar código',             icon: '⚡' },
  { id: 'file_read',  label: 'File System',    desc: 'Ler e escrever arquivos',     icon: '📁' },
  { id: 'browser',    label: 'Browser',        desc: 'Navegar em páginas web',      icon: '🌐' },
  { id: 'calculator', label: 'Calculator',     desc: 'Operações matemáticas',       icon: '🧮' },
  { id: 'image_gen',  label: 'Image Gen',      desc: 'Gerar imagens com IA',        icon: '🎨' },
  { id: 'email',      label: 'Email',          desc: 'Enviar e receber e-mails',    icon: '📧' },
  { id: 'db_query',   label: 'Database',       desc: 'Queries SQL',                 icon: '🗄️' },
  { id: 'git',        label: 'Git',            desc: 'Operações de versionamento',  icon: '🌿' },
  { id: 'api_call',   label: 'HTTP / API',     desc: 'Chamadas REST e GraphQL',     icon: '🔌' },
];

const emptySkills = (): AgentSkills => ({
  text: '',
  fileName: '',
  fileContent: '',
  githubUrl: '',
  githubContent: '',
});

const emptyConfig = (): AgentConfig => ({
  prompt: '',
  workspaceIds: [],
  mcpServers: [],
  tools: [],
  skills: emptySkills(),
});

export default function AgentCanvas() {
  const configAgentId    = useUIStore((s) => s.configAgentId);
  const closeAgentCanvas = useUIStore((s) => s.closeAgentCanvas);
  const { agentConfigs, setAgentConfig, agentModels, setAgentModel, llmKeys } = useProfileStore();
  const workspaces  = useWorkspaceStore((s) => s.workspaces);
  const activeWsId  = useWorkspaceStore((s) => s.activeId);
  const activeWs    = workspaces.find((w) => w.id === activeWsId);

  // Chave composta: produto_agente
  const cfgKey = (agentId: string) => `${activeWsId}_${agentId}`;

  // Which agent is being viewed inside this session
  const firstAgent = TEAM.find((t) => !t.isCoord)!;
  const [selectedId, setSelectedId] = useState<string>(configAgentId ?? firstAgent.id);
  const [tab, setTab]   = useState<Tab>('prompt');
  const [draft, setDraft] = useState<AgentConfig>(emptyConfig());
  const [newMcp, setNewMcp] = useState<Omit<MCPServer, 'id'>>({ name: '', url: '', description: '', token: '' });
  const [saved, setSaved]   = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState('');

  // Generate all previews once
  useEffect(() => {
    const map: Record<string, string> = {};
    TEAM.forEach((t) => { map[t.id] = makePreview(t.color, t.sprite); });
    setPreviews(map);
  }, []);

  // When canvas opens, reset to clicked agent (skip coord)
  useEffect(() => {
    if (configAgentId) {
      const target = configAgentId === 'coord' ? firstAgent.id : configAgentId;
      setSelectedId(target);
      setTab('prompt');
    }
  }, [configAgentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load draft whenever selected agent or active workspace changes
  useEffect(() => {
    const saved = agentConfigs[cfgKey(selectedId)] ?? {};
    setDraft({ ...emptyConfig(), ...saved, skills: { ...emptySkills(), ...(saved.skills ?? {}) } });
    setNewMcp({ name: '', url: '', description: '', token: '' });
    setSaved(false);
    setTab('prompt');
  }, [selectedId, activeWsId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!configAgentId) return null;

  const def = TEAM.find((t) => t.id === selectedId)!;

  // ── helpers ────────────────────────────────────────────────────────────

  const update = (partial: Partial<AgentConfig>) => setDraft((d) => ({ ...d, ...partial }));

  const handleSave = () => {
    setAgentConfig(cfgKey(selectedId), draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const toggleWorkspace = (wsId: string) => {
    const has = draft.workspaceIds.includes(wsId);
    update({ workspaceIds: has ? draft.workspaceIds.filter((id) => id !== wsId) : [...draft.workspaceIds, wsId] });
  };

  const addMcp = () => {
    if (!newMcp.name.trim() || !newMcp.url.trim()) return;
    const server: MCPServer = { id: crypto.randomUUID(), ...newMcp };
    update({ mcpServers: [...draft.mcpServers, server] });
    setNewMcp({ name: '', url: '', description: '', token: '' });
  };

  const removeMcp = (id: string) => update({ mcpServers: draft.mcpServers.filter((s) => s.id !== id) });

  const toggleTool = (toolId: string) => {
    const has = draft.tools.includes(toolId);
    update({ tools: has ? draft.tools.filter((t) => t !== toolId) : [...draft.tools, toolId] });
  };

  const updateSkills = (partial: Partial<AgentSkills>) =>
    update({ skills: { ...(draft.skills ?? emptySkills()), ...partial } });

  const fetchSkillsFromGithub = async (url: string) => {
    setSkillsLoading(true);
    setSkillsError('');
    try {
      let rawUrl = url.trim();
      if (rawUrl.includes('github.com') && rawUrl.includes('/blob/')) {
        rawUrl = rawUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
      }
      // Route through backend proxy (corporate proxy support)
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('hexora_token') || '';
      const res = await fetch(`${API_BASE}/github/fetch-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: rawUrl }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.content?.trim()) throw new Error('Arquivo vazio');
      updateSkills({ githubUrl: url, githubContent: data.content });
    } catch (err) {
      setSkillsError((err as Error).message);
    } finally {
      setSkillsLoading(false);
    }
  };

  const handleSkillsFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1 * 1024 * 1024) {
      setSkillsError(`Arquivo excede 1 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      if (text.trim()) updateSkills({ fileName: file.name, fileContent: text });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── styles ──────────────────────────────────────────────────────────────

  const inp: React.CSSProperties = {
    background: 'rgba(255,255,255,.04)',
    border: '1px solid #2a1050',
    borderRadius: 6,
    color: '#e2e8f0',
    fontFamily: 'VT323, monospace',
    fontSize: 16,
    padding: '8px 12px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const lbl: React.CSSProperties = {
    fontFamily: 'ui-monospace, "SF Mono", "Courier New", monospace',
    fontSize: '9px',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: 7,
    display: 'block',
    lineHeight: 1.5,
  };

  // ── render ──────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9000, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(5px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) closeAgentCanvas(); }}
    >
      <div
        style={{
          width: 'min(900px, 97vw)',
          height: 'min(620px, 92vh)',
          background: '#080d1a',
          backgroundImage: 'radial-gradient(circle, rgba(42,16,80,.5) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          border: '1px solid #2a1050',
          borderRadius: 12,
          boxShadow: '0 0 60px rgba(124,58,237,.18), 0 24px 64px rgba(0,0,0,.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Top bar ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 20px',
          borderBottom: '1px solid #160a30',
          gap: 10,
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'ui-monospace, "Courier New", monospace', fontSize: '9px', letterSpacing: '0.2em', color: '#4b5563' }}>
            ⬛ AGENT CONFIG
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={closeAgentCanvas}
            style={{
              background: 'transparent', border: '1px solid #2a1050',
              borderRadius: 6, color: '#4b5563', fontFamily: 'VT323, monospace',
              fontSize: 20, width: 30, height: 30, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.color = '#7c3aed'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a1050'; e.currentTarget.style.color = '#4b5563'; }}
          >
            ×
          </button>
        </div>

        {/* ── Main (sidebar + content) ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ── Sidebar ── */}
          <div style={{
            width: 140,
            borderRight: '1px solid #160a30',
            overflowY: 'auto',
            padding: '10px 8px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            <div style={{ fontFamily: 'ui-monospace, "Courier New", monospace', fontSize: '9px', letterSpacing: '0.2em', color: '#374151', padding: '4px 6px 8px', borderBottom: '1px solid #160a30', marginBottom: 4, lineHeight: 1.5 }}>
              AGENTES
            </div>
            {TEAM.filter((t) => !t.isCoord).map((t) => {
              const active = t.id === selectedId;
              const isCoord = false;
              const cfg = agentConfigs[cfgKey(t.id)];
              const hasSkills = cfg?.skills && (cfg.skills.text || cfg.skills.fileContent || cfg.skills.githubContent);
              const hasConfig = !isCoord && cfg && (cfg.prompt || cfg.tools.length || cfg.mcpServers.length || cfg.workspaceIds.length || hasSkills);
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 8px',
                    borderRadius: 6,
                    cursor: isCoord ? 'default' : 'pointer',
                    background: active ? 'rgba(124,58,237,.15)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(124,58,237,.35)' : 'transparent'}`,
                    opacity: isCoord ? 0.45 : 1,
                    transition: 'all .12s',
                  }}
                  onMouseEnter={(e) => { if (!active && !isCoord) e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
                  onMouseLeave={(e) => { if (!active && !isCoord) e.currentTarget.style.background = 'transparent'; }}
                >
                  {previews[t.id] && (
                    <img src={previews[t.id]} alt={t.name} style={{ width: 18, height: 18, imageRendering: 'pixelated', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'VT323, monospace', fontSize: 14, color: active ? t.color : '#9ca3af', lineHeight: 1.1 }}>
                      {t.name}
                    </div>
                    <div style={{ fontFamily: 'ui-monospace, "Courier New", monospace', fontSize: '9px', color: '#374151', letterSpacing: '0.06em', lineHeight: 1.5 }}>
                      {t.role}
                    </div>
                  </div>
                  {hasConfig && (
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: t.color, opacity: .6, flexShrink: 0 }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Right pane ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Agent header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 20px',
              borderBottom: '1px solid #160a30',
              flexShrink: 0,
            }}>
              {previews[def.id] && (
                <img src={previews[def.id]} alt={def.name} style={{ width: 32, height: 32, imageRendering: 'pixelated' }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'VT323, monospace', fontSize: 22, color: def.color, lineHeight: 1 }}>{def.name}</div>
                <div style={{ fontFamily: 'ui-monospace, "Courier New", monospace', fontSize: '9px', color: '#4b5563', letterSpacing: '0.12em', marginTop: 1, lineHeight: 1.5 }}>{def.role}</div>
                {def.desc && (
                  <div style={{ fontFamily: 'ui-monospace, "Courier New", monospace', fontSize: '9px', color: '#6b7280', letterSpacing: '0.06em', marginTop: 3, lineHeight: 1.5 }}>
                    {def.desc}
                  </div>
                )}
              </div>

              {/* Model selector */}
              {!def.isCoord && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                  <label style={{ fontFamily: 'ui-monospace, "Courier New", monospace', fontSize: '9px', letterSpacing: '0.14em', color: '#4b5563', lineHeight: 1.5 }}>MODELO LLM</label>
                  <select
                    value={agentModels[def.id] ?? ''}
                    onChange={(e) => setAgentModel(def.id, e.target.value)}
                    style={{
                      background: '#0a0f1e',
                      border: `1px solid ${agentModels[def.id] ? def.color + '66' : '#2a1050'}`,
                      borderRadius: 5,
                      color: agentModels[def.id] ? '#e2e8f0' : '#6b7280',
                      fontFamily: 'ui-monospace, "Courier New", monospace',
                      fontSize: '9px',
                      padding: '5px 8px',
                      outline: 'none',
                      cursor: 'pointer',
                      minWidth: 180,
                    }}
                  >
                    <option value="">— selecionar modelo —</option>
                    {PROVIDERS.filter((p) => llmKeys[p.id] || p.id === 'local').map((p) =>
                      p.models.map((m) => (
                        <option key={`${p.id}:${m}`} value={`${p.id}:${m}`}>
                          {p.logo} {p.name} · {m}
                        </option>
                      ))
                    )}
                  </select>
                  {!agentModels[def.id] && (
                    <div style={{ fontFamily: 'ui-monospace, "Courier New", monospace', fontSize: '9px', color: '#f87171', letterSpacing: '0.06em', lineHeight: 1.5 }}>
                      ⚠ Sem modelo — LLM não vai funcionar
                    </div>
                  )}
                  <div
                    title={
                      ['dev-back', 'dev-front', 'eng-dados', 'devops'].includes(def.id)
                        ? '💡 Recomendado: Claude/GPT (nuvem) para geração de código.\nLocal (Ollama llama3.1:8b) funciona mas com qualidade inferior.\nSua máquina (Ryzen 7 + 40GB RAM) aguenta llama3.1:8b em CPU (~10s/resposta).'
                        : '💡 Recomendado: Local (Ollama llama3.2:3b) para análise — rápido e leve (~3-5s).\nPara melhor qualidade, use Claude Sonnet ou GPT-4o (nuvem).\nSua máquina (Ryzen 7 + 40GB RAM) roda llama3.1:8b confortável em CPU.'
                    }
                    style={{
                      fontFamily: 'ui-monospace, "Courier New", monospace',
                      fontSize: '8px', color: '#6b7280', cursor: 'help',
                      letterSpacing: '0.04em', marginTop: 2,
                    }}
                  >
                    💡 passe o mouse para ver recomendação
                  </div>
                </div>
              )}

              {/* Produto ativo */}
              {activeWs && !def.isCoord && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'rgba(255,255,255,.03)', border: '1px solid #1a0d35',
                  borderRadius: 5, padding: '4px 10px', flexShrink: 0,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: activeWs.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'ui-monospace, "Courier New", monospace', fontSize: '9px', color: '#6b7280', letterSpacing: '0.1em', lineHeight: 1.5 }}>
                    {activeWs.name}
                  </span>
                </div>
              )}
            </div>

            {/* Coord locked state */}
            {def.isCoord ? (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14,
              }}>
                <div style={{ fontSize: 36, opacity: .5 }}>🔒</div>
                <div style={{ fontFamily: 'VT323, monospace', fontSize: 22, color: '#fbbf24', opacity: .6 }}>
                  Orquestrador
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '8px', color: '#4b5563', letterSpacing: '0.1em', textAlign: 'center', lineHeight: 1.8, maxWidth: 300 }}>
                  O coordenador não é configurável.<br />
                  Ele é o motor de orquestração que lê os outros agentes e direciona o fluxo automaticamente.
                </div>
              </div>
            ) : (
            <>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #160a30', padding: '0 20px', flexShrink: 0 }}>
              {(['prompt', 'skills', 'knowledge', 'mcp', 'tools'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    fontFamily: 'monospace', fontSize: '8px', letterSpacing: '0.16em',
                    padding: '10px 14px', background: 'transparent', border: 'none',
                    borderBottom: tab === t ? `2px solid ${def.color}` : '2px solid transparent',
                    color: tab === t ? def.color : '#4b5563',
                    cursor: 'pointer', transition: 'all .12s', textTransform: 'uppercase',
                  }}
                >
                  {t === 'knowledge' ? 'CONHECIMENTO' : t === 'skills' ? 'SKILLS' : t.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>

              {/* PROMPT */}
              {tab === 'prompt' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={lbl}>PROMPT CUSTOMIZADO (sobrescreve o padrão)</label>
                    <textarea
                      value={draft.prompt}
                      onChange={(e) => update({ prompt: e.target.value })}
                      placeholder={`Deixe em branco para usar o prompt padrão do agente...`}
                      rows={5}
                      style={{ ...inp, resize: 'vertical', lineHeight: 1.6, minHeight: 100 }}
                    />
                    <div style={{ fontFamily: 'monospace', fontSize: '8px', color: '#374151', marginTop: 5, letterSpacing: '0.08em' }}>
                      {draft.prompt.length > 0 ? `${draft.prompt.length} caracteres — prompt customizado ATIVO` : 'Vazio — usando prompt padrão abaixo'}
                    </div>
                  </div>

                  {/* Default role prompt */}
                  {ROLE_PROMPTS[def.id] && (
                    <div>
                      <label style={lbl}>PROMPT PADRÃO DO PAPEL (somente leitura)</label>
                      <pre style={{
                        background: 'rgba(255,255,255,.02)',
                        border: '1px solid #1a0d35',
                        borderRadius: 6,
                        color: '#6b7280',
                        fontFamily: 'monospace',
                        fontSize: '8px',
                        lineHeight: 1.7,
                        letterSpacing: '0.04em',
                        padding: '12px 14px',
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}>
                        {ROLE_PROMPTS[def.id]}
                      </pre>
                    </div>
                  )}

                  <div>
                    <label style={lbl}>RESPONSABILIDADES PADRÃO</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {def.flow.map((f) => (
                        <span key={f} style={{
                          fontFamily: 'monospace', fontSize: '8px', letterSpacing: '0.08em',
                          color: def.color, background: 'rgba(42,16,80,.3)',
                          border: `1px solid ${def.color}33`, borderRadius: 4, padding: '4px 10px',
                        }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* SKILLS */}
              {tab === 'skills' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <p style={{ fontFamily: 'monospace', fontSize: '8px', color: '#6b7280', letterSpacing: '0.06em', lineHeight: 1.7, margin: 0 }}>
                    Defina instruções, docs de arquitetura, templates ou padrões específicos deste agente.
                    Use qualquer combinação das 3 fontes — todas serão incluídas no contexto do LLM.
                  </p>

                  {/* 1) Texto livre */}
                  <div>
                    <label style={lbl}>📝 INSTRUÇÕES / DOCS (texto livre)</label>
                    <textarea
                      value={draft.skills?.text ?? ''}
                      onChange={(e) => updateSkills({ text: e.target.value })}
                      placeholder="Ex: Use sempre Clean Architecture, endpoints REST em /api/v1/..., PostgreSQL como banco..."
                      rows={5}
                      style={{ ...inp, resize: 'vertical', lineHeight: 1.6, minHeight: 90 }}
                    />
                    {(draft.skills?.text?.length ?? 0) > 0 && (
                      <div style={{ fontFamily: 'monospace', fontSize: '7px', color: '#4b5563', marginTop: 4, letterSpacing: '0.06em' }}>
                        {draft.skills.text.length} chars
                      </div>
                    )}
                  </div>

                  {/* 2) Upload .md */}
                  <div>
                    <label style={lbl}>📄 UPLOAD DE ARQUIVO .MD</label>
                    {draft.skills?.fileContent ? (
                      <div style={{
                        background: 'rgba(0,0,0,.25)', border: '1px solid rgba(74,222,128,.2)',
                        borderRadius: 6, padding: '8px 10px', position: 'relative',
                      }}>
                        <div style={{ fontFamily: 'monospace', fontSize: '8px', color: '#4ade80', letterSpacing: '0.08em', marginBottom: 4 }}>
                          ✓ {draft.skills.fileName} ({draft.skills.fileContent.length} chars)
                        </div>
                        <div style={{ fontFamily: 'VT323, monospace', fontSize: 12, color: '#6b7280', lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 80, overflow: 'hidden' }}>
                          {draft.skills.fileContent.slice(0, 200)}{draft.skills.fileContent.length > 200 ? '…' : ''}
                        </div>
                        <button
                          onClick={() => updateSkills({ fileName: '', fileContent: '' })}
                          style={{
                            position: 'absolute', top: 6, right: 6,
                            background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.3)',
                            color: '#f87171', fontFamily: 'monospace', fontSize: '7px', padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
                          }}
                        >
                          LIMPAR
                        </button>
                      </div>
                    ) : (
                      <label
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          border: `1px dashed ${def.color}33`, background: `${def.color}05`,
                          borderRadius: 6, padding: '10px 12px', cursor: 'pointer', transition: 'border-color .12s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = def.color)}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = `${def.color}33`)}
                      >
                        <input type="file" accept=".md,.txt,.markdown" className="hidden" onChange={handleSkillsFileUpload} style={{ display: 'none' }} />
                        <span style={{ fontSize: 14 }}>📄</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '8px', color: `${def.color}cc`, letterSpacing: '0.06em' }}>
                          SOLTAR ARQUIVO .MD AQUI
                        </span>
                      </label>
                    )}
                  </div>

                  {/* 3) GitHub URL */}
                  <div>
                    <label style={lbl}>🐙 URL DO GITHUB (.md)</label>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <input
                        value={draft.skills?.githubUrl ?? ''}
                        onChange={(e) => updateSkills({ githubUrl: e.target.value })}
                        placeholder="https://github.com/org/repo/blob/main/docs/architecture.md"
                        style={{ ...inp, flex: 1 }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && draft.skills?.githubUrl?.trim()) fetchSkillsFromGithub(draft.skills.githubUrl); }}
                      />
                      <button
                        onClick={() => { if (draft.skills?.githubUrl?.trim()) fetchSkillsFromGithub(draft.skills.githubUrl); }}
                        disabled={skillsLoading || !draft.skills?.githubUrl?.trim()}
                        style={{
                          fontFamily: 'monospace', fontSize: '8px', letterSpacing: '0.12em',
                          background: 'rgba(124,58,237,.15)', border: `1px solid ${def.color}55`,
                          color: def.color, borderRadius: 6, padding: '8px 12px', cursor: 'pointer', flexShrink: 0,
                        }}
                      >
                        {skillsLoading ? '...' : 'FETCH'}
                      </button>
                    </div>
                    {skillsError && (
                      <div style={{ fontFamily: 'VT323, monospace', fontSize: 12, color: '#f87171', marginBottom: 4 }}>
                        ✕ {skillsError}
                      </div>
                    )}
                    {draft.skills?.githubContent && (
                      <div style={{
                        background: 'rgba(0,0,0,.25)', border: '1px solid rgba(96,165,250,.2)',
                        borderRadius: 6, padding: '8px 10px', position: 'relative',
                      }}>
                        <div style={{ fontFamily: 'monospace', fontSize: '8px', color: '#60a5fa', letterSpacing: '0.08em', marginBottom: 4 }}>
                          ✓ CARREGADO ({draft.skills.githubContent.length} chars)
                        </div>
                        <div style={{ fontFamily: 'VT323, monospace', fontSize: 12, color: '#6b7280', lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 80, overflow: 'hidden' }}>
                          {draft.skills.githubContent.slice(0, 200)}{draft.skills.githubContent.length > 200 ? '…' : ''}
                        </div>
                        <button
                          onClick={() => updateSkills({ githubUrl: '', githubContent: '' })}
                          style={{
                            position: 'absolute', top: 6, right: 6,
                            background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.3)',
                            color: '#f87171', fontFamily: 'monospace', fontSize: '7px', padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
                          }}
                        >
                          LIMPAR
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Resumo */}
                  {(() => {
                    const s = draft.skills ?? emptySkills();
                    const sources = [s.text && 'texto', s.fileContent && 'arquivo', s.githubContent && 'github'].filter(Boolean);
                    return sources.length > 0 ? (
                      <div style={{ fontFamily: 'monospace', fontSize: '8px', color: '#4ade80', letterSpacing: '0.08em', background: 'rgba(74,222,128,.05)', border: '1px solid rgba(74,222,128,.15)', borderRadius: 6, padding: '8px 10px' }}>
                        ✓ {sources.length} fonte{sources.length > 1 ? 's' : ''} de skill ativa{sources.length > 1 ? 's' : ''}: {sources.join(', ')}
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {/* CONHECIMENTO */}
              {tab === 'knowledge' && (
                <div>
                  <label style={lbl}>BASES DE CONHECIMENTO (RAG)</label>
                  <p style={{ fontFamily: 'monospace', fontSize: '8px', color: '#4b5563', letterSpacing: '0.08em', lineHeight: 1.7, marginBottom: 16 }}>
                    Selecione quais produtos este agente pode consultar. Os arquivos e URLs ficam no painel de workspaces.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {workspaces.map((ws) => {
                      const active = draft.workspaceIds.includes(ws.id);
                      const isCurrentProduct = ws.id === activeWsId;
                      const totalSources = ws.files.length + ws.urls.length;
                      return (
                        <div
                          key={ws.id}
                          onClick={() => toggleWorkspace(ws.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            background: active ? 'rgba(124,58,237,.1)' : 'rgba(255,255,255,.02)',
                            border: `1px solid ${active ? ws.color + '55' : '#1a0d35'}`,
                            borderRadius: 8, padding: '12px 14px', cursor: 'pointer',
                            transition: 'all .12s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = active ? 'rgba(124,58,237,.16)' : 'rgba(255,255,255,.04)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = active ? 'rgba(124,58,237,.1)' : 'rgba(255,255,255,.02)'; }}
                        >
                          {/* Color dot */}
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: ws.color, flexShrink: 0 }} />

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontFamily: 'VT323, monospace', fontSize: 16, color: active ? ws.color : '#9ca3af' }}>
                                {ws.name}
                              </span>
                              {isCurrentProduct && (
                                <span style={{
                                  fontFamily: 'ui-monospace, "Courier New", monospace', fontSize: '9px', letterSpacing: '0.12em',
                                  color: '#fbbf24', background: 'rgba(251,191,36,.1)',
                                  border: '1px solid rgba(251,191,36,.25)', borderRadius: 3, padding: '2px 5px',
                                  lineHeight: 1.5,
                                }}>
                                  ATIVO
                                </span>
                              )}
                            </div>
                            <div style={{ fontFamily: 'ui-monospace, "Courier New", monospace', fontSize: '9px', color: '#374151', marginTop: 2, lineHeight: 1.5 }}>
                              {ws.desc}
                            </div>
                            {/* Sources summary */}
                            <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                              {ws.files.length > 0 && (
                                <span style={{ fontFamily: 'ui-monospace, "Courier New", monospace', fontSize: '9px', color: '#4b5563', letterSpacing: '0.06em', lineHeight: 1.5 }}>
                                  📄 {ws.files.length} arquivo{ws.files.length !== 1 ? 's' : ''}
                                </span>
                              )}
                              {ws.urls.length > 0 && (
                                <span style={{ fontFamily: 'ui-monospace, "Courier New", monospace', fontSize: '9px', color: '#4b5563', letterSpacing: '0.06em', lineHeight: 1.5 }}>
                                  🔗 {ws.urls.length} URL{ws.urls.length !== 1 ? 's' : ''}
                                </span>
                              )}
                              {ws.stack.length > 0 && (
                                <span style={{ fontFamily: 'ui-monospace, "Courier New", monospace', fontSize: '9px', color: '#4b5563', letterSpacing: '0.06em', lineHeight: 1.5 }}>
                                  ⚙ {ws.stack.length} tecnologia{ws.stack.length !== 1 ? 's' : ''}
                                </span>
                              )}
                              {totalSources === 0 && ws.stack.length === 0 && (
                                <span style={{ fontFamily: 'ui-monospace, "Courier New", monospace', fontSize: '9px', color: '#374151', letterSpacing: '0.06em', lineHeight: 1.5 }}>
                                  Sem fontes configuradas
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Checkbox */}
                          <div style={{
                            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                            border: `2px solid ${active ? ws.color : '#2a1050'}`,
                            background: active ? ws.color : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, color: '#000', fontWeight: 'bold', transition: 'all .12s',
                          }}>
                            {active ? '✓' : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {draft.workspaceIds.length > 0 && (
                    <div style={{ marginTop: 14, fontFamily: 'monospace', fontSize: '8px', color: '#4b5563', letterSpacing: '0.1em' }}>
                      {draft.workspaceIds.length} produto{draft.workspaceIds.length !== 1 ? 's' : ''} vinculado{draft.workspaceIds.length !== 1 ? 's' : ''} ao RAG
                    </div>
                  )}
                </div>
              )}

              {/* MCP */}
              {tab === 'mcp' && (
                <div>
                  <label style={lbl}>SERVIDORES MCP</label>

                  {/* Templates */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontFamily: 'ui-monospace, "Courier New", monospace', fontSize: '9px', letterSpacing: '0.14em', color: '#374151', marginBottom: 8, lineHeight: 1.5 }}>
                      TEMPLATES RÁPIDOS
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[
                        {
                          name: 'GitHub Copilot MCP',
                          url: 'https://api.githubcopilot.com/mcp/',
                          description: 'Criar branches, PRs, issues e pipelines via GitHub Copilot',
                          icon: '🐙',
                          color: '#60a5fa',
                          note: 'Requer GitHub Copilot + PAT (scopes: repo, workflow)',
                        },
                        {
                          name: 'GitHub Local',
                          url: 'http://localhost:3100/sse',
                          description: 'Servidor GitHub MCP local (npx @modelcontextprotocol/server-github)',
                          icon: '🌿',
                          color: '#4ade80',
                          note: 'Execute: GITHUB_TOKEN=seu_token npx @modelcontextprotocol/server-github',
                        },
                        {
                          name: 'GitLab MCP',
                          url: 'http://localhost:3200/sse',
                          description: 'Integração GitLab: branches, MRs, CI/CD pipelines',
                          icon: '🦊',
                          color: '#fb923c',
                          note: 'Execute: npx @modelcontextprotocol/server-gitlab',
                        },
                      ].map((tpl) => (
                        <div
                          key={tpl.name}
                          style={{
                            display: 'flex', flexDirection: 'column', gap: 4,
                            background: 'rgba(255,255,255,.02)', border: '1px solid #1a0d35',
                            borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
                            flex: '1 1 180px', minWidth: 0, transition: 'border-color .12s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.borderColor = tpl.color + '55')}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1a0d35')}
                          onClick={() => setNewMcp({ name: tpl.name, url: tpl.url, description: tpl.description, token: '' })}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 14 }}>{tpl.icon}</span>
                            <span style={{ fontFamily: 'VT323, monospace', fontSize: 15, color: tpl.color }}>{tpl.name}</span>
                          </div>
                          <div style={{ fontFamily: 'ui-monospace, "Courier New", monospace', fontSize: '9px', color: '#4b5563', lineHeight: 1.6, letterSpacing: '0.04em' }}>
                            {tpl.description}
                          </div>
                          <div style={{ fontFamily: 'monospace', fontSize: '6px', color: '#374151', marginTop: 2, letterSpacing: '0.04em' }}>
                            {tpl.note}
                          </div>
                          <div style={{ fontFamily: 'monospace', fontSize: '6px', color: tpl.color, letterSpacing: '0.12em', marginTop: 4, opacity: 0.7 }}>
                            USAR TEMPLATE ▶
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{
                    background: 'rgba(255,255,255,.02)', border: '1px solid #1a0d35',
                    borderRadius: 8, padding: '14px', marginBottom: 16,
                  }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '8px', letterSpacing: '0.14em', color: '#4b5563', marginBottom: 10 }}>
                      NOVO SERVIDOR
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginBottom: 8 }}>
                      <div>
                        <label style={{ ...lbl, fontSize: '7px' }}>NOME</label>
                        <input value={newMcp.name} onChange={(e) => setNewMcp((p) => ({ ...p, name: e.target.value }))}
                          placeholder="my-server" style={inp} />
                      </div>
                      <div>
                        <label style={{ ...lbl, fontSize: '7px' }}>URL / ENDPOINT</label>
                        <input value={newMcp.url} onChange={(e) => setNewMcp((p) => ({ ...p, url: e.target.value }))}
                          placeholder="http://localhost:3100/sse" style={inp} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 10 }}>
                      <div>
                        <label style={{ ...lbl, fontSize: '7px' }}>DESCRIÇÃO</label>
                        <input value={newMcp.description} onChange={(e) => setNewMcp((p) => ({ ...p, description: e.target.value }))}
                          placeholder="O que este servidor fornece..." style={inp} />
                      </div>
                      <div>
                        <label style={{ ...lbl, fontSize: '7px' }}>TOKEN (opcional)</label>
                        <input type="password" value={newMcp.token} onChange={(e) => setNewMcp((p) => ({ ...p, token: e.target.value }))}
                          placeholder="Bearer ..." style={inp} />
                      </div>
                    </div>
                    <button onClick={addMcp}
                      disabled={!newMcp.name.trim() || !newMcp.url.trim()}
                      style={{
                        fontFamily: 'monospace', fontSize: '8px', letterSpacing: '0.12em',
                        background: (!newMcp.name.trim() || !newMcp.url.trim()) ? 'rgba(42,16,80,.1)' : 'rgba(124,58,237,.22)',
                        border: '1px solid', borderColor: (!newMcp.name.trim() || !newMcp.url.trim()) ? '#1a0d35' : 'rgba(124,58,237,.5)',
                        color: (!newMcp.name.trim() || !newMcp.url.trim()) ? '#374151' : '#7c3aed',
                        borderRadius: 6, padding: '8px 16px',
                        cursor: (!newMcp.name.trim() || !newMcp.url.trim()) ? 'not-allowed' : 'pointer',
                      }}>
                      + ADICIONAR
                    </button>
                  </div>
                  {draft.mcpServers.length === 0 ? (
                    <div style={{ fontFamily: 'VT323, monospace', fontSize: 15, color: '#374151', textAlign: 'center', padding: '24px 0' }}>
                      Nenhum servidor MCP conectado
                    </div>
                  ) : draft.mcpServers.map((srv) => (
                    <div key={srv.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
                      background: 'rgba(255,255,255,.03)', border: '1px solid #1a0d35',
                      borderRadius: 8, padding: '10px 14px',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'VT323, monospace', fontSize: 16, color: def.color }}>{srv.name}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '7px', color: '#60a5fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {srv.url}
                        </div>
                        {srv.description && <div style={{ fontFamily: 'VT323, monospace', fontSize: 12, color: '#4b5563', marginTop: 2 }}>{srv.description}</div>}
                      </div>
                      <span style={{
                        fontFamily: 'monospace', fontSize: '7px', letterSpacing: '0.12em',
                        color: '#4ade80', background: 'rgba(74,222,128,.08)',
                        border: '1px solid rgba(74,222,128,.2)', borderRadius: 4, padding: '3px 7px', flexShrink: 0,
                      }}>CONNECTED</span>
                      <button onClick={() => removeMcp(srv.id)}
                        style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#4b5563')}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* TOOLS */}
              {tab === 'tools' && (
                <div>
                  <label style={lbl}>FERRAMENTAS DISPONÍVEIS</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                    {TOOLS_LIST.map((tool) => {
                      const active = draft.tools.includes(tool.id);
                      return (
                        <div key={tool.id} onClick={() => toggleTool(tool.id)} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          background: active ? 'rgba(124,58,237,.12)' : 'rgba(255,255,255,.02)',
                          border: `1px solid ${active ? 'rgba(124,58,237,.4)' : '#1a0d35'}`,
                          borderRadius: 7, padding: '10px 12px', cursor: 'pointer', transition: 'all .12s',
                        }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = active ? 'rgba(124,58,237,.18)' : 'rgba(255,255,255,.05)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = active ? 'rgba(124,58,237,.12)' : 'rgba(255,255,255,.02)'; }}
                        >
                          <span style={{ fontSize: 16, flexShrink: 0 }}>{tool.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'VT323, monospace', fontSize: 15, color: active ? def.color : '#9ca3af', lineHeight: 1.1 }}>
                              {tool.label}
                            </div>
                            <div style={{ fontFamily: 'monospace', fontSize: '7px', color: '#374151', letterSpacing: '0.05em' }}>{tool.desc}</div>
                          </div>
                          <div style={{
                            width: 13, height: 13, borderRadius: 3, flexShrink: 0,
                            border: `1.5px solid ${active ? def.color : '#2a1050'}`,
                            background: active ? def.color : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 8, color: '#000', transition: 'all .12s',
                          }}>
                            {active ? '✓' : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {draft.tools.length > 0 && (
                    <div style={{ marginTop: 12, fontFamily: 'monospace', fontSize: '8px', color: '#4b5563', letterSpacing: '0.1em' }}>
                      {draft.tools.length} ferramenta{draft.tools.length !== 1 ? 's' : ''} ativa{draft.tools.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              gap: 10, padding: '12px 22px', borderTop: '1px solid #160a30', flexShrink: 0,
            }}>
              {saved && (
                <span style={{ fontFamily: 'VT323, monospace', fontSize: 16, color: '#4ade80', letterSpacing: '0.08em' }}>✓ Salvo</span>
              )}
              <button onClick={handleSave} style={{
                fontFamily: 'monospace', fontSize: '8px', letterSpacing: '0.14em',
                background: 'rgba(124,58,237,.2)', border: `1px solid ${def.color}66`,
                color: def.color, borderRadius: 6, padding: '8px 22px', cursor: 'pointer',
              }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,.36)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,.2)')}>
                SALVAR CONFIG
              </button>
            </div>
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
