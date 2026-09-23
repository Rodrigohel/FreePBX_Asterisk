import { localDateStr } from '../utils/localDate.js';

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

function toDateStr(d) {
  return localDateStr(d);
}

// % de chamadas atendidas sobre o total (recebidas + realizadas), excluindo
// perdidas e com falha. null quando não há chamadas suficientes pra calcular.
function answeredRate(summary) {
  if (!summary) return null;
  const total = (summary.received || 0) + (summary.made || 0);
  if (total === 0) return null;
  const answered = total - (summary.missed || 0) - (summary.failed || 0);
  return answered / total;
}

function titleForDate(dateStr) {
  if (!dateStr) return 'Resumo de chamadas de hoje';
  const today = toDateStr(new Date());
  const yesterday = toDateStr(new Date(Date.now() - 86400000));
  if (dateStr === today) return 'Resumo de chamadas de hoje';
  if (dateStr === yesterday) return 'Resumo de chamadas de ontem';
  const [y, m, d] = dateStr.split('-');
  return `Resumo de chamadas de ${d}/${m}/${y}`;
}

export default function TodaySummaryPanel({ colors, summary, previousSummary, date, onDateChange }) {
  const today = toDateStr(new Date());
  const yesterday = toDateStr(new Date(Date.now() - 86400000));

  const rate = answeredRate(summary);
  const previousRate = answeredRate(previousSummary);
  const rateDeltaPts = rate !== null && previousRate !== null ? Math.round((rate - previousRate) * 100) : null;

  const stats = [
    { label: 'Recebidas', value: String(summary.received), color: colors.textPrimary },
    { label: 'Realizadas', value: String(summary.made), color: colors.textPrimary },
    { label: 'Perdidas', value: String(summary.missed), color: colors.red },
    { label: 'Com falha', value: String(summary.failed), color: colors.amber },
    {
      label: 'Taxa de atendimento',
      value: rate === null ? '—' : `${Math.round(rate * 100)}%`,
      color: rate === null ? colors.textPrimary : rate >= 0.9 ? colors.green : rate >= 0.7 ? colors.amber : colors.red,
      trend: rateDeltaPts,
    },
    { label: 'Tempo médio', value: formatShortDuration(summary.avgDurationSeconds), color: colors.textPrimary },
    { label: 'Tempo total', value: formatDuration(summary.totalDurationSeconds), color: colors.textPrimary },
    { label: 'Ramal mais usado', value: summary.mostUsedExtension || '—', color: colors.primary },
  ];

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '18px 22px', boxShadow: colors.shadow }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15, fontWeight: 600, color: colors.textPrimary }}>
          {titleForDate(date)}
        </div>

        {onDateChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, background: colors.bgCardAlt, padding: 4, borderRadius: 10 }}>
              {[{ key: today, label: 'Hoje' }, { key: yesterday, label: 'Ontem' }].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => onDateChange(opt.key)}
                  style={{
                    border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                    background: date === opt.key ? colors.bgCard : 'transparent',
                    color: date === opt.key ? colors.primary : colors.textSecondary,
                    boxShadow: date === opt.key ? colors.shadow : 'none',
                    transition: 'background .2s ease, color .2s ease, box-shadow .2s ease',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={date || today}
              max={today}
              onChange={(e) => e.target.value && onDateChange(e.target.value)}
              style={{
                border: `1px solid ${colors.border}`, borderRadius: 10, padding: '7px 10px', fontSize: 12.5,
                fontFamily: 'inherit', background: colors.bgCardAlt, color: colors.textPrimary,
              }}
            />
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(130px,100%),1fr))', gap: 14 }}>
        {stats.map((st) => (
          <div key={st.label}>
            <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 600 }}>{st.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, fontWeight: 700, color: st.color, marginTop: 2 }}>{st.value}</div>
              {st.trend !== undefined && st.trend !== null && st.trend !== 0 && (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: st.trend > 0 ? colors.green : colors.red }}>
                  {st.trend > 0 ? '↑' : '↓'} {Math.abs(st.trend)}pts
                </span>
              )}
            </div>
            {st.trend !== undefined && st.trend !== null && (
              <div style={{ fontSize: 10.5, color: colors.textTertiary, marginTop: 1 }}>vs. dia anterior</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
