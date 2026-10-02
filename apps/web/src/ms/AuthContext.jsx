"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, getToken, peekApi, prefetch, seedApi, setToken } from "./api";
import { isLocalDev } from "./authUtils";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (typeof window === "undefined" ? null : peekApi("/v1/me") || null));
  const [ready, setReady] = useState(() => typeof window === "undefined" || !getToken() || Boolean(peekApi("/v1/me")));

  const applySession = useCallback(async (token, nextUser) => {
    if (token) setToken(token);
    if (nextUser) {
      seedApi("/v1/me", nextUser);
      setUser(nextUser);
      setReady(true);
      prefetch([
        "/v1/me/dashboard",
        "/v1/me/bookings",
        "/v1/public/cities",
        "/v1/public/home",
        "/v1/public/search",
        "/v1/public/catalog-config",
      ]);
      return nextUser;
    }
    if (!getToken()) {
      setUser(null);
      setReady(true);
      return null;
    }
    try {
      const me = await api("/v1/me");
      setUser(me);
      return me;
    } catch {
      setUser(null);
      setToken("");
      return null;
    } finally {
      setReady(true);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setReady(true);
      return null;
    }
    const cached = peekApi("/v1/me");
    if (cached) {
      setUser(cached);
      setReady(true);
      void api("/v1/me")
        .then((me) => setUser(me))
        .catch(() => undefined);
      return cached;
    }
    try {
      const me = await api("/v1/me");
      setUser(me);
      return me;
    } catch {
      setUser(null);
      setToken("");
      return null;
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    prefetch([
      "/v1/public/cities",
      "/v1/public/home",
      "/v1/public/search",
      "/v1/public/catalog-config",
    ]);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) return;
    prefetch(["/v1/me/dashboard", "/v1/me/bookings"]);
  }, [user?.id]);

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
      const me = await applySession(data.token, data.user);
      if (me) return me;
      return requireSession(refresh);
    },
    [applySession, refresh, requireSession]
  );

  const register = useCallback(
    async (email, password, fullName, phone) => {
      const data = await api("/v1/auth/register", {
        method: "POST",
        body: { email, password, fullName, phone },
      });
      if (data?.error) throw new Error(data.error);
      const me = await applySession(data.token, data.user);
      if (me) return me;
      return requireSession(refresh);
    },
    [applySession, refresh, requireSession]
  );

  const loginGoogle = useCallback(
    async (idToken) => {
      const data = await api("/v1/auth/google", {
        method: "POST",
        body: { idToken },
      });
      if (data?.error) throw new Error(data.error);
      const me = await applySession(data.token, data.user);
      if (me) return me;
      return requireSession(refresh);
    },
    [applySession, refresh, requireSession]
  );

  const loginFacebook = useCallback(
    async (accessToken) => {
      const data = await api("/v1/auth/facebook", {
        method: "POST",
        body: { accessToken },
      });
      if (data?.error) throw new Error(data.error);
      const me = await applySession(data.token, data.user);
      if (me) return me;
      return requireSession(refresh);
    },
    [applySession, refresh, requireSession]
  );

  const loginDev = useCallback(
    async (email) => {
      const data = await api("/v1/auth/dev", {
        method: "POST",
        body: { email: email.trim().toLowerCase() },
        retries: 3,
      });
      if (data?.error) throw new Error(data.error);
      const me = await applySession(data.token, data.user);
      if (me) return me;
      return requireSession(refresh);
    },
    [applySession, refresh, requireSession]
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

      if (data?.token) {
        await applySession(data.token, data.user);
        return { verified: true, sessionStarted: true };
      }

      if (isLocalDev()) {
        setToken(`dev:${normalized}`);
        await requireSession(refresh);
        return { verified: true, sessionStarted: true };
      }

      return { verified: true, sessionStarted: false };
    },
    [applySession, refresh, requireSession]
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
      loginPassword: loginWithEmailPassword,
      register,
      loginGoogle,
      loginFacebook,
      loginDev,
      sendOtp,
      verifyOtp,
      loginOtp: async (email, code) => {
        const result = await verifyOtp(email, code);
        if (!result.sessionStarted) {
          throw new Error("OTP verified, but a session token was not issued.");
        }
        return peekApi("/v1/me") || refresh();
      },
      logout,
    }),
    [
      user,
      ready,
      refresh,
      loginWithEmailPassword,
      register,
      loginGoogle,
      loginFacebook,
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
