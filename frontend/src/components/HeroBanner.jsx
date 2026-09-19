import Icon, { ICONS } from './Icon.jsx';

export default function HeroBanner({ colors, banner }) {
  return (
    <div style={{
      background: banner.gradient || banner.bg, border: `1px solid ${banner.border}`, borderRadius: 16, padding: '18px 22px',
      display: 'flex', alignItems: 'center', gap: 14, boxShadow: colors.shadow, animation: 'fadeInUp .4s ease both',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 99, background: banner.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        animation: banner.urgent ? 'pulseRing 1.8s ease-out infinite' : 'none',
      }}>
        <Icon paths={banner.iconPaths} size={20} color={banner.iconColor} strokeWidth={2.4} />
      </div>
      <div>
        <div style={{ fontSize: 15.5, fontWeight: 700, color: colors.textPrimary, fontFamily: "'Space Grotesk',sans-serif" }}>{banner.title}</div>
        <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{banner.subtitle}</div>
      </div>
    </div>
  );
}

export function buildHeroBanner(colors, { extSummary, activeCallsCount, activeAlertsCount, overall }) {
  if (overall === 'offline') {
    return {
      bg: colors.redSoft, gradient: `linear-gradient(135deg, ${colors.redSoft} 0%, transparent 100%)`, border: 'transparent',
      iconBg: colors.red, iconColor: '#fff', iconPaths: ICONS.offline, urgent: true,
      title: 'PBX indisponível', subtitle: 'Não foi possível conectar ao Asterisk. Verifique o serviço.',
    };
  }
  if (overall === 'degraded' || activeAlertsCount > 0) {
    return {
      bg: colors.amberSoft, gradient: `linear-gradient(135deg, ${colors.amberSoft} 0%, transparent 100%)`, border: 'transparent',
      iconBg: colors.amber, iconColor: '#fff', iconPaths: ICONS.warningTriangle, urgent: false,
      title: 'Atenção necessária',
      subtitle: `${extSummary.online} de ${extSummary.configured} ramais online · ${activeCallsCount} chamadas em andamento · ${activeAlertsCount} alertas para revisar`,
    };
  }
  return {
    bg: colors.greenSoft, gradient: `linear-gradient(135deg, ${colors.greenSoft} 0%, transparent 100%)`, border: 'transparent',
    iconBg: colors.green, iconColor: '#fff', iconPaths: ICONS.check, urgent: false,
    title: 'Tudo funcionando bem hoje',
    subtitle: `${extSummary.online} de ${extSummary.configured} ramais online · ${activeCallsCount} chamadas em andamento · ${activeAlertsCount} alertas para revisar`,
  };
}
