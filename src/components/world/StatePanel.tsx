import { useState, useEffect, useRef } from 'react';
import { useFlowStore } from '../../store/useFlowStore';
import type { FlowRun, FlowStep, InfoQuestion } from '../../types';

export default function StatePanel() {
  const flows          = useFlowStore((s) => s.flows);
  const selectedFlowId = useFlowStore((s) => s.selectedFlowId);
  const selectFlow     = useFlowStore((s) => s.selectFlow);
  const removeFlow     = useFlowStore((s) => s.removeFlow);

  const [approvalStep, setApprovalStep]     = useState<FlowStep | null>(null);
  const [infoRequestStep, setInfoRequestStep] = useState<FlowStep | null>(null);
  const lastAutoOpenRef = useRef<string>('');

  // Auto-open modals when a step enters info-request or approval/spec-review
  // Uses a signature based on step id + status + infoRequest length to detect changes
  useEffect(() => {
    // Don't auto-open if a modal is already showing
    if (approvalStep || infoRequestStep) return;

    for (const flow of flows) {
      if (flow.status !== 'running') continue;
      for (const step of flow.steps) {
        const sig = `${step.id}|${step.status}|${step.infoRequest?.length ?? 0}|${step.specDraft?.length ?? 0}`;

        if (step.status === 'info-request' && sig !== lastAutoOpenRef.current) {
          lastAutoOpenRef.current = sig;
          setInfoRequestStep({ ...step }); // new ref to force update
          return;
        }
        if ((step.status === 'approval' || step.status === 'spec-review') && sig !== lastAutoOpenRef.current) {
          lastAutoOpenRef.current = sig;
          setApprovalStep({ ...step });
          return;
        }
      }
    }
  }, [flows, approvalStep, infoRequestStep]);

  const running = flows.filter((f) => f.status === 'running');

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 52,
          right: 0,
          width: 260,
          bottom: 110,
          background: '#0d0720',
          borderLeft: '1px solid #2a1050',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="font-pixel flex items-center justify-between flex-shrink-0"
          style={{
            padding: '10px 14px',
            fontSize: '6px',
            color: '#6b7280',
            letterSpacing: '0.12em',
            borderBottom: '1px solid #1a0d35',
            background: 'rgba(124,58,237,.03)',
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="rounded-full inline-block"
              style={{ width: 5, height: 5, background: '#7c3aed', boxShadow: '0 0 5px #7c3aed' }}
            />
            FLOW STATE
          </div>
          {running.length > 0 && (
            <span
              className="font-pixel rounded-full"
              style={{
                fontSize: '5px', padding: '2px 6px',
                background: 'rgba(74,222,128,.12)', border: '1px solid rgba(74,222,128,.3)',
                color: '#4ade80', letterSpacing: '0.06em',
              }}
            >
              {running.length} ativo{running.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Flows list */}
        <div className="flex-1 overflow-y-auto">
          {flows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full" style={{ padding: '32px 16px' }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.2 }}>◈</div>
              <div className="font-vt text-center" style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.5 }}>
                Nenhum fluxo ativo.<br />
                <span style={{ color: '#6b7280' }}>Crie uma história para começar.</span>
              </div>
            </div>
          ) : (
            <div style={{ padding: '6px 0' }}>
              {flows.map((flow) => (
                <FlowCard
                  key={flow.id}
                  flow={flow}
                  selected={flow.id === selectedFlowId}
                  onSelect={() => selectFlow(flow.id === selectedFlowId ? null : flow.id)}
                  onRemove={() => removeFlow(flow.id)}
                  onApprove={setApprovalStep}
                  onInfoRequest={setInfoRequestStep}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Code approval modal */}
      {approvalStep && (
        <CodeApprovalModal
          step={approvalStep}
          onConfirm={() => {
            (window as unknown as { _approvalCallback?: (ok: boolean) => void })._approvalCallback?.(true);
            setApprovalStep(null);
          }}
          onCancel={() => {
            (window as unknown as { _approvalCallback?: (ok: boolean) => void })._approvalCallback?.(false);
            setApprovalStep(null);
          }}
          onDismiss={() => {
            // Close modal without resolving — keeps the flow waiting
            setApprovalStep(null);
          }}
        />
      )}

      {/* Info request modal */}
      {infoRequestStep && (
        <InfoRequestModal
          step={infoRequestStep}
          onSubmit={(answers) => {
            (window as unknown as { _infoCallback?: (a: Record<string, string>) => void })._infoCallback?.(answers);
            setInfoRequestStep(null);
          }}
          onCancel={() => {
            (window as unknown as { _infoCallback?: (a: null) => void })._infoCallback?.(null);
            setInfoRequestStep(null);
          }}
        />
      )}
    </>
  );
}

// ── Flow Card ──

function FlowCard({
  flow, selected, onSelect, onRemove, onApprove, onInfoRequest,
}: {
  flow: FlowRun;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onApprove: (step: FlowStep) => void;
  onInfoRequest: (step: FlowStep) => void;
}) {
  const isRunning      = flow.status === 'running';
  const activeStep     = flow.steps.find((s) => s.status === 'active');
  const approvalStep   = flow.steps.find((s) => s.status === 'approval' || s.status === 'spec-review');
  const infoStep       = flow.steps.find((s) => s.status === 'info-request');
  const waitingStep    = approvalStep ?? infoStep;
  const doneCount      = flow.steps.filter((s) => s.status === 'done').length;
  const progress       = flow.steps.length > 0 ? doneCount / flow.steps.length : 0;

  return (
    <div
      style={{
        borderBottom: '1px solid #1a0d35',
        background: selected ? 'rgba(124,58,237,.05)' : 'transparent',
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center gap-2 cursor-pointer transition-all"
        style={{ padding: '9px 14px' }}
        onClick={onSelect}
        onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.02)'; }}
        onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        {/* Status dot */}
        <span
          className={isRunning ? 'anim-gp' : ''}
          style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: isRunning
              ? (waitingStep ? '#fb923c' : '#4ade80')
              : flow.status === 'done' ? '#7c3aed' : '#f87171',
            boxShadow: isRunning
              ? (waitingStep ? '0 0 6px #fb923c' : '0 0 5px #4ade80')
              : undefined,
          }}
        />

        {/* Story title */}
        <div className="flex-1 min-w-0">
          <div className="font-vt overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.3 }}>
            {flow.story}
          </div>
          {isRunning && approvalStep && (
            <div className="font-pixel overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: '5px', color: '#fb923c', letterSpacing: '0.05em', marginTop: 2 }}>
              ⚡ AGUARDA APROVAÇÃO
            </div>
          )}
          {isRunning && infoStep && !approvalStep && (
            <div className="font-pixel overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: '5px', color: '#f97316', letterSpacing: '0.05em', marginTop: 2 }}>
              ❓ AGUARDA INFORMAÇÕES
            </div>
          )}
          {isRunning && !waitingStep && activeStep && (
            <div className="font-pixel overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: '5px', color: '#6b7280', letterSpacing: '0.05em', marginTop: 2 }}>
              {activeStep.role}
            </div>
          )}
          {!isRunning && (
            <div className="font-pixel" style={{ fontSize: '5px', color: flow.status === 'done' ? '#7c3aed' : '#f87171', letterSpacing: '0.05em', marginTop: 2 }}>
              {flow.status === 'done' ? 'CONCLUÍDO' : 'ERRO'}
            </div>
          )}
        </div>

        {/* Step count */}
        <div className="font-pixel flex-shrink-0" style={{ fontSize: '5px', color: '#4b5563' }}>
          {doneCount}/{flow.steps.length}
        </div>

        {!isRunning && (
          <button
            className="flex-shrink-0 flex items-center justify-center rounded cursor-pointer transition-all"
            style={{ width: 18, height: 18, background: 'transparent', border: '1px solid #1a0d35', color: '#4b5563', fontSize: 10 }}
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = '#7f1d1d'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#4b5563'; e.currentTarget.style.borderColor = '#1a0d35'; }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div style={{ height: 2, background: '#1a0d35', margin: '0 14px 6px' }}>
          <div style={{
            height: '100%', width: `${progress * 100}%`,
            background: waitingStep
              ? 'linear-gradient(90deg, #fb923c, #fbbf24)'
              : 'linear-gradient(90deg, #7c3aed, #7c3aed)',
            transition: 'width .4s ease',
          }} />
        </div>
      )}

      {/* Steps (expanded when selected) */}
      {selected && (
        <div style={{ paddingBottom: 6 }}>
          {flow.steps.map((step) => (
            <StepRow
              key={step.id}
              step={step}
              onApprove={(step.status === 'approval' || step.status === 'spec-review') ? () => onApprove(step) : undefined}
              onInfoRequest={step.status === 'info-request' ? () => onInfoRequest(step) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step Row ──

function StepRow({ step, onApprove, onInfoRequest }: { step: FlowStep; onApprove?: () => void; onInfoRequest?: () => void }) {
  const isApproval    = step.status === 'approval' || step.status === 'spec-review';
  const isInfoRequest = step.status === 'info-request';

  const color = {
    done:           '#4ade80',
    active:         '#7c3aed',
    pending:        '#2a1050',
    error:          '#f87171',
    approval:       '#fb923c',
    'spec-review':  '#7c3aed',
    'info-request': '#f97316',
  }[step.status] ?? '#2a1050';

  return (
    <div
      style={{
        padding: '6px 14px 6px 20px',
        borderLeft: `2px solid ${color}`,
        margin: '1px 14px 1px 14px',
        background: (isApproval || isInfoRequest)
          ? 'rgba(249,115,22,.06)'
          : step.status === 'active' ? 'rgba(124,58,237,.04)' : 'transparent',
        borderRadius: 2,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={isApproval ? 'anim-gp' : ''}
          style={{
            width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
            background: color,
            boxShadow: (step.status === 'active' || isApproval) ? `0 0 4px ${color}` : undefined,
          }}
        />
        <span className="font-pixel" style={{ fontSize: '5px', color: step.agentColor, letterSpacing: '0.05em', flex: 1 }}>
          {step.role}
        </span>
        {isApproval && step.filePath && (
          <span className="font-pixel" style={{ fontSize: '4.5px', color: '#fb923c', letterSpacing: '0.04em', opacity: 0.8 }}>
            {step.filePath.split('/').pop()}
          </span>
        )}
      </div>

      <div className="font-vt" style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.3, marginTop: 2 }}>
        {step.desc}
      </div>

      {/* Approval action */}
      {isApproval && onApprove && (
        <button
          onClick={onApprove}
          style={{
            marginTop: 5, width: '100%',
            fontFamily: 'monospace', fontSize: '7px', letterSpacing: '0.12em',
            background: 'rgba(251,146,60,.18)', border: '1px solid rgba(251,146,60,.5)',
            color: '#fb923c', borderRadius: 4, padding: '5px 0', cursor: 'pointer',
            transition: 'background .12s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(251,146,60,.3)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(251,146,60,.18)')}
        >
          REVISAR CÓDIGO ▶
        </button>
      )}

      {/* Info-request action */}
      {isInfoRequest && onInfoRequest && (
        <button
          onClick={onInfoRequest}
          style={{
            marginTop: 5, width: '100%',
            fontFamily: 'monospace', fontSize: '7px', letterSpacing: '0.12em',
            background: 'rgba(249,115,22,.18)', border: '1px solid rgba(249,115,22,.5)',
            color: '#f97316', borderRadius: 4, padding: '5px 0', cursor: 'pointer',
            transition: 'background .12s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(249,115,22,.3)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(249,115,22,.18)')}
        >
          PREENCHER INFORMAÇÕES ▶
        </button>
      )}

      {/* Result */}
      {step.result && step.status === 'done' && (
        <div
          className="font-vt rounded mt-1"
          style={{
            fontSize: 11, color: '#4ade80',
            background: 'rgba(74,222,128,.06)', border: '1px solid rgba(74,222,128,.2)',
            padding: '2px 6px', lineHeight: 1.4,
          }}
        >
          {step.result}
        </div>
      )}
      {step.result && step.status === 'error' && (
        <div
          className="font-vt rounded mt-1"
          style={{
            fontSize: 11, color: '#f87171',
            background: 'rgba(248,113,113,.06)', border: '1px solid rgba(248,113,113,.2)',
            padding: '2px 6px', lineHeight: 1.4,
          }}
        >
          {step.result}
        </div>
      )}
    </div>
  );
}

// ── Code Approval Modal ──

function CodeApprovalModal({
  step, onConfirm, onCancel, onDismiss,
}: {
  step: FlowStep;
  onConfirm: () => void;
  onCancel: () => void;
  onDismiss?: () => void;
}) {
  const isSpec = step.status === 'spec-review';
  const blocks = parseCodeBlocks(step.code ?? '');
  const code   = isSpec ? (step.specDraft ?? '') : (blocks[0]?.code ?? step.code ?? '');
  const lang   = isSpec ? 'spec' : (blocks[0]?.lang ?? '');

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9600,
        background: 'rgba(0,0,0,.80)', backdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) (onDismiss ?? onCancel)(); }}
    >
      <div style={{
        width: 'min(740px, 96vw)',
        maxHeight: '88vh',
        background: '#080d1a',
        backgroundImage: 'radial-gradient(circle, rgba(42,16,80,.4) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        border: '1px solid rgba(251,146,60,.4)',
        borderRadius: 12,
        boxShadow: '0 0 50px rgba(251,146,60,.12), 0 20px 60px rgba(0,0,0,.7)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 20px', borderBottom: '1px solid rgba(251,146,60,.2)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 16 }}>{isSpec ? '📋' : '🐙'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'monospace', fontSize: '8px', letterSpacing: '0.18em', color: isSpec ? '#7c3aed' : '#fb923c' }}>
              {isSpec ? 'REVISAR ESPECIFICAÇÃO DO PO' : 'REVISAR CÓDIGO ANTES DE COMMITAR'}
            </div>
            <div style={{ fontFamily: 'VT323, monospace', fontSize: 14, color: step.agentColor, marginTop: 2 }}>
              {isSpec ? 'P.OWNER → Spec da História' : `${step.role} → ${step.filePath ?? 'arquivo'}`}
            </div>
          </div>
          <span style={{ fontFamily: 'monospace', fontSize: '7px', color: '#4b5563', background: 'rgba(0,0,0,.3)', borderRadius: 4, padding: '3px 8px' }}>
            {lang || 'code'}
          </span>
        </div>

        {/* Code */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <pre style={{
            margin: 0,
            fontFamily: '"Fira Code", "Cascadia Code", "Courier New", monospace',
            fontSize: '13px',
            color: '#e2e8f0',
            background: 'rgba(0,0,0,.4)',
            border: '1px solid #1a0d35',
            borderRadius: 8,
            padding: '16px',
            lineHeight: 1.65,
            whiteSpace: 'pre',
            overflowX: 'auto',
            tabSize: 4,
          }}>
            <code>{code}</code>
          </pre>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 10, padding: '14px 20px',
          borderTop: `1px solid ${isSpec ? 'rgba(124,58,237,.2)' : 'rgba(251,146,60,.2)'}`, flexShrink: 0,
          background: 'rgba(0,0,0,.2)',
        }}>
          <div style={{ flex: 1, fontFamily: 'monospace', fontSize: '7px', color: '#4b5563', letterSpacing: '0.08em', lineHeight: 1.7 }}>
            {isSpec
              ? 'Revise a especificacao. Apos aprovar, a squad vai executar com base neste SDD.'
              : <>O codigo sera commitado em <span style={{ color: '#fb923c' }}>{step.filePath}</span> na branch da historia.</>
            }
          </div>
          <button
            onClick={onCancel}
            style={{
              fontFamily: 'monospace', fontSize: '8px', letterSpacing: '0.12em',
              background: 'transparent', border: '1px solid #2a1050',
              color: '#4b5563', borderRadius: 6, padding: '9px 18px', cursor: 'pointer',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = '#7f1d1d'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#4b5563'; e.currentTarget.style.borderColor = '#2a1050'; }}
          >
            {isSpec ? 'REJEITAR SDD' : 'CANCELAR'}
          </button>
          <button
            onClick={onConfirm}
            style={{
              fontFamily: 'monospace', fontSize: '8px', letterSpacing: '0.12em',
              background: isSpec ? 'rgba(124,58,237,.2)' : 'rgba(251,146,60,.2)',
              border: `1px solid ${isSpec ? 'rgba(124,58,237,.6)' : 'rgba(251,146,60,.6)'}`,
              color: isSpec ? '#7c3aed' : '#fb923c',
              borderRadius: 6, padding: '9px 22px', cursor: 'pointer',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = isSpec ? 'rgba(124,58,237,.35)' : 'rgba(251,146,60,.35)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = isSpec ? 'rgba(124,58,237,.2)' : 'rgba(251,146,60,.2)'; }}
          >
            {isSpec ? 'APROVAR SDD' : 'CONFIRMAR COMMIT 🐙'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Info Request Modal ──

function InfoRequestModal({
  step, onSubmit, onCancel,
}: {
  step: FlowStep;
  onSubmit: (answers: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const questions: InfoQuestion[] = step.infoRequest ?? [];
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(questions.map((q) => [q.key, q.default ?? '']))
  );

  const set = (key: string, val: string) => setValues((v) => ({ ...v, [key]: val }));

  const isPO = step.agentId === 'po';
  const isCoordAlert = step.agentId === 'coord';

  // Dynamic title/icon based on agent
  const icon = isPO ? '📋' : isCoordAlert ? '⚠️' : '☁️';
  const title = isPO ? 'REFINAMENTO DO PO' : isCoordAlert ? 'AÇÃO NECESSÁRIA' : `${step.role} — INFORMAÇÕES`;
  const subtitle = isPO
    ? 'Responda as perguntas para refinar a especificação'
    : `${step.agentName} precisa dessas informações para continuar`;
  const accentColor = isPO ? '#7c3aed' : '#f97316';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9600,
        background: 'rgba(0,0,0,.80)', backdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        width: 'min(560px, 96vw)', maxHeight: '88vh',
        background: '#080d1a',
        backgroundImage: 'radial-gradient(circle, rgba(42,16,80,.4) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        border: `1px solid ${accentColor}66`,
        borderRadius: 12,
        boxShadow: `0 0 50px ${accentColor}1a, 0 20px 60px rgba(0,0,0,.7)`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '16px 20px', borderBottom: `1px solid ${accentColor}33`, flexShrink: 0,
        }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '9px', letterSpacing: '0.16em', color: accentColor, textTransform: 'uppercase' }}>
              {title}
            </div>
            <div style={{ fontFamily: 'VT323, monospace', fontSize: 14, color: step.agentColor, marginTop: 3 }}>
              {subtitle}
            </div>
          </div>
        </div>

        {/* Questions */}
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
          {questions.map((q) => (
            <div key={q.key}>
              <label style={{
                display: 'block',
                fontFamily: 'ui-monospace, monospace', fontSize: '9px',
                letterSpacing: '0.08em',
                color: '#e2e8f0', marginBottom: 5, lineHeight: 1.5,
              }}>
                {q.label}{q.required && <span style={{ color: '#f87171', marginLeft: 4 }}>*</span>}
              </label>
              <input
                value={values[q.key] ?? ''}
                onChange={(e) => set(q.key, e.target.value)}
                placeholder={q.placeholder ?? ''}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,.04)',
                  border: `1px solid ${values[q.key]?.trim() ? `${accentColor}66` : '#2a1050'}`,
                  borderRadius: 6, color: '#e2e8f0',
                  fontFamily: 'ui-monospace, "Courier New", monospace',
                  fontSize: '12px', padding: '8px 12px', outline: 'none',
                  transition: 'border-color .12s',
                }}
                onFocus={(e) => (e.target.style.borderColor = accentColor)}
                onBlur={(e) => (e.target.style.borderColor = values[q.key]?.trim() ? `${accentColor}66` : '#2a1050')}
              />
            </div>
          ))}
        </div>

        {/* Footer with action buttons */}
        <div style={{
          display: 'flex', gap: 10, padding: '14px 20px',
          borderTop: `1px solid ${accentColor}33`, flexShrink: 0,
          background: 'rgba(0,0,0,.2)', alignItems: 'center',
        }}>
          {/* Cancel */}
          <button
            onClick={onCancel}
            style={{
              fontFamily: 'monospace', fontSize: '8px', letterSpacing: '0.12em',
              background: 'transparent', border: '1px solid #2a1050',
              color: '#4b5563', borderRadius: 6, padding: '9px 16px', cursor: 'pointer', flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = '#7f1d1d'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#4b5563'; e.currentTarget.style.borderColor = '#2a1050'; }}
          >
            CANCELAR
          </button>

          <div style={{ flex: 1 }} />

          {/* Approve — PO only: skip remaining questions, generate spec now */}
          {isPO && (
            <button
              onClick={() => onSubmit({ ...values, _approve: '1' })}
              style={{
                fontFamily: 'monospace', fontSize: '8px', letterSpacing: '0.12em',
                background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.5)',
                color: '#4ade80', borderRadius: 6, padding: '9px 18px', cursor: 'pointer', flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(74,222,128,.25)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(74,222,128,.1)'; }}
            >
              ✓ APROVAR SPEC
            </button>
          )}

          {/* Submit answers */}
          <button
            onClick={() => onSubmit(values)}
            style={{
              fontFamily: 'monospace', fontSize: '8px', letterSpacing: '0.12em',
              background: `${accentColor}33`, border: `1px solid ${accentColor}99`,
              color: accentColor, borderRadius: 6, padding: '9px 18px', cursor: 'pointer', flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${accentColor}55`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = `${accentColor}33`; }}
          >
            {isPO ? 'ENVIAR RESPOSTAS →' : 'ENVIAR'}
          </button>
        </div>
      </div>
    </div>
  );
}

function parseCodeBlocks(text: string): { lang: string; code: string }[] {
  const blocks: { lang: string; code: string }[] = [];
  const re = /```(\w*)\n([\s\S]+?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) blocks.push({ lang: m[1], code: m[2] });
  return blocks;
}
