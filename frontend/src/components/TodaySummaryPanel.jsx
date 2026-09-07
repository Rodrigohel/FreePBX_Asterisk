function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h${m}m`;
  return `${m}m`;
}

function formatShortDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return `${m}m${s}s`;
}

export default function TodaySummaryPanel({ colors, summary }) {
  const stats = [
    { label: 'Recebidas hoje', value: String(summary.received), color: colors.textPrimary },
    { label: 'Realizadas hoje', value: String(summary.made), color: colors.textPrimary },
    { label: 'Perdidas', value: String(summary.missed), color: colors.red },
    { label: 'Com falha', value: String(summary.failed), color: colors.amber },
    { label: 'Tempo médio', value: formatShortDuration(summary.avgDurationSeconds), color: colors.textPrimary },
    { label: 'Tempo total', value: formatDuration(summary.totalDurationSeconds), color: colors.textPrimary },
    { label: 'Ramal mais usado', value: summary.mostUsedExtension || '—', color: colors.primary },
  ];

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '18px 22px', boxShadow: colors.shadow }}>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15, fontWeight: 600, color: colors.textPrimary, marginBottom: 12 }}>Resumo de chamadas de hoje</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(130px,100%),1fr))', gap: 14 }}>
        {stats.map((st) => (
          <div key={st.label}>
            <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 600 }}>{st.label}</div>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, fontWeight: 700, color: st.color, marginTop: 2 }}>{st.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
