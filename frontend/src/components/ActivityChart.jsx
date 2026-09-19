import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

const RANGES = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
];

export default function ActivityChart({ colors, range, onRangeChange, trend }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

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
    if (!chartRef.current || !trend) return;
    const axisColor = colors.textTertiary;
    chartRef.current.setOption({
      textStyle: { fontFamily: 'Manrope, sans-serif', color: colors.textSecondary },
      color: [colors.primary, colors.green, colors.red, colors.amber],
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
      legend: { top: 0, right: 0, textStyle: { color: colors.textSecondary, fontSize: 12 }, itemWidth: 10, itemHeight: 10, icon: 'circle' },
      tooltip: { trigger: 'axis', backgroundColor: colors.bgCard, borderColor: colors.border, textStyle: { color: colors.textPrimary }, extraCssText: 'box-shadow:0 8px 24px rgba(0,0,0,0.12);border-radius:10px;' },
      xAxis: { type: 'category', data: trend.categories, axisLine: { lineStyle: { color: colors.border } }, axisLabel: { color: axisColor, fontSize: 11 }, axisTick: { show: false } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: colors.border, type: 'dashed' } }, axisLabel: { color: axisColor, fontSize: 11 } },
      series: [
        { name: 'Recebidas', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, showSymbol: false, data: trend.recebidas, areaStyle: { opacity: 0.08 }, lineStyle: { width: 3 } },
        { name: 'Realizadas', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, showSymbol: false, data: trend.realizadas, lineStyle: { width: 3 } },
        { name: 'Perdidas', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, showSymbol: false, data: trend.perdidas, lineStyle: { width: 2 } },
        { name: 'Falhas', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, showSymbol: false, data: trend.falhas, lineStyle: { width: 2, type: 'dashed' } },
      ],
      animationDuration: 500,
    }, true);
  }, [colors, trend]);

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>Atividade telefônica</div>
          <div style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }}>Recebidas, realizadas, perdidas e falhas</div>
        </div>
        <div style={{ display: 'flex', gap: 4, background: colors.bgCardAlt, padding: 4, borderRadius: 10 }}>
          {RANGES.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onRangeChange(opt.key)}
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
      <div ref={ref} style={{ width: '100%', height: 'clamp(230px,30vw,360px)' }} />
    </div>
  );
}
