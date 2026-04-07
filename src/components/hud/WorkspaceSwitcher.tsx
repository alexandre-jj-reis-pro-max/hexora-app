import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useUIStore } from '../../store/useUIStore';

export default function WorkspaceSwitcher() {
  const { workspaces, activeId, setActive } = useWorkspaceStore();
  const { wsDropOpen, toggleWsDrop, togglePanel, setWsTab } = useUIStore();
  const active = workspaces.find((w) => w.id === activeId);

  const handleSelect = (id: string) => {
    setActive(id);
    toggleWsDrop(true);
  };

  return (
    <div className="relative h-full flex-shrink-0">
      <button
        className="flex items-center gap-2 h-full cursor-pointer transition-all"
        style={{
          padding: '0 16px',
          background: 'transparent',
          border: 'none',
          minWidth: 160,
          maxWidth: 220,
        }}
        onClick={() => toggleWsDrop()}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <span
          className="rounded-full flex-shrink-0"
          style={{ width: 8, height: 8, background: active?.color ?? '#7c3aed', boxShadow: `0 0 6px ${active?.color ?? '#7c3aed'}` }}
        />
        <div className="flex-1 min-w-0 text-left">
          <div
            className="font-vt overflow-hidden text-ellipsis whitespace-nowrap"
            style={{ fontSize: 16, color: '#d1d5db', letterSpacing: '0.04em', lineHeight: 1.1 }}
          >
            {active?.name ?? 'workspace'}
          </div>
          {active?.desc && (
            <div
              className="overflow-hidden text-ellipsis whitespace-nowrap"
              style={{ fontFamily: 'ui-monospace, monospace', fontSize: '9px', color: '#4b5563', letterSpacing: '0.06em' }}
            >
              {active.desc}
            </div>
          )}
        </div>
        <span
          style={{
            color: '#6b7280',
            fontSize: 10,
            transform: wsDropOpen ? 'rotate(180deg)' : undefined,
            transition: 'transform .15s',
            flexShrink: 0,
          }}
        >
          ▾
        </span>
      </button>

      {wsDropOpen && (
        <div
          className="absolute flex flex-col"
          style={{
            top: 52,
            left: 0,
            minWidth: 220,
            background: '#0f0823',
            border: '1px solid #2a1050',
            borderTop: 'none',
            zIndex: 600,
            boxShadow: '0 12px 40px rgba(0,0,0,.8)',
            borderRadius: '0 0 8px 8px',
          }}
        >
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="flex items-center gap-3 cursor-pointer transition-all"
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid #1a0d35',
                background: ws.id === activeId ? 'rgba(124,58,237,.1)' : undefined,
              }}
              onClick={() => handleSelect(ws.id)}
              onMouseEnter={(e) => {
                if (ws.id !== activeId) e.currentTarget.style.background = 'rgba(124,58,237,.06)';
              }}
              onMouseLeave={(e) => {
                if (ws.id !== activeId) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span
                className="rounded-full flex-shrink-0"
                style={{ width: 8, height: 8, background: ws.color, boxShadow: `0 0 5px ${ws.color}` }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-vt" style={{ fontSize: 16, color: '#e2e8f0', letterSpacing: '0.03em', lineHeight: 1.1 }}>
                  {ws.name}
                </div>
                <div className="overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontFamily: 'ui-monospace, monospace', fontSize: '9px', color: '#4b5563', letterSpacing: '0.05em' }}>
                  {ws.desc || 'sem descrição'}
                </div>
              </div>
              {ws.id === activeId && (
                <span style={{ color: '#7c3aed', fontSize: 10 }}>✓</span>
              )}
            </div>
          ))}
          <button
            className="flex items-center gap-2 w-full ui-label cursor-pointer transition-all"
            style={{
              padding: '10px 14px',
              background: 'transparent',
              border: 'none',
              color: '#6b7280',
            }}
            onClick={() => { setWsTab('list'); togglePanel('ws'); toggleWsDrop(true); }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(124,58,237,.08)';
              e.currentTarget.style.color = '#7c3aed';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            <span style={{ fontSize: 10 }}>＋</span> GERENCIAR WORKSPACES
          </button>
        </div>
      )}
    </div>
  );
}
