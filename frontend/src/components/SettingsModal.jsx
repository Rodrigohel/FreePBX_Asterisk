import { useRef, useState } from 'react';
import { api } from '../api/client.js';
import Icon, { ICONS } from './Icon.jsx';
import Logo from './Logo.jsx';

export default function SettingsModal({ colors, settings, onClose, onSaved }) {
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [pbxName, setPbxName] = useState(settings.pbxName);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.updateSettings({ companyName, pbxName });
      setMessage('Salvo!');
      onSaved?.();
    } catch (err) {
      setError(err.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      const updated = await api.uploadLogo(file);
      setLogoUrl(updated.logoUrl);
      setMessage('Logo atualizado!');
      onSaved?.();
    } catch (err) {
      setError(err.message || 'Não foi possível enviar a imagem.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSave}
        style={{ width: '100%', maxWidth: 420, background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '28px 26px', boxShadow: colors.shadow, position: 'relative' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          style={{ position: 'absolute', top: 14, right: 14, border: 'none', background: 'transparent', color: colors.textTertiary, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
        >
          ×
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Icon paths={ICONS.settings} size={20} color={colors.primary} />
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, color: colors.textPrimary }}>Configurações</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <Logo colors={colors} logoUrl={logoUrl} size={56} />
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ border: `1px solid ${colors.border}`, background: colors.bgCardAlt, color: colors.textPrimary, borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: uploading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Icon paths={ICONS.upload} size={14} />
              {uploading ? 'Enviando...' : 'Trocar logo'}
            </button>
            <div style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 6 }}>PNG, JPG ou SVG, até 2MB</div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          </div>
        </div>

        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 }}>Nome (empresa / condomínio)</label>
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, marginBottom: 14, fontSize: 14, fontFamily: 'inherit' }}
        />

        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 }}>Nome do sistema / PBX</label>
        <input
          value={pbxName}
          onChange={(e) => setPbxName(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, marginBottom: 18, fontSize: 14, fontFamily: 'inherit' }}
        />

        {error && <div style={{ color: colors.red, fontSize: 13, marginBottom: 14 }}>{error}</div>}
        {message && !error && <div style={{ color: colors.green, fontSize: 13, marginBottom: 14 }}>{message}</div>}

        <button
          type="submit"
          disabled={saving}
          style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </div>
  );
}
