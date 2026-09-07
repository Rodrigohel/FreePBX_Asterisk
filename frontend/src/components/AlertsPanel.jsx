import Icon, { ICONS } from './Icon.jsx';

const SEVERITY_META = {
  critical: { label: 'Crítico', iconBg: 'redSoft', iconColor: 'red', iconPaths: ICONS.warningTriangle },
  warning: { label: 'Atenção', iconBg: 'amberSoft', iconColor: 'amber', iconPaths: ICONS.warningTriangle },
  info: { label: 'Informação', iconBg: 'primarySoft', iconColor: 'primary', iconPaths: ICONS.info },
  resolved: { label: 'Resolvido', iconBg: 'greenSoft', iconColor: 'green', iconPaths: ICONS.check },
};

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m atrás`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AlertsPanel({ colors, alerts }) {
  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 12 }}>Alertas recentes</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {alerts.length === 0 && (
          <div style={{ fontSize: 13, color: colors.textSecondary }}>Nenhum alerta no momento.</div>
        )}
        {alerts.map((alert) => {
          const meta = SEVERITY_META[alert.severity] || SEVERITY_META.info;
          const iconColor = colors[meta.iconColor];
          const iconBg = colors[meta.iconBg];
          const resolved = alert.status === 'resolved';
          return (
            <div key={alert.id} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 12, background: colors.bgCardAlt, border: `1px solid ${colors.border}` }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon paths={meta.iconPaths} size={15} color={iconColor} strokeWidth={2.2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.03em', color: iconColor, textTransform: 'uppercase' }}>{meta.label}</span>
                  <span style={{ fontSize: 11, color: colors.textTertiary }}>{timeAgo(alert.createdAt)}</span>
                </div>
                <div style={{ fontSize: 13.5, color: colors.textPrimary, marginTop: 3 }}>{alert.message}</div>
              </div>
              <div style={{
                flexShrink: 0, fontSize: 11.5, fontWeight: 700, alignSelf: 'flex-start', borderRadius: 99, padding: '3px 9px',
                color: resolved ? colors.textSecondary : colors.red,
                background: resolved ? colors.graySoft : colors.redSoft,
              }}>
                {resolved ? 'Resolvido' : 'Ativo'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
