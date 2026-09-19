import Icon, { ICONS } from './Icon.jsx';
import Logo from './Logo.jsx';

const STATUS_PILL = {
  operational: (c) => ({ bg: c.greenSoft, fg: c.green, label: 'Operacional' }),
  degraded: (c) => ({ bg: c.amberSoft, fg: c.amber, label: 'Degradado' }),
  offline: (c) => ({ bg: c.redSoft, fg: c.red, label: 'Offline' }),
};

export default function PublicHeader({
  colors, companyName, pbxName, logoUrl, status, lastUpdateLabel,
  onRefresh, refreshing, isDark, onToggleTheme, onLoginClick,
}) {
  const statusPill = status ? (STATUS_PILL[status.overall] || STATUS_PILL.operational)(colors) : null;

  return (
    <header style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '18px 22px', boxShadow: colors.shadow,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <Logo colors={colors} logoUrl={logoUrl} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 17, color: colors.textPrimary, lineHeight: 1.2 }}>{companyName}</div>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{pbxName}</div>
        </div>
        {statusPill && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: statusPill.bg, color: statusPill.fg, padding: '6px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700, marginLeft: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: statusPill.fg, animation: 'pulseDot 2s ease-in-out infinite' }} />
            {statusPill.label}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {lastUpdateLabel && (
          <div style={{ fontSize: 12, color: colors.textTertiary }}>Atualizado {lastUpdateLabel}</div>
        )}

        <button
          onClick={onRefresh}
          style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${colors.border}`, background: colors.bgCardAlt, color: colors.textPrimary, borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          <span style={{ display: 'inline-flex', animation: refreshing ? 'spinIcon 0.7s linear infinite' : 'none' }}>
            <Icon paths={ICONS.refresh} size={15} strokeWidth={2.2} />
          </span>
          Atualizar
        </button>

        <button
          onClick={onToggleTheme}
          title="Alternar tema"
          style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bgCardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: colors.textSecondary }}
        >
          {isDark ? <Icon paths={ICONS.moon} size={16} strokeWidth={2} /> : <Icon paths={ICONS.sun} size={16} strokeWidth={2} />}
        </button>

        <button
          onClick={onLoginClick}
          style={{ border: 'none', background: colors.primary, color: '#fff', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          Entrar
        </button>
      </div>
    </header>
  );
}
