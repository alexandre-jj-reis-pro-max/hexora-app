import { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

export default function AuthScreen() {
  const [mode, setMode]       = useState<'login' | 'register'>('login');
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { login, register, loginWithGoogle, firebaseEnabled } = useAuthStore();

  const handleSubmit = async () => {
    setError('');
    if (!email.trim() || !password.trim()) return;
    if (mode === 'register' && !name.trim()) return;
    setLoading(true);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await register(name.trim(), email.trim(), password);
    } catch (err) {
      const msg = (err as Error).message
        .replace('Firebase: ', '')
        .replace(/\(auth\/.*\)\.?/, '')
        .trim();
      setError(msg || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError((err as Error).message.replace('Firebase: ', '').replace(/\(auth\/.*\)\.?/, '').trim());
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: '#0c0720' }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(124,58,237,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div
        style={{
          width: 360,
          background: '#0f0a1e',
          border: '1px solid #2a1050',
          borderRadius: 8,
          padding: '32px 28px',
          boxShadow: '0 0 60px rgba(124,58,237,.15)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center" style={{ marginBottom: 24 }}>
          <div
            className="font-pixel"
            style={{ fontSize: '11px', color: '#7c3aed', letterSpacing: '0.25em', marginBottom: 6 }}
          >
            HEXORA
          </div>
          <div
            className="font-vt"
            style={{ fontSize: 14, color: '#4b5563', letterSpacing: '0.08em' }}
          >
            AgentOS Platform
          </div>
        </div>

        {/* Google button — only when Firebase is configured */}
        {firebaseEnabled && (
          <>
            <button
              onClick={handleGoogle}
              disabled={googleLoading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '11px 16px',
                background: googleLoading ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.05)',
                border: '1px solid rgba(255,255,255,.12)',
                borderRadius: 6,
                color: googleLoading ? '#4b5563' : '#e2e8f0',
                fontFamily: 'monospace',
                fontSize: '8px',
                letterSpacing: '0.12em',
                cursor: googleLoading ? 'not-allowed' : 'pointer',
                marginBottom: 18,
                transition: 'all .15s',
              }}
              onMouseEnter={(e) => { if (!googleLoading) e.currentTarget.style.background = 'rgba(255,255,255,.09)'; }}
              onMouseLeave={(e) => { if (!googleLoading) e.currentTarget.style.background = 'rgba(255,255,255,.05)'; }}
            >
              {/* Google "G" logo */}
              <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {googleLoading ? 'AGUARDE...' : 'ENTRAR COM GOOGLE'}
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ flex: 1, height: 1, background: '#1a0d35' }} />
              <span style={{ fontFamily: 'monospace', fontSize: '7px', color: '#374151', letterSpacing: '0.1em' }}>
                OU
              </span>
              <div style={{ flex: 1, height: 1, background: '#1a0d35' }} />
            </div>
          </>
        )}

        {/* Tabs */}
        <div
          className="flex rounded-md overflow-hidden"
          style={{ border: '1px solid #1a0d35', marginBottom: 18 }}
        >
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              className="flex-1 font-pixel cursor-pointer transition-all"
              style={{
                padding: '8px',
                fontSize: '5.5px',
                letterSpacing: '0.1em',
                background: mode === m ? 'rgba(124,58,237,.2)' : 'transparent',
                color: mode === m ? '#c4b5fd' : '#4b5563',
                border: 'none',
              }}
              onClick={() => { setMode(m); setError(''); }}
            >
              {m === 'login' ? 'ENTRAR' : 'CADASTRAR'}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'register' && (
            <Field label="NOME" value={name} onChange={setName} onKeyDown={handleKey} placeholder="Seu nome" />
          )}
          <Field label="EMAIL" value={email} onChange={setEmail} onKeyDown={handleKey} placeholder="email@exemplo.com" type="email" />
          <Field label="SENHA" value={password} onChange={setPassword} onKeyDown={handleKey} placeholder="••••••••" type="password" />
        </div>

        {/* Error */}
        {error && (
          <div
            className="font-vt rounded-md"
            style={{
              marginTop: 12,
              padding: '8px 12px',
              background: 'rgba(248,113,113,.08)',
              border: '1px solid rgba(248,113,113,.25)',
              color: '#f87171',
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          className="w-full font-pixel rounded-md cursor-pointer transition-all"
          style={{
            marginTop: 18,
            padding: '12px',
            background: loading ? 'rgba(124,58,237,.08)' : 'rgba(124,58,237,.2)',
            border: `1px solid ${loading ? '#2a1050' : 'rgba(124,58,237,.6)'}`,
            color: loading ? '#4b5563' : '#c4b5fd',
            fontSize: '6.5px',
            letterSpacing: '0.12em',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 0 14px rgba(124,58,237,.18)',
          }}
          disabled={loading}
          onClick={handleSubmit}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'rgba(124,58,237,.35)'; }}
          onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = 'rgba(124,58,237,.2)'; }}
        >
          {loading ? '...' : mode === 'login' ? '▶ ENTRAR' : '▶ CRIAR CONTA'}
        </button>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, onKeyDown, placeholder, type = 'text',
}: {
  label: string; value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  placeholder: string; type?: string;
}) {
  return (
    <div>
      <div className="font-pixel" style={{ fontSize: '5px', color: '#6d28d9', letterSpacing: '0.1em', marginBottom: 5 }}>
        {label}
      </div>
      <input
        className="w-full font-vt rounded-md outline-none transition-all"
        type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{
          background: 'rgba(124,58,237,.06)', border: '1px solid #2a1050',
          color: '#e2e8f0', fontSize: 15, padding: '8px 12px',
        }}
        onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
        onBlur={(e) => (e.target.style.borderColor = '#2a1050')}
      />
    </div>
  );
}
