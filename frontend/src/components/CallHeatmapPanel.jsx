import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import Icon, { ICONS } from './Icon.jsx';
import { toCsv, downloadCsv } from '../utils/csv.js';
import { localDateStr, daysAgoLocalStr } from '../utils/localDate.js';

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function todayIso() {
  return localDateStr();
}

function daysAgoIso(days) {
  return daysAgoLocalStr(days);
}

function intensityColor(colors, ratio) {
  if (ratio <= 0) return colors.bgCardAlt;
  // interpola entre a cor "soft" (fraco) e a cor cheia do primary (pico)
  const alpha = 0.12 + ratio * 0.78;
  return colors.primary.startsWith('#')
    ? hexToRgba(colors.primary, alpha)
    : colors.primarySoft;
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function CallHeatmapPanel({ colors }) {
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [cells, setCells] = useState([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    try {
      const res = await api.callHeatmap({ from, to });
      setCells(res.cells || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { search(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function handleSubmit(e) {
    e.preventDefault();
    search();
  }

  const grid = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.total]));

  function handleExportCsv() {
    // Exporta a matriz completa (todos os 7x24 cruzamentos, mesmo com 0
    // chamadas) em vez de só as células com movimento — fica pronto pra
    // virar tabela dinâmica no Excel sem buracos.
    const rows = [];
    for (let dow = 0; dow < 7; dow++) {
      for (let hour = 0; hour < 24; hour++) {
        rows.push([DAY_LABELS[dow], `${hour}h`, String(grid.get(`${dow}-${hour}`) || 0)]);
      }
    }
    const csv = toCsv(['Dia da semana', 'Hora', 'Chamadas'], rows);
    downloadCsv(`horarios_de_pico_${from}_a_${to}.csv`, csv);
  }
  const max = Math.max(1, ...cells.map((c) => c.total));

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 2 }}>Horários de pico</div>
      <div style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 14 }}>Volume de chamadas por dia da semana e hora, num período</div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, fontSize: 13, fontFamily: 'inherit', background: colors.bgCardAlt, color: colors.textPrimary }}
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, fontSize: 13, fontFamily: 'inherit', background: colors.bgCardAlt, color: colors.textPrimary }}
        />
        <button
          type="submit"
          style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: colors.primary, color: '#fff', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          <Icon paths={ICONS.search} size={14} strokeWidth={2.2} />
          Buscar
        </button>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={loading || cells.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', border: `1px solid ${colors.border}`,
            background: colors.bgCardAlt, color: colors.textPrimary, borderRadius: 10, padding: '7px 14px', fontSize: 12.5, fontWeight: 600,
            cursor: 'pointer', opacity: loading || cells.length === 0 ? 0.5 : 1,
          }}
        >
          <Icon paths={ICONS.chevronDown} size={13} strokeWidth={2.2} />
          Exportar CSV
        </button>
      </form>

      {loading ? (
        <div style={{ padding: '16px 2px', fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>Buscando...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 620 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 3, marginBottom: 4 }}>
              <div />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} style={{ fontSize: 9.5, color: colors.textTertiary, textAlign: 'center' }}>
                  {h % 3 === 0 ? `${h}h` : ''}
                </div>
              ))}
            </div>
            {DAY_LABELS.map((label, dow) => (
              <div key={dow} style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 3, marginBottom: 3 }}>
                <div style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 600, display: 'flex', alignItems: 'center' }}>{label}</div>
                {Array.from({ length: 24 }, (_, hour) => {
                  const total = grid.get(`${dow}-${hour}`) || 0;
                  const ratio = total / max;
                  return (
                    <div
                      key={hour}
                      title={`${label} ${hour}h — ${total} chamada${total === 1 ? '' : 's'}`}
                      style={{
                        aspectRatio: '1', borderRadius: 4, background: intensityColor(colors, ratio),
                        border: `1px solid ${colors.border}`,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
