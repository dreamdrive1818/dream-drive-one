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

function firebaseAuth() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getAuth(app);
}

/** Opens Google's account chooser and returns a Firebase ID token. */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(firebaseAuth(), provider);
  const idToken = await result.user.getIdToken();
  if (!idToken) throw new Error("Google did not return a sign-in token.");
  return idToken;
}
