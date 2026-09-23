import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import Icon, { ICONS } from './Icon.jsx';
import { buildExtensionDirectory, describeCallParty } from '../utils/extensionDirectory.js';
import { toCsv, downloadCsv } from '../utils/csv.js';
import { generateReportPdf } from '../utils/pdf.js';
import { localDateStr, daysAgoLocalStr } from '../utils/localDate.js';

function todayIso() {
  return localDateStr();
}

function daysAgoIso(days) {
  return daysAgoLocalStr(days);
}

function formatDurationLong(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const totalMinutes = Math.floor(seconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes || parts.length === 0) parts.push(`${minutes}min`);
  return parts.join(' ');
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function FailuresReportPanel({ colors, extensions = [] }) {
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(null); // 'csv' | 'pdf' | null

  const directory = useMemo(() => buildExtensionDirectory(extensions), [extensions]);

  async function search() {
    setLoading(true);
    try {
      const res = await api.extensionFailures({ from, to });
      setIncidents(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { search(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function handleSubmit(e) {
    e.preventDefault();
    search();
  }

  const enriched = incidents.map((inc) => ({
    inc,
    party: describeCallParty(inc.number, directory),
  }));

  const totalDowntime = incidents.reduce((sum, inc) => sum + inc.durationSeconds, 0);
  const counts = {};
  incidents.forEach((inc) => { counts[inc.number] = (counts[inc.number] || 0) + 1; });
  const worst = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

  function buildRows() {
    return enriched.map(({ inc, party }) => [
      inc.number,
      party.isInternal ? party.label : (inc.name || ''),
      party.detail || '',
      formatDateTime(inc.wentOfflineAt),
      inc.wentOnlineAt ? formatDateTime(inc.wentOnlineAt) : 'Ainda offline',
      formatDurationLong(inc.durationSeconds),
    ]);
  }

  async function handleExportCsv() {
    if (incidents.length === 0) return;
    setExporting('csv');
    setExportError('');
    try {
      const csv = toCsv(
        ['Ramal', 'Nome', 'Torre/Apto', 'Offline desde', 'Voltou em', 'Duração'],
        buildRows()
      );
      downloadCsv(`falhas_ramais_${from}_a_${to}.csv`, csv);
    } catch (err) {
      setExportError(err.message || 'Não foi possível exportar.');
    } finally {
      setExporting(null);
    }
  }

  async function handleExportPdf() {
    if (incidents.length === 0) return;
    setExporting('pdf');
    setExportError('');
    try {
      generateReportPdf({
        title: 'Relatório de falhas de ramal',
        subtitle: `${from} a ${to} · ${incidents.length} quedas · ${formatDurationLong(totalDowntime)} de indisponibilidade total`,
        headers: ['Ramal', 'Nome', 'Torre/Apto', 'Offline desde', 'Voltou em', 'Duração'],
        rows: buildRows(),
        filename: `falhas_ramais_${from}_a_${to}.pdf`,
      });
    } catch (err) {
      setExportError(err.message || 'Não foi possível exportar.');
    } finally {
      setExporting(null);
    }
  }

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 2 }}>Relatório de falhas de ramal</div>
      <div style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 14 }}>Quais ramais ficaram offline, quando caíram, quando voltaram e por quanto tempo</div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
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
          disabled={exporting !== null || incidents.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', border: `1px solid ${colors.border}`, background: colors.bgCardAlt, color: colors.textPrimary, borderRadius: 10, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: exporting || incidents.length === 0 ? 'default' : 'pointer', opacity: incidents.length === 0 ? 0.5 : 1 }}
        >
          <Icon paths={ICONS.chevronDown} size={13} strokeWidth={2.2} />
          {exporting === 'csv' ? 'Exportando...' : 'Exportar CSV'}
        </button>
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={exporting !== null || incidents.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${colors.border}`, background: colors.bgCardAlt, color: colors.textPrimary, borderRadius: 10, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: exporting || incidents.length === 0 ? 'default' : 'pointer', opacity: incidents.length === 0 ? 0.5 : 1 }}
        >
          <Icon paths={ICONS.chevronDown} size={13} strokeWidth={2.2} />
          {exporting === 'pdf' ? 'Exportando...' : 'Exportar PDF'}
        </button>
      </form>
      {exportError && <div style={{ color: colors.red, fontSize: 12.5, marginBottom: 10 }}>{exportError}</div>}

      {!loading && incidents.length > 0 && (
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 12, fontSize: 12.5, color: colors.textSecondary }}>
          <span><strong style={{ color: colors.textPrimary }}>{incidents.length}</strong> quedas</span>
          <span><strong style={{ color: colors.textPrimary }}>{formatDurationLong(totalDowntime)}</strong> de indisponibilidade total</span>
          {worst && <span>Mais instável: <strong style={{ color: colors.textPrimary }}>{worst[0]}</strong> ({worst[1]}x)</span>}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${colors.border}`, maxHeight: 400, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: '16px 2px', fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>Buscando...</div>
        )}
        {!loading && incidents.length === 0 && (
          <div style={{ padding: '16px 2px', fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>Nenhuma queda registrada nesse período. 🎉</div>
        )}
        {!loading && enriched.map(({ inc, party }, i) => (
          <div key={i} style={{ padding: '10px 2px', borderBottom: `1px solid ${colors.border}`, fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon paths={ICONS.warningTriangle} size={13} color={inc.wentOnlineAt ? colors.amber : colors.red} strokeWidth={2} />
              <span style={{ fontWeight: 700, color: colors.textPrimary, fontFamily: "'Space Grotesk',sans-serif", flexShrink: 0 }}>{inc.number}</span>
              <span style={{ color: colors.textPrimary, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {party.isInternal ? party.label : (inc.name || '—')}
                {party.detail && <span style={{ color: colors.textTertiary, fontWeight: 400 }}> · {party.detail}</span>}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, flexShrink: 0,
                color: inc.wentOnlineAt ? colors.textSecondary : colors.red,
                background: inc.wentOnlineAt ? colors.graySoft : colors.redSoft,
              }}>
                {inc.wentOnlineAt ? formatDurationLong(inc.durationSeconds) : 'Ainda offline'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 5, paddingLeft: 21, fontSize: 12, color: colors.textTertiary }}>
              <span>Caiu: {formatDateTime(inc.wentOfflineAt)}</span>
              <span>Voltou: {inc.wentOnlineAt ? formatDateTime(inc.wentOnlineAt) : '—'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
