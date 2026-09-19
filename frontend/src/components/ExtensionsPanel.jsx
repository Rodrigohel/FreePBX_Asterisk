import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { ICONS } from './Icon.jsx';
import { classifyExtension, GROUP_LABELS } from '../utils/extensionDirectory.js';

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

function offlineDurationMs(ext) {
  if (ext.state !== 'offline') return null;
  if (!ext.lastActivity) return Infinity;
  return Date.now() - new Date(ext.lastActivity).getTime();
}

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

function exactOfflineSince(ext) {
  if (ext.state !== 'offline' || !ext.lastActivity) return undefined;
  return `Offline desde ${new Date(ext.lastActivity).toLocaleString('pt-BR')}`;
}

function compareOfflineFirst(a, b) {
  const aOff = a.state === 'offline';
  const bOff = b.state === 'offline';
  if (aOff !== bOff) return aOff ? -1 : 1;
  if (aOff && bOff) return (offlineDurationMs(b) || 0) - (offlineDurationMs(a) || 0);
  return a.number.localeCompare(b.number, undefined, { numeric: true });
}

// filter: null (todos) | 'free' | 'in_call' | 'ringing' | 'offline' | 'unknown' | '__online__' (qualquer um exceto offline)
function matchesFilter(state, filter) {
  if (!filter) return true;
  if (filter === '__online__') return state !== 'offline';
  return state === filter;
}

function StarButton({ colors, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={active ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      style={{ border: 'none', background: 'transparent', padding: 2, cursor: 'pointer', display: 'flex', flexShrink: 0 }}
    >
      <svg width={14} height={14} viewBox="0 0 24 24" fill={active ? colors.amber : 'none'} stroke={active ? colors.amber : colors.textTertiary} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d={ICONS.starOutline[0]} />
      </svg>
    </button>
  );
}

export default function ExtensionsPanel({ colors, extensions, filter, onFilterChange, favorites = [], onToggleFavorite, onSelectExtension }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  const onFilterChangeRef = useRef(onFilterChange);
  onFilterChangeRef.current = onFilterChange;
  const [search, setSearch] = useState('');
  const [groupMode, setGroupMode] = useState('tower');

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

  const searchTerm = search.trim().toLowerCase();
  const favSet = new Set(favorites);

  const visibleExtensions = extensions
    .filter((ext) => matchesFilter(ext.state, filter))
    .filter((ext) => !searchTerm || ext.number.includes(searchTerm) || (ext.name || '').toLowerCase().includes(searchTerm));

  const filterLabel = filter === '__online__' ? 'Online' : STATE_LABEL[filter];

  function renderRow(ext) {
    const { unitLabel } = classifyExtension(ext);
    return (
      <div
        key={ext.number}
        onClick={() => onSelectExtension?.(ext.number)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 2px', borderBottom: `1px solid ${colors.border}`, fontSize: 13, cursor: onSelectExtension ? 'pointer' : 'default' }}
      >
        {onToggleFavorite && (
          <StarButton colors={colors} active={favSet.has(ext.number)} onClick={(e) => { e.stopPropagation(); onToggleFavorite(ext.number, favSet.has(ext.number)); }} />
        )}
        <span style={{ width: 7, height: 7, borderRadius: 99, background: stateColor(ext.state), flexShrink: 0 }} />
        <span style={{ fontWeight: 700, color: colors.textPrimary, fontFamily: "'Space Grotesk',sans-serif", width: 40, flexShrink: 0 }}>{ext.number}</span>
        <span style={{ color: colors.textPrimary, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ext.name}
          {unitLabel && <span style={{ color: colors.textTertiary, fontWeight: 400 }}> · {unitLabel}</span>}
        </span>
        <span style={{ color: stateColor(ext.state), fontWeight: 600, fontSize: 12 }}>{STATE_LABEL[ext.state] || 'Desconhecido'}</span>
        <span title={exactOfflineSince(ext)} style={{ color: colors.textTertiary, fontSize: 12, width: 56, textAlign: 'right', flexShrink: 0 }}>{formatMeta(ext)}</span>
      </div>
    );
  }

  function renderSection(label, list) {
    if (list.length === 0) return null;
    return (
      <div key={label}>
        <div style={{ padding: '10px 2px 4px', fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textTertiary }}>
          {label} · {list.length}
        </div>
        {list.map(renderRow)}
      </div>
    );
  }

  let listContent;
  if (visibleExtensions.length === 0) {
    listContent = <div style={{ padding: '16px 2px', fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>Nenhum ramal encontrado.</div>;
  } else if (groupMode === 'offline') {
    listContent = [...visibleExtensions].sort(compareOfflineFirst).map(renderRow);
  } else {
    const favoriteExts = visibleExtensions.filter((e) => favSet.has(e.number)).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    const rest = visibleExtensions.filter((e) => !favSet.has(e.number));
    const grouped = { torreA: [], blocoB: [], common: [], other: [] };
    rest.forEach((ext) => grouped[classifyExtension(ext).key].push(ext));
    Object.values(grouped).forEach((list) => list.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })));

    listContent = [
      renderSection('Favoritos', favoriteExts),
      renderSection(GROUP_LABELS.torreA, grouped.torreA),
      renderSection(GROUP_LABELS.blocoB, grouped.blocoB),
      renderSection(GROUP_LABELS.common, grouped.common),
      renderSection(GROUP_LABELS.other, grouped.other),
    ];
  }

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

      <div style={{ display: 'flex', gap: 8, marginTop: 4, marginBottom: 4 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por ramal ou nome..."
          style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, fontSize: 13, fontFamily: 'inherit', background: colors.bgCardAlt, color: colors.textPrimary }}
        />
        <div style={{ display: 'flex', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
          <button
            onClick={() => setGroupMode('tower')}
            title="Agrupar por Torre/Bloco"
            style={{ border: 'none', padding: '0 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: groupMode === 'tower' ? colors.primary : colors.bgCardAlt, color: groupMode === 'tower' ? '#fff' : colors.textSecondary }}
          >
            Torre/Bloco
          </button>
          <button
            onClick={() => setGroupMode('offline')}
            title="Ordenar por tempo offline"
            style={{ border: 'none', padding: '0 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: groupMode === 'offline' ? colors.primary : colors.bgCardAlt, color: groupMode === 'offline' ? '#fff' : colors.textSecondary }}
          >
            Offline há mais tempo
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 4, borderTop: `1px solid ${colors.border}`, maxHeight: 320, overflowY: 'auto' }}>
        {listContent}
      </div>
    </div>
  );
}
