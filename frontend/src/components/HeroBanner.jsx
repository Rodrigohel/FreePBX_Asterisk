import Icon, { ICONS } from './Icon.jsx';

export default function HeroBanner({ colors, banner }) {
  return (
    <div style={{
      background: banner.bg, border: `1px solid ${banner.border}`, borderRadius: 16, padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 14, boxShadow: colors.shadow, animation: 'fadeInUp .4s ease both',
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 99, background: banner.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon paths={banner.iconPaths} size={19} color={banner.iconColor} strokeWidth={2.4} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary, fontFamily: "'Space Grotesk',sans-serif" }}>{banner.title}</div>
        <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 1 }}>{banner.subtitle}</div>
      </div>
    </div>
  );
}

export function buildHeroBanner(colors, { extSummary, activeCallsCount, activeAlertsCount, overall }) {
  if (overall === 'offline') {
    return {
      bg: colors.redSoft, border: 'transparent', iconBg: colors.red, iconColor: '#fff',
      iconPaths: ICONS.offline,
      title: 'PBX indisponível', subtitle: 'Não foi possível conectar ao Asterisk. Verifique o serviço.',
    };
  }
  if (overall === 'degraded' || activeAlertsCount > 0) {
    return {
      bg: colors.amberSoft, border: 'transparent', iconBg: colors.amber, iconColor: '#fff',
      iconPaths: ICONS.warningTriangle,
      title: 'Atenção necessária',
      subtitle: `${extSummary.online} de ${extSummary.configured} ramais online · ${activeCallsCount} chamadas em andamento · ${activeAlertsCount} alertas para revisar`,
    };
  }
  return {
    bg: colors.greenSoft, border: 'transparent', iconBg: colors.green, iconColor: '#fff',
    iconPaths: ICONS.check,
    title: 'Tudo funcionando bem hoje',
    subtitle: `${extSummary.online} de ${extSummary.configured} ramais online · ${activeCallsCount} chamadas em andamento · ${activeAlertsCount} alertas para revisar`,
  };
}
