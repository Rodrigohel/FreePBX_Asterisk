import Icon from './Icon.jsx';

const LOGO_URL = import.meta.env.VITE_LOGO_URL || '';

// Mostra o logo customizado (VITE_LOGO_URL) quando configurado; caso
// contrário, cai no ícone padrão do painel.
export default function Logo({ colors, size = 44 }) {
  if (LOGO_URL) {
    return (
      <img
        src={LOGO_URL}
        alt="Logo"
        style={{ width: size, height: size, borderRadius: 12, objectFit: 'contain', background: colors.primarySoft, flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 12, background: colors.primarySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon paths={['M2 3h20v8H2z', 'M2 13h20v8H2z', 'M6 7h.01', 'M6 17h.01']} size={Math.round(size / 2)} color={colors.primary} strokeWidth={2} />
    </div>
  );
}
