import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import Icon, { ICONS } from './Icon.jsx';

const STATE_LABEL = {
  free: 'Livre',
  in_call: 'Em ligação',
  ringing: 'Tocando',
  offline: 'Offline',
  unknown: 'Desconhecido',
};

const DISPOSITION_LABEL = {
  ANSWERED: 'Atendida',
  'NO ANSWER': 'Não atendida',
  BUSY: 'Ocupado',
  FAILED: 'Falhou',
};

function stateColor(colors, state) {
  return { free: colors.green, in_call: colors.red, ringing: colors.primary, offline: colors.textTertiary, unknown: colors.amber }[state] || colors.textTertiary;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${s}s` : `${s}s`;
}

export default function ExtensionDetailModal({ colors, number, onClose, favorite, onToggleFavorite }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.extensionDetail(number)
      .then((data) => { if (!cancelled) setDetail(data); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Não foi possível carregar o ramal.'); });
    return () => { cancelled = true; };
  }, [number]);

  const ext = detail?.extension;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '26px 24px', boxShadow: colors.shadow, position: 'relative' }}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          style={{ position: 'absolute', top: 14, right: 14, border: 'none', background: 'transparent', color: colors.textTertiary, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
        >
          ×
        </button>

        {error && <div style={{ color: colors.red, fontSize: 13 }}>{error}</div>}

        {!error && !detail && (
          <div style={{ color: colors.textSecondary, fontSize: 13, padding: '20px 0' }}>Carregando ramal...</div>
        )}

        {ext && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 20, color: colors.textPrimary }}>{ext.number}</div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${stateColor(colors, ext.state)}22`, color: stateColor(colors, ext.state), padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700 }}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: stateColor(colors, ext.state) }} />
                {STATE_LABEL[ext.state] || 'Desconhecido'}
              </span>
              {onToggleFavorite && (
                <button
                  onClick={() => onToggleFavorite(ext.number, favorite)}
                  title={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  style={{ marginLeft: 'auto', marginRight: 20, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex' }}
                >
                  <svg width={18} height={18} viewBox="0 0 24 24" fill={favorite ? colors.amber : 'none'} stroke={favorite ? colors.amber : colors.textTertiary} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d={ICONS.starOutline[0]} />
                  </svg>
                </button>
              )}
            </div>
            <div style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 18 }}>{ext.name}</div>

            {ext.state === 'offline' && (
              <div style={{ background: colors.bgCardAlt, borderRadius: 12, padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Icon paths={ICONS.clock} size={16} color={colors.textTertiary} strokeWidth={2} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>Offline desde {formatDateTime(detail.offlineSince)}</div>
                  <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Ficou offline {detail.offlineCount7d} {detail.offlineCount7d === 1 ? 'vez' : 'vezes'} nos últimos 7 dias</div>
                </div>
              </div>
            )}
            {ext.state !== 'offline' && (
              <div style={{ fontSize: 12.5, color: colors.textTertiary, marginBottom: 16 }}>
                Ficou offline {detail.offlineCount7d} {detail.offlineCount7d === 1 ? 'vez' : 'vezes'} nos últimos 7 dias
              </div>
            )}

            <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Histórico de conexão</div>
            <div style={{ marginBottom: 18 }}>
              {detail.downtimeEvents.length === 0 && (
                <div style={{ fontSize: 13, color: colors.textTertiary }}>Sem eventos registrados ainda.</div>
              )}
              {detail.downtimeEvents.map((evt, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13, borderBottom: i < detail.downtimeEvents.length - 1 ? `1px solid ${colors.border}` : 'none' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: evt.event_type === 'went_offline' ? colors.red : colors.green, flexShrink: 0 }} />
                  <span style={{ color: colors.textPrimary }}>{evt.event_type === 'went_offline' ? 'Ficou offline' : 'Voltou online'}</span>
                  <span style={{ marginLeft: 'auto', color: colors.textTertiary, fontSize: 12 }}>{formatDateTime(evt.at)}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Chamadas de hoje</div>
            <div>
              {detail.callsToday.length === 0 && (
                <div style={{ fontSize: 13, color: colors.textTertiary }}>Nenhuma chamada hoje.</div>
              )}
              {detail.callsToday.map((call, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13, borderBottom: i < detail.callsToday.length - 1 ? `1px solid ${colors.border}` : 'none' }}>
                  <Icon paths={call.direction === 'made' ? ICONS.callOutbound : ICONS.callInbound} size={13} color={colors.textTertiary} strokeWidth={2} />
                  <span style={{ color: colors.textPrimary }}>
                    {call.direction === 'made' ? 'Ligou para ' : 'Recebeu de '}
                    <strong>{call.direction === 'made' ? call.dst : call.src}</strong>
                  </span>
                  <span style={{ color: colors.textTertiary, fontSize: 12 }}>{DISPOSITION_LABEL[call.disposition] || call.disposition}</span>
                  <span style={{ marginLeft: 'auto', color: colors.textTertiary, fontSize: 12 }}>{formatDuration(call.durationSeconds)}</span>
                  <span style={{ color: colors.textTertiary, fontSize: 12, width: 68, textAlign: 'right', flexShrink: 0 }}>{new Date(call.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
