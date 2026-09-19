import { useCallback, useEffect, useRef, useState } from 'react';
import { getColors } from '../theme/colors.js';
import { api, connectLiveSocket } from '../api/client.js';
import Header from '../components/Header.jsx';
import TopBar from '../components/TopBar.jsx';
import HeroBanner, { buildHeroBanner } from '../components/HeroBanner.jsx';
import IndicatorCards, { buildIndicatorCards } from '../components/IndicatorCards.jsx';
import ActivityChart from '../components/ActivityChart.jsx';
import ExtensionsPanel from '../components/ExtensionsPanel.jsx';
import ActiveCallsPanel from '../components/ActiveCallsPanel.jsx';
import AlertsPanel from '../components/AlertsPanel.jsx';
import ServerHealthPanel from '../components/ServerHealthPanel.jsx';
import TodaySummaryPanel from '../components/TodaySummaryPanel.jsx';
import SettingsModal from '../components/SettingsModal.jsx';
import ExtensionDetailModal from '../components/ExtensionDetailModal.jsx';
import CallHistoryPanel from '../components/CallHistoryPanel.jsx';
import MissedCallsPanel from '../components/MissedCallsPanel.jsx';

const THEME_KEY = 'pbx_dashboard_theme';

const STATUS_PILL = {
  operational: (c) => ({ bg: c.greenSoft, fg: c.green, label: 'Operacional' }),
  degraded: (c) => ({ bg: c.amberSoft, fg: c.amber, label: 'Degradado' }),
  offline: (c) => ({ bg: c.redSoft, fg: c.red, label: 'Offline' }),
};

export default function Dashboard({ user, onLogout, settings, reloadSettings }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light');
  const [range, setRange] = useState('today');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);

  const [status, setStatus] = useState(null);
  const [extensions, setExtensions] = useState([]);
  const [extSummary, setExtSummary] = useState({ configured: 0, online: 0, offline: 0 });
  const [activeCalls, setActiveCalls] = useState([]);
  const [trend, setTrend] = useState(null);
  const [todaySummary, setTodaySummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [health, setHealth] = useState(null);
  const [extensionFilter, setExtensionFilter] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [selectedExtension, setSelectedExtension] = useState(null);

  const extensionsSectionRef = useRef(null);
  const activeCallsSectionRef = useRef(null);
  const alertsSectionRef = useRef(null);
  const healthSectionRef = useRef(null);
  const todaySummarySectionRef = useRef(null);

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
    const [statusRes, extRes, extSumRes, callsRes, trendRes, todayRes, alertsRes, healthRes, favRes] = await Promise.all([
      api.status(), api.extensions(), api.extensionsSummary(), api.activeCalls(),
      api.callsSummary(currentRange), api.todaySummary(), api.alerts(), api.serverHealth(), api.favorites(),
    ]);
    setStatus(statusRes);
    setExtensions(extRes.data);
    setExtSummary(extSumRes);
    setActiveCalls(callsRes.data);
    setTrend(trendRes);
    setTodaySummary(todayRes);
    setAlerts(alertsRes.data);
    setHealth(healthRes);
    setFavorites(favRes.data);
    setLastUpdate(new Date());
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
      await loadAll(range);
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  }, [loadAll, range]);

  if (!status || !trend || !todaySummary || !health) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bgPage, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontFamily: "'Manrope',sans-serif" }}>
        Carregando dashboard...
      </div>
    );
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

  return (
    <div style={{ background: colors.bgPage, minHeight: '100vh', transition: 'background .2s ease' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '20px 24px 64px', display: 'flex', flexDirection: 'column', gap: 20, fontFamily: "'Manrope',sans-serif" }}>

        <TopBar colors={colors} demoMode={status.demoMode} />

        <Header
          colors={colors}
          companyName={settings.companyName}
          pbxName={settings.pbxName}
          logoUrl={settings.logoUrl}
          statusPill={statusPill}
          connectionInfo={{ color: status.connection.connected ? colors.green : colors.red, label: status.connection.label }}
          lastUpdateLabel={lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          isDark={isDark}
          onToggleTheme={() => setTheme(isDark ? 'light' : 'dark')}
          user={user}
          onLogout={onLogout}
          onOpenSettings={() => setShowSettings(true)}
        />

        <HeroBanner colors={colors} banner={heroBanner} />

        <IndicatorCards colors={colors} cards={indicatorCards} />

        <ActivityChart colors={colors} range={range} onRangeChange={setRange} trend={trend} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(380px,100%),1fr))', gap: 16, alignItems: 'start' }}>
          <div ref={extensionsSectionRef}>
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
          <div ref={activeCallsSectionRef}>
            <ActiveCallsPanel colors={colors} calls={activeCalls} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(380px,100%),1fr))', gap: 16, alignItems: 'start' }}>
          <div ref={alertsSectionRef}>
            <AlertsPanel colors={colors} alerts={alerts} />
          </div>
          <div ref={healthSectionRef}>
            <ServerHealthPanel colors={colors} health={health} />
          </div>
        </div>

        <div ref={todaySummarySectionRef}>
          <TodaySummaryPanel colors={colors} summary={todaySummary} />
        </div>

        <MissedCallsPanel colors={colors} extensions={extensions} />

        <CallHistoryPanel colors={colors} extensions={extensions} />

      </div>

      {showSettings && (
        <SettingsModal
          colors={colors}
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSaved={reloadSettings}
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
