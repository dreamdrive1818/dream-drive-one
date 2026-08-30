"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  async function refresh() {
    if (!getToken()) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      await api("/v1/auth/sync", { method: "POST", body: {} });
      const me = await api("/v1/me");
      setUser(me);
    } catch {
      setUser(null);
      setToken("");
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      refresh,
      loginDev: async (email) => {
        setToken(`dev:${email.trim().toLowerCase()}`);
        await refresh();
      },
      logout: () => {
        setToken("");
        setUser(null);
      },
    }),
    [user, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
