import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import Icon, { ICONS } from './Icon.jsx';
import Logo from './Logo.jsx';

const inputStyle = (colors) => ({
  width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`,
  marginBottom: 14, fontSize: 14, fontFamily: 'inherit', background: colors.bgCardAlt, color: colors.textPrimary,
});
const labelStyle = (colors) => ({ display: 'block', fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 });
const sectionTitleStyle = (colors) => ({ fontSize: 12.5, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, margin: '18px 0 10px' });

const AUDIT_ACTION_LABELS = {
  'auth.login': 'Fez login',
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

export default function SettingsModal({ colors, settings, onClose, onSaved, currentUsername }) {
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [pbxName, setPbxName] = useState(settings.pbxName);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [offlineMinutes, setOfflineMinutes] = useState('120');
  const [diskPercent, setDiskPercent] = useState('80');
  const [reminderMinutes, setReminderMinutes] = useState('60');
  const [porteiroExtensions, setPorteiroExtensions] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramTestMessage, setTelegramTestMessage] = useState('');
  const [telegramTestError, setTelegramTestError] = useState('');
  const fileInputRef = useRef(null);

  const [auditLog, setAuditLog] = useState([]);
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
      setPorteiroExtensions(full.porteiroExtensions || '');
      setTelegramBotToken(full.telegramBotToken || '');
      setTelegramChatId(full.telegramChatId || '');
    }).catch(() => {});
    loadUsers();
    api.auditLog({ limit: 20 }).then((res) => setAuditLog(res.data)).catch(() => {});
  }, []);

  function loadUsers() {
    api.users().then((res) => setUsers(res.data)).catch(() => {});
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.updateSettings({
        companyName, pbxName,
        alertExtensionOfflineMinutes: offlineMinutes,
        alertDiskUsagePercent: diskPercent,
        alertReminderIntervalMinutes: reminderMinutes,
        porteiroExtensions,
        telegramBotToken, telegramChatId,
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

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="settings-modal-card"
        style={{
          width: '100%', maxWidth: 440, background: colors.bgCard,
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
          borderBottom: `1px solid ${colors.border}`, padding: '20px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
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

        <div style={{ overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
        <form onSubmit={handleSave} style={{ padding: '20px 26px 26px' }}>
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

          <div style={sectionTitleStyle(colors)}>Alertas</div>

          <label style={labelStyle(colors)}>Ramal considerado offline após (minutos)</label>
          <input type="number" min="1" value={offlineMinutes} onChange={(e) => setOfflineMinutes(e.target.value)} style={inputStyle(colors)} />

          <label style={labelStyle(colors)}>Repetir lembrete a cada (minutos, 0 = não repetir)</label>
          <input type="number" min="0" value={reminderMinutes} onChange={(e) => setReminderMinutes(e.target.value)} style={inputStyle(colors)} />
          <div style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: -10, marginBottom: 14 }}>
            Enquanto o ramal continuar offline, manda um novo aviso no Telegram nesse intervalo.
          </div>

          <label style={labelStyle(colors)}>Alerta de disco cheio acima de (%)</label>
          <input type="number" min="1" max="100" value={diskPercent} onChange={(e) => setDiskPercent(e.target.value)} style={inputStyle(colors)} />

          <div style={sectionTitleStyle(colors)}>Notificação por Telegram (opcional)</div>
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

          {error && <div style={{ color: colors.red, fontSize: 13, marginBottom: 14 }}>{error}</div>}
          {message && !error && <div style={{ color: colors.green, fontSize: 13, marginBottom: 14 }}>{message}</div>}

          <button
            type="submit"
            disabled={saving}
            style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </form>

        <div style={{ padding: '0 26px 26px' }}>
        <div style={sectionTitleStyle(colors)}>Usuários do painel</div>

        {users.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {users.map((u) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${colors.border}`, fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: colors.textPrimary }}>{u.displayName}</span>
                <span style={{ color: colors.textTertiary, fontSize: 12 }}>@{u.username}</span>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, padding: '2px 7px', borderRadius: 99,
                  color: u.role === 'admin' ? colors.primary : colors.textTertiary,
                  background: u.role === 'admin' ? colors.primarySoft : colors.graySoft,
                }}>
                  {u.role === 'admin' ? 'Admin' : 'Usuário'}
                </span>
                {u.username !== currentUsername && (
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(u.id)}
                    style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: colors.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Remover
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

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

        <div style={sectionTitleStyle(colors)}>Log de auditoria</div>
        {auditLog.length === 0 ? (
          <div style={{ fontSize: 12.5, color: colors.textTertiary }}>Nenhuma ação registrada ainda.</div>
        ) : (
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {auditLog.map((entry) => (
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
        </div>
        </div>
      </div>
    </div>
  );
}
