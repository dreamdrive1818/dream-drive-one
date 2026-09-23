"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import {
  getPostLoginPath,
  readRedirectFromLocation,
} from "../authUtils";
import { LoginSkeleton } from "../../components/Skeleton/Skeleton";
import AuthForm from "../AuthForm";
import "./Login.css";

const VISUAL_CAR =
  "https://res.cloudinary.com/dcrfks1tq/image/upload/v1744881450/istockphoto-184127993-612x612-removebg-preview_caadfj.png";

export default function Login() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const isSubmitLogin = useRef(false);

  const completeLogin = useCallback(() => {
    isSubmitLogin.current = true;
    const path = getPostLoginPath(readRedirectFromLocation());
    navigate(path, { replace: true });
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
      <aside className="customer-login-visual" aria-hidden="true">
        <div className="customer-login-visual-glow" />
        <div className="customer-login-visual-grid" />
        <div className="customer-login-visual-copy">
          <p className="customer-login-visual-brand">Dream Drive</p>
          <p className="customer-login-visual-line">Self-drive, on your schedule.</p>
        </div>
        <img
          src={VISUAL_CAR}
          alt=""
          className="customer-login-visual-car"
          draggable={false}
        />
      </aside>

      <section className="customer-login-panel">
        <Link to="/" className="customer-login-back">
          ← Back to home
        </Link>
        <AuthForm idPrefix="page-auth" onSuccess={completeLogin} />
      </section>
    </div>
  );
}
