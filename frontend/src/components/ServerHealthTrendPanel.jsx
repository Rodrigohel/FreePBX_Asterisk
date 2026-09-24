import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { api } from '../api/client.js';

const RANGES = [
  { key: 24, label: '24h' },
  { key: 168, label: '7 dias' },
];

function formatLabel(iso, rangeHours) {
  const d = new Date(iso);
  if (rangeHours <= 24) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit' });
}

export default function ServerHealthTrendPanel({ colors }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  const [range, setRange] = useState(24);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ref.current) return;
    chartRef.current = echarts.init(ref.current, null, { renderer: 'svg' });
    const resize = () => chartRef.current && chartRef.current.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      chartRef.current && chartRef.current.dispose();
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    api.serverHealthHistory({ hours: range }).then((res) => setHistory(res.data)).finally(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    if (!chartRef.current || !history) return;
    chartRef.current.resize();
    const axisColor = colors.textTertiary;
    const categories = history.map((p) => formatLabel(p.at, range));
    chartRef.current.setOption({
      textStyle: { fontFamily: 'Manrope, sans-serif', color: colors.textSecondary },
      color: [colors.primary, colors.amber, colors.green],
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
      legend: { top: 0, right: 0, textStyle: { color: colors.textSecondary, fontSize: 12 }, itemWidth: 10, itemHeight: 10, icon: 'circle' },
      tooltip: { trigger: 'axis', backgroundColor: colors.bgCard, borderColor: colors.border, textStyle: { color: colors.textPrimary }, extraCssText: 'box-shadow:0 8px 24px rgba(0,0,0,0.12);border-radius:10px;' },
      xAxis: { type: 'category', data: categories, axisLine: { lineStyle: { color: colors.border } }, axisLabel: { color: axisColor, fontSize: 11 }, axisTick: { show: false } },
      yAxis: { type: 'value', max: 100, splitLine: { lineStyle: { color: colors.border, type: 'dashed' } }, axisLabel: { color: axisColor, fontSize: 11, formatter: '{value}%' } },
      series: [
        { name: 'CPU', type: 'line', smooth: true, showSymbol: false, data: history.map((p) => p.cpuPercent), areaStyle: { opacity: 0.08 }, lineStyle: { width: 3 } },
        { name: 'Memória', type: 'line', smooth: true, showSymbol: false, data: history.map((p) => p.memoryPercent), lineStyle: { width: 2 } },
        { name: 'Disco', type: 'line', smooth: true, showSymbol: false, data: history.map((p) => p.diskPercent), lineStyle: { width: 2, type: 'dashed' } },
      ],
      animationDuration: 500,
    }, true);
  }, [colors, history, range]);

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>Tendência de saúde do servidor</div>
          <div style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }}>CPU, memória e disco ao longo do tempo</div>
        </div>
        <div style={{ display: 'flex', gap: 4, background: colors.bgCardAlt, padding: 4, borderRadius: 10 }}>
          {RANGES.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              style={{
                border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                background: range === opt.key ? colors.bgCard : 'transparent',
                color: range === opt.key ? colors.primary : colors.textSecondary,
                boxShadow: range === opt.key ? colors.shadow : 'none',
                transition: 'background .2s ease, color .2s ease, box-shadow .2s ease',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {!loading && history && history.length === 0 && (
        <div style={{ padding: '16px 2px', fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>
          Ainda não tem amostras suficientes — volte daqui a alguns minutos.
        </div>
      )}
      <div ref={ref} style={{ width: '100%', height: 'clamp(230px,30vw,360px)', display: !history || history.length === 0 ? 'none' : 'block' }} />
    </div>
  );
}
