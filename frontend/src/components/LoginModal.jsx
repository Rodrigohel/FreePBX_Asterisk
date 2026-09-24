import { useState } from 'react';
import Logo from './Logo.jsx';

export default function LoginModal({ colors, onLogin, onLoginTotp, onClose, logoUrl }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const needsTotp = !!totpToken;

  function backToCredentials() {
    setTotpToken('');
    setCode('');
    setError('');
  }

  async function handleCredentialsSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await onLogin(username, password);
      if (result?.requiresTotp) {
        setTotpToken(result.totpToken);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  async function handleTotpSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLoginTotp(totpToken, code);
      onClose();
    } catch (err) {
      setError(err.message || 'Código inválido.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000,
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={needsTotp ? handleTotpSubmit : handleCredentialsSubmit}
        style={{ width: '100%', maxWidth: 360, background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '28px 26px', boxShadow: colors.shadow, position: 'relative' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          style={{ position: 'absolute', top: 14, right: 14, border: 'none', background: 'transparent', color: colors.textTertiary, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
        >
          ×
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Logo colors={colors} logoUrl={logoUrl} />
          <div>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, color: colors.textPrimary }}>
              {needsTotp ? 'Verificação em duas etapas' : 'Entrar'}
            </div>
            <div style={{ fontSize: 12.5, color: colors.textSecondary }}>
              {needsTotp ? 'Código do app autenticador ou de recuperação' : 'Acesse o painel completo'}
            </div>
          </div>
        </div>

        {!needsTotp && (
          <>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 }}>Usuário</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, marginBottom: 14, fontSize: 14, fontFamily: 'inherit' }}
            />

            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 }}>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, marginBottom: 18, fontSize: 14, fontFamily: 'inherit' }}
            />
          </>
        )}

        {needsTotp && (
          <>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 }}>Código</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              placeholder="000000 ou código de recuperação"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, marginBottom: 8, fontSize: 18, letterSpacing: 2, textAlign: 'center', fontFamily: "'Space Grotesk',sans-serif" }}
            />
            <button
              type="button"
              onClick={backToCredentials}
              style={{ border: 'none', background: 'transparent', color: colors.textTertiary, fontSize: 12, cursor: 'pointer', marginBottom: 18, padding: 0 }}
            >
              ← Voltar
            </button>
          </>
        )}

        {error && <div style={{ color: colors.red, fontSize: 13, marginBottom: 14 }}>{error}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700, fontSize: 14, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Entrando...' : needsTotp ? 'Verificar' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
