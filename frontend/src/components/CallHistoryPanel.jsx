import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import Icon, { ICONS } from './Icon.jsx';

const DISPOSITION_LABEL = {
  ANSWERED: 'Atendida',
  'NO ANSWER': 'Não atendida',
  BUSY: 'Ocupado',
  FAILED: 'Falhou',
};

function dispositionColor(colors, disposition) {
  if (disposition === 'ANSWERED') return colors.green;
  if (disposition === 'NO ANSWER' || disposition === 'BUSY') return colors.amber;
  return colors.red;
}

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${s}s` : `${s}s`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

export default function CallHistoryPanel({ colors }) {
  const [q, setQ] = useState('');
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], total: 0, pageSize: 25 });
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (params) => {
    setLoading(true);
    try {
      const data = await api.callsHistory(params);
      setResult(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search({ q, from, to, page, pageSize: 25 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function handleSubmit(e) {
    e.preventDefault();
    setPage(1);
    search({ q, from, to, page: 1, pageSize: 25 });
  }

  const totalPages = Math.max(1, Math.ceil(result.total / (result.pageSize || 25)));

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 2 }}>Histórico de chamadas</div>
      <div style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 14 }}>Busque por ramal, apartamento ou número, num período</div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ramal ou número..."
          style={{ flex: '1 1 160px', minWidth: 140, padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, fontSize: 13, fontFamily: 'inherit', background: colors.bgCardAlt, color: colors.textPrimary }}
        />
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
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${colors.border}` }}>
        {loading && (
          <div style={{ padding: '16px 2px', fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>Buscando...</div>
        )}
        {!loading && result.data.length === 0 && (
          <div style={{ padding: '16px 2px', fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>Nenhuma chamada encontrada nesse período.</div>
        )}
        {!loading && result.data.map((call, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 2px', borderBottom: `1px solid ${colors.border}`, fontSize: 13 }}>
            <Icon paths={call.direction === 'made' ? ICONS.callOutbound : ICONS.callInbound} size={13} color={colors.textTertiary} strokeWidth={2} />
            <span style={{ fontWeight: 700, color: colors.textPrimary, fontFamily: "'Space Grotesk',sans-serif", width: 60, flexShrink: 0 }}>{call.direction === 'made' ? call.src : call.dst}</span>
            <span style={{ color: colors.textSecondary, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {call.direction === 'made' ? `para ${call.dst}` : `de ${call.src}`}
            </span>
            <span style={{ color: dispositionColor(colors, call.disposition), fontWeight: 600, fontSize: 12 }}>{DISPOSITION_LABEL[call.disposition] || call.disposition}</span>
            <span style={{ color: colors.textTertiary, fontSize: 12, width: 48, textAlign: 'right', flexShrink: 0 }}>{formatDuration(call.durationSeconds)}</span>
            <span style={{ color: colors.textTertiary, fontSize: 12, width: 116, textAlign: 'right', flexShrink: 0 }}>{new Date(call.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
      </div>

      {result.total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 12, fontSize: 12.5, color: colors.textSecondary }}>
          <span>{result.total} resultados · página {page} de {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ border: `1px solid ${colors.border}`, background: colors.bgCardAlt, color: colors.textPrimary, borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}
          >
            Anterior
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ border: `1px solid ${colors.border}`, background: colors.bgCardAlt, color: colors.textPrimary, borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
