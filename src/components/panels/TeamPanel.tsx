import { useEffect, useRef, useState } from 'react';
import SidePanel from './SidePanel';
import { useUIStore } from '../../store/useUIStore';
import { useProfileStore } from '../../store/useProfileStore';
import { TEAM, PROVIDERS } from '../../constants';
import { loadSprite, drawPreview } from '../../engine/spritesheets';

interface TeamPanelProps {
  className?: string;
}

export default function TeamPanel({ className }: TeamPanelProps) {
  const open = useUIStore((s) => s.openPanel === 'team');
  const togglePanel = useUIStore((s) => s.togglePanel);
  const openAgentCanvas = useUIStore((s) => s.openAgentCanvas);
  const { llmKeys, agentModels, setAgentModel, squadAgentIds, toggleSquadAgent } = useProfileStore();

  const getOptions = () => {
    const opts: { id: string; label: string }[] = [];
    PROVIDERS.forEach((p) => {
      if (llmKeys[p.id] || p.id === 'local') {
        p.models.forEach((m) => opts.push({ id: `${p.id}:${m}`, label: `${p.logo} ${m}` }));
      }
    });
    return opts;
  };

  return (
    <div className={className}>
      <SidePanel open={open} side="right" width={300} title="◧ TIME" onClose={() => togglePanel('team')}>
        <p className="font-vt mb-3" style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
          Monte sua squad. Apenas agentes ativos participam dos fluxos.
        </p>
        <div className="flex flex-col gap-2">
          {TEAM.map((def) => (
            <AgentCard
              key={def.id}
              def={def}
              model={agentModels[def.id] || ''}
              options={getOptions()}
              active={def.isCoord || squadAgentIds.includes(def.id)}
              onChange={(m) => setAgentModel(def.id, m)}
              onToggle={() => { if (!def.isCoord) toggleSquadAgent(def.id); }}
              onConfig={() => { togglePanel('team'); openAgentCanvas(def.id); }}
            />
          ))}
        </div>
      </SidePanel>
    </div>
  );
}

function AgentCard({ def, model, options, active, onChange, onToggle, onConfig }: {
  def: typeof TEAM[number];
  model: string;
  options: { id: string; label: string }[];
  active: boolean;
  onChange: (m: string) => void;
  onToggle: () => void;
  onConfig: () => void;
}) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSprite(def.id).then(() => {
      setLoaded(true);
    }).catch(() => {/* no sprite, show nothing */});
  }, [def.id]);

  useEffect(() => {
    if (loaded && previewRef.current) drawPreview(def.id, previewRef.current);
  }, [loaded, def.id]);

  return (
    <div
      className="flex items-center gap-3 rounded-md p-3 transition-all"
      style={{
        background: active ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.2)',
        border: `1px solid ${active ? '#1a0d35' : '#0d0618'}`,
        opacity: active ? 1 : 0.5,
      }}
    >
      <canvas
        ref={previewRef}
        width={36} height={48}
        className="flex-shrink-0"
        style={{
          imageRendering: 'pixelated',
          width: 36, height: 48,
          filter: active ? 'none' : 'grayscale(1)',
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="font-vt" style={{ fontSize: 16, color: active ? def.color : '#4b5563', lineHeight: 1.2 }}>{def.name}</div>
        <div className="ui-label mt-0.5">{def.role}</div>
        {active && (
          <select
            className="font-vt rounded cursor-pointer outline-none mt-1.5 transition-all"
            value={model}
            onChange={(e) => onChange(e.target.value)}
            style={{
              background: 'rgba(0,0,0,.4)',
              border: '1px solid #2a1050',
              color: '#9ca3af',
              fontSize: 12,
              padding: '3px 7px',
              maxWidth: 145,
              borderRadius: 4,
            }}
            onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
            onBlur={(e) => (e.target.style.borderColor = '#2a1050')}
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Toggle — coord is always on */}
      {def.isCoord ? (
        <div title="Coordenador sempre ativo" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <div style={{
            width: 28, height: 16, borderRadius: 8,
            background: '#7c3aed', position: 'relative', opacity: 0.6,
          }}>
            <div style={{ position: 'absolute', right: 2, top: 2, width: 12, height: 12, borderRadius: '50%', background: '#fff' }} />
          </div>
        </div>
      ) : (
        <button
          onClick={onToggle}
          title={active ? 'Remover da squad' : 'Adicionar à squad'}
          style={{
            background: 'transparent', border: 'none', padding: 0,
            cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center',
          }}
        >
          <div style={{
            width: 28, height: 16, borderRadius: 8,
            background: active ? def.color : '#374151',
            position: 'relative', transition: 'background .2s',
          }}>
            <div style={{
              position: 'absolute',
              left: active ? 14 : 2,
              top: 2,
              width: 12, height: 12,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left .2s',
            }} />
          </div>
        </button>
      )}

      <button
        onClick={onConfig}
        title="Configurar agente"
        style={{
          background: 'transparent',
          border: '1px solid #2a1050',
          borderRadius: 5,
          color: '#4b5563',
          fontSize: 13,
          width: 26,
          height: 26,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = def.color; e.currentTarget.style.color = def.color; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a1050'; e.currentTarget.style.color = '#4b5563'; }}
      >
        ⚙
      </button>
    </div>
  );
}
