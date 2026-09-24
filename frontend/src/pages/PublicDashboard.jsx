import { useCallback, useEffect, useState } from 'react';
import { getColors } from '../theme/colors.js';
import { api } from '../api/client.js';
import PublicHeader from '../components/PublicHeader.jsx';
import LoginModal from '../components/LoginModal.jsx';
import HeroBanner, { buildHeroBanner } from '../components/HeroBanner.jsx';
import IndicatorCards from '../components/IndicatorCards.jsx';
import ActivityChart from '../components/ActivityChart.jsx';
import ExtensionsPanel from '../components/ExtensionsPanel.jsx';
import ActiveCallsPanel from '../components/ActiveCallsPanel.jsx';
import AlertsPanel from '../components/AlertsPanel.jsx';
import ServerHealthPanel from '../components/ServerHealthPanel.jsx';
import TodaySummaryPanel from '../components/TodaySummaryPanel.jsx';
import { ICONS } from '../components/Icon.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';

const THEME_KEY = 'pbx_dashboard_theme';

function reveal(index) {
  return { animation: 'fadeInUp .5s ease both', animationDelay: `${index * 0.06}s` };
}

function buildPublicCards(colors, payload) {
  const cards = [];

  if (payload.extensionsSummary) {
    const s = payload.extensionsSummary;
    cards.push({ title: 'Ramais configurados', value: String(s.configured), stateColor: colors.gray, stateText: 'Total cadastrado', iconBg: colors.graySoft, iconColor: colors.gray, iconPaths: ICONS.extensionsTotal, plain: 'Quantidade de telefones cadastrados no sistema.' });
    cards.push({ title: 'Ramais online', value: String(s.online), stateColor: colors.green, stateText: 'Registrados agora', iconBg: colors.greenSoft, iconColor: colors.green, iconPaths: ICONS.check, plain: 'Telefones ligados e prontos para receber chamadas.' });
    cards.push({ title: 'Ramais offline', value: String(s.offline), stateColor: colors.red, stateText: 'Não registrados', iconBg: colors.redSoft, iconColor: colors.red, iconPaths: ICONS.offline, plain: 'Telefones desligados ou sem conexão agora.' });
  }

  if (payload.activeCallsCount !== undefined) {
    cards.push({ title: 'Chamadas em andamento', value: String(payload.activeCallsCount), stateColor: colors.primary, stateText: 'Neste momento', iconBg: colors.primarySoft, iconColor: colors.primary, iconPaths: ICONS.phoneActive, plain: 'Ligações acontecendo agora mesmo.' });
  }

  if (payload.todaySummary) {
    const t = payload.todaySummary;
    cards.push({ title: 'Chamadas hoje', value: String(t.received + t.made), stateColor: colors.gray, stateText: 'Recebidas + realizadas', iconBg: colors.graySoft, iconColor: colors.gray, iconPaths: ICONS.calendar, plain: 'Total de ligações feitas e recebidas hoje.' });
  }

  if (payload.serverHealth) {
    const h = payload.serverHealth;
    const state = h.cpuPercent >= 85 || h.memoryPercent >= 90 ? { text: 'Crítico', color: colors.red } : h.cpuPercent >= 65 || h.memoryPercent >= 75 ? { text: 'Atenção', color: colors.amber } : { text: 'Bom', color: colors.green };
    cards.push({ title: 'Saúde do servidor', value: state.text, stateColor: state.color, stateText: `CPU ${h.cpuPercent}% · RAM ${h.memoryPercent}%`, iconBg: colors.graySoft, iconColor: state.color, iconPaths: ICONS.extensionsIcon, plain: 'Como está o desempenho geral do sistema.' });
  }

  if (payload.alerts) {
    const activeCount = payload.alerts.filter((a) => a.status === 'active').length;
    cards.push({ title: 'Alertas ativos', value: String(activeCount), stateColor: activeCount > 0 ? colors.amber : colors.green, stateText: activeCount > 0 ? 'Requer atenção' : 'Tudo certo', iconBg: activeCount > 0 ? colors.amberSoft : colors.greenSoft, iconColor: activeCount > 0 ? colors.amber : colors.green, iconPaths: ICONS.warningTriangle, plain: 'Avisos que precisam de atenção.' });
  }

  return cards;
}

export default function PublicDashboard({ onLogin, onCompleteTotp, settings }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light');
  const [range, setRange] = useState('today');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [payload, setPayload] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const colors = getColors(theme);
  const isDark = theme === 'dark';

  const load = useCallback(async (currentRange) => {
    try {
      const data = await api.publicDashboard(currentRange);
      setPayload(data);
      setLastUpdate(new Date());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => { load(range); }, [load, range]);

  useEffect(() => {
    const interval = setInterval(() => load(range), 15000);
    return () => clearInterval(interval);
  }, [load, range]);

  useEffect(() => { localStorage.setItem(THEME_KEY, theme); }, [theme]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(range); } finally { setTimeout(() => setRefreshing(false), 400); }
  }, [load, range]);

  async function handleLogin(username, password) {
    const result = await onLogin(username, password);
    // Com 2FA pendente (result.requiresTotp), o modal continua aberto pra
    // pedir o código — só fecha quando o login realmente termina.
    if (!result?.requiresTotp) setShowLogin(false);
    return result;
  }

  if (loadError && !payload) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bgPage, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontFamily: "'Manrope',sans-serif", flexDirection: 'column', gap: 12 }}>
        <div>Não foi possível carregar o painel público.</div>
        <button onClick={() => setShowLogin(true)} style={{ border: 'none', background: colors.primary, color: '#fff', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Entrar</button>
        {showLogin && <LoginModal colors={colors} onLogin={handleLogin} onCompleteTotp={onCompleteTotp} onClose={() => setShowLogin(false)} logoUrl={settings.logoUrl} />}
      </div>
    );
  }

  if (!payload) {
    return <LoadingScreen colors={colors} label="Carregando painel..." />;
  }

  const cards = buildPublicCards(colors, payload);
  const heroBanner = payload.heroBanner ? buildHeroBanner(colors, payload.heroBanner) : null;

  return (
    <div style={{ background: colors.pageGradient, minHeight: '100vh', transition: 'background .2s ease' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '20px 24px 64px', display: 'flex', flexDirection: 'column', gap: 20, fontFamily: "'Manrope',sans-serif" }}>

        <PublicHeader
          colors={colors}
          companyName={settings.companyName}
          pbxName={settings.pbxName}
          logoUrl={settings.logoUrl}
          status={payload.status}
          lastUpdateLabel={lastUpdate ? lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          isDark={isDark}
          onToggleTheme={() => setTheme(isDark ? 'light' : 'dark')}
          onLoginClick={() => setShowLogin(true)}
        />

        {heroBanner && <HeroBanner colors={colors} banner={heroBanner} />}

        {cards.length > 0 && <IndicatorCards colors={colors} cards={cards} />}

        {payload.trend && (
          <div style={reveal(1)}>
            <ActivityChart colors={colors} range={range} onRangeChange={setRange} trend={payload.trend} />
          </div>
        )}

        {(payload.extensions || payload.activeCalls) && (
          <div style={{ ...reveal(2), display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(380px,100%),1fr))', gap: 16, alignItems: 'start' }}>
            {payload.extensions && <ExtensionsPanel colors={colors} extensions={payload.extensions} />}
            {payload.activeCalls && <ActiveCallsPanel colors={colors} calls={payload.activeCalls} />}
          </div>
        )}

        {(payload.alerts || payload.serverHealth) && (
          <div style={{ ...reveal(3), display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(380px,100%),1fr))', gap: 16, alignItems: 'start' }}>
            {payload.alerts && <AlertsPanel colors={colors} alerts={payload.alerts} />}
            {payload.serverHealth && <ServerHealthPanel colors={colors} health={payload.serverHealth} />}
          </div>
        )}

        {payload.todaySummary && (
          <div style={reveal(4)}>
            <TodaySummaryPanel colors={colors} summary={payload.todaySummary} />
          </div>
        )}

      </div>

      {showLogin && <LoginModal colors={colors} onLogin={handleLogin} onCompleteTotp={onCompleteTotp} onClose={() => setShowLogin(false)} logoUrl={settings.logoUrl} />}
    </div>
  );
}
