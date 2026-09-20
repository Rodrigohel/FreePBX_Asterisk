import { useMemo, useState } from 'react';
import { api } from '../api/client.js';
import Icon, { ICONS } from './Icon.jsx';
import { buildExtensionDirectory, describeCallParty } from '../utils/extensionDirectory.js';
import { generateMonthlyReportPdf } from '../utils/pdf.js';

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthRange(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  const from = `${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);
  const lastOfMonth = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
  const to = lastOfMonth > today ? today : lastOfMonth;
  return { from, to };
}

function monthLabel(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function formatDurationLong(seconds) {
  if (!seconds) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes || parts.length === 0) parts.push(`${minutes}min`);
  return parts.join(' ');
}

function answeredRatePct(summary) {
  const total = (summary.received || 0) + (summary.made || 0);
  if (total === 0) return '—';
  const answered = total - (summary.missed || 0) - (summary.failed || 0);
  return `${Math.round((answered / total) * 100)}%`;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function MonthlyReportPanel({ colors, settings, extensions = [] }) {
  const [month, setMonth] = useState(currentMonthStr());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const directory = useMemo(() => buildExtensionDirectory(extensions), [extensions]);

  function unitLabel(number) {
    const party = describeCallParty(number, directory);
    return party.isInternal ? `${party.label}${party.detail ? ` · ${party.detail}` : ''}` : number;
  }

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const { from, to } = monthRange(month);
      const [summary, topUnits, failures] = await Promise.all([
        api.periodSummary({ from, to }),
        api.topUnitsReport({ from, to, limit: 10 }),
        api.extensionFailures({ from, to }),
      ]);

      const sections = [
        {
          heading: 'Resumo geral',
          headers: ['Recebidas', 'Realizadas', 'Perdidas', 'Com falha', 'Taxa de atendimento', 'Tempo médio', 'Tempo total', 'Ramal mais usado'],
          rows: [[
            String(summary.received), String(summary.made), String(summary.missed), String(summary.failed),
            answeredRatePct(summary), `${Math.round(summary.avgDurationSeconds / 60)}min`,
            formatDurationLong(summary.totalDurationSeconds), summary.mostUsedExtension ? unitLabel(summary.mostUsedExtension) : '—',
          ]],
        },
        {
          heading: 'Unidades que mais ligaram para a portaria',
          headers: ['Unidade', 'Chamadas'],
          rows: topUnits.mostActive.map((it) => [unitLabel(it.number), String(it.total)]),
          emptyLabel: 'Nenhuma chamada no período.',
        },
        {
          heading: 'Unidades que mais deixaram de atender',
          headers: ['Unidade', 'Chamadas perdidas'],
          rows: topUnits.mostMissed.map((it) => [unitLabel(it.number), String(it.total)]),
          emptyLabel: 'Nenhuma chamada perdida no período. 🎉',
        },
        {
          heading: 'Quedas de ramal no período',
          headers: ['Ramal', 'Caiu em', 'Voltou em', 'Duração'],
          rows: failures.data.map((inc) => [
            unitLabel(inc.number), formatDateTime(inc.wentOfflineAt),
            inc.wentOnlineAt ? formatDateTime(inc.wentOnlineAt) : 'Ainda offline',
            formatDurationLong(inc.durationSeconds),
          ]),
          emptyLabel: 'Nenhuma queda registrada no período. 🎉',
        },
      ];

      generateMonthlyReportPdf({
        title: `Relatório mensal — ${settings?.companyName || ''}`.trim(),
        subtitle: `${monthLabel(month)} · ${from} a ${to}`,
        sections,
        filename: `relatorio_mensal_${month}.pdf`,
      });
    } catch (err) {
      setError(err.message || 'Não foi possível gerar o relatório.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 2 }}>Relatório mensal</div>
      <div style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 14 }}>Resumo consolidado do mês em PDF, pronto pra mandar pra administradora</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input
          type="month"
          value={month}
          max={currentMonthStr()}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, fontSize: 13, fontFamily: 'inherit', background: colors.bgCardAlt, color: colors.textPrimary }}
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: colors.primary, color: '#fff',
            borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: generating ? 'default' : 'pointer',
            opacity: generating ? 0.7 : 1,
          }}
        >
          <Icon paths={ICONS.chevronDown} size={13} strokeWidth={2.2} />
          {generating ? 'Gerando...' : 'Gerar PDF'}
        </button>
      </div>
      {error && <div style={{ color: colors.red, fontSize: 12.5, marginTop: 10 }}>{error}</div>}
    </div>
  );
}
