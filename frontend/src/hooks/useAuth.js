import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../api/client.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (import.meta.env.VITE_EMBEDDED !== 'true' && !getToken()) {
      setChecking(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setChecking(false));
  }, []);

  // api.login/api.me não devolvem totpEnabled num objeto só de uma vez (só
  // /me sabe) — busca antes de usar o valor no estado, senão a tela de
  // "Minha conta" abriria achando que 2FA está desativado até o próximo
  // reload.
  const finalizeLogin = useCallback(async (token) => {
    setToken(token);
    const full = await api.me();
    setUser(full);
    return full;
  }, []);

  // Primeira etapa: usuário + senha. Se a conta não tem 2FA, já loga (e o
  // valor de retorno é o usuário). Se tem, não loga ainda — devolve
  // { requiresTotp: true, totpToken } pro chamador (LoginModal) trocar pra
  // pedir o código.
  const login = useCallback(async (username, password) => {
    const result = await api.login(username, password);
    if (result.requiresTotp) return result;
    return finalizeLogin(result.token);
  }, [finalizeLogin]);

  // Segunda etapa: código TOTP ou de recuperação, junto do totpToken de
  // curta duração devolvido pela primeira etapa.
  const loginTotp = useCallback(async (totpToken, code) => {
    const { token } = await api.loginTotp(totpToken, code);
    return finalizeLogin(token);
  }, [finalizeLogin]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // Pra depois de ativar/desativar 2FA — atualiza só o totpEnabled (e o
  // resto) sem precisar deslogar/logar de novo.
  const refreshUser = useCallback(async () => {
    const full = await api.me().catch(() => null);
    if (full) setUser(full);
    return full;
  }, []);

  return { user, checking, login, loginTotp, logout, refreshUser, isAuthenticated: !!user };
}
