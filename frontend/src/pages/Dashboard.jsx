import { useCallback, useEffect, useRef, useState } from 'react';
import { getColors } from '../theme/colors.js';
import { api, connectLiveSocket } from '../api/client.js';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import Icon, { ICONS } from '../components/Icon.jsx';
import HeroBanner, { buildHeroBanner } from '../components/HeroBanner.jsx';
import IndicatorCards, { buildIndicatorCards } from '../components/IndicatorCards.jsx';
import ActivityChart from '../components/ActivityChart.jsx';
import ExtensionsPanel from '../components/ExtensionsPanel.jsx';
import ActiveCallsPanel from '../components/ActiveCallsPanel.jsx';
import AlertsPanel from '../components/AlertsPanel.jsx';
import ServerHealthPanel from '../components/ServerHealthPanel.jsx';
import ServerHealthTrendPanel from '../components/ServerHealthTrendPanel.jsx';
import TodaySummaryPanel from '../components/TodaySummaryPanel.jsx';
import SettingsModal from '../components/SettingsModal.jsx';
import AccountModal from '../components/AccountModal.jsx';
import ExtensionDetailModal from '../components/ExtensionDetailModal.jsx';
import CallHistoryPanel from '../components/CallHistoryPanel.jsx';
import MissedCallsPanel from '../components/MissedCallsPanel.jsx';
import FailuresReportPanel from '../components/FailuresReportPanel.jsx';
import TopUnitsPanel from '../components/TopUnitsPanel.jsx';
import CallHeatmapPanel from '../components/CallHeatmapPanel.jsx';
import MonthlyReportPanel from '../components/MonthlyReportPanel.jsx';
import MonthlyTrendPanel from '../components/MonthlyTrendPanel.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import { localDateStr } from '../utils/localDate.js';

const THEME_KEY = 'pbx_dashboard_theme';

const STATUS_PILL = {
  operational: (c) => ({ bg: c.greenSoft, fg: c.green, label: 'Operacional' }),
  degraded: (c) => ({ bg: c.amberSoft, fg: c.amber, label: 'Degradado' }),
  offline: (c) => ({ bg: c.redSoft, fg: c.red, label: 'Offline' }),
};

// Entrada escalonada das seções ao carregar a página — os valores são
// sempre os mesmos a cada render, então a re-renderização por polling não
// reinicia a animação (o navegador só reinicia quando o valor muda de fato).
function reveal(index) {
  return { animation: 'fadeInUp .5s ease both', animationDelay: `${index * 0.06}s` };
}

function firstName(displayName) {
  if (!displayName) return '';
  return displayName.trim().split(/\s+/)[0];
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Dashboard({ user, onLogout, onRefreshUser, settings, reloadSettings }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light');
  const [range, setRange] = useState('today');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshHover, setRefreshHover] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [status, setStatus] = useState(null);
  const [extensions, setExtensions] = useState([]);
  const [extSummary, setExtSummary] = useState({ configured: 0, online: 0, offline: 0 });
  const [activeCalls, setActiveCalls] = useState([]);
  const [trend, setTrend] = useState(null);
  const [todaySummary, setTodaySummary] = useState(null);
  const [previousDaySummary, setPreviousDaySummary] = useState(null);
  const [summaryDate, setSummaryDate] = useState(() => localDateStr());
  const [alerts, setAlerts] = useState([]);
  const [health, setHealth] = useState(null);
  const [extensionFilter, setExtensionFilter] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [selectedExtension, setSelectedExtension] = useState(null);

  const topRef = useRef(null);
  const extensionsSectionRef = useRef(null);
  const activeCallsSectionRef = useRef(null);
  const alertsSectionRef = useRef(null);
  const healthSectionRef = useRef(null);
  const todaySummarySectionRef = useRef(null);
  const analyticsSectionRef = useRef(null);
  const callHistorySectionRef = useRef(null);

  const colors = getColors(theme);
  const isDark = theme === 'dark';

  const scrollToSection = useCallback((ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const toggleExtensionFilter = useCallback((value) => {
    setExtensionFilter((current) => (current === value ? null : value));
    scrollToSection(extensionsSectionRef);
  }, [scrollToSection]);

  const loadAll = useCallback(async (currentRange) => {
    const [statusRes, extRes, extSumRes, callsRes, trendRes, alertsRes, healthRes, favRes] = await Promise.all([
      api.status(), api.extensions(), api.extensionsSummary(), api.activeCalls(),
      api.callsSummary(currentRange), api.alerts(), api.serverHealth(), api.favorites(),
    ]);
    setStatus(statusRes);
    setExtensions(extRes.data);
    setExtSummary(extSumRes);
    setActiveCalls(callsRes.data);
    setTrend(trendRes);
    setAlerts(alertsRes.data);
    setHealth(healthRes);
    setFavorites(favRes.data);
    setLastUpdate(new Date());
  }, []);

  // Separado do loadAll de propósito: o resumo de chamadas pode estar
  // olhando pra um dia passado (escolhido no painel), então não deve ser
  // resetado pra "hoje" a cada refresh geral do dashboard nem depender do
  // `range` do gráfico — só recarrega quando a data escolhida muda (ou no
  // polling, se a data escolhida ainda for hoje).
  const loadDaySummary = useCallback((date) => {
    const previousDate = localDateStr(new Date(new Date(`${date}T00:00:00`).getTime() - 86400000));
    return Promise.all([
      api.todaySummary(date).then(setTodaySummary),
      api.todaySummary(previousDate).then(setPreviousDaySummary).catch(() => setPreviousDaySummary(null)),
    ]).catch(() => {});
  }, []);

  const handleToggleFavorite = useCallback(async (number, isFavorite) => {
    setFavorites((current) => (isFavorite ? current.filter((n) => n !== number) : [...current, number]));
    try {
      if (isFavorite) await api.removeFavorite(number);
      else await api.addFavorite(number);
    } catch {
      setFavorites((current) => (isFavorite ? [...current, number] : current.filter((n) => n !== number)));
    }
  }, []);

  useEffect(() => {
    loadAll(range);
  }, [loadAll, range]);

  useEffect(() => {
    const interval = setInterval(() => loadAll(range), 15000);
    return () => clearInterval(interval);
  }, [loadAll, range]);

  useEffect(() => {
    loadDaySummary(summaryDate);
  }, [loadDaySummary, summaryDate]);

  useEffect(() => {
    const interval = setInterval(() => loadDaySummary(summaryDate), 15000);
    return () => clearInterval(interval);
  }, [loadDaySummary, summaryDate]);

  useEffect(() => {
    const disconnect = connectLiveSocket((msg) => {
      if (msg.type === 'calls:active') setActiveCalls(msg.payload);
      if (msg.type === 'extensions') setExtensions(msg.payload);
    });
    return disconnect;
  }, []);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadAll(range), loadDaySummary(summaryDate)]);
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  }, [loadAll, range, loadDaySummary, summaryDate]);

  if (!status || !trend || !todaySummary || !health) {
    return <LoadingScreen colors={colors} label="Carregando dashboard..." />;
  }

  const activeAlertsCount = alerts.filter((a) => a.status === 'active').length;
  const statusPill = (STATUS_PILL[status.overall] || STATUS_PILL.operational)(colors);
  const heroBanner = buildHeroBanner(colors, { extSummary, activeCallsCount: activeCalls.length, activeAlertsCount, overall: status.overall });
  const indicatorCards = buildIndicatorCards(colors, {
    extSummary, activeCallsCount: activeCalls.length, todaySummary, health, activeAlertsCount,
    onCardClick: {
      extensionsAll: () => { setExtensionFilter(null); scrollToSection(extensionsSectionRef); },
      extensionsOnline: () => toggleExtensionFilter('__online__'),
      extensionsOffline: () => toggleExtensionFilter('offline'),
      activeCalls: () => scrollToSection(activeCallsSectionRef),
      alerts: () => scrollToSection(alertsSectionRef),
      health: () => scrollToSection(healthSectionRef),
      todaySummary: () => scrollToSection(todaySummarySectionRef),
    },
  });

  const navItems = [
    { key: 'overview', label: 'Visão geral', icon: ICONS.extensionsIcon, onClick: () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
    { key: 'extensions', label: 'Ramais', icon: ICONS.extensionsTotal, onClick: () => scrollToSection(extensionsSectionRef) },
    { key: 'calls', label: 'Chamadas', icon: ICONS.phoneActive, onClick: () => scrollToSection(activeCallsSectionRef) },
    { key: 'alerts', label: 'Alertas', icon: ICONS.warningTriangle, onClick: () => scrollToSection(alertsSectionRef) },
    { key: 'health', label: 'Servidor', icon: ICONS.server, onClick: () => scrollToSection(healthSectionRef) },
    { key: 'summary', label: 'Resumo do dia', icon: ICONS.calendar, onClick: () => scrollToSection(todaySummarySectionRef) },
    { key: 'analytics', label: 'Análises', icon: ICONS.extensionsIcon, onClick: () => scrollToSection(analyticsSectionRef) },
    { key: 'history', label: 'Histórico', icon: ICONS.clock, onClick: () => scrollToSection(callHistorySectionRef) },
  ];

  return (
    <div style={{ background: colors.pageGradient, minHeight: '100vh', display: 'flex', transition: 'background .2s ease' }}>
      <Sidebar
        colors={colors}
        companyName={settings.companyName}
        pbxName={settings.pbxName}
        logoUrl={settings.logoUrl}
        statusPill={statusPill}
        navItems={navItems}
        isDark={isDark}
        onToggleTheme={() => setTheme(isDark ? 'light' : 'dark')}
        user={user}
        onLogout={onLogout}
        onOpenSettings={user?.role === 'admin' ? () => { setShowSettings(true); setSidebarOpen(false); } : undefined}
        onOpenAccount={() => { setShowAccount(true); setSidebarOpen(false); }}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div
        className={`app-sidebar-backdrop${sidebarOpen ? ' is-open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="app-main-content" style={{ flex: 1, minWidth: 0, padding: '24px 32px 64px', display: 'flex', flexDirection: 'column', gap: 20, fontFamily: "'Manrope',sans-serif" }}>

        <div className="app-mobile-topbar" style={{
          alignItems: 'center', gap: 12, background: colors.header.gradient, borderRadius: 14, padding: '12px 16px', margin: '0 0 4px',
        }}>
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
            style={{
              width: 34, height: 34, borderRadius: 9, border: `1px solid ${colors.header.glassBorder}`, background: colors.header.glassBg,
              color: colors.header.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <Icon paths={ICONS.menu} size={17} strokeWidth={2.2} />
          </button>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 650, fontSize: 15, color: colors.header.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {settings.companyName}
          </div>
        </div>

        <TopBar colors={colors} demoMode={status.demoMode} />

        <div ref={topRef} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, scrollMarginTop: 20 }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 700, color: colors.textPrimary, letterSpacing: '-0.01em' }}>
              {greeting()}, {firstName(user?.displayName) || 'tudo bem'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: colors.textSecondary, marginTop: 5 }}>
              <Icon paths={ICONS.phoneRow} size={13} color={status.connection.connected ? colors.green : colors.red} strokeWidth={2.2} />
              {status.connection.label} · Atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <button
            onClick={handleRefresh}
            onMouseEnter={() => setRefreshHover(true)}
            onMouseLeave={() => setRefreshHover(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, border: `1px solid ${colors.border}`,
              background: refreshHover ? colors.primary : colors.bgCard, color: refreshHover ? '#fff' : colors.textPrimary,
              borderRadius: 12, padding: '10px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
              transition: 'transform .15s ease, box-shadow .15s ease, background .15s ease, color .15s ease',
              transform: refreshHover ? 'translateY(-2px)' : 'none',
              boxShadow: refreshHover ? colors.shadowHover : colors.shadow,
            }}
          >
            <span style={{ display: 'inline-flex', animation: refreshing ? 'spinIcon 0.7s linear infinite' : 'none' }}>
              <Icon paths={ICONS.refresh} size={15} strokeWidth={2.4} />
            </span>
            Atualizar
          </button>
        </div>

        <HeroBanner colors={colors} banner={heroBanner} />

        <IndicatorCards colors={colors} cards={indicatorCards} />

        <div style={reveal(1)}>
          <ActivityChart colors={colors} range={range} onRangeChange={setRange} trend={trend} />
        </div>

        <div style={{ ...reveal(2), display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(380px,100%),1fr))', gap: 16, alignItems: 'start' }}>
          <div ref={extensionsSectionRef} style={{ scrollMarginTop: 20 }}>
            <ExtensionsPanel
              colors={colors}
              extensions={extensions}
              filter={extensionFilter}
              onFilterChange={toggleExtensionFilter}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              onSelectExtension={setSelectedExtension}
            />
          </div>
          <div ref={activeCallsSectionRef} style={{ scrollMarginTop: 20 }}>
            <ActiveCallsPanel colors={colors} calls={activeCalls} />
          </div>
        </div>

        <div style={{ ...reveal(3), display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(380px,100%),1fr))', gap: 16, alignItems: 'start' }}>
          <div ref={alertsSectionRef} style={{ scrollMarginTop: 20 }}>
            <AlertsPanel colors={colors} alerts={alerts} />
          </div>
          <div ref={healthSectionRef} style={{ scrollMarginTop: 20 }}>
            <ServerHealthPanel colors={colors} health={health} />
          </div>
        </div>

        <div style={{ ...reveal(4) }}>
          <ServerHealthTrendPanel colors={colors} />
        </div>

        <div ref={todaySummarySectionRef} style={{ ...reveal(5), scrollMarginTop: 20 }}>
          <TodaySummaryPanel colors={colors} summary={todaySummary} previousSummary={previousDaySummary} date={summaryDate} onDateChange={setSummaryDate} />
        </div>

        <div style={reveal(6)}>
          <MissedCallsPanel colors={colors} extensions={extensions} />
        </div>

        <div ref={analyticsSectionRef} style={{ ...reveal(7), display: 'flex', flexDirection: 'column', gap: 16, scrollMarginTop: 20 }}>
          <TopUnitsPanel colors={colors} extensions={extensions} />
          <CallHeatmapPanel colors={colors} />
          <MonthlyTrendPanel colors={colors} />
          <MonthlyReportPanel colors={colors} settings={settings} extensions={extensions} />
        </div>

        <div style={reveal(8)}>
          <FailuresReportPanel colors={colors} extensions={extensions} />
        </div>

        <div ref={callHistorySectionRef} style={{ ...reveal(9), scrollMarginTop: 20 }}>
          <CallHistoryPanel colors={colors} extensions={extensions} />
        </div>

      </div>

      {showSettings && (
        <SettingsModal
          colors={colors}
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSaved={reloadSettings}
          currentUsername={user?.username}
        />
      )}

      {showAccount && (
        <AccountModal
          colors={colors}
          user={user}
          onClose={() => setShowAccount(false)}
          onRefreshUser={onRefreshUser}
        />
      )}

      {selectedExtension && (
        <ExtensionDetailModal
          colors={colors}
          number={selectedExtension}
          favorite={favorites.includes(selectedExtension)}
          onToggleFavorite={handleToggleFavorite}
          onClose={() => setSelectedExtension(null)}
          extensions={extensions}
        />
      )}
    </div>
  );
}
