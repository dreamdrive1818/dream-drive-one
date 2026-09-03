/** True on localhost / Next dev — enables dev token login and OTP session bypass. */
export function isLocalDev() {
  if (process.env.NODE_ENV === "development") return true;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host.endsWith(".local")
    );
  }
  return false;
}

/**
 * Allow only same-origin path redirects (no protocol-relative or external URLs).
 */
export function sanitizeRedirect(raw) {
  if (!raw || typeof raw !== "string") return null;
  let path = raw.trim();
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (/^https?:\/\//i.test(path)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return null;
  return path;
}

/** Resolved post-login path: sanitized redirect or /account. */
export function getPostLoginPath(rawRedirect) {
  return sanitizeRedirect(rawRedirect) || "/account";
}

/** Read ?redirect= from the current URL ( reliable at login completion time ). */
export function readRedirectFromLocation() {
  if (typeof window === "undefined") return null;
  return (
    new URLSearchParams(window.location.search).get("redirect") ||
    new URLSearchParams(window.location.search).get("next")
  );
}

const AUTH_MESSAGES = {
  "auth/invalid-credential": "Incorrect email or password. Please try again.",
  "auth/user-not-found": "No account found with this email address.",
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/user-disabled": "This account has been disabled. Contact support for help.",
  INVALID_LOGIN_CREDENTIALS: "Incorrect email or password. Please try again.",
  EMAIL_NOT_FOUND: "No account found with this email address.",
  INVALID_PASSWORD: "Incorrect password. Please try again.",
  USER_DISABLED: "This account has been disabled. Contact support for help.",
  "Invalid credentials": "Incorrect email or password. Please try again.",
};

/** Friendly copy for API / auth errors shown on the login UI. */
export function firebaseAuthMessage(error) {
  const code = error?.code;
  if (code && AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
  const message = error?.message || error?.data?.message || "";
  if (message && AUTH_MESSAGES[message]) return AUTH_MESSAGES[message];
  if (/invalid credentials|unauthorized/i.test(message)) {
    return "Incorrect email or password. Please try again.";
  }
  return message || "Unable to sign in. Please try again.";
}
