import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api/client.js';
import Icon, { ICONS } from './Icon.jsx';
import Logo from './Logo.jsx';
import { toCsv, downloadCsv } from '../utils/csv.js';

const inputStyle = (colors) => ({
  width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`,
  marginBottom: 14, fontSize: 14, fontFamily: 'inherit', background: colors.bgCardAlt, color: colors.textPrimary,
});
const labelStyle = (colors) => ({ display: 'block', fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 });
const sectionTitleStyle = (colors) => ({ fontSize: 12.5, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, margin: '18px 0 10px' });

const AUDIT_ACTION_LABELS = {
  'auth.login': 'Fez login',
  'auth.lockout': 'Conta bloqueada temporariamente (muitas tentativas erradas)',
  '2fa.enabled': 'Ativou verificação em duas etapas',
  '2fa.disabled': 'Desativou verificação em duas etapas',
  'settings.update': 'Atualizou configurações',
  'settings.logo_upload': 'Trocou o logo',
  'user.create': 'Criou usuário',
  'user.delete': 'Removeu usuário',
};

function auditActionLabel(action) {
  return AUDIT_ACTION_LABELS[action] || action;
}

function formatAuditDate(iso) {
  if (!iso) return '—';
  // A coluna `at` do SQLite vem em UTC sem sufixo de fuso (datetime('now'));
  // sem o "Z", o navegador interpretaria como hora local e mostraria a
  // ação horas adiantada/atrasada.
  return new Date(`${iso.replace(' ', 'T')}Z`).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

const TABS = [
  { key: 'general', label: 'Geral' },
  { key: 'alerts', label: 'Alertas' },
  { key: 'notifications', label: 'Notificações' },
  { key: 'users', label: 'Usuários' },
  { key: 'security', label: 'Segurança' },
  { key: 'audit', label: 'Auditoria' },
];

function TabButton({ colors, active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none', borderBottom: active ? `2px solid ${colors.primary}` : '2px solid transparent',
        background: 'transparent', color: active ? colors.primary : colors.textSecondary,
        padding: '8px 4px', marginRight: 18, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function GeneralTab({
  colors, companyName, setCompanyName, pbxName, setPbxName, logoUrl, uploading, fileInputRef, handleFileChange,
  porteiroExtensions, setPorteiroExtensions,
}) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <Logo colors={colors} logoUrl={logoUrl} size={56} />
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ border: `1px solid ${colors.border}`, background: colors.bgCardAlt, color: colors.textPrimary, borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: uploading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Icon paths={ICONS.upload} size={14} />
            {uploading ? 'Enviando...' : 'Trocar logo'}
          </button>
          <div style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 6 }}>PNG, JPG ou SVG, até 2MB</div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        </div>
      </div>

      <label style={labelStyle(colors)}>Nome (empresa / condomínio)</label>
      <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={inputStyle(colors)} />

      <label style={labelStyle(colors)}>Nome do sistema / PBX</label>
      <input value={pbxName} onChange={(e) => setPbxName(e.target.value)} style={inputStyle(colors)} />

      <div style={sectionTitleStyle(colors)}>Chamadas</div>

      <label style={labelStyle(colors)}>Ramais da portaria (separados por vírgula)</label>
      <input
        value={porteiroExtensions}
        onChange={(e) => setPorteiroExtensions(e.target.value)}
        placeholder="993,994,995,996,998"
        style={inputStyle(colors)}
      />
      <div style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: -10, marginBottom: 14 }}>
        Usado pra decidir "Recebida" (chegou pra portaria) e "Realizada" (saiu da portaria) no resumo e no histórico de chamadas. Deixe em branco pra usar o critério antigo (interno vs. linha externa).
      </div>
    </>
  );
}

function AlertsTab({
  colors, offlineMinutes, setOfflineMinutes, reminderMinutes, setReminderMinutes,
  diskPercent, setDiskPercent, slaThresholdMinutes, setSlaThresholdMinutes,
}) {
  return (
    <>
      <label style={labelStyle(colors)}>Ramal considerado offline após (minutos)</label>
      <input type="number" min="1" value={offlineMinutes} onChange={(e) => setOfflineMinutes(e.target.value)} style={inputStyle(colors)} />

      <label style={labelStyle(colors)}>Repetir lembrete a cada (minutos, 0 = não repetir)</label>
      <input type="number" min="0" value={reminderMinutes} onChange={(e) => setReminderMinutes(e.target.value)} style={inputStyle(colors)} />
      <div style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: -10, marginBottom: 14 }}>
        Enquanto o ramal continuar offline, manda um novo aviso no Telegram nesse intervalo.
      </div>

      <label style={labelStyle(colors)}>Alerta de disco cheio acima de (%)</label>
      <input type="number" min="1" max="100" value={diskPercent} onChange={(e) => setDiskPercent(e.target.value)} style={inputStyle(colors)} />

      <label style={labelStyle(colors)}>Alertar se um ramal somar mais de (minutos offline no mês, 0 = desativado)</label>
      <input type="number" min="0" value={slaThresholdMinutes} onChange={(e) => setSlaThresholdMinutes(e.target.value)} style={inputStyle(colors)} />
      <div style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: -10, marginBottom: 14 }}>
        Pega ramal instável (cai e volta várias vezes) que nunca fica offline tempo suficiente pra disparar o alerta acima, mas que no total do mês já passou do aceitável.
      </div>
    </>
  );
}

function NotificationsTab({
  colors, telegramBotToken, setTelegramBotToken, telegramChatId, setTelegramChatId,
  handleTestTelegram, testingTelegram, telegramTestError, telegramTestMessage,
  dailyDigestEnabled, setDailyDigestEnabled, dailyDigestHour, setDailyDigestHour,
}) {
  return (
    <>
      <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: -4, marginBottom: 12 }}>
        Deixe em branco para não notificar. Fale com o @BotFather no Telegram para criar um bot.
      </div>

      <label style={labelStyle(colors)}>Bot Token</label>
      <input value={telegramBotToken} onChange={(e) => setTelegramBotToken(e.target.value)} placeholder="123456789:AA..." style={inputStyle(colors)} />

      <label style={labelStyle(colors)}>Chat ID</label>
      <input value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} placeholder="8873836707" style={inputStyle(colors)} />

      <button
        type="button"
        onClick={handleTestTelegram}
        disabled={testingTelegram || !telegramBotToken || !telegramChatId}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${colors.border}`, background: colors.bgCardAlt,
          color: colors.textPrimary, borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600,
          cursor: testingTelegram || !telegramBotToken || !telegramChatId ? 'default' : 'pointer',
          opacity: !telegramBotToken || !telegramChatId ? 0.5 : 1, marginBottom: 10,
        }}
      >
        <span style={{ display: 'inline-flex', animation: testingTelegram ? 'spinIcon 0.7s linear infinite' : 'none' }}>
          <Icon paths={ICONS.refresh} size={14} strokeWidth={2.2} />
        </span>
        {testingTelegram ? 'Enviando...' : 'Testar notificação'}
      </button>
      {telegramTestError && <div style={{ color: colors.red, fontSize: 12.5, marginBottom: 14 }}>{telegramTestError}</div>}
      {telegramTestMessage && !telegramTestError && <div style={{ color: colors.green, fontSize: 12.5, marginBottom: 14 }}>{telegramTestMessage}</div>}

      <div style={sectionTitleStyle(colors)}>Resumo diário automático</div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: colors.textPrimary, marginBottom: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={dailyDigestEnabled} onChange={(e) => setDailyDigestEnabled(e.target.checked)} />
        Mandar resumo diário automático (dia anterior) no Telegram
      </label>
      {dailyDigestEnabled && (
        <>
          <label style={labelStyle(colors)}>Horário do resumo (0-23h)</label>
          <input type="number" min="0" max="23" value={dailyDigestHour} onChange={(e) => setDailyDigestHour(e.target.value)} style={inputStyle(colors)} />
        </>
      )}
    </>
  );
}

function UsersTab({
  colors, users, currentUsername, handleDeleteUser, handleAddUser, handleDisableUserTotp,
  newUsername, setNewUsername, newDisplayName, setNewDisplayName, newPassword, setNewPassword,
  newIsAdmin, setNewIsAdmin, userError, addingUser,
}) {
  return (
    <>
      <div style={sectionTitleStyle(colors)}>Usuários do painel</div>

      {users.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {users.map((u) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${colors.border}`, fontSize: 13, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: colors.textPrimary }}>{u.displayName}</span>
              <span style={{ color: colors.textTertiary, fontSize: 12 }}>@{u.username}</span>
              <span style={{
                fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, padding: '2px 7px', borderRadius: 99,
                color: u.role === 'admin' ? colors.primary : colors.textTertiary,
                background: u.role === 'admin' ? colors.primarySoft : colors.graySoft,
              }}>
                {u.role === 'admin' ? 'Admin' : 'Usuário'}
              </span>
              {u.totpEnabled && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: 0.3, padding: '2px 7px', borderRadius: 99, color: colors.green, background: colors.greenSoft,
                }}>
                  <Icon paths={ICONS.shield} size={10} strokeWidth={2.4} />
                  2FA
                </span>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                {u.totpEnabled && (
                  <button
                    type="button"
                    onClick={() => handleDisableUserTotp(u.id, u.username)}
                    title="Desativar 2FA (se a pessoa perdeu o acesso)"
                    style={{ border: 'none', background: 'transparent', color: colors.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Desativar 2FA
                  </button>
                )}
                {u.username !== currentUsername && (
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(u.id)}
                    style={{ border: 'none', background: 'transparent', color: colors.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={sectionTitleStyle(colors)}>Adicionar usuário</div>
      <form onSubmit={handleAddUser}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <input
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Usuário (login)"
            required
            style={{ ...inputStyle(colors), flex: '1 1 120px', marginBottom: 0 }}
          />
          <input
            value={newDisplayName}
            onChange={(e) => setNewDisplayName(e.target.value)}
            placeholder="Nome de exibição"
            style={{ ...inputStyle(colors), flex: '1 1 120px', marginBottom: 0 }}
          />
        </div>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Senha (mín. 6 caracteres)"
          required
          minLength={6}
          style={inputStyle(colors)}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: colors.textPrimary, marginBottom: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={newIsAdmin} onChange={(e) => setNewIsAdmin(e.target.checked)} />
          Administrador (pode editar Configurações e usuários)
        </label>
        {userError && <div style={{ color: colors.red, fontSize: 13, marginBottom: 10 }}>{userError}</div>}
        <button
          type="submit"
          disabled={addingUser}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bgCardAlt, color: colors.textPrimary, fontWeight: 700, fontSize: 13, cursor: addingUser ? 'default' : 'pointer' }}
        >
          {addingUser ? 'Criando...' : 'Adicionar usuário'}
        </button>
      </form>
    </>
  );
}

function SecurityTab({ colors }) {
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState('idle'); // idle | setup | recovery
  const [setupData, setSetupData] = useState(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [disableCode, setDisableCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.me().then(setMe).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  async function handleStartSetup() {
    setError('');
    setBusy(true);
    try {
      const { secret, otpauthUri } = await api.totpSetup();
      const qrDataUrl = await QRCode.toDataURL(otpauthUri, { width: 168, margin: 1 });
      setSetupData({ secret, qrDataUrl });
      setStep('setup');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmEnable(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { recoveryCodes: codes } = await api.totpEnable(setupData.secret, code);
      setRecoveryCodes(codes);
      setStep('recovery');
      setCode('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleFinishSetup() {
    setStep('idle');
    setSetupData(null);
    setRecoveryCodes(null);
  }

  async function handleDisable(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.totpDisable(disableCode);
      setDisableCode('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div style={sectionTitleStyle(colors)}>Autenticação em duas etapas (2FA)</div>
      {!me && !error && <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 14 }}>Carregando...</div>}

      {step === 'recovery' && recoveryCodes && (
        <div style={{ border: `1px solid ${colors.amber}`, background: colors.amberSoft, borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textPrimary, marginBottom: 6 }}>2FA ativado! Guarde estes códigos de recuperação:</div>
          <div style={{ fontSize: 11.5, color: colors.textSecondary, marginBottom: 8 }}>
            Cada um funciona uma única vez, caso você perca o acesso ao app autenticador. Salve num lugar seguro — eles não aparecem de novo.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontFamily: 'monospace', fontSize: 12.5, color: colors.textPrimary, marginBottom: 10 }}>
            {recoveryCodes.map((c) => <div key={c}>{c}</div>)}
          </div>
          <button type="button" onClick={handleFinishSetup} style={{ border: 'none', background: colors.primary, color: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            Já salvei, entendi
          </button>
        </div>
      )}

      {step === 'setup' && setupData && (
        <form onSubmit={handleConfirmEnable} style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
            <img src={setupData.qrDataUrl} alt="QR code" width={140} height={140} style={{ borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 6 }}>
                Escaneie com Google Authenticator, Authy ou similar. Não consegue escanear? Digite manualmente:
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, background: colors.bgCardAlt, border: `1px solid ${colors.border}`, borderRadius: 6, padding: '5px 8px', wordBreak: 'break-all' }}>
                {setupData.secret}
              </div>
            </div>
          </div>
          <label style={labelStyle(colors)}>Código gerado pelo app, pra confirmar</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            autoFocus
            style={{ ...inputStyle(colors), fontFamily: 'monospace', letterSpacing: '.08em' }}
          />
          {error && <div style={{ color: colors.red, fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={busy} style={{ border: 'none', background: colors.primary, color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
              {busy ? 'Confirmando...' : 'Ativar 2FA'}
            </button>
            <button type="button" onClick={() => { setStep('idle'); setSetupData(null); setError(''); }} style={{ border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, borderRadius: 8, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {step === 'idle' && me && (
        <>
          {me.totpEnabled ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13, color: colors.green, fontWeight: 700 }}>
                <Icon paths={ICONS.shield} size={14} strokeWidth={2} /> 2FA ativado na sua conta
              </div>
              <form onSubmit={handleDisable} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
                <div style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
                  <label style={labelStyle(colors)}>Código atual (pra desativar)</label>
                  <input value={disableCode} onChange={(e) => setDisableCode(e.target.value)} placeholder="123456" style={{ ...inputStyle(colors), fontFamily: 'monospace', marginBottom: 0 }} />
                </div>
                <button type="submit" disabled={busy || !disableCode} style={{ border: `1px solid ${colors.red}`, background: 'transparent', color: colors.red, borderRadius: 8, padding: '9px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: (busy || !disableCode) ? 0.5 : 1 }}>
                  Desativar 2FA
                </button>
              </form>
            </>
          ) : (
            <button type="button" onClick={handleStartSetup} disabled={busy} style={{ border: 'none', background: colors.primary, color: '#fff', borderRadius: 9, padding: '9px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}>
              {busy ? 'Gerando...' : 'Ativar 2FA'}
            </button>
          )}
          {error && <div style={{ color: colors.red, fontSize: 13, marginBottom: 10 }}>{error}</div>}
        </>
      )}
    </>
  );
}

function AuditTab({ colors }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  function search() {
    setLoading(true);
    api.auditLog({ limit: 100, q, action, from, to })
      .then((res) => setEntries(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => { search(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function handleSubmit(e) {
    e.preventDefault();
    search();
  }

  function handleExportCsv() {
    const rows = entries.map((entry) => [formatAuditDate(entry.at), entry.actorUsername, auditActionLabel(entry.action), entry.details || '']);
    const csv = toCsv(['Data/Hora', 'Usuário', 'Ação', 'Detalhes'], rows);
    downloadCsv('log_auditoria.csv', csv);
  }

  return (
    <>
      <div style={sectionTitleStyle(colors)}>Log de auditoria</div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por usuário, ação ou detalhe..."
          style={{ ...inputStyle(colors), flex: '1 1 180px', marginBottom: 0 }}
        />
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          style={{ ...inputStyle(colors), flex: '1 1 140px', marginBottom: 0 }}
        >
          <option value="">Todas as ações</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...inputStyle(colors), marginBottom: 0 }} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...inputStyle(colors), marginBottom: 0 }} />
        <button
          type="submit"
          style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: colors.primary, color: '#fff', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          <Icon paths={ICONS.search} size={14} strokeWidth={2.2} />
          Buscar
        </button>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={entries.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', border: `1px solid ${colors.border}`,
            background: colors.bgCardAlt, color: colors.textPrimary, borderRadius: 10, padding: '8px 14px', fontSize: 12.5, fontWeight: 600,
            cursor: entries.length === 0 ? 'default' : 'pointer', opacity: entries.length === 0 ? 0.5 : 1,
          }}
        >
          <Icon paths={ICONS.chevronDown} size={13} strokeWidth={2.2} />
          Exportar CSV
        </button>
      </form>

      {loading ? (
        <div style={{ fontSize: 12.5, color: colors.textTertiary, textAlign: 'center', padding: '12px 0' }}>Buscando...</div>
      ) : entries.length === 0 ? (
        <div style={{ fontSize: 12.5, color: colors.textTertiary }}>Nenhuma ação encontrada.</div>
      ) : (
        <div>
          {entries.map((entry) => (
            <div key={entry.id} style={{ padding: '7px 0', borderBottom: `1px solid ${colors.border}`, fontSize: 12.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: colors.textPrimary }}>
                  <strong>@{entry.actorUsername}</strong> {auditActionLabel(entry.action)}
                </span>
                <span style={{ color: colors.textTertiary, flexShrink: 0 }}>{formatAuditDate(entry.at)}</span>
              </div>
              {entry.details && <div style={{ color: colors.textTertiary, fontSize: 11.5, marginTop: 2 }}>{entry.details}</div>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function SettingsModal({ colors, settings, onClose, onSaved, currentUsername }) {
  const [tab, setTab] = useState('general');
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [pbxName, setPbxName] = useState(settings.pbxName);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [offlineMinutes, setOfflineMinutes] = useState('120');
  const [diskPercent, setDiskPercent] = useState('80');
  const [reminderMinutes, setReminderMinutes] = useState('60');
  const [slaThresholdMinutes, setSlaThresholdMinutes] = useState('0');
  const [porteiroExtensions, setPorteiroExtensions] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState(false);
  const [dailyDigestHour, setDailyDigestHour] = useState('8');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramTestMessage, setTelegramTestMessage] = useState('');
  const [telegramTestError, setTelegramTestError] = useState('');
  const fileInputRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [userError, setUserError] = useState('');
  const [addingUser, setAddingUser] = useState(false);

  useEffect(() => {
    // GET /api/settings (autenticado) traz o objeto completo, com os campos
    // sensíveis que o endpoint público (usado antes do login) não expõe.
    api.settings().then((full) => {
      setOfflineMinutes(String(full.alertExtensionOfflineMinutes ?? '120'));
      setDiskPercent(String(full.alertDiskUsagePercent ?? '80'));
      setReminderMinutes(String(full.alertReminderIntervalMinutes ?? '60'));
      setSlaThresholdMinutes(String(full.slaThresholdMinutesPerMonth ?? '0'));
      setPorteiroExtensions(full.porteiroExtensions || '');
      setTelegramBotToken(full.telegramBotToken || '');
      setTelegramChatId(full.telegramChatId || '');
      setDailyDigestEnabled(full.dailyDigestEnabled === 'true');
      setDailyDigestHour(String(full.dailyDigestHour ?? '8'));
    }).catch(() => {});
    loadUsers();
  }, []);

  function loadUsers() {
    api.users().then((res) => setUsers(res.data)).catch(() => {});
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.updateSettings({
        companyName, pbxName,
        alertExtensionOfflineMinutes: offlineMinutes,
        alertDiskUsagePercent: diskPercent,
        alertReminderIntervalMinutes: reminderMinutes,
        slaThresholdMinutesPerMonth: slaThresholdMinutes,
        porteiroExtensions,
        telegramBotToken, telegramChatId,
        dailyDigestEnabled, dailyDigestHour,
      });
      setMessage('Salvo!');
      onSaved?.();
      setTimeout(onClose, 600);
    } catch (err) {
      setError(err.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      const updated = await api.uploadLogo(file);
      setLogoUrl(updated.logoUrl);
      setMessage('Logo atualizado!');
      onSaved?.();
    } catch (err) {
      setError(err.message || 'Não foi possível enviar a imagem.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleAddUser(e) {
    e.preventDefault();
    setUserError('');
    setAddingUser(true);
    try {
      await api.createUser({
        username: newUsername, displayName: newDisplayName, password: newPassword,
        role: newIsAdmin ? 'admin' : 'user',
      });
      setNewUsername('');
      setNewDisplayName('');
      setNewPassword('');
      setNewIsAdmin(false);
      loadUsers();
    } catch (err) {
      setUserError(err.message || 'Não foi possível criar o usuário.');
    } finally {
      setAddingUser(false);
    }
  }

  async function handleTestTelegram() {
    setTestingTelegram(true);
    setTelegramTestError('');
    setTelegramTestMessage('');
    try {
      await api.testTelegram({ telegramBotToken, telegramChatId });
      setTelegramTestMessage('Enviado! Confira o Telegram.');
    } catch (err) {
      setTelegramTestError(err.message || 'Não foi possível enviar a mensagem de teste.');
    } finally {
      setTestingTelegram(false);
    }
  }

  async function handleDeleteUser(id) {
    setUserError('');
    try {
      await api.deleteUser(id);
      loadUsers();
    } catch (err) {
      setUserError(err.message || 'Não foi possível remover o usuário.');
    }
  }

  // Escape hatch pro admin: desativa o 2FA de outro usuário que ficou sem
  // acesso ao app autenticador e aos códigos de recuperação. Nunca pede o
  // código dele — só confirma a intenção, já que quem está fazendo isso é
  // quem tem poder de administrador no painel.
  async function handleDisableUserTotp(id, username) {
    setUserError('');
    if (!window.confirm(`Desativar a verificação em duas etapas de @${username}?`)) return;
    try {
      await api.adminDisableTotp(id);
      loadUsers();
    } catch (err) {
      setUserError(err.message || 'Não foi possível desativar o 2FA desse usuário.');
    }
  }

  const showSaveBar = tab === 'general' || tab === 'alerts' || tab === 'notifications';

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="settings-modal-card"
        style={{
          width: '100%', maxWidth: 480, background: colors.bgCard,
          border: `1px solid ${colors.border}`, borderRadius: 16, boxShadow: colors.shadow, margin: '20px 0',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Cabeçalho fora da área rolável (não usa position:sticky — em
            alguns navegadores mobile, sticky dentro de um overlay
            position:fixed pode "descolar" visualmente do conteúdo durante
            o toque). Assim ele nunca rola, ponto final, sem depender de
            nenhum comportamento de scroll do navegador. */}
        <div style={{
          flexShrink: 0, background: colors.bgCard, borderRadius: '16px 16px 0 0',
          borderBottom: `1px solid ${colors.border}`, padding: '20px 26px 0', display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <Icon paths={ICONS.settings} size={20} color={colors.primary} />
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, color: colors.textPrimary }}>Configurações</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              style={{
                width: 32, height: 32, borderRadius: 9, border: `1px solid ${colors.border}`, background: colors.bgCardAlt,
                color: colors.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <Icon paths={ICONS.close} size={15} strokeWidth={2.2} />
            </button>
          </div>

          <div style={{ display: 'flex', overflowX: 'auto' }}>
            {TABS.map((t) => (
              <TabButton key={t.key} colors={colors} active={tab === t.key} onClick={() => setTab(t.key)}>
                {t.label}
              </TabButton>
            ))}
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          <div style={{ padding: '20px 26px 26px' }}>
            {tab === 'general' && (
              <GeneralTab
                colors={colors} companyName={companyName} setCompanyName={setCompanyName}
                pbxName={pbxName} setPbxName={setPbxName} logoUrl={logoUrl} uploading={uploading}
                fileInputRef={fileInputRef} handleFileChange={handleFileChange}
                porteiroExtensions={porteiroExtensions} setPorteiroExtensions={setPorteiroExtensions}
              />
            )}
            {tab === 'alerts' && (
              <AlertsTab
                colors={colors} offlineMinutes={offlineMinutes} setOfflineMinutes={setOfflineMinutes}
                reminderMinutes={reminderMinutes} setReminderMinutes={setReminderMinutes}
                diskPercent={diskPercent} setDiskPercent={setDiskPercent}
                slaThresholdMinutes={slaThresholdMinutes} setSlaThresholdMinutes={setSlaThresholdMinutes}
              />
            )}
            {tab === 'notifications' && (
              <NotificationsTab
                colors={colors} telegramBotToken={telegramBotToken} setTelegramBotToken={setTelegramBotToken}
                telegramChatId={telegramChatId} setTelegramChatId={setTelegramChatId}
                handleTestTelegram={handleTestTelegram} testingTelegram={testingTelegram}
                telegramTestError={telegramTestError} telegramTestMessage={telegramTestMessage}
                dailyDigestEnabled={dailyDigestEnabled} setDailyDigestEnabled={setDailyDigestEnabled}
                dailyDigestHour={dailyDigestHour} setDailyDigestHour={setDailyDigestHour}
              />
            )}
            {tab === 'users' && (
              <UsersTab
                colors={colors} users={users} currentUsername={currentUsername} handleDeleteUser={handleDeleteUser}
                handleDisableUserTotp={handleDisableUserTotp}
                handleAddUser={handleAddUser} newUsername={newUsername} setNewUsername={setNewUsername}
                newDisplayName={newDisplayName} setNewDisplayName={setNewDisplayName}
                newPassword={newPassword} setNewPassword={setNewPassword}
                newIsAdmin={newIsAdmin} setNewIsAdmin={setNewIsAdmin} userError={userError} addingUser={addingUser}
              />
            )}
            {tab === 'security' && <SecurityTab colors={colors} />}
            {tab === 'audit' && <AuditTab colors={colors} />}

            {showSaveBar && (
              <>
                {error && <div style={{ color: colors.red, fontSize: 13, margin: '14px 0 0' }}>{error}</div>}
                {message && !error && <div style={{ color: colors.green, fontSize: 13, margin: '14px 0 0' }}>{message}</div>}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  style={{ width: '100%', marginTop: 14, padding: '11px 12px', borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
