import { useState } from 'react';
import { useFlowStore } from '../../store/useFlowStore';
import { useLLMTraceStore, type LLMTrace } from '../../store/useLLMTraceStore';

const TAG_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  task:   { bg: 'rgba(96,165,250,.1)',  color: '#60a5fa', border: 'rgba(96,165,250,.3)' },
  review: { bg: 'rgba(74,222,128,.1)',  color: '#4ade80', border: 'rgba(74,222,128,.3)' },
  alert:  { bg: 'rgba(248,113,113,.1)', color: '#f87171', border: 'rgba(248,113,113,.3)' },
  sync:   { bg: 'rgba(251,146,60,.1)',  color: '#fb923c', border: 'rgba(251,146,60,.3)' },
  deploy: { bg: 'rgba(192,132,252,.1)', color: '#c084fc', border: 'rgba(192,132,252,.3)' },
  orch:   { bg: 'rgba(251,191,36,.1)',  color: '#fbbf24', border: 'rgba(251,191,36,.3)' },
  agent:  { bg: 'rgba(139,92,246,.1)',  color: '#7c3aed', border: 'rgba(139,92,246,.3)' },
  done:   { bg: 'rgba(74,222,128,.1)',  color: '#4ade80', border: 'rgba(74,222,128,.3)' },
};

const PROVIDER_COLOR: Record<string, string> = {
  claude:  '#f97316',
  gpt4:    '#22c55e',
  gemini:  '#3b82f6',
  mistral: '#8b5cf6',
  llama:   '#6b7280',
  local:   '#f59e0b',
};

export default function Log() {
  const [tab, setTab] = useState<'log' | 'requests'>('log');
  const [selectedTrace, setSelectedTrace] = useState<LLMTrace | null>(null);
  const log    = useFlowStore((s) => s.log);
  const traces = useLLMTraceStore((s) => s.traces);
  const clear  = useLLMTraceStore((s) => s.clearTraces);

  const pendingCount = traces.filter((t) => t.status === 'pending').length;
  const errorCount   = traces.filter((t) => t.status === 'error').length;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 260,
          height: 130,
          background: '#0d0720',
          borderTop: '1px solid #2a1050',
          zIndex: 300,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ── Header / Tabs ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid #1a0d35',
            flexShrink: 0,
          }}
        >
          <TabBtn active={tab === 'log'} onClick={() => setTab('log')}>
            <span
              className="anim-gp rounded-full inline-block"
              style={{ width: 4, height: 4, background: '#4ade80', marginRight: 5, flexShrink: 0 }}
            />
            LOG
          </TabBtn>

          <TabBtn active={tab === 'requests'} onClick={() => setTab('requests')}>
            <span style={{ marginRight: 5 }}>⇄</span>
            REQUESTS
            {pendingCount > 0 && (
              <span style={{
                marginLeft: 5, background: 'rgba(251,191,36,.2)', border: '1px solid rgba(251,191,36,.4)',
                color: '#fbbf24', borderRadius: 3, padding: '0 4px', fontSize: '5px',
              }}>
                {pendingCount}
              </span>
            )}
            {errorCount > 0 && (
              <span style={{
                marginLeft: 4, background: 'rgba(248,113,113,.2)', border: '1px solid rgba(248,113,113,.4)',
                color: '#f87171', borderRadius: 3, padding: '0 4px', fontSize: '5px',
              }}>
                {errorCount} err
              </span>
            )}
          </TabBtn>

          <div style={{ flex: 1 }} />

          {tab === 'requests' && traces.length > 0 && (
            <button
              onClick={clear}
              style={{
                fontFamily: 'monospace', fontSize: '6px', letterSpacing: '0.1em',
                background: 'transparent', border: 'none', color: '#374151',
                cursor: 'pointer', padding: '0 14px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#9ca3af')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#374151')}
            >
              LIMPAR
            </button>
          )}
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflow: 'hidden' }}>

          {tab === 'log' && (
            <div className="flex flex-col justify-end h-full" style={{ padding: '5px 16px 8px' }}>
              {log.length === 0 ? (
                <div className="font-vt" style={{ fontSize: 13, color: '#374151' }}>
                  Aguardando eventos...
                </div>
              ) : (
                log.slice(0, 4).map((entry) => (
                  <div
                    key={entry.id}
                    className="font-vt flex items-center gap-1.5 whitespace-nowrap overflow-hidden"
                    style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.55 }}
                  >
                    <span style={{ color: '#374151', flexShrink: 0 }}>›</span>
                    <span className="overflow-hidden text-ellipsis">
                      <span dangerouslySetInnerHTML={{ __html: entry.text }} />
                    </span>
                    {entry.tag && (
                      <span
                        style={{
                          fontSize: '4.5px', letterSpacing: '0.06em', fontFamily: 'monospace',
                          flexShrink: 0, borderRadius: 3, padding: '2px 5px',
                          ...(TAG_STYLES[entry.tag.type] ?? TAG_STYLES.task),
                          border: `1px solid ${(TAG_STYLES[entry.tag.type] ?? TAG_STYLES.task).border}`,
                        }}
                      >
                        {entry.tag.label}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'requests' && (
            <div
              style={{
                height: '100%',
                overflowX: 'auto',
                overflowY: 'hidden',
                display: 'flex',
                alignItems: 'stretch',
                gap: 6,
                padding: '8px 12px',
              }}
            >
              {/* Token summary badge */}
              {traces.length > 0 && (
                <div style={{
                  flexShrink: 0, width: 100, display: 'flex', flexDirection: 'column',
                  justifyContent: 'center', alignItems: 'center', gap: 4,
                  background: 'rgba(124,58,237,.06)', border: '1px solid #1a0d35',
                  borderRadius: 6, padding: '6px 8px',
                }}>
                  <div className="font-pixel" style={{ fontSize: '4.5px', color: '#6d28d9', letterSpacing: '0.1em' }}>TOKENS</div>
                  <div className="font-vt" style={{ fontSize: 18, color: '#a78bfa', lineHeight: 1 }}>
                    {traces.reduce((s, t) => s + (t.tokensInput ?? 0) + (t.tokensOutput ?? 0), 0).toLocaleString()}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '5.5px', color: '#4b5563' }}>
                      IN {traces.reduce((s, t) => s + (t.tokensInput ?? 0), 0).toLocaleString()}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '5.5px', color: '#4b5563' }}>
                      OUT {traces.reduce((s, t) => s + (t.tokensOutput ?? 0), 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              {traces.length === 0 ? (
                <div className="font-vt flex items-center" style={{ fontSize: 13, color: '#374151' }}>
                  Nenhuma chamada LLM ainda. Execute uma história para ver os requests.
                </div>
              ) : (
                traces.map((trace) => (
                  <TraceCard key={trace.id} trace={trace} onSelect={setSelectedTrace} />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Trace detail modal ── */}
      {selectedTrace && (
        <TraceModal trace={selectedTrace} onClose={() => setSelectedTrace(null)} />
      )}
    </>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'monospace', fontSize: '6px', letterSpacing: '0.14em',
        padding: '8px 14px', background: 'transparent', border: 'none',
        borderBottom: active ? '2px solid #7c3aed' : '2px solid transparent',
        color: active ? '#7c3aed' : '#4b5563',
        cursor: 'pointer', display: 'flex', alignItems: 'center',
        transition: 'color .12s',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#6b7280'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#4b5563'; }}
    >
      {children}
    </button>
  );
}

// ── Trace Card (compact, click to open modal) ─────────────────────────────────

function TraceCard({ trace, onSelect }: { trace: LLMTrace; onSelect: (t: LLMTrace) => void }) {
  const providerColor = PROVIDER_COLOR[trace.provider] ?? '#6b7280';
  const statusColor   = trace.status === 'success' ? '#4ade80' : trace.status === 'error' ? '#f87171' : '#fbbf24';
  const statusIcon    = trace.status === 'success' ? '✓' : trace.status === 'error' ? '✕' : '…';

  return (
    <div
      onClick={() => onSelect(trace)}
      style={{
        flexShrink: 0,
        width: 190,
        background: 'rgba(255,255,255,.02)',
        border: `1px solid ${trace.status === 'error' ? 'rgba(248,113,113,.3)' : trace.status === 'pending' ? 'rgba(251,191,36,.2)' : '#1a0d35'}`,
        borderRadius: 6,
        padding: '8px 10px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        transition: 'background .12s, border-color .12s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.02)')}
    >
      {/* Status + provider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 14, height: 14, borderRadius: '50%',
          background: `${statusColor}22`, border: `1px solid ${statusColor}66`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 8, color: statusColor, fontWeight: 'bold', flexShrink: 0,
        }}>
          {statusIcon}
        </span>
        <span style={{
          fontFamily: 'monospace', fontSize: '7px', letterSpacing: '0.1em',
          color: providerColor, fontWeight: 'bold',
        }}>
          {trace.provider.toUpperCase()}
        </span>
        {trace.duration !== undefined && (
          <span style={{ fontFamily: 'monospace', fontSize: '6px', color: '#4b5563', marginLeft: 'auto' }}>
            {`${trace.duration}ms`}
          </span>
        )}
      </div>

      {/* Agent + model */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          fontFamily: 'VT323, monospace', fontSize: 13,
          color: trace.agentColor, lineHeight: 1,
        }}>
          {trace.agentName}
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: '6px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {trace.model}
        </span>
      </div>

      {/* Response / error preview */}
      {trace.status !== 'pending' && (
        <div style={{
          fontFamily: 'VT323, monospace', fontSize: 11,
          color: trace.status === 'error' ? '#f87171' : '#6b7280',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {trace.status === 'error' ? trace.error : trace.response}
        </div>
      )}

      {/* Click hint */}
      <div style={{ fontFamily: 'monospace', fontSize: '5px', color: '#374151', letterSpacing: '0.1em', marginTop: 'auto' }}>
        CLIQUE PARA DETALHES
      </div>
    </div>
  );
}

// ── Trace detail modal ────────────────────────────────────────────────────────

function TraceModal({ trace, onClose }: { trace: LLMTrace; onClose: () => void }) {
  const providerColor = PROVIDER_COLOR[trace.provider] ?? '#6b7280';
  const statusColor   = trace.status === 'success' ? '#4ade80' : trace.status === 'error' ? '#f87171' : '#fbbf24';
  const statusLabel   = trace.status === 'success' ? 'SUCCESS' : trace.status === 'error' ? 'ERROR' : 'PENDING';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 'min(680px, 96vw)',
        maxHeight: '82vh',
        background: '#080d1a',
        backgroundImage: 'radial-gradient(circle, rgba(42,16,80,.4) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        border: '1px solid #2a1050',
        borderRadius: 12,
        boxShadow: '0 0 50px rgba(124,58,237,.15), 0 20px 60px rgba(0,0,0,.7)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 20px', borderBottom: '1px solid #160a30', flexShrink: 0,
        }}>
          {/* Status badge */}
          <span style={{
            fontFamily: 'monospace', fontSize: '7px', letterSpacing: '0.14em',
            color: statusColor, background: `${statusColor}18`,
            border: `1px solid ${statusColor}44`,
            borderRadius: 4, padding: '3px 8px',
          }}>
            {statusLabel}
          </span>

          {/* Provider */}
          <span style={{
            fontFamily: 'monospace', fontSize: '8px', letterSpacing: '0.12em',
            color: providerColor, fontWeight: 'bold',
          }}>
            {trace.provider.toUpperCase()}
          </span>

          {/* Agent */}
          <span style={{ fontFamily: 'VT323, monospace', fontSize: 16, color: trace.agentColor }}>
            {trace.agentName}
          </span>

          {/* Model */}
          <span style={{ fontFamily: 'monospace', fontSize: '7px', color: '#4b5563' }}>
            {trace.model}
          </span>

          {trace.duration !== undefined && (
            <span style={{ fontFamily: 'monospace', fontSize: '7px', color: '#374151' }}>
              {`${trace.duration}ms`}
            </span>
          )}

          <div style={{ flex: 1 }} />

          {/* Timestamp */}
          <span style={{ fontFamily: 'monospace', fontSize: '6px', color: '#374151', letterSpacing: '0.08em' }}>
            {new Date(trace.timestamp).toLocaleTimeString('pt-BR')}
          </span>

          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: '1px solid #2a1050',
              borderRadius: 6, color: '#4b5563', fontFamily: 'VT323, monospace',
              fontSize: 20, width: 28, height: 28, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.color = '#7c3aed'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a1050'; e.currentTarget.style.color = '#4b5563'; }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Section label="SYSTEM PROMPT" color="#60a5fa" text={trace.systemPrompt ?? '—'} />
          <Section label="USER MESSAGE"  color="#34d399" text={trace.userMessage ?? '—'} />
          {trace.status === 'success' && (
            <Section label="RESPONSE" color="#4ade80" text={trace.response ?? '—'} />
          )}
          {trace.status === 'error' && (
            <Section label="ERROR" color="#f87171" text={trace.error ?? '—'} />
          )}
          {trace.status === 'pending' && (
            <div style={{ fontFamily: 'VT323, monospace', fontSize: 16, color: '#fbbf24', textAlign: 'center', padding: '24px 0' }}>
              Aguardando resposta...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ label, color, text }: { label: string; color: string; text: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'monospace', fontSize: '7px', letterSpacing: '0.14em', color, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'VT323, monospace', fontSize: 14, color: '#9ca3af',
        background: 'rgba(0,0,0,.35)', borderRadius: 6, padding: '10px 12px',
        maxHeight: 200, overflowY: 'auto', lineHeight: 1.55, whiteSpace: 'pre-wrap',
        wordBreak: 'break-word', border: '1px solid #1a0d35',
      }}>
        {text}
      </div>
    </div>
  );
}
