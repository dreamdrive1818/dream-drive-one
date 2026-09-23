"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import {
  getPostLoginPath,
  readRedirectFromLocation,
} from "../authUtils";
import { LoginSkeleton } from "../../components/Skeleton/Skeleton";
import AuthForm from "../AuthForm";
import "./Login.css";

const VISUAL_STAGE = "/hero-road-presence.jpg";

export default function Login() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const isSubmitLogin = useRef(false);

  const completeLogin = useCallback(() => {
    isSubmitLogin.current = true;
    const path = getPostLoginPath(readRedirectFromLocation());
    navigate(path, { replace: true });
  }, [navigate]);

  const goHome = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const goBack = useCallback(() => {
    if (typeof window === "undefined") {
      navigate("/");
      return;
    }
    const from = readRedirectFromLocation();
    if (from && from !== "/login") {
      navigate(from);
      return;
    }
    const referrer = document.referrer;
    try {
      if (referrer) {
        const refUrl = new URL(referrer);
        if (
          refUrl.origin === window.location.origin &&
          refUrl.pathname !== "/login"
        ) {
          navigate(-1);
          return;
        }
      }
    } catch {
      // Invalid referrer — fall through to home.
    }
    navigate("/");
  }, [navigate]);

  useEffect(() => {
    if (!ready || !user || isSubmitLogin.current) return;
    completeLogin();
  }, [ready, user, completeLogin]);

  if (!ready) {
    return <LoginSkeleton />;
  }

  return (
    <div className="customer-login-page customer-login-page--full">
      <nav className="customer-login-nav" aria-label="Login page">
        <button type="button" className="customer-login-nav-btn" onClick={goBack}>
          <span aria-hidden="true">←</span>
          Back
        </button>
        <button type="button" className="customer-login-nav-btn" onClick={goHome}>
          Home
        </button>
      </nav>

      <aside className="customer-login-visual" aria-hidden="true">
        <img
          src={VISUAL_STAGE}
          alt=""
          className="customer-login-visual-bg"
          draggable={false}
        />
        <div className="customer-login-visual-shade" />
        <div className="customer-login-visual-sheen" />
        <div className="customer-login-visual-copy">
          <p className="customer-login-visual-brand">Dream Drive</p>
          <p className="customer-login-visual-line">
            Ranchi’s trusted self-drive rentals — keys when you need them.
          </p>
        </div>
      </aside>

      <section className="customer-login-panel">
        <AuthForm idPrefix="page-auth" onSuccess={completeLogin} />
      </section>
    </div>
  );
}
