import Icon, { ICONS } from './Icon.jsx';
import Logo from './Logo.jsx';

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

export default function Header({
  colors, companyName, pbxName, statusPill, connectionInfo,
  lastUpdateLabel, onRefresh, refreshing, isDark, onToggleTheme, user, onLogout,
}) {
  return (
    <header style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '18px 22px', boxShadow: colors.shadow,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <Logo colors={colors} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 17, color: colors.textPrimary, lineHeight: 1.2 }}>{companyName}</div>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{pbxName}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: statusPill.bg, color: statusPill.fg, padding: '6px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700, marginLeft: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: statusPill.fg, animation: 'pulseDot 2s ease-in-out infinite' }} />
          {statusPill.label}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: colors.textSecondary }}>
            <Icon paths={ICONS.phoneRow} size={13} color={connectionInfo.color} strokeWidth={2.2} />
            {connectionInfo.label}
          </div>
          <div style={{ fontSize: 12, color: colors.textTertiary }}>Atualizado {lastUpdateLabel}</div>
        </div>

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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 14, borderLeft: `1px solid ${colors.border}` }}>
          <div style={{ width: 32, height: 32, borderRadius: 99, background: colors.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif" }}>
            {initials(user?.displayName)}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>{user?.displayName}</div>
          <button
            onClick={onLogout}
            title="Sair"
            style={{ border: 'none', background: 'transparent', color: colors.textTertiary, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginLeft: 2 }}
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
