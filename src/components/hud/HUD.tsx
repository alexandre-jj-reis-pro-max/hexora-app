import { useUIStore } from '../../store/useUIStore';
import { useFlowStore } from '../../store/useFlowStore';
import { useProfileStore } from '../../store/useProfileStore';
import WorkspaceSwitcher from './WorkspaceSwitcher';

export default function HUD() {
  const togglePanel = useUIStore((s) => s.togglePanel);
  const flows = useFlowStore((s) => s.flows);
  const running = flows.some((f) => f.status === 'running');
  const activeFlow = flows.find((f) => f.status === 'running');
  const currentStory = activeFlow?.story ?? '';
  const profile = useProfileStore((s) => s.profile);

  const initials = profile.name
    ? profile.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  return (
    <div
      className="fixed top-0 left-0 right-0 flex items-center z-[300]"
      style={{
        height: 52,
        background: 'linear-gradient(180deg, #110826 0%, #0d0720 100%)',
        borderBottom: '1px solid #2a1050',
      }}
    >
      {/* Workspace */}
      <WorkspaceSwitcher />

      {/* Divisor */}
      <div style={{ width: 1, height: 24, background: '#2a1050', flexShrink: 0 }} />

      {/* CTA Nova História */}
      <button
        onClick={() => togglePanel('story')}
        className="font-pixel flex items-center gap-1.5 rounded-md cursor-pointer transition-all flex-shrink-0"
        style={{
          marginLeft: 14,
          padding: '6px 14px',
          background: 'rgba(124,58,237,.22)',
          border: '1px solid rgba(124,58,237,.6)',
          color: '#c4b5fd',
          fontSize: '8px',
          letterSpacing: '0.1em',
          boxShadow: '0 0 12px rgba(124,58,237,.18)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(124,58,237,.38)';
          e.currentTarget.style.boxShadow = '0 0 20px rgba(124,58,237,.35)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(124,58,237,.22)';
          e.currentTarget.style.boxShadow = '0 0 12px rgba(124,58,237,.18)';
        }}
      >
        <span style={{ fontSize: 9 }}>▶</span>
        NOVA HISTÓRIA
      </button>

      {/* Indicador de execução */}
      {running && (
        <div
          className="font-vt flex items-center gap-2 flex-shrink-0 overflow-hidden rounded-md"
          style={{
            marginLeft: 10,
            maxWidth: 200,
            padding: '4px 10px',
            background: 'rgba(251,191,36,.07)',
            border: '1px solid rgba(251,191,36,.25)',
          }}
        >
          <span className="anim-gp rounded-full flex-shrink-0" style={{ width: 5, height: 5, background: '#4ade80' }} />
          <span
            className="overflow-hidden text-ellipsis whitespace-nowrap"
            style={{ fontSize: 13, color: '#fbbf24' }}
          >
            {currentStory}
          </span>
        </div>
      )}

      {/* Espaçador */}
      <div className="flex-1" />

      {/* Divisor */}
      <div style={{ width: 1, height: 24, background: '#2a1050', flexShrink: 0 }} />

      {/* Botões direita */}
      <div className="flex items-center gap-2 flex-shrink-0" style={{ paddingLeft: 12, paddingRight: 12 }}>
        <button
          onClick={() => togglePanel('team')}
          className="ui-label rounded cursor-pointer transition-all flex items-center gap-1.5"
          style={{
            padding: '5px 11px',
            background: 'transparent',
            border: '1px solid #2a1050',
            color: '#6b7280',
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#7c3aed';
            e.currentTarget.style.color = '#a78bfa';
            e.currentTarget.style.background = 'rgba(124,58,237,.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#2a1050';
            e.currentTarget.style.color = '#6b7280';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          ◧ TIME
        </button>

        <button
          onClick={() => togglePanel('profile')}
          className="ui-label rounded-full flex items-center justify-center cursor-pointer transition-all flex-shrink-0"
          style={{
            width: 30,
            height: 30,
            background: 'rgba(124,58,237,.2)',
            border: '1.5px solid rgba(124,58,237,.5)',
            color: '#c4b5fd',
            fontSize: '10px',
            letterSpacing: '0.04em',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(124,58,237,.4)';
            e.currentTarget.style.borderColor = '#a78bfa';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(124,58,237,.2)';
            e.currentTarget.style.borderColor = 'rgba(124,58,237,.5)';
          }}
        >
          {initials}
        </button>
      </div>
    </div>
  );
}
