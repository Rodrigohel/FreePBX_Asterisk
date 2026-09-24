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

  const login = useCallback(async (username, password, totpCode) => {
    const { token, user: u } = await api.login(username, password, totpCode);
    setToken(token);
    // api.login não devolve totpEnabled (só /me sabe) — busca antes de usar
    // o valor no estado, senão a tela de "Minha conta" abriria achando que
    // 2FA está desativado até o próximo reload.
    const full = await api.me().catch(() => u);
    setUser(full);
    return full;
  }, []);

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

  return { user, checking, login, logout, refreshUser, isAuthenticated: !!user };
}
