import Icon, { ICONS } from './Icon.jsx';

function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function ActiveCallsPanel({ colors, calls }) {
  const hasCalls = calls.length > 0;

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>Chamadas em andamento</div>
        <span style={{ fontSize: 12, fontWeight: 700, color: colors.primary, background: colors.primarySoft, padding: '3px 9px', borderRadius: 99 }}>{calls.length}</span>
      </div>
      <div style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 12 }}>Atualização em tempo real</div>

      {hasCalls ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
          {calls.map((call, i) => {
            const inbound = call.direction === 'inbound';
            const dirColor = inbound ? colors.primary : colors.green;
            const dirBg = inbound ? colors.primarySoft : colors.greenSoft;
            const stateLabel = call.state === 'ringing' ? 'Tocando' : 'Em andamento';
            const stateColor = call.state === 'ringing' ? colors.primary : colors.green;
            return (
              <div key={`${call.ext}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, background: colors.bgCardAlt, border: `1px solid ${colors.border}` }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: dirBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon paths={inbound ? ICONS.callInbound : ICONS.callOutbound} size={14} color={dirColor} strokeWidth={2.3} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>{call.ext} · {call.name}</div>
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{call.destination}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: stateColor }}>{stateLabel}</div>
                  <div style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 1, fontFamily: "'Space Grotesk',sans-serif" }}>{formatDuration(call.durationSeconds)}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '30px 10px' }}>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
            <Icon paths={ICONS.noCall} size={30} color={colors.textTertiary} strokeWidth={1.6} />
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: colors.textPrimary }}>Nenhuma chamada em andamento</div>
          <div style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }}>O sistema está livre neste momento.</div>
        </div>
      )}
    </div>
  );
}
