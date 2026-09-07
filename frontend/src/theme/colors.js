// Paleta idêntica à do design de referência (design/Dashboard.dc.html, método getColors()).
// Não alterar valores aqui sem atualizar também o protótipo de design.
export function getColors(theme) {
  const dark = theme === 'dark';
  return {
    bgPage: dark ? '#0F172A' : '#F6F8FB',
    bgCard: dark ? '#1A2436' : '#FFFFFF',
    bgCardAlt: dark ? '#141D2C' : '#F8FAFC',
    border: dark ? '#243046' : '#E2E8F0',
    textPrimary: dark ? '#F1F5F9' : '#0F172A',
    textSecondary: dark ? '#94A3B8' : '#64748B',
    textTertiary: dark ? '#64748B' : '#94A3B8',
    shadow: dark
      ? '0 1px 2px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.35)'
      : '0 1px 2px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.05)',
    primary: '#2563EB',
    primarySoft: dark ? 'rgba(37,99,235,0.18)' : '#DBEAFE',
    green: '#16A34A',
    greenSoft: dark ? 'rgba(22,163,74,0.18)' : '#DCFCE7',
    amber: '#F59E0B',
    amberSoft: dark ? 'rgba(245,158,11,0.18)' : '#FEF3C7',
    red: '#DC2626',
    redSoft: dark ? 'rgba(220,38,38,0.18)' : '#FEE2E2',
    gray: '#334155',
    graySoft: dark ? 'rgba(100,116,139,0.18)' : '#F1F5F9',
  };
}
