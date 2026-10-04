"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

/** Public Firebase web config for project dreamdrive-307ed. */
const firebaseConfig = {
  apiKey: "AIzaSyDDfe2wUwf-TkLtqmm5Jq7axxwega4xWjY",
  authDomain: "dreamdrive-307ed.firebaseapp.com",
  projectId: "dreamdrive-307ed",
  storageBucket: "dreamdrive-307ed.appspot.com",
  messagingSenderId: "669755502101",
  appId: "1:669755502101:web:32375dd8fcbfcbcb8b281c",
};

const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "669755502101-ifbbgh6v76bnh7nn5a4g17upkvq6bv3q.apps.googleusercontent.com";

function firebaseAuth() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getAuth(app);
}

function loadGis() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in only works in the browser."));
  }
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-dd-gis]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Google sign-in.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.ddGis = "1";
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Could not load Google sign-in."));
    document.head.appendChild(script);
  });
}

function signInWithGis() {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err, token) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(token);
    };

    loadGis()
      .then((google) => {
        if (!google?.accounts?.id) {
          finish(new Error("Google sign-in is unavailable in this browser."));
          return;
        }
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (resp) => {
            if (resp?.credential) finish(null, resp.credential);
            else finish(new Error("Google did not return a sign-in token."));
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          ux_mode: "popup",
          use_fedcm_for_prompt: true,
        });
        google.accounts.id.prompt((notification) => {
          if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
            finish(
              Object.assign(new Error("Google sign-in was blocked. Allow popups for this site and try again."), {
                code: "auth/popup-blocked",
              })
            );
          }
        });
      })
      .catch(finish);
  });
}

/** Opens Google's account chooser and returns a Firebase or Google ID token. */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const result = await signInWithPopup(firebaseAuth(), provider);
    const idToken = await result.user.getIdToken();
    if (!idToken) throw new Error("Google did not return a sign-in token.");
    return idToken;
  } catch (err) {
    const code = err?.code || "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      throw err;
    }
    try {
      return await signInWithGis();
    } catch {
      throw err;
    }
  }
}
