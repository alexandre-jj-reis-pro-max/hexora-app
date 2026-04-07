import { useState } from 'react';
import SidePanel from './SidePanel';
import { useUIStore } from '../../store/useUIStore';
import { STORY_EXAMPLES } from '../../constants';

interface StoryPanelProps {
  className?: string;
  onRunOrchestration: (story: string) => void;
}

export default function StoryPanel({ className, onRunOrchestration }: StoryPanelProps) {
  const open = useUIStore((s) => s.openPanel === 'story');
  const togglePanel = useUIStore((s) => s.togglePanel);
  const [text, setText] = useState('');
  const [exIdx, setExIdx] = useState<number | null>(null);

  const setExample = (i: number) => {
    setText(STORY_EXAMPLES[i]);
    setExIdx(i);
  };

  const handleRun = () => {
    if (!text.trim()) return;
    onRunOrchestration(text);
    setText('');
    setExIdx(null);
    togglePanel('story');
  };

  return (
    <div className={className}>
      <SidePanel open={open} side="left" title="◈ NOVA HISTÓRIA" onClose={() => togglePanel('story')}>
        {/* Textarea */}
        <FieldLabel>HISTÓRIA / FEATURE</FieldLabel>
        <textarea
          className="w-full font-vt rounded-md resize-none outline-none transition-all"
          value={text}
          onChange={(e) => { setText(e.target.value); setExIdx(null); }}
          placeholder="Descreva a feature ou user story..."
          rows={6}
          style={{
            background: 'rgba(124,58,237,.06)',
            border: '1px solid #2a1050',
            color: '#e2e8f0',
            fontSize: 15,
            padding: '10px 12px',
            lineHeight: 1.5,
            marginBottom: 16,
          }}
          onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
          onBlur={(e) => (e.target.style.borderColor = '#2a1050')}
        />

        {/* Exemplos */}
        <FieldLabel>EXEMPLOS RÁPIDOS</FieldLabel>
        <div className="flex flex-col gap-1.5" style={{ marginBottom: 20 }}>
          {STORY_EXAMPLES.map((ex, i) => (
            <button
              key={i}
              className="w-full text-left font-vt rounded-md cursor-pointer transition-all"
              style={{
                background: exIdx === i ? 'rgba(124,58,237,.12)' : 'rgba(255,255,255,.02)',
                border: `1px solid ${exIdx === i ? 'rgba(124,58,237,.5)' : '#1a0d35'}`,
                color: exIdx === i ? '#c4b5fd' : '#9ca3af',
                fontSize: 14,
                padding: '8px 12px',
                lineHeight: 1.4,
              }}
              onClick={() => setExample(i)}
              onMouseEnter={(e) => {
                if (exIdx !== i) {
                  e.currentTarget.style.borderColor = '#4c1d95';
                  e.currentTarget.style.color = '#c4b5fd';
                  e.currentTarget.style.background = 'rgba(124,58,237,.06)';
                }
              }}
              onMouseLeave={(e) => {
                if (exIdx !== i) {
                  e.currentTarget.style.borderColor = '#1a0d35';
                  e.currentTarget.style.color = '#9ca3af';
                  e.currentTarget.style.background = 'rgba(255,255,255,.02)';
                }
              }}
            >
              {ex}
            </button>
          ))}
        </div>

        {/* CTA */}
        <PrimBtn onClick={handleRun} disabled={!text.trim()}>
          ▶ INICIAR ORQUESTRAÇÃO
        </PrimBtn>
      </SidePanel>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="ui-label"
      style={{ color: '#7c3aed', marginBottom: 6 }}
    >
      {children}
    </div>
  );
}

export function PrimBtn({
  children,
  onClick,
  disabled,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      className="w-full font-pixel rounded-md cursor-pointer transition-all"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '12px',
        background: disabled ? 'rgba(124,58,237,.08)' : 'rgba(124,58,237,.2)',
        border: `1px solid ${disabled ? '#2a1050' : 'rgba(124,58,237,.6)'}`,
        color: disabled ? '#4b5563' : '#c4b5fd',
        fontSize: '8px',
        letterSpacing: '0.12em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 0 14px rgba(124,58,237,.18)',
        ...style,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'rgba(124,58,237,.35)'; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = 'rgba(124,58,237,.2)'; }}
    >
      {children}
    </button>
  );
}
