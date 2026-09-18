export default function ServerHealthPanel({ colors, health }) {
  const metrics = [
    { label: 'CPU', valueLabel: `${health.cpuPercent}%`, pct: health.cpuPercent, color: colors.primary },
    { label: 'Memória', valueLabel: `${health.memoryPercent}%`, pct: health.memoryPercent, color: colors.amber },
    { label: 'Disco', valueLabel: `${health.diskPercent}%`, pct: health.diskPercent, color: colors.green },
    { label: 'Load average', valueLabel: String(health.loadAverage), pct: Math.min(100, health.loadAverage * 25), color: colors.gray },
  ];

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 12 }}>Saúde do servidor</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {metrics.map((hm) => (
          <div key={hm.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
              <span style={{ color: colors.textSecondary, fontWeight: 600 }}>{hm.label}</span>
              <span style={{ color: colors.textPrimary, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif" }}>{hm.valueLabel}</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: colors.bgCardAlt, overflow: 'hidden' }}>
              <div style={{ width: `${hm.pct}%`, height: '100%', borderRadius: 99, background: hm.color }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${colors.border}` }}>
        {health.services.map((svc) => (
          <div key={svc.name} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: colors.textPrimary }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: svc.ok ? colors.green : colors.red, flexShrink: 0 }} />
            {svc.name}
          </div>
        ))}
      </div>
    </div>
  );
}
