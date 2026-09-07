import { useState } from 'react';
import Icon, { ICONS } from './Icon.jsx';

function Card({ colors, card, index }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 14, padding: '16px 18px',
        boxShadow: colors.shadow, cursor: 'default', transition: 'transform .15s ease, box-shadow .15s ease',
        animation: 'fadeInUp .4s ease both', animationDelay: `${index * 0.05}s`,
        transform: hover ? 'translateY(-4px)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: card.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon paths={card.iconPaths} size={17} color={card.iconColor} strokeWidth={2} />
        </div>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={colors.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
      <div style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 12, fontWeight: 600 }}>{card.title}</div>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 27, fontWeight: 700, color: colors.textPrimary, marginTop: 2 }}>{card.value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 12, fontWeight: 600, color: card.stateColor }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: card.stateColor }} />
        {card.stateText}
      </div>
      <div style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 6, lineHeight: 1.4 }}>{card.plain}</div>
    </div>
  );
}

export default function IndicatorCards({ colors, cards }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14 }}>
      {cards.map((card, i) => (
        <Card key={card.title} colors={colors} card={card} index={i} />
      ))}
    </div>
  );
}

export function buildIndicatorCards(colors, data) {
  const { extSummary, activeCallsCount, todaySummary, health, activeAlertsCount } = data;
  const uptimeDays = Math.floor((health.uptimeSeconds || 0) / 86400);
  const uptimeHours = Math.floor(((health.uptimeSeconds || 0) % 86400) / 3600);
  const healthState = health.cpuPercent >= 85 || health.memoryPercent >= 90
    ? { text: 'Crítico', color: colors.red }
    : health.cpuPercent >= 65 || health.memoryPercent >= 75
      ? { text: 'Atenção', color: colors.amber }
      : { text: 'Bom', color: colors.green };

  return [
    { title: 'Ramais configurados', value: String(extSummary.configured), stateColor: colors.gray, stateText: 'Total cadastrado', iconBg: colors.graySoft, iconColor: colors.gray, iconPaths: ICONS.extensionsTotal, plain: 'Quantidade de telefones cadastrados no sistema.' },
    { title: 'Ramais online', value: String(extSummary.online), stateColor: colors.green, stateText: 'Registrados agora', iconBg: colors.greenSoft, iconColor: colors.green, iconPaths: ICONS.check, plain: 'Telefones ligados e prontos para receber chamadas.' },
    { title: 'Ramais offline', value: String(extSummary.offline), stateColor: colors.red, stateText: 'Não registrados', iconBg: colors.redSoft, iconColor: colors.red, iconPaths: ICONS.offline, plain: 'Telefones desligados ou sem conexão agora.' },
    { title: 'Chamadas em andamento', value: String(activeCallsCount), stateColor: colors.primary, stateText: 'Neste momento', iconBg: colors.primarySoft, iconColor: colors.primary, iconPaths: ICONS.phoneActive, plain: 'Ligações acontecendo agora mesmo.' },
    { title: 'Chamadas hoje', value: String(todaySummary.received + todaySummary.made), stateColor: colors.gray, stateText: 'Recebidas + realizadas', iconBg: colors.graySoft, iconColor: colors.gray, iconPaths: ICONS.calendar, plain: 'Total de ligações feitas e recebidas hoje.' },
    { title: 'Uptime do servidor', value: `${uptimeDays}d ${uptimeHours}h`, stateColor: colors.green, stateText: 'Sem reinício', iconBg: colors.greenSoft, iconColor: colors.green, iconPaths: ICONS.uptime, plain: 'Tempo que o sistema ficou funcionando sem parar.' },
    { title: 'Alertas ativos', value: String(activeAlertsCount), stateColor: activeAlertsCount > 0 ? colors.amber : colors.green, stateText: activeAlertsCount > 0 ? 'Requer atenção' : 'Tudo certo', iconBg: activeAlertsCount > 0 ? colors.amberSoft : colors.greenSoft, iconColor: activeAlertsCount > 0 ? colors.amber : colors.green, iconPaths: ICONS.warningTriangle, plain: 'Avisos que precisam da sua atenção.' },
    { title: 'Saúde do servidor', value: healthState.text, stateColor: healthState.color, stateText: `CPU ${health.cpuPercent}% · RAM ${health.memoryPercent}%`, iconBg: colors.graySoft, iconColor: healthState.color, iconPaths: ICONS.extensionsIcon, plain: 'Como está o desempenho geral do sistema.' },
  ];
}
