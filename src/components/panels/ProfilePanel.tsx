import { useState, useEffect } from 'react';
import SidePanel from './SidePanel';
import { useUIStore } from '../../store/useUIStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useFlowStore } from '../../store/useFlowStore';
import { useAuthStore } from '../../store/useAuthStore';
import { profileApi } from '../../lib/api';
import { PrimBtn } from './StoryPanel';
import { PROVIDERS } from '../../constants';

interface ProfilePanelProps {
  className?: string;
}

export default function ProfilePanel({ className }: ProfilePanelProps) {
  const open = useUIStore((s) => s.openPanel === 'profile');
  const togglePanel = useUIStore((s) => s.togglePanel);
  const eventCount = useFlowStore((s) => s.eventCount);
  const flowsRun = useProfileStore((s) => s.stats.flows);
  const { user, logout } = useAuthStore();
  const { llmKeys, setLLMKey, githubToken, setGithubToken, proxyConfig, setProxyConfig } = useProfileStore();

  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(user?.name ?? '');
  }, [user]);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await profileApi.updateMe(name.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // silent fail — store still has the value
    } finally {
      setSaving(false);
    }
  };

  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  return (
    <div className={className}>
      <SidePanel open={open} side="right" width={300} title="◧ PERFIL" onClose={() => togglePanel('profile')}>
        {/* Avatar */}
        <div className="flex justify-center mb-6">
          <div
            className="font-pixel flex items-center justify-center rounded-full"
            style={{
              width: 64,
              height: 64,
              background: 'rgba(124,58,237,.15)',
              border: '2px solid rgba(124,58,237,.4)',
              color: '#c4b5fd',
              fontSize: '10px',
              letterSpacing: '0.05em',
              boxShadow: '0 0 20px rgba(124,58,237,.2)',
            }}
          >
            {initials}
          </div>
        </div>

        {/* Email (read-only) */}
        {user?.email && (
          <div
            className="font-vt text-center rounded-md"
            style={{
              fontSize: 13,
              color: '#6b7280',
              marginBottom: 16,
              padding: '4px 8px',
            }}
          >
            {user.email}
          </div>
        )}

        {/* Fields */}
        <div className="flex flex-col gap-3 mb-6">
          <FieldGroup label="NOME">
            <PInput value={name} onChange={setName} placeholder="Seu nome" />
          </FieldGroup>
        </div>

        <PrimBtn onClick={save} disabled={saving}>
          {saved ? '✓ SALVO' : saving ? '...' : 'SALVAR PERFIL'}
        </PrimBtn>

        {/* Stats */}
        <div
          className="grid mt-4 rounded-md overflow-hidden"
          style={{ gridTemplateColumns: '1fr 1fr', border: '1px solid #1a0d35' }}
        >
          <StatBox label="EVENTOS" value={eventCount} />
          <StatBox label="FLUXOS" value={flowsRun} border />
        </div>

        {/* Corporate Proxy */}
        <ProxySection config={proxyConfig} onChange={setProxyConfig} />

        {/* GitHub PAT */}
        <div style={{ marginTop: 20, borderTop: '1px solid #1a0d35', paddingTop: 16 }}>
          <div className="font-pixel" style={{ fontSize: '5.5px', color: '#6d28d9', letterSpacing: '0.12em', marginBottom: 10 }}>
            GITHUB
          </div>
          <GitHubKeyRow value={githubToken} onChange={setGithubToken} />
          <GitHubApiUrlField />
          <div className="font-pixel" style={{ fontSize: '5px', color: '#374151', marginTop: 8, letterSpacing: '0.06em', lineHeight: 1.6 }}>
            PAT com scopes: <span style={{ color: '#4b5563' }}>repo, workflow</span>.
            Para GitHub Enterprise, altere a API URL acima.
          </div>
        </div>

        {/* LLM Secrets */}
        <div style={{ marginTop: 20, borderTop: '1px solid #1a0d35', paddingTop: 16 }}>
          <div className="font-pixel" style={{ fontSize: '5.5px', color: '#6d28d9', letterSpacing: '0.12em', marginBottom: 10 }}>
            PROVEDORES LLM
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PROVIDERS.map((p) => (
              <LLMKeyRow
                key={p.id}
                provider={p}
                value={llmKeys[p.id] ?? ''}
                onChange={(v) => setLLMKey(p.id, v)}
              />
            ))}
          </div>
          <div className="font-pixel" style={{ fontSize: '5px', color: '#374151', marginTop: 8, letterSpacing: '0.06em', lineHeight: 1.6 }}>
            Chaves salvas localmente. Apenas provedores com chave aparecem na seleção de modelo dos agentes.
          </div>
        </div>

        {/* Logout */}
        <button
          className="w-full font-pixel rounded-md cursor-pointer transition-all"
          style={{
            marginTop: 12,
            padding: '9px',
            background: 'transparent',
            border: '1px solid #1a0d35',
            color: '#4b5563',
            fontSize: '5.5px',
            letterSpacing: '0.08em',
          }}
          onClick={logout}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = '#7f1d1d'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#4b5563'; e.currentTarget.style.borderColor = '#1a0d35'; }}
        >
          SAIR DA CONTA
        </button>
      </SidePanel>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="font-pixel"
        style={{ fontSize: '5.5px', color: '#6d28d9', letterSpacing: '0.1em', marginBottom: 5 }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function PInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      className="w-full font-vt rounded-md outline-none transition-all"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        background: 'rgba(124,58,237,.06)',
        border: '1px solid #2a1050',
        color: '#e2e8f0',
        fontSize: 15,
        padding: '8px 12px',
      }}
      onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
      onBlur={(e) => (e.target.style.borderColor = '#2a1050')}
    />
  );
}

function StatBox({ label, value, border }: { label: string; value: number; border?: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        padding: '14px 8px',
        background: 'rgba(124,58,237,.04)',
        borderLeft: border ? '1px solid #1a0d35' : 'none',
      }}
    >
      <div className="font-pixel" style={{ fontSize: '18px', color: '#7c3aed', lineHeight: 1, marginBottom: 4 }}>
        {value}
      </div>
      <div className="font-pixel" style={{ fontSize: '5px', color: '#4b5563', letterSpacing: '0.08em' }}>
        {label}
      </div>
    </div>
  );
}

function GitHubApiUrlField() {
  const [url, setUrl] = useState('https://api.github.com');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    profileApi.getGithubApiUrl().then((d) => setUrl(d.url)).catch(() => {});
  }, []);

  const save = async () => {
    try {
      await profileApi.setGithubApiUrl(url.trim() || 'https://api.github.com');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* silent */ }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div className="font-pixel" style={{ fontSize: '5px', color: '#4b5563', letterSpacing: '0.08em', marginBottom: 3 }}>
        API URL (Enterprise: https://github.empresa.com/api/v3)
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.github.com"
          className="font-vt"
          style={{
            flex: 1, background: 'rgba(0,0,0,.3)', border: '1px solid #2a1050',
            borderRadius: 4, color: '#9ca3af', fontSize: 12, padding: '4px 8px', outline: 'none',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
          onBlur={(e) => { save(); e.target.style.borderColor = '#2a1050'; }}
        />
        {saved && <span style={{ fontFamily: 'monospace', fontSize: '6px', color: '#4ade80', alignSelf: 'center' }}>OK</span>}
      </div>
    </div>
  );
}

function GitHubKeyRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  const [local, setLocal] = useState(value);
  const hasKey = value.length > 0;

  useEffect(() => { setLocal(value); }, [value]);

  return (
    <div style={{
      background: 'rgba(255,255,255,.02)',
      border: `1px solid ${hasKey ? '#2a1050' : '#1a0d35'}`,
      borderRadius: 6, padding: '8px 10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 14 }}>🐙</span>
        <span className="font-pixel" style={{ fontSize: '5.5px', color: hasKey ? '#7c3aed' : '#4b5563', letterSpacing: '0.08em', flex: 1 }}>
          GitHub PAT
        </span>
        {hasKey && (
          <span style={{
            fontFamily: 'monospace', fontSize: '6px', letterSpacing: '0.1em',
            color: '#4ade80', background: 'rgba(74,222,128,.08)',
            border: '1px solid rgba(74,222,128,.2)', borderRadius: 3, padding: '1px 5px',
          }}>
            OK
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type={show ? 'text' : 'password'}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="ghp_xxxxxxxxxxxx"
          className="font-vt"
          style={{
            flex: 1, background: 'rgba(0,0,0,.3)', border: '1px solid #2a1050',
            borderRadius: 4, color: '#9ca3af', fontSize: 12, padding: '4px 8px', outline: 'none',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
          onBlur={(e) => { onChange(local); e.target.style.borderColor = '#2a1050'; }}
        />
        <button
          onClick={() => setShow((s) => !s)}
          style={{ background: 'transparent', border: '1px solid #1a0d35', borderRadius: 4, color: '#4b5563', fontSize: 11, padding: '0 7px', cursor: 'pointer', flexShrink: 0 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#9ca3af')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#4b5563')}
        >
          {show ? '🙈' : '👁'}
        </button>
      </div>
    </div>
  );
}

function ProxySection({ config, onChange }: {
  config: { url: string; user: string; password: string; skipSsl: boolean };
  onChange: (cfg: { url: string; user: string; password: string; skipSsl: boolean }) => void;
}) {
  const [localUrl, setLocalUrl] = useState(config.url);
  const [localUser, setLocalUser] = useState(config.user);
  const [localPass, setLocalPass] = useState(config.password);
  const [localSkipSsl, setLocalSkipSsl] = useState(config.skipSsl);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocalUrl(config.url);
    setLocalUser(config.user);
    setLocalPass(config.password);
    setLocalSkipSsl(config.skipSsl);
  }, [config.url, config.user, config.password, config.skipSsl]);

  const hasProxy = config.url.length > 0;

  const saveProxy = async () => {
    setSaving(true);
    try {
      await profileApi.setProxyConfig(localUrl.trim(), localUser.trim(), localPass, localSkipSsl);
      onChange({ url: localUrl.trim(), user: localUser.trim(), password: localPass, skipSsl: localSkipSsl });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: 20, borderTop: '1px solid #1a0d35', paddingTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div className="font-pixel" style={{ fontSize: '5.5px', color: '#6d28d9', letterSpacing: '0.12em', flex: 1 }}>
          PROXY CORPORATIVO
        </div>
        {hasProxy && (
          <span style={{
            fontFamily: 'monospace', fontSize: '6px', letterSpacing: '0.1em',
            color: '#4ade80', background: 'rgba(74,222,128,.08)',
            border: '1px solid rgba(74,222,128,.2)', borderRadius: 3, padding: '1px 5px',
          }}>
            ON
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <div className="font-pixel" style={{ fontSize: '5px', color: '#4b5563', letterSpacing: '0.08em', marginBottom: 3 }}>
            URL DO PROXY
          </div>
          <input
            value={localUrl}
            onChange={(e) => setLocalUrl(e.target.value)}
            placeholder="http://proxy.empresa.com:8080"
            className="font-vt w-full"
            style={{
              background: 'rgba(0,0,0,.3)', border: '1px solid #2a1050',
              borderRadius: 4, color: '#9ca3af', fontSize: 12, padding: '6px 8px', outline: 'none',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
            onBlur={(e) => (e.target.style.borderColor = '#2a1050')}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div className="font-pixel" style={{ fontSize: '5px', color: '#4b5563', letterSpacing: '0.08em', marginBottom: 3 }}>
              USUARIO
            </div>
            <input
              value={localUser}
              onChange={(e) => setLocalUser(e.target.value)}
              placeholder="usuario"
              className="font-vt w-full"
              style={{
                background: 'rgba(0,0,0,.3)', border: '1px solid #2a1050',
                borderRadius: 4, color: '#9ca3af', fontSize: 12, padding: '6px 8px', outline: 'none',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
              onBlur={(e) => (e.target.style.borderColor = '#2a1050')}
            />
          </div>
          <div>
            <div className="font-pixel" style={{ fontSize: '5px', color: '#4b5563', letterSpacing: '0.08em', marginBottom: 3 }}>
              SENHA
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={localPass}
                onChange={(e) => setLocalPass(e.target.value)}
                placeholder="senha"
                className="font-vt"
                style={{
                  flex: 1, background: 'rgba(0,0,0,.3)', border: '1px solid #2a1050',
                  borderRadius: 4, color: '#9ca3af', fontSize: 12, padding: '6px 8px', outline: 'none',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
                onBlur={(e) => (e.target.style.borderColor = '#2a1050')}
              />
              <button
                onClick={() => setShowPass((s) => !s)}
                style={{ background: 'transparent', border: '1px solid #1a0d35', borderRadius: 4, color: '#4b5563', fontSize: 11, padding: '0 6px', cursor: 'pointer', flexShrink: 0 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#9ca3af')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#4b5563')}
              >
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>
        </div>

        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            cursor: 'pointer', padding: '4px 0',
          }}
          onClick={() => setLocalSkipSsl(!localSkipSsl)}
        >
          <div style={{
            width: 14, height: 14, borderRadius: 3, flexShrink: 0,
            border: `1px solid ${localSkipSsl ? '#f59e0b' : '#2a1050'}`,
            background: localSkipSsl ? 'rgba(245,158,11,.2)' : 'rgba(0,0,0,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {localSkipSsl && <span style={{ fontSize: 9, color: '#f59e0b', lineHeight: 1 }}>✓</span>}
          </div>
          <span className="font-pixel" style={{ fontSize: '5px', color: localSkipSsl ? '#f59e0b' : '#4b5563', letterSpacing: '0.06em' }}>
            IGNORAR VERIFICACAO SSL (verify=false)
          </span>
        </label>

        <button
          className="w-full font-pixel rounded-md cursor-pointer transition-all"
          style={{
            padding: '7px',
            background: 'rgba(124,58,237,.12)',
            border: '1px solid #2a1050',
            color: saved ? '#4ade80' : '#7c3aed',
            fontSize: '5.5px',
            letterSpacing: '0.08em',
          }}
          onClick={saveProxy}
          disabled={saving}
          onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = 'rgba(124,58,237,.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,.12)'; }}
        >
          {saved ? '✓ PROXY SALVO' : saving ? '...' : 'SALVAR PROXY'}
        </button>
      </div>

      <div className="font-pixel" style={{ fontSize: '5px', color: '#374151', marginTop: 8, letterSpacing: '0.06em', lineHeight: 1.6 }}>
        Configure se sua empresa usa proxy para acesso externo.
        As chamadas LLM e GitHub passam pelo backend com essas credenciais.
        Marque "Ignorar SSL" se o proxy faz inspecao de certificado.
      </div>
    </div>
  );
}

function LLMKeyRow({ provider, value, onChange }: {
  provider: typeof PROVIDERS[number];
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  const [local, setLocal] = useState(value);
  const hasKey = value.length > 0;

  // sync if external changes
  useEffect(() => { setLocal(value); }, [value]);

  return (
    <div style={{
      background: 'rgba(255,255,255,.02)',
      border: `1px solid ${hasKey ? '#2a1050' : '#1a0d35'}`,
      borderRadius: 6,
      padding: '8px 10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 12 }}>{provider.logo}</span>
        <span className="font-pixel" style={{ fontSize: '5.5px', color: hasKey ? '#7c3aed' : '#4b5563', letterSpacing: '0.08em', flex: 1 }}>
          {provider.name}
        </span>
        {hasKey && (
          <span style={{
            fontFamily: 'monospace', fontSize: '6px', letterSpacing: '0.1em',
            color: '#4ade80', background: 'rgba(74,222,128,.08)',
            border: '1px solid rgba(74,222,128,.2)', borderRadius: 3, padding: '1px 5px',
          }}>
            OK
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type={show ? 'text' : 'password'}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder={`sk-... (${provider.org})`}
          className="font-vt"
          style={{
            flex: 1, background: 'rgba(0,0,0,.3)', border: '1px solid #2a1050',
            borderRadius: 4, color: '#9ca3af', fontSize: 12, padding: '4px 8px', outline: 'none',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
          onBlur={(e) => { onChange(local); e.target.style.borderColor = '#2a1050'; }}
        />
        <button
          onClick={() => setShow((s) => !s)}
          style={{
            background: 'transparent', border: '1px solid #1a0d35', borderRadius: 4,
            color: '#4b5563', fontSize: 11, padding: '0 7px', cursor: 'pointer', flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#9ca3af')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#4b5563')}
        >
          {show ? '🙈' : '👁'}
        </button>
      </div>
    </div>
  );
}
