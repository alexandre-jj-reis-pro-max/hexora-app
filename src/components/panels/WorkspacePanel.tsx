import { useState } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { WS_COLORS, STACK_OPTIONS } from '../../constants';
import { PrimBtn } from './StoryPanel';

interface WorkspacePanelProps {
  className?: string;
}

export default function WorkspacePanel({ className }: WorkspacePanelProps) {
  const { openPanel, wsTab, setWsTab, togglePanel } = useUIStore();
  const open = openPanel === 'ws';
  const { workspaces, activeId, setActive, addWorkspace, deleteWorkspace, addFile, removeFile, addUrl, removeUrl, toggleStack, setGithubConfig } =
    useWorkspaceStore();
  const activeWs = workspaces.find((w) => w.id === activeId);

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState(WS_COLORS[0]);
  const [urlInput, setUrlInput] = useState('');
  const [ghRepo, setGhRepo] = useState(activeWs?.githubRepo ?? '');
  const [ghBranch, setGhBranch] = useState(activeWs?.githubBaseBranch ?? 'main');

  const handleAdd = () => {
    if (!newName.trim()) return;
    addWorkspace({ name: newName, desc: newDesc, color: newColor });
    setNewName('');
    setNewDesc('');
  };

  const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeId) return;
    if (file.size > MAX_FILE_SIZE) {
      alert(`Arquivo excede o limite de 1 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
      e.target.value = '';
      return;
    }
    addFile(activeId, { name: file.name, size: file.size, type: file.type });
    e.target.value = '';
  };

  const transform = open ? 'translateX(0)' : 'translateX(-100%)';

  const TABS = [
    { id: 'list', label: 'WORKSPACES' },
    { id: 'kb', label: 'KNOWLEDGE BASE' },
    { id: 'stack', label: 'STACK' },
  ] as const;

  return (
    <div
      className={className}
      style={{
        position: 'fixed',
        display: 'flex',
        flexDirection: 'column',
        top: 52,
        bottom: 110,
        left: 0,
        width: 420,
        background: '#0d0720',
        borderRight: '1px solid #2a1050',
        transform,
        transition: 'transform .25s cubic-bezier(.4,0,.2,1)',
        boxShadow: '6px 0 40px rgba(0,0,0,.7)',
        zIndex: 500,
      }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0"
        style={{ borderBottom: '1px solid #1a0d35', background: 'rgba(124,58,237,.03)' }}
      >
        <div className="flex items-center justify-between" style={{ padding: '14px 18px 0' }}>
          <h2 className="font-pixel" style={{ fontSize: '7px', color: '#7c3aed', letterSpacing: '0.1em' }}>
            ◫ WORKSPACES
          </h2>
          <button
            className="flex items-center justify-center rounded transition-all cursor-pointer"
            style={{
              width: 26,
              height: 26,
              background: 'transparent',
              border: '1px solid #1a0d35',
              color: '#4b5563',
              fontSize: 14,
            }}
            onClick={() => togglePanel('ws')}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#4c1d95';
              e.currentTarget.style.color = '#7c3aed';
              e.currentTarget.style.background = 'rgba(124,58,237,.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#1a0d35';
              e.currentTarget.style.color = '#4b5563';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ marginTop: 8 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className="font-pixel cursor-pointer transition-all"
              onClick={() => setWsTab(tab.id)}
              style={{
                padding: '9px 16px',
                fontSize: '5.5px',
                letterSpacing: '0.07em',
                color: wsTab === tab.id ? '#7c3aed' : '#4b5563',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${wsTab === tab.id ? '#7c3aed' : 'transparent'}`,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { if (wsTab !== tab.id) e.currentTarget.style.color = '#6b7280'; }}
              onMouseLeave={(e) => { if (wsTab !== tab.id) e.currentTarget.style.color = '#4b5563'; }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1" style={{ padding: '16px 18px' }}>

        {/* ── LIST TAB ── */}
        {wsTab === 'list' && (
          <>
            {/* Criar workspace */}
            <div
              className="rounded-md p-4 mb-4"
              style={{ background: 'rgba(124,58,237,.05)', border: '1px solid #2a1050' }}
            >
              <SLabel>NOVO WORKSPACE</SLabel>
              <SInput value={newName} onChange={setNewName} placeholder="Nome do workspace" />
              <SInput value={newDesc} onChange={setNewDesc} placeholder="Descrição" />
              <div className="flex gap-2 flex-wrap mb-3">
                {WS_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className="rounded-full cursor-pointer transition-all flex-shrink-0"
                    style={{
                      width: 22,
                      height: 22,
                      background: c,
                      border: newColor === c ? '2px solid #fff' : '2px solid transparent',
                      transform: newColor === c ? 'scale(1.2)' : undefined,
                      boxShadow: newColor === c ? `0 0 8px ${c}` : undefined,
                    }}
                  />
                ))}
              </div>
              <PrimBtn onClick={handleAdd} disabled={!newName.trim()}>+ CRIAR WORKSPACE</PrimBtn>
            </div>

            {/* Lista */}
            <div className="flex flex-col gap-1.5">
              {workspaces.map((ws) => (
                <div
                  key={ws.id}
                  onClick={() => setActive(ws.id)}
                  className="flex items-center gap-3 rounded-md p-3 cursor-pointer transition-all"
                  style={{
                    background: ws.id === activeId ? 'rgba(124,58,237,.1)' : 'rgba(255,255,255,.02)',
                    border: `1px solid ${ws.id === activeId ? 'rgba(124,58,237,.4)' : '#1a0d35'}`,
                  }}
                  onMouseEnter={(e) => { if (ws.id !== activeId) e.currentTarget.style.borderColor = '#4c1d95'; }}
                  onMouseLeave={(e) => { if (ws.id !== activeId) e.currentTarget.style.borderColor = '#1a0d35'; }}
                >
                  <span
                    className="rounded-full flex-shrink-0"
                    style={{ width: 10, height: 10, background: ws.color, boxShadow: `0 0 5px ${ws.color}` }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-pixel" style={{ fontSize: '6.5px', color: '#e2e8f0', letterSpacing: '0.05em', marginBottom: 3 }}>
                      {ws.name}
                    </div>
                    <div className="font-vt" style={{ fontSize: 13, color: '#6b7280' }}>{ws.desc}</div>
                  </div>
                  {ws.id === activeId && (
                    <span className="font-pixel flex-shrink-0" style={{ fontSize: '5px', color: '#7c3aed' }}>ATIVO</span>
                  )}
                  <IconBtn onClick={(e) => { e.stopPropagation(); deleteWorkspace(ws.id); }} danger>✕</IconBtn>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── KB TAB ── */}
        {wsTab === 'kb' && activeWs && (
          <>
            {/* Badges de resumo */}
            <div className="flex gap-2 flex-wrap mb-5">
              {[
                { label: `${activeWs.files.length} docs`, has: activeWs.files.length > 0 },
                { label: `${activeWs.urls.length} urls`, has: activeWs.urls.length > 0 },
                { label: `${activeWs.stack.length} techs`, has: activeWs.stack.length > 0 },
              ].map(({ label, has }) => (
                <div
                  key={label}
                  className="px-3 py-1 rounded-full font-vt flex items-center gap-1.5"
                  style={{
                    fontSize: 13,
                    border: `1px solid ${has ? 'rgba(74,222,128,.3)' : '#1a0d35'}`,
                    color: has ? '#4ade80' : '#4b5563',
                    background: has ? 'rgba(74,222,128,.06)' : 'rgba(255,255,255,.01)',
                  }}
                >
                  <span style={{ fontSize: 8 }}>{has ? '●' : '○'}</span> {label}
                </div>
              ))}
            </div>

            <KBSection title="DOCUMENTOS">
              <label
                className="flex flex-col items-center gap-2 rounded-md p-5 text-center cursor-pointer transition-all"
                style={{ border: '1px dashed #2a1050', background: 'rgba(124,58,237,.03)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.background = 'rgba(124,58,237,.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a1050'; e.currentTarget.style.background = 'rgba(124,58,237,.03)'; }}
              >
                <input type="file" className="hidden" onChange={handleFile} />
                <span className="text-2xl">📄</span>
                <span className="font-pixel" style={{ fontSize: '5.5px', color: '#6d28d9', letterSpacing: '0.07em' }}>
                  SOLTAR ARQUIVO AQUI
                </span>
                <span className="font-vt" style={{ fontSize: 12, color: '#4b5563' }}>PDF, DOCX, TXT, MD</span>
              </label>
              {activeWs.files.map((f) => (
                <div key={f.name} className="flex items-center gap-2 rounded p-2 mt-1.5" style={{ background: 'rgba(255,255,255,.02)', border: '1px solid #1a0d35' }}>
                  <span style={{ fontSize: 14 }}>📄</span>
                  <span className="font-vt flex-1 overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: 13, color: '#9ca3af' }}>{f.name}</span>
                  <span className="font-vt flex-shrink-0" style={{ fontSize: 11, color: '#4b5563' }}>{(f.size / 1024).toFixed(0)} kb</span>
                  <IconBtn onClick={() => removeFile(activeId, f.name)} danger>✕</IconBtn>
                </div>
              ))}
            </KBSection>

            <KBSection title="URLS">
              <div className="flex gap-1.5 mb-2">
                <input
                  className="flex-1 font-vt rounded-md outline-none transition-all"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://..."
                  style={{ background: 'rgba(0,0,0,.3)', border: '1px solid #2a1050', color: '#9ca3af', fontSize: 14, padding: '7px 10px', borderRadius: 6 }}
                  onFocus={(e) => { e.target.style.borderColor = '#7c3aed'; e.target.style.color = '#e2e8f0'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#2a1050'; e.target.style.color = '#9ca3af'; }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && urlInput.trim()) { addUrl(activeId, urlInput); setUrlInput(''); } }}
                />
                <button
                  className="font-pixel cursor-pointer rounded-md transition-all flex-shrink-0"
                  style={{ padding: '7px 12px', background: 'rgba(124,58,237,.15)', border: '1px solid rgba(124,58,237,.4)', color: '#7c3aed', fontSize: '5.5px', whiteSpace: 'nowrap' }}
                  onClick={() => { if (urlInput.trim()) { addUrl(activeId, urlInput); setUrlInput(''); } }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,.3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,.15)')}
                >
                  + ADD
                </button>
              </div>
              {activeWs.urls.map((url) => (
                <div key={url} className="flex items-center gap-2 rounded p-2 mb-1" style={{ background: 'rgba(255,255,255,.02)', border: '1px solid #1a0d35' }}>
                  <span className="font-vt flex-1 overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: 12, color: '#38bdf8' }}>{url}</span>
                  <IconBtn onClick={() => removeUrl(activeId, url)} danger>✕</IconBtn>
                </div>
              ))}
            </KBSection>
          </>
        )}

        {/* ── STACK TAB ── */}
        {wsTab === 'stack' && activeWs && (
          <>
            <KBSection title="STACK TÉCNICA">
              <div className="flex flex-wrap gap-2">
                {STACK_OPTIONS.map((tech) => {
                  const on = activeWs.stack.includes(tech);
                  return (
                    <button
                      key={tech}
                      onClick={() => toggleStack(activeId, tech)}
                      className="font-vt rounded-full cursor-pointer transition-all"
                      style={{
                        padding: '5px 12px',
                        border: `1px solid ${on ? 'rgba(124,58,237,.6)' : '#1a0d35'}`,
                        background: on ? 'rgba(124,58,237,.15)' : 'rgba(255,255,255,.01)',
                        color: on ? '#c4b5fd' : '#6b7280',
                        fontSize: 14,
                        boxShadow: on ? '0 0 8px rgba(124,58,237,.2)' : 'none',
                      }}
                      onMouseEnter={(e) => { if (!on) { e.currentTarget.style.borderColor = '#4c1d95'; e.currentTarget.style.color = '#9ca3af'; } }}
                      onMouseLeave={(e) => { if (!on) { e.currentTarget.style.borderColor = '#1a0d35'; e.currentTarget.style.color = '#6b7280'; } }}
                    >
                      {tech}
                    </button>
                  );
                })}
              </div>
            </KBSection>

            <KBSection title="REPOSITÓRIO GITHUB">
              <div style={{
                background: activeWs.githubRepo ? 'rgba(74,222,128,.04)' : 'rgba(255,255,255,.02)',
                border: `1px solid ${activeWs.githubRepo ? 'rgba(74,222,128,.2)' : '#1a0d35'}`,
                borderRadius: 8, padding: '14px',
              }}>
                {activeWs.githubRepo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <span style={{ fontSize: 14 }}>🐙</span>
                    <span className="font-vt" style={{ fontSize: 13, color: '#4ade80' }}>{activeWs.githubRepo}</span>
                    <span className="font-pixel" style={{ fontSize: '5px', color: '#4b5563', marginLeft: 4 }}>
                      → {activeWs.githubBaseBranch ?? 'main'}
                    </span>
                  </div>
                )}
                <SInput
                  value={ghRepo}
                  onChange={(v) => setGhRepo(v)}
                  placeholder="owner/repo  (ex: acme/backend)"
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <span className="font-pixel" style={{ fontSize: '5px', color: '#6b7280', letterSpacing: '0.08em', flexShrink: 0 }}>
                    BRANCH BASE
                  </span>
                  <input
                    className="font-vt rounded-md outline-none transition-all"
                    value={ghBranch}
                    onChange={(e) => setGhBranch(e.target.value)}
                    placeholder="main"
                    style={{
                      flex: 1, background: 'rgba(124,58,237,.06)', border: '1px solid #2a1050',
                      color: '#e2e8f0', fontSize: 14, padding: '6px 10px',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
                    onBlur={(e) => (e.target.style.borderColor = '#2a1050')}
                  />
                </div>
                <PrimBtn
                  onClick={() => {
                    if (ghRepo.trim()) {
                      setGithubConfig(activeId, ghRepo.trim(), ghBranch.trim() || 'main');
                    }
                  }}
                  disabled={!ghRepo.trim()}
                >
                  {activeWs.githubRepo ? '✓ ATUALIZAR REPOSITÓRIO' : '+ VINCULAR REPOSITÓRIO'}
                </PrimBtn>
                <div className="font-pixel" style={{ fontSize: '5px', color: '#374151', marginTop: 8, letterSpacing: '0.06em', lineHeight: 1.6 }}>
                  Após execução do fluxo, o DEV BACK irá gerar o código e abrir um PR neste repositório.
                </div>
              </div>
            </KBSection>
          </>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-pixel" style={{ fontSize: '5.5px', color: '#6d28d9', letterSpacing: '0.1em', marginBottom: 6 }}>
      {children}
    </div>
  );
}

function SInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      className="w-full font-vt rounded-md outline-none transition-all mb-2.5"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ background: 'rgba(124,58,237,.06)', border: '1px solid #2a1050', color: '#e2e8f0', fontSize: 15, padding: '8px 12px' }}
      onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
      onBlur={(e) => (e.target.style.borderColor = '#2a1050')}
    />
  );
}

function KBSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div
        className="font-pixel flex items-center gap-2 mb-3"
        style={{ fontSize: '5.5px', color: '#6b7280', letterSpacing: '0.1em' }}
      >
        <span className="rounded-full inline-block" style={{ width: 4, height: 4, background: '#7c3aed' }} />
        {title}
      </div>
      {children}
    </div>
  );
}

function IconBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void; danger?: boolean }) {
  return (
    <button
      className="flex items-center justify-center rounded cursor-pointer transition-all flex-shrink-0"
      onClick={onClick}
      style={{ width: 26, height: 26, background: 'transparent', border: '1px solid #1a0d35', color: '#4b5563', fontSize: 12 }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = danger ? '#7f1d1d' : '#7c3aed';
        e.currentTarget.style.color = danger ? '#f87171' : '#7c3aed';
        e.currentTarget.style.background = danger ? 'rgba(248,113,113,.08)' : 'rgba(124,58,237,.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#1a0d35';
        e.currentTarget.style.color = '#4b5563';
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}
