import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import Icon, { ICONS } from './Icon.jsx';
import { buildExtensionDirectory, describeCallParty } from '../utils/extensionDirectory.js';
import { toMultiSectionCsv, downloadCsv } from '../utils/csv.js';
import { localDateStr, daysAgoLocalStr } from '../utils/localDate.js';

function todayIso() {
  return localDateStr();
}

function daysAgoIso(days) {
  return daysAgoLocalStr(days);
}

function RankList({ colors, title, icon, iconColor, items, directory, emptyLabel }) {
  const max = Math.max(1, ...items.map((it) => it.total));
  return (
    <div style={{ flex: '1 1 260px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon paths={icon} size={15} color={iconColor} strokeWidth={2.2} />
        <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>{title}</div>
      </div>
      {items.length === 0 && (
        <div style={{ fontSize: 12.5, color: colors.textSecondary, padding: '8px 0' }}>{emptyLabel}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {items.map((item, i) => {
          const party = describeCallParty(item.number, directory);
          return (
            <div key={item.number} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 20, height: 20, borderRadius: 6, background: colors.graySoft, color: colors.textSecondary,
                fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5 }}>
                  <span style={{ color: colors.textPrimary, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {party.isInternal ? party.label : item.number}
                    {party.detail && <span style={{ color: colors.textTertiary, fontWeight: 400 }}> · {party.detail}</span>}
                  </span>
                  <span style={{ color: colors.textSecondary, fontWeight: 700, flexShrink: 0 }}>{item.total}</span>
                </div>
                <div style={{ height: 5, borderRadius: 99, background: colors.graySoft, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(item.total / max) * 100}%`, background: iconColor, borderRadius: 99 }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TopUnitsPanel({ colors, extensions = [] }) {
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [report, setReport] = useState({ mostActive: [], mostMissed: [] });
  const [loading, setLoading] = useState(false);

  const directory = useMemo(() => buildExtensionDirectory(extensions), [extensions]);

  function unitLabel(number) {
    const party = describeCallParty(number, directory);
    return party.isInternal ? `${party.label}${party.detail ? ` · ${party.detail}` : ''} (${number})` : number;
  }

  function handleExportCsv() {
    const csv = toMultiSectionCsv([
      {
        heading: 'Mais ligaram para a portaria',
        headers: ['Unidade', 'Chamadas'],
        rows: report.mostActive.map((it) => [unitLabel(it.number), String(it.total)]),
        emptyLabel: 'Nenhuma chamada nesse período.',
      },
      {
        heading: 'Mais deixaram de atender',
        headers: ['Unidade', 'Chamadas perdidas'],
        rows: report.mostMissed.map((it) => [unitLabel(it.number), String(it.total)]),
        emptyLabel: 'Nenhuma chamada perdida nesse período.',
      },
    ]);
    downloadCsv(`ranking_unidades_${from}_a_${to}.csv`, csv);
  }

  async function search() {
    setLoading(true);
    try {
      const res = await api.topUnitsReport({ from, to });
      setReport(res);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { search(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function handleSubmit(e) {
    e.preventDefault();
    search();
  }

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 2 }}>Ranking de unidades</div>
      <div style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 14 }}>Quem mais liga pra portaria e quem mais deixa de atender, num período</div>

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
          disabled={loading || (report.mostActive.length === 0 && report.mostMissed.length === 0)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', border: `1px solid ${colors.border}`,
            background: colors.bgCardAlt, color: colors.textPrimary, borderRadius: 10, padding: '7px 14px', fontSize: 12.5, fontWeight: 600,
            cursor: 'pointer', opacity: loading || (report.mostActive.length === 0 && report.mostMissed.length === 0) ? 0.5 : 1,
          }}
        >
          <Icon paths={ICONS.chevronDown} size={13} strokeWidth={2.2} />
          Exportar CSV
        </button>
      </form>

      {loading ? (
        <div style={{ padding: '16px 2px', fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>Buscando...</div>
      ) : (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <RankList
            colors={colors} title="Mais ligaram para a portaria" icon={ICONS.phoneActive} iconColor={colors.primary}
            items={report.mostActive} directory={directory} emptyLabel="Nenhuma chamada nesse período."
          />
          <RankList
            colors={colors} title="Mais deixaram de atender" icon={ICONS.noCall} iconColor={colors.red}
            items={report.mostMissed} directory={directory} emptyLabel="Nenhuma chamada perdida nesse período. 🎉"
          />
        </div>
      )}
    </div>
  );
}
