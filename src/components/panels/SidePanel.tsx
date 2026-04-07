import type { ReactNode } from 'react';

interface SidePanelProps {
  open: boolean;
  side: 'left' | 'right';
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

export default function SidePanel({ open, side, title, onClose, children, width = 320 }: SidePanelProps) {
  const transform = open
    ? 'translateX(0)'
    : side === 'left'
      ? 'translateX(-100%)'
      : 'translateX(100%)';

  return (
    <div
      className="fixed z-[400]"
      style={{
        top: 52,
        bottom: 0,
        [side]: 0,
        width,
        background: '#0d0720',
        borderRight: side === 'left' ? '1px solid #2a1050' : 'none',
        borderLeft: side === 'right' ? '1px solid #2a1050' : 'none',
        transform,
        transition: 'transform .25s cubic-bezier(.4,0,.2,1)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: side === 'left'
          ? '4px 0 32px rgba(0,0,0,.6)'
          : '-4px 0 32px rgba(0,0,0,.6)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid #1a0d35',
          background: 'rgba(124,58,237,.04)',
        }}
      >
        <h2
          className="ui-label"
          style={{ fontSize: '10px', color: '#7c3aed', letterSpacing: '0.14em' }}
        >
          {title}
        </h2>
        <button
          onClick={onClose}
          className="flex items-center justify-center rounded transition-all cursor-pointer"
          style={{
            width: 26,
            height: 26,
            background: 'transparent',
            border: '1px solid #1a0d35',
            color: '#4b5563',
            fontSize: 14,
            lineHeight: 1,
          }}
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '16px 18px' }}>
        {children}
      </div>
    </div>
  );
}
