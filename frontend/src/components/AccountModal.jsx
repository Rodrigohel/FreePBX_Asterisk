import { useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api/client.js';
import Icon, { ICONS } from './Icon.jsx';

const inputStyle = (colors) => ({
  width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`,
  marginBottom: 12, fontSize: 14, fontFamily: 'inherit', background: colors.bgCardAlt, color: colors.textPrimary,
});
const labelStyle = (colors) => ({ display: 'block', fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 });

export default function AccountModal({ colors, user, onClose, onRefreshUser }) {
  // 'idle' | 'setting_up' | 'recovery_codes' | 'disabling'
  const [step, setStep] = useState('idle');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Enquanto os códigos de recuperação estão na tela, o modal só fecha
  // depois que a pessoa confirmar que salvou — eles não aparecem de novo
  // depois disso.
  const isLocked = step === 'recovery_codes';

  async function handleStartSetup() {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await api.setupTotp();
      const dataUrl = await QRCode.toDataURL(res.otpauthUri);
      setSecret(res.secret);
      setQrCodeDataUrl(dataUrl);
      setStep('setting_up');
    } catch (err) {
      setError(err.message || 'Não foi possível iniciar a configuração.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.enableTotp(secret, code);
      await onRefreshUser();
      setRecoveryCodes(res.recoveryCodes);
      setSavedConfirmed(false);
      setCode('');
      setStep('recovery_codes');
    } catch (err) {
      setError(err.message || 'Não foi possível confirmar.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.disableTotp(code);
      await onRefreshUser();
      setStep('idle');
      setCode('');
      setMessage('Verificação em duas etapas desativada.');
    } catch (err) {
      setError(err.message || 'Não foi possível desativar.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyRecoveryCodes() {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão de clipboard não é grave — os códigos continuam
      // visíveis na tela pra copiar manualmente.
    }
  }

  function finishRecoveryCodes() {
    setStep('idle');
    setRecoveryCodes([]);
    setSecret('');
    setQrCodeDataUrl('');
    setMessage('Verificação em duas etapas ativada!');
  }

  function cancelStep() {
    setStep('idle');
    setCode('');
    setError('');
  }

  return (
    <div
      onClick={isLocked ? undefined : onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 420, background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '24px 26px', boxShadow: colors.shadow, position: 'relative', maxHeight: '85vh', overflowY: 'auto' }}
      >
        {!isLocked && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{ position: 'absolute', top: 16, right: 16, border: 'none', background: 'transparent', color: colors.textTertiary, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <Icon paths={ICONS.user} size={18} color={colors.textPrimary} strokeWidth={2} />
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, color: colors.textPrimary }}>Minha conta</div>
        </div>

        <div style={{ fontSize: 13, color: colors.textPrimary, fontWeight: 600 }}>{user?.displayName}</div>
        <div style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 18 }}>@{user?.username}</div>

        <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 10px' }}>
          Verificação em duas etapas
        </div>

        {step === 'idle' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: user?.totpEnabled ? colors.green : colors.textTertiary, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: colors.textPrimary }}>
                {user?.totpEnabled ? 'Ativada' : 'Desativada'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 14 }}>
              {user?.totpEnabled
                ? 'Todo login pede, além da senha, um código gerado por um app autenticador (Google Authenticator, Authy, etc.), ou um dos seus códigos de recuperação.'
                : 'Peça um código do app autenticador além da senha, toda vez que entrar — protege sua conta mesmo se a senha vazar.'}
            </div>
            <button
              type="button"
              onClick={user?.totpEnabled ? () => setStep('disabling') : handleStartSetup}
              disabled={loading}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: loading ? 'default' : 'pointer',
                border: user?.totpEnabled ? `1px solid ${colors.border}` : 'none',
                background: user?.totpEnabled ? colors.bgCardAlt : colors.primary,
                color: user?.totpEnabled ? colors.red : '#fff',
              }}
            >
              {loading ? 'Carregando...' : user?.totpEnabled ? 'Desativar' : 'Ativar verificação em duas etapas'}
            </button>
          </>
        )}

        {step === 'setting_up' && (
          <form onSubmit={handleConfirm}>
            <div style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 10 }}>
              Escaneie o QR code com seu app autenticador (Google Authenticator, Authy, etc.):
            </div>
            {qrCodeDataUrl && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <img src={qrCodeDataUrl} alt="QR code de configuração" style={{ width: 180, height: 180, borderRadius: 10, border: `1px solid ${colors.border}` }} />
              </div>
            )}
            <div style={{ fontSize: 11.5, color: colors.textTertiary, marginBottom: 12, textAlign: 'center', wordBreak: 'break-all' }}>
              Não consegue escanear? Digite manualmente: <strong>{secret}</strong>
            </div>
            <label style={labelStyle(colors)}>Código gerado pelo app</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoFocus
              placeholder="000000"
              style={{ ...inputStyle(colors), fontSize: 18, letterSpacing: 3, textAlign: 'center' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={cancelStep} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bgCardAlt, color: colors.textPrimary, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="submit" disabled={loading || code.length !== 6} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700, fontSize: 13, cursor: loading ? 'default' : 'pointer', opacity: code.length !== 6 ? 0.5 : 1 }}>
                {loading ? 'Confirmando...' : 'Confirmar'}
              </button>
            </div>
          </form>
        )}

        {step === 'recovery_codes' && (
          <div>
            <div style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 10 }}>
              Guarde estes 8 códigos de recuperação em lugar seguro. Cada um funciona <strong>uma única vez</strong> pra entrar
              caso você perca o acesso ao app autenticador — eles não aparecem de novo depois que você fechar esta tela.
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 12, borderRadius: 10,
              background: colors.bgCardAlt, border: `1px solid ${colors.border}`, marginBottom: 10,
            }}>
              {recoveryCodes.map((c) => (
                <div key={c} style={{ fontFamily: 'monospace', fontSize: 13.5, color: colors.textPrimary, letterSpacing: 0.5 }}>{c}</div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleCopyRecoveryCodes}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bgCardAlt, color: colors.textPrimary, fontWeight: 600, fontSize: 12.5, cursor: 'pointer', marginBottom: 14 }}
            >
              {copied ? 'Copiado!' : 'Copiar todos os códigos'}
            </button>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: colors.textPrimary, marginBottom: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={savedConfirmed} onChange={(e) => setSavedConfirmed(e.target.checked)} style={{ marginTop: 2 }} />
              Salvei esses códigos em um lugar seguro
            </label>
            <button
              type="button"
              onClick={finishRecoveryCodes}
              disabled={!savedConfirmed}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: savedConfirmed ? 'pointer' : 'default', opacity: savedConfirmed ? 1 : 0.5 }}
            >
              Concluir
            </button>
          </div>
        )}

        {step === 'disabling' && (
          <form onSubmit={handleDisable}>
            <div style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 10 }}>
              Digite um código do app autenticador (ou um código de recuperação) pra desativar a verificação em duas etapas:
            </div>
            <label style={labelStyle(colors)}>Código</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              placeholder="000000 ou código de recuperação"
              style={inputStyle(colors)}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={cancelStep} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bgCardAlt, color: colors.textPrimary, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="submit" disabled={loading || !code} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none', background: colors.red, color: '#fff', fontWeight: 700, fontSize: 13, cursor: loading ? 'default' : 'pointer', opacity: !code ? 0.5 : 1 }}>
                {loading ? 'Desativando...' : 'Desativar'}
              </button>
            </div>
          </form>
        )}

        {error && <div style={{ color: colors.red, fontSize: 13, marginTop: 14 }}>{error}</div>}
        {message && !error && step === 'idle' && <div style={{ color: colors.green, fontSize: 13, marginTop: 14 }}>{message}</div>}
      </div>
    </div>
  );
}
