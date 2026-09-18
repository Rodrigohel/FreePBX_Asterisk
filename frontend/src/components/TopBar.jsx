export default function TopBar({ colors, demoMode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: colors.textTertiary, letterSpacing: '.02em' }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: demoMode ? colors.amber : colors.green }} />
      {demoMode ? 'Modo demonstração — dados simulados' : 'Conectado ao Asterisk — dados em tempo real'}
    </div>
  );
}
