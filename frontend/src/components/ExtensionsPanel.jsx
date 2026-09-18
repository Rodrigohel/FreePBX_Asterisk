import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

const STATE_LABEL = {
  free: 'Livre',
  in_call: 'Em ligação',
  ringing: 'Tocando',
  offline: 'Offline',
  unknown: 'Desconhecido',
};

const DONUT_NAME_TO_STATE = {
  'Livres': 'free',
  'Em ligação': 'in_call',
  'Tocando': 'ringing',
  'Offline': 'offline',
  'Desconhecido': 'unknown',
};

function formatMeta(ext) {
  if (ext.state !== 'offline') return 'agora';
  if (!ext.lastActivity) return '—';
  const diffMs = Date.now() - new Date(ext.lastActivity).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m atrás`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.round(hours / 24)}d atrás`;
}

// filter: null (todos) | 'free' | 'in_call' | 'ringing' | 'offline' | 'unknown' | '__online__' (qualquer um exceto offline)
function matchesFilter(state, filter) {
  if (!filter) return true;
  if (filter === '__online__') return state !== 'offline';
  return state === filter;
}

export default function ExtensionsPanel({ colors, extensions, filter, onFilterChange }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  const onFilterChangeRef = useRef(onFilterChange);
  onFilterChangeRef.current = onFilterChange;

  useEffect(() => {
    if (!ref.current) return;
    chartRef.current = echarts.init(ref.current, null, { renderer: 'svg' });
    chartRef.current.on('click', (params) => {
      const state = DONUT_NAME_TO_STATE[params.name];
      if (state) onFilterChangeRef.current?.(state);
    });
    const resize = () => chartRef.current && chartRef.current.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      chartRef.current && chartRef.current.dispose();
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    const counts = { free: 0, in_call: 0, ringing: 0, offline: 0, unknown: 0 };
    for (const ext of extensions) counts[ext.state in counts ? ext.state : 'unknown'] += 1;

    const donutData = [
      { value: counts.free, name: 'Livres', itemStyle: { color: colors.green, opacity: filter && filter !== 'free' ? 0.35 : 1 } },
      { value: counts.in_call, name: 'Em ligação', itemStyle: { color: colors.red, opacity: filter && filter !== 'in_call' ? 0.35 : 1 } },
      { value: counts.ringing, name: 'Tocando', itemStyle: { color: colors.primary, opacity: filter && filter !== 'ringing' ? 0.35 : 1 } },
      { value: counts.offline, name: 'Offline', itemStyle: { color: colors.textTertiary, opacity: filter && filter !== 'offline' ? 0.35 : 1 } },
      { value: counts.unknown, name: 'Desconhecido', itemStyle: { color: colors.amber, opacity: filter && filter !== 'unknown' ? 0.35 : 1 } },
    ];
    const total = extensions.length;

    chartRef.current.setOption({
      textStyle: { fontFamily: 'Manrope, sans-serif' },
      tooltip: { trigger: 'item', backgroundColor: colors.bgCard, borderColor: colors.border, textStyle: { color: colors.textPrimary } },
      series: [{
        type: 'pie', radius: ['62%', '85%'], center: ['50%', '50%'],
        label: { show: false }, labelLine: { show: false },
        data: donutData,
        emphasis: { scaleSize: 6 },
        cursor: 'pointer',
      }],
      graphic: [
        { type: 'text', left: 'center', top: '42%', style: { text: String(total), fontSize: 26, fontWeight: 700, fill: colors.textPrimary, fontFamily: 'Space Grotesk, sans-serif' } },
        { type: 'text', left: 'center', top: '58%', style: { text: 'ramais', fontSize: 12, fill: colors.textSecondary } },
      ],
      animationDuration: 500,
    }, true);
  }, [colors, extensions, filter]);

  const stateColor = (state) => ({ free: colors.green, in_call: colors.red, ringing: colors.primary, offline: colors.textTertiary, unknown: colors.amber }[state] || colors.textTertiary);

  const filteredExtensions = extensions.filter((ext) => matchesFilter(ext.state, filter));
  const filterLabel = filter === '__online__' ? 'Online' : STATE_LABEL[filter];

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>Estado dos ramais</div>
        {filter && (
          <button
            onClick={() => onFilterChange?.(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: colors.primarySoft, color: colors.primary, borderRadius: 99, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            {filterLabel} ×
          </button>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 10 }}>Clique numa fatia do gráfico para filtrar</div>
      <div ref={ref} style={{ width: '100%', height: 220 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 8, borderTop: `1px solid ${colors.border}`, maxHeight: 260, overflowY: 'auto' }}>
        {filteredExtensions.length === 0 && (
          <div style={{ padding: '16px 2px', fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>Nenhum ramal nesse estado.</div>
        )}
        {filteredExtensions.map((ext) => (
          <div key={ext.number} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 2px', borderBottom: `1px solid ${colors.border}`, fontSize: 13 }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: stateColor(ext.state), flexShrink: 0 }} />
            <span style={{ fontWeight: 700, color: colors.textPrimary, fontFamily: "'Space Grotesk',sans-serif", width: 44, flexShrink: 0 }}>{ext.number}</span>
            <span style={{ color: colors.textPrimary, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ext.name}</span>
            <span style={{ color: stateColor(ext.state), fontWeight: 600, fontSize: 12 }}>{STATE_LABEL[ext.state] || 'Desconhecido'}</span>
            <span style={{ color: colors.textTertiary, fontSize: 12, width: 56, textAlign: 'right', flexShrink: 0 }}>{formatMeta(ext)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
