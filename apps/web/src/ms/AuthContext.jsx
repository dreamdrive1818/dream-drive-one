"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, getToken, setToken } from "./api";
import { isLocalDev } from "./authUtils";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setReady(true);
      return null;
    }
    try {
      await api("/v1/auth/sync", { method: "POST", body: {} });
      const me = await api("/v1/me");
      setUser(me);
      return me;
    } catch (err) {
      setUser(null);
      setToken("");
      return null;
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requireSession = useCallback(
    async (loadSession) => {
      const me = await loadSession();
      if (!me?.id && !me?.email) {
        throw new Error(
          "Sign-in failed. Ensure the API gateway is running on port 4000 and the database is seeded."
        );
      }
      return me;
    },
    []
  );

  /** Password login via API (Firebase stays server-side — no browser Firebase SDK). */
  const loginWithEmailPassword = useCallback(
    async (email, password) => {
      const data = await api("/v1/auth/login", {
        method: "POST",
        body: {
          email: email.trim().toLowerCase(),
          password,
        },
      });
      if (data?.error) {
        throw new Error(data.error);
      }
      if (!data?.token) {
        throw new Error("Login failed. No token returned.");
      }
      setToken(data.token);
      if (data.user) {
        setUser(data.user);
        setReady(true);
        return data.user;
      }
      return requireSession(refresh);
    },
    [refresh, requireSession]
  );

  const loginDev = useCallback(
    async (email) => {
      setToken(`dev:${email.trim().toLowerCase()}`);
      return requireSession(refresh);
    },
    [refresh, requireSession]
  );

  const sendOtp = useCallback(async (email) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      throw new Error("Email is required.");
    }
    const data = await api("/v1/auth/otp/send", {
      method: "POST",
      body: { email: normalized },
    });
    if (data?.error) {
      throw new Error(data.error);
    }
    return data;
  }, []);

  const verifyOtp = useCallback(
    async (email, code) => {
      const normalized = email.trim().toLowerCase();
      const data = await api("/v1/auth/otp/verify", {
        method: "POST",
        body: { email: normalized, code: String(code).trim() },
      });
      if (data?.error) {
        throw new Error(data.error);
      }

      if (isLocalDev()) {
        setToken(`dev:${normalized}`);
        await requireSession(refresh);
        return { verified: true, sessionStarted: true };
      }

      return { verified: true, sessionStarted: false };
    },
    [refresh, requireSession]
  );

  const logout = useCallback(() => {
    setToken("");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      refresh,
      loginWithEmailPassword,
      loginDev,
      sendOtp,
      verifyOtp,
      logout,
    }),
    [
      user,
      ready,
      refresh,
      loginWithEmailPassword,
      loginDev,
      sendOtp,
      verifyOtp,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
