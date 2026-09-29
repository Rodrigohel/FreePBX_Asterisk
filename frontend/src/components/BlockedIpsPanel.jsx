import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import Icon, { ICONS } from './Icon.jsx';

const POLL_MS = 30000;

function JailSection({ colors, jail, onUnban, busyKey }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: colors.textPrimary }}>{jail.jail}</span>
        <span style={{
          fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
          color: jail.bannedCount > 0 ? colors.red : colors.textTertiary,
          background: jail.bannedCount > 0 ? colors.redSoft : colors.graySoft,
        }}>
          {jail.bannedCount} {jail.bannedCount === 1 ? 'banido' : 'banidos'}
        </span>
      </div>
      {jail.ips.length === 0 ? (
        <div style={{ fontSize: 12.5, color: colors.textTertiary }}>Nenhum IP banido nesse jail agora.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {jail.ips.map((ip) => {
            const key = `${jail.jail}:${ip}`;
            return (
              <div key={ip} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 9, background: colors.bgCardAlt, border: `1px solid ${colors.border}` }}>
                <Icon paths={ICONS.offline} size={14} color={colors.red} strokeWidth={2.2} />
                <span style={{ fontFamily: 'monospace', fontSize: 12.5, color: colors.textPrimary, flex: 1, minWidth: 0 }}>{ip}</span>
                <button
                  type="button"
                  onClick={() => onUnban(jail.jail, ip)}
                  disabled={busyKey === key}
                  style={{ border: 'none', background: 'transparent', color: colors.primary, fontSize: 12, fontWeight: 700, cursor: busyKey === key ? 'default' : 'pointer', opacity: busyKey === key ? 0.5 : 1 }}
                >
                  {busyKey === key ? 'Desbanindo...' : 'Desbanir'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BlockedIpsPanel({ colors }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [actionError, setActionError] = useState('');

  const load = useCallback(() => {
    return api.blockedIps().then(setData).catch((err) => setError(err.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  async function handleUnban(jail, ip) {
    if (!window.confirm(`Desbanir ${ip} do jail "${jail}"?`)) return;
    setActionError('');
    setBusyKey(`${jail}:${ip}`);
    try {
      await api.unbanIp(jail, ip);
      await load();
    } catch (err) {
      setActionError(err.message || 'Não foi possível desbanir esse IP.');
    } finally {
      setBusyKey('');
    }
  }

  const fail2ban = data?.fail2ban;
  const firewall = data?.firewall;

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Icon paths={ICONS.shield} size={16} color={colors.textPrimary} strokeWidth={2} />
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>Bloqueios de segurança</div>
      </div>
      <div style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 16 }}>
        IPs banidos automaticamente pelo fail2ban e regras manuais de firewall.
      </div>

      {error && <div style={{ color: colors.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {!data && !error && <div style={{ fontSize: 13, color: colors.textSecondary }}>Carregando...</div>}

      {fail2ban && (
        <>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textTertiary, marginBottom: 10 }}>
            fail2ban
          </div>
          {!fail2ban.available ? (
            <div style={{ fontSize: 12.5, color: colors.textTertiary, marginBottom: 16 }}>
              Não disponível — {fail2ban.error || 'confira a permissão de sudo do backend (ver README).'}
            </div>
          ) : fail2ban.jails.length === 0 ? (
            <div style={{ fontSize: 12.5, color: colors.textTertiary, marginBottom: 16 }}>Nenhuma jail configurada no fail2ban.</div>
          ) : (
            fail2ban.jails.map((jail) => (
              <JailSection key={jail.jail} colors={colors} jail={jail} onUnban={handleUnban} busyKey={busyKey} />
            ))
          )}
          {actionError && <div style={{ color: colors.red, fontSize: 12.5, marginBottom: 12 }}>{actionError}</div>}
        </>
      )}

      {firewall && (
        <>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textTertiary, margin: '4px 0 10px' }}>
            Firewall (regras manuais)
          </div>
          {!firewall.available ? (
            <div style={{ fontSize: 12.5, color: colors.textTertiary }}>
              Não disponível — {firewall.error || 'confira a permissão de sudo do backend (ver README).'}
            </div>
          ) : firewall.rules.length === 0 ? (
            <div style={{ fontSize: 12.5, color: colors.textTertiary }}>Nenhuma regra manual de bloqueio encontrada.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {firewall.rules.map((rule) => (
                <div key={rule.raw} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 9, background: colors.bgCardAlt, border: `1px solid ${colors.border}` }}>
                  <Icon paths={ICONS.offline} size={14} color={colors.textTertiary} strokeWidth={2.2} />
                  <span style={{ fontFamily: 'monospace', fontSize: 12.5, color: colors.textPrimary, flex: 1, minWidth: 0 }}>{rule.ip}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: colors.textTertiary }}>{rule.target}</span>
                </div>
              ))}
              <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>
                Regras manuais só são listadas aqui — remova ou ajuste direto no servidor.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
