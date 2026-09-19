import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import Icon, { ICONS } from './Icon.jsx';
import { buildExtensionDirectory, describeCallParty, GROUP_LABELS } from '../utils/extensionDirectory.js';
import { toCsv, downloadCsv } from '../utils/csv.js';
import { generateReportPdf } from '../utils/pdf.js';

const DISPOSITION_LABEL = {
  ANSWERED: 'Atendida',
  'NO ANSWER': 'Não atendida',
  BUSY: 'Ocupado',
  FAILED: 'Falhou',
};

const TOWER_FILTERS = [
  { value: 'all', label: 'Todas as torres/blocos' },
  { value: 'torreA', label: GROUP_LABELS.torreA },
  { value: 'blocoB', label: GROUP_LABELS.blocoB },
  { value: 'common', label: GROUP_LABELS.common },
];

// "Realizada"/"Recebida" baseado no dcontext do Asterisk não faz sentido
// pra uma ligação interna (porteiro -> apartamento, apartamento ->
// apartamento): dependeria de qual lado é "quem ligou", que é ambíguo sem
// contexto. Em vez disso, classificamos pelo que já sabemos de cada ponta
// (é um ramal do condomínio ou um número de fora):
// interna (os dois lados são ramal conhecido), saída (ramal ligou pra
// fora) ou entrada (alguém de fora ligou pro condomínio).
function classifyDirection(fromParty, toParty) {
  if (fromParty.isInternal && toParty.isInternal) return { key: 'internal', label: 'Interna' };
  if (fromParty.isInternal && !toParty.isInternal) return { key: 'outbound', label: 'Saída' };
  if (!fromParty.isInternal && toParty.isInternal) return { key: 'inbound', label: 'Entrada' };
  return { key: 'unknown', label: '—' };
}

function DirectionIcon({ colors, direction }) {
  if (direction.key === 'outbound') return <Icon paths={ICONS.callOutbound} size={13} color={colors.textTertiary} strokeWidth={2} />;
  if (direction.key === 'inbound') return <Icon paths={ICONS.callInbound} size={13} color={colors.textTertiary} strokeWidth={2} />;
  return <Icon paths={ICONS.phoneRow} size={13} color={colors.textTertiary} strokeWidth={2} />;
}

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

function PartyLabel({ colors, party, align }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, textAlign: align }}>
      <span style={{ color: colors.textPrimary, fontWeight: party.isInternal ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {party.isInternal ? party.label : party.number}
      </span>
      {party.isInternal && (
        <span style={{ color: colors.textTertiary, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {party.number}{party.detail ? ` · ${party.detail}` : ''}
        </span>
      )}
    </span>
  );
}

export default function CallHistoryPanel({ colors, extensions = [] }) {
  const [q, setQ] = useState('');
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [tower, setTower] = useState('all');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], total: 0, pageSize: 25 });
  const [loading, setLoading] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState('');

  const directory = useMemo(() => buildExtensionDirectory(extensions), [extensions]);

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

  async function fetchEnrichedExport() {
    const { data } = await api.exportCallHistory({ q, from, to });
    const enriched = data
      .map((call) => ({ call, from: describeCallParty(call.src, directory), to: describeCallParty(call.dst, directory) }))
      .filter(({ from: fromParty, to: toParty }) => tower === 'all' || fromParty.groupKey === tower || toParty.groupKey === tower);
    if (enriched.length === 0) {
      throw new Error('Nenhuma chamada encontrada nesse filtro pra exportar.');
    }
    return enriched;
  }

  function partyText(party) {
    if (!party.isInternal) return party.number;
    return `${party.label} (${party.number})${party.detail ? ` - ${party.detail}` : ''}`;
  }

  async function handleExportCsv() {
    setExportingCsv(true);
    setExportError('');
    try {
      const enriched = await fetchEnrichedExport();
      const csvRows = enriched.map(({ call, from: fromParty, to: toParty }) => [
        new Date(call.at).toLocaleString('pt-BR'),
        classifyDirection(fromParty, toParty).label,
        fromParty.isInternal ? fromParty.label : '',
        fromParty.number,
        fromParty.detail || '',
        toParty.isInternal ? toParty.label : '',
        toParty.number,
        toParty.detail || '',
        DISPOSITION_LABEL[call.disposition] || call.disposition,
        call.durationSeconds ?? 0,
      ]);
      const csv = toCsv(
        ['Data/Hora', 'Direção', 'De (nome)', 'De (número)', 'De (torre/apto)', 'Para (nome)', 'Para (número)', 'Para (torre/apto)', 'Status', 'Duração (s)'],
        csvRows
      );
      downloadCsv(`chamadas_${from}_a_${to}.csv`, csv);
    } catch (err) {
      setExportError(err.message || 'Não foi possível exportar.');
    } finally {
      setExportingCsv(false);
    }
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    setExportError('');
    try {
      const enriched = await fetchEnrichedExport();
      const pdfRows = enriched.map(({ call, from: fromParty, to: toParty }) => [
        new Date(call.at).toLocaleString('pt-BR'),
        classifyDirection(fromParty, toParty).label,
        partyText(fromParty),
        partyText(toParty),
        DISPOSITION_LABEL[call.disposition] || call.disposition,
        formatDuration(call.durationSeconds),
      ]);
      const towerLabel = TOWER_FILTERS.find((t) => t.value === tower)?.label || '';
      generateReportPdf({
        title: 'Relatório de chamadas',
        subtitle: `${from} a ${to}${q ? ` · busca: "${q}"` : ''}${tower !== 'all' ? ` · ${towerLabel}` : ''} · ${enriched.length} chamadas`,
        headers: ['Data/Hora', 'Direção', 'De', 'Para', 'Status', 'Duração'],
        rows: pdfRows,
        filename: `chamadas_${from}_a_${to}.pdf`,
      });
    } catch (err) {
      setExportError(err.message || 'Não foi possível exportar.');
    } finally {
      setExportingPdf(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(result.total / (result.pageSize || 25)));

  const rows = result.data.map((call) => ({
    call,
    from: describeCallParty(call.src, directory),
    to: describeCallParty(call.dst, directory),
  })).filter(({ from: fromParty, to: toParty }) => (
    tower === 'all' || fromParty.groupKey === tower || toParty.groupKey === tower
  ));

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 2 }}>Histórico de chamadas</div>
      <div style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 14 }}>Busque por ramal, apartamento ou número, num período — mostra de onde veio e para onde foi cada ligação</div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <select
          value={tower}
          onChange={(e) => setTower(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, fontSize: 12.5, fontFamily: 'inherit', background: colors.bgCardAlt, color: colors.textPrimary }}
        >
          {TOWER_FILTERS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={exportingCsv}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', border: `1px solid ${colors.border}`, background: colors.bgCardAlt, color: colors.textPrimary, borderRadius: 10, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: exportingCsv ? 'default' : 'pointer' }}
        >
          <Icon paths={ICONS.chevronDown} size={13} strokeWidth={2.2} />
          {exportingCsv ? 'Exportando...' : 'Exportar CSV'}
        </button>
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={exportingPdf}
          style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${colors.border}`, background: colors.bgCardAlt, color: colors.textPrimary, borderRadius: 10, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: exportingPdf ? 'default' : 'pointer' }}
        >
          <Icon paths={ICONS.chevronDown} size={13} strokeWidth={2.2} />
          {exportingPdf ? 'Exportando...' : 'Exportar PDF'}
        </button>
      </div>
      {exportError && <div style={{ color: colors.red, fontSize: 12.5, marginTop: -6, marginBottom: 10 }}>{exportError}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${colors.border}` }}>
        {loading && (
          <div style={{ padding: '16px 2px', fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>Buscando...</div>
        )}
        {!loading && rows.length === 0 && (
          <div style={{ padding: '16px 2px', fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>Nenhuma chamada encontrada.</div>
        )}
        {!loading && rows.map(({ call, from: fromParty, to: toParty }, i) => {
          const direction = classifyDirection(fromParty, toParty);
          return (
            <div key={i} style={{ padding: '10px 2px', borderBottom: `1px solid ${colors.border}`, fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DirectionIcon colors={colors} direction={direction} />
                <div style={{ flex: '1 1 0', minWidth: 0 }}>
                  <PartyLabel colors={colors} party={fromParty} align="left" />
                </div>
                <Icon paths={['M5 12h14', 'M13 6l6 6-6 6']} size={12} color={colors.textTertiary} strokeWidth={2} />
                <div style={{ flex: '1 1 0', minWidth: 0 }}>
                  <PartyLabel colors={colors} party={toParty} align="left" />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 5, paddingLeft: 21 }}>
                <span style={{ color: colors.textTertiary, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{direction.label}</span>
                <span style={{ color: dispositionColor(colors, call.disposition), fontWeight: 600, fontSize: 12 }}>{DISPOSITION_LABEL[call.disposition] || call.disposition}</span>
                <span style={{ color: colors.textTertiary, fontSize: 12 }}>{formatDuration(call.durationSeconds)}</span>
                <span style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 'auto' }}>{new Date(call.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          );
        })}
      </div>

      {result.total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 12, fontSize: 12.5, color: colors.textSecondary }}>
          <span>
            {tower === 'all'
              ? `${result.total} resultados · página ${page} de ${totalPages}`
              : `${rows.length} de ${result.data.length} nesta página (filtrado por torre) · página ${page} de ${totalPages}`}
          </span>
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
