import { useState } from 'react';
import Logo from './Logo.jsx';

export default function LoginModal({ colors, onLogin, onClose, logoUrl }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(username, password, needsTotp ? totpCode : undefined);
    } catch (err) {
      if (err.requiresTotp) {
        setNeedsTotp(true);
        // Só mostra erro se já tinha tentado um código (código errado) —
        // na primeira vez que o campo aparece não é bem um "erro".
        if (needsTotp) setError(err.message || 'Código inválido.');
      } else {
        setError(err.message || 'Não foi possível entrar.');
      }
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
        onSubmit={handleSubmit}
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
              {needsTotp ? 'Digite o código do seu app autenticador' : 'Acesse o painel completo'}
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
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 }}>Código de 6 dígitos</label>
            <input
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoFocus
              placeholder="000000"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, marginBottom: 8, fontSize: 20, letterSpacing: 4, textAlign: 'center', fontFamily: "'Space Grotesk',sans-serif" }}
            />
            <button
              type="button"
              onClick={() => { setNeedsTotp(false); setTotpCode(''); setError(''); }}
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
