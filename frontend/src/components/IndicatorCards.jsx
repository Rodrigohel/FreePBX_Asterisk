import { useState } from 'react';
import Icon, { ICONS } from './Icon.jsx';

function Card({ colors, card, index }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={card.onClick}
      style={{
        position: 'relative', overflow: 'hidden',
        background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 18, padding: '18px 18px 16px',
        boxShadow: hover ? `${colors.shadowHover}, 0 0 0 1px ${card.stateColor}33` : colors.shadow,
        cursor: card.onClick ? 'pointer' : 'default',
        transition: 'transform .18s ease, box-shadow .18s ease',
        animation: 'fadeInUp .4s ease both', animationDelay: `${index * 0.05}s`,
        transform: hover ? 'translateY(-5px)' : 'none',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: card.stateColor, opacity: hover ? 1 : 0.55, transition: 'opacity .18s ease' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{
          width: 42, height: 42, borderRadius: 13, background: card.iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: hover ? 'scale(1.06)' : 'none', transition: 'transform .18s ease',
        }}>
          <Icon paths={card.iconPaths} size={20} color={card.iconColor} strokeWidth={2.1} />
        </div>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={colors.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 4, opacity: hover ? 1 : 0.5, transition: 'opacity .18s ease' }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
      <div style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 14, fontWeight: 600 }}>{card.title}</div>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 30, fontWeight: 700, color: colors.textPrimary, marginTop: 2, letterSpacing: '-0.01em' }}>{card.value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 9, fontSize: 12, fontWeight: 600, color: card.stateColor }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: card.stateColor }} />
        {card.stateText}
      </div>
      <div style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 6, lineHeight: 1.4 }}>{card.plain}</div>
    </div>
  );
}

export default function IndicatorCards({ colors, cards }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(210px,100%),1fr))', gap: 16 }}>
      {cards.map((card, i) => (
        <Card key={card.title} colors={colors} card={card} index={i} />
      ))}
    </div>
  );
}

export function buildIndicatorCards(colors, data) {
  const { extSummary, activeCallsCount, todaySummary, health, activeAlertsCount, onCardClick = {} } = data;
  const uptimeDays = Math.floor((health.uptimeSeconds || 0) / 86400);
  const uptimeHours = Math.floor(((health.uptimeSeconds || 0) % 86400) / 3600);
  const healthState = health.cpuPercent >= 85 || health.memoryPercent >= 90
    ? { text: 'Crítico', color: colors.red }
    : health.cpuPercent >= 65 || health.memoryPercent >= 75
      ? { text: 'Atenção', color: colors.amber }
      : { text: 'Bom', color: colors.green };

  return [
    { title: 'Ramais configurados', value: String(extSummary.configured), stateColor: colors.gray, stateText: 'Total cadastrado', iconBg: colors.graySoft, iconColor: colors.gray, iconPaths: ICONS.extensionsTotal, plain: 'Quantidade de telefones cadastrados no sistema.', onClick: onCardClick.extensionsAll },
    { title: 'Ramais online', value: String(extSummary.online), stateColor: colors.green, stateText: 'Registrados agora', iconBg: colors.greenSoft, iconColor: colors.green, iconPaths: ICONS.check, plain: 'Telefones ligados e prontos para receber chamadas.', onClick: onCardClick.extensionsOnline },
    { title: 'Ramais offline', value: String(extSummary.offline), stateColor: colors.red, stateText: 'Não registrados', iconBg: colors.redSoft, iconColor: colors.red, iconPaths: ICONS.offline, plain: 'Telefones desligados ou sem conexão agora.', onClick: onCardClick.extensionsOffline },
    { title: 'Chamadas em andamento', value: String(activeCallsCount), stateColor: colors.primary, stateText: 'Neste momento', iconBg: colors.primarySoft, iconColor: colors.primary, iconPaths: ICONS.phoneActive, plain: 'Ligações acontecendo agora mesmo.', onClick: onCardClick.activeCalls },
    { title: 'Chamadas hoje', value: String(todaySummary.received + todaySummary.made), stateColor: colors.gray, stateText: 'Recebidas + realizadas', iconBg: colors.graySoft, iconColor: colors.gray, iconPaths: ICONS.calendar, plain: 'Total de ligações feitas e recebidas hoje.', onClick: onCardClick.todaySummary },
    { title: 'Uptime do servidor', value: `${uptimeDays}d ${uptimeHours}h`, stateColor: colors.green, stateText: 'Sem reinício', iconBg: colors.greenSoft, iconColor: colors.green, iconPaths: ICONS.uptime, plain: 'Tempo que o sistema ficou funcionando sem parar.', onClick: onCardClick.health },
    { title: 'Alertas ativos', value: String(activeAlertsCount), stateColor: activeAlertsCount > 0 ? colors.amber : colors.green, stateText: activeAlertsCount > 0 ? 'Requer atenção' : 'Tudo certo', iconBg: activeAlertsCount > 0 ? colors.amberSoft : colors.greenSoft, iconColor: activeAlertsCount > 0 ? colors.amber : colors.green, iconPaths: ICONS.warningTriangle, plain: 'Avisos que precisam da sua atenção.', onClick: onCardClick.alerts },
    { title: 'Saúde do servidor', value: healthState.text, stateColor: healthState.color, stateText: `CPU ${health.cpuPercent}% · RAM ${health.memoryPercent}%`, iconBg: colors.graySoft, iconColor: healthState.color, iconPaths: ICONS.extensionsIcon, plain: 'Como está o desempenho geral do sistema.', onClick: onCardClick.health },
  ];
}
