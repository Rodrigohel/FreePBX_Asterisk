import { useState } from 'react';
import Icon, { ICONS } from './Icon.jsx';
import Logo from './Logo.jsx';

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

function IconButton({ h, onClick, title, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 38, height: 38, borderRadius: 11,
        border: `1px solid ${hover ? h.glassBorderHover : h.glassBorder}`,
        background: hover ? h.glassBgHover : h.glassBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        color: h.text,
        transition: 'border-color .15s ease, background .15s ease, transform .15s ease',
        transform: hover ? 'translateY(-2px)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

export default function Header({
  colors, companyName, pbxName, logoUrl, statusPill, connectionInfo,
  lastUpdateLabel, onRefresh, refreshing, isDark, onToggleTheme, user, onLogout, onOpenSettings,
}) {
  const h = colors.header;
  const [refreshHover, setRefreshHover] = useState(false);
  const [logoutHover, setLogoutHover] = useState(false);

  return (
    <header style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      background: h.gradient, borderRadius: 18, padding: '18px 24px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.3), 0 20px 40px -14px rgba(15,23,42,0.55)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, position: 'relative' }}>
        <Logo colors={colors} logoUrl={logoUrl} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 650, fontSize: 17, color: h.text, lineHeight: 1.2 }}>{companyName}</div>
          <div style={{ fontSize: 13, color: h.textSecondary, marginTop: 2 }}>{pbxName}</div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, background: h.glassBg, border: `1px solid ${h.glassBorder}`,
          color: h.text, padding: '6px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700, marginLeft: 8,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: statusPill.fg, animation: 'pulseDot 2s ease-in-out infinite' }} />
          {statusPill.label}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: h.textSecondary }}>
            <Icon paths={ICONS.phoneRow} size={13} color={connectionInfo.color} strokeWidth={2.2} />
            {connectionInfo.label}
          </div>
          <div style={{ fontSize: 12, color: h.textTertiary }}>Atualizado {lastUpdateLabel}</div>
        </div>

        <button
          onClick={onRefresh}
          onMouseEnter={() => setRefreshHover(true)}
          onMouseLeave={() => setRefreshHover(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            border: 'none', background: refreshHover ? '#FFFFFF' : '#F1F5F9',
            color: '#1E293B',
            borderRadius: 11, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            transition: 'transform .15s ease, box-shadow .15s ease, background .15s ease',
            transform: refreshHover ? 'translateY(-2px)' : 'none',
            boxShadow: refreshHover ? '0 8px 18px -6px rgba(0,0,0,0.35)' : '0 2px 6px -2px rgba(0,0,0,0.25)',
          }}
        >
          <span style={{ display: 'inline-flex', animation: refreshing ? 'spinIcon 0.7s linear infinite' : 'none' }}>
            <Icon paths={ICONS.refresh} size={15} strokeWidth={2.4} />
          </span>
          Atualizar
        </button>

        <IconButton h={h} onClick={onToggleTheme} title="Alternar tema">
          {isDark ? <Icon paths={ICONS.moon} size={16} strokeWidth={2} /> : <Icon paths={ICONS.sun} size={16} strokeWidth={2} />}
        </IconButton>

        {onOpenSettings && (
          <IconButton h={h} onClick={onOpenSettings} title="Configurações">
            <Icon paths={ICONS.settings} size={16} strokeWidth={2} />
          </IconButton>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingLeft: 15, borderLeft: `1px solid ${h.glassBorder}` }}>
          <div style={{
            width: 33, height: 33, borderRadius: 99, background: 'linear-gradient(135deg, #60A5FA 0%, #818CF8 100%)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700,
            fontFamily: "'Space Grotesk',sans-serif", boxShadow: '0 0 0 2px rgba(255,255,255,0.18)',
          }}>
            {initials(user?.displayName)}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: h.text }}>{user?.displayName}</div>
          <button
            onClick={onLogout}
            title="Sair"
            onMouseEnter={() => setLogoutHover(true)}
            onMouseLeave={() => setLogoutHover(false)}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, marginLeft: 2,
              color: logoutHover ? '#FCA5A5' : h.textTertiary, transition: 'color .15s ease',
            }}
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
