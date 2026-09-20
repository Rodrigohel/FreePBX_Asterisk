import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { api } from '../api/client.js';

export default function MonthlyTrendPanel({ colors }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  const [trend, setTrend] = useState(null);
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
    api.callsSummary('12m').then(setTrend).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!chartRef.current || !trend) return;
    // O container fica com display:none enquanto carrega (pra caber o
    // texto "Carregando..." sem pular layout) — sem o resize aqui, o
    // echarts mediria largura/altura 0 no init e o gráfico nasceria
    // encolhido até a próxima vez que a janela for redimensionada.
    chartRef.current.resize();
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
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 2 }}>Tendência mensal</div>
      <div style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 14 }}>Recebidas, realizadas, perdidas e falhas, mês a mês nos últimos 12 meses</div>
      {loading && !trend && (
        <div style={{ padding: '16px 2px', fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>Carregando...</div>
      )}
      <div ref={ref} style={{ width: '100%', height: 'clamp(230px,30vw,360px)', display: loading && !trend ? 'none' : 'block' }} />
    </div>
  );
}
