import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import Icon, { ICONS } from './Icon.jsx';
import { buildExtensionDirectory, describeCallParty } from '../utils/extensionDirectory.js';

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function MissedCallsPanel({ colors, extensions = [] }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const directory = useMemo(() => buildExtensionDirectory(extensions), [extensions]);

  useEffect(() => {
    let cancelled = false;
    api.missedCallsToday()
      .then((res) => { if (!cancelled) setRows(res.data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Só interessa quem não atendeu dentro do condomínio (unidade/porteiro
  // conhecidos) — uma ligação perdida para uma linha externa não é
  // acionável por aqui.
  const internalRows = rows
    .map((row) => ({ ...row, party: describeCallParty(row.number, directory) }))
    .filter((row) => row.party.isInternal);

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 2 }}>Chamadas não atendidas hoje</div>
      <div style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 14 }}>Unidades e porteiros que não atenderam quando ligaram para eles</div>

      {loading && <div style={{ padding: '16px 2px', fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>Carregando...</div>}
      {!loading && internalRows.length === 0 && (
        <div style={{ padding: '16px 2px', fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>Nenhuma chamada perdida hoje. 🎉</div>
      )}
      {!loading && internalRows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${colors.border}` }}>
          {internalRows.map((row) => (
            <div key={row.number} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 2px', borderBottom: `1px solid ${colors.border}`, fontSize: 13 }}>
              <Icon paths={ICONS.warningTriangle} size={14} color={colors.amber} strokeWidth={2} />
              <span style={{ fontWeight: 700, color: colors.textPrimary, fontFamily: "'Space Grotesk',sans-serif", width: 44, flexShrink: 0 }}>{row.number}</span>
              <span style={{ color: colors.textPrimary, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.party.label}
                {row.party.detail && <span style={{ color: colors.textTertiary, fontWeight: 400 }}> · {row.party.detail}</span>}
              </span>
              <span style={{ color: colors.amber, fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{row.total}x sem resposta</span>
              <span style={{ color: colors.textTertiary, fontSize: 12, width: 48, textAlign: 'right', flexShrink: 0 }}>{formatTime(row.lastAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
