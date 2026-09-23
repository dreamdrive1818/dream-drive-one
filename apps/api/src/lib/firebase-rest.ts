import { BadRequestException, UnauthorizedException } from "@nestjs/common";

type FirebaseAuthResponse = {
  idToken?: string;
  localId?: string;
  email?: string;
  displayName?: string;
  error?: { message?: string };
};

function apiKey() {
  const key = process.env.FIREBASE_API_KEY;
  if (!key) {
    throw new BadRequestException("Firebase is not configured on the API");
  }
  return key;
}

async function firebaseAccount(path: string, body: Record<string, unknown>) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${path}?key=${encodeURIComponent(apiKey())}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const data = (await res.json()) as FirebaseAuthResponse;
  if (!res.ok || !data.idToken || !data.localId) {
    throw new UnauthorizedException(data.error?.message || "Invalid credentials");
  }
  return {
    idToken: data.idToken,
    uid: data.localId,
    email: data.email ?? String(body.email ?? ""),
    name: data.displayName,
  };
}

export async function firebaseSignInWithPassword(email: string, password: string) {
  return firebaseAccount("accounts:signInWithPassword", {
    email: email.toLowerCase().trim(),
    password,
    returnSecureToken: true,
  });
}

export async function firebaseSignUpWithPassword(email: string, password: string) {
  return firebaseAccount("accounts:signUp", {
    email: email.toLowerCase().trim(),
    password,
    returnSecureToken: true,
  });
}

export async function verifyGoogleOrFirebaseIdToken(idToken: string): Promise<{
  uid: string;
  email: string;
  name?: string;
}> {
  try {
    const { firebaseAdmin } = await import("./firebase-admin");
    const admin = await firebaseAdmin();
    if (admin) {
      const decoded = await admin.auth().verifyIdToken(idToken);
      if (decoded.email) {
        return {
          uid: decoded.uid,
          email: decoded.email,
          name: decoded.name,
        };
      }
    }
  } catch {
    // fall through to Google tokeninfo
  }

  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );
  const data = (await res.json()) as {
    aud?: string;
    sub?: string;
    email?: string;
    email_verified?: string | boolean;
    name?: string;
    error_description?: string;
  };
  if (!res.ok || !data.sub || !data.email) {
    throw new UnauthorizedException(data.error_description || "Invalid Google token");
  }
  const allowedAud = [
    process.env.FIREBASE_PROJECT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_ID,
  ].filter(Boolean);
  if (data.aud && allowedAud.length && !allowedAud.includes(data.aud)) {
    throw new UnauthorizedException("Token audience is not this project");
  }
  if (data.email_verified === "false" || data.email_verified === false) {
    throw new UnauthorizedException("Google email is not verified");
  }
  return { uid: data.sub, email: data.email, name: data.name };
}

/** Verify Facebook Login access token via Graph API. */
export async function verifyFacebookAccessToken(accessToken: string): Promise<{
  uid: string;
  email: string;
  name?: string;
}> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (appId && appSecret) {
    const debugRes = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`
    );
    const debug = (await debugRes.json()) as {
      data?: { is_valid?: boolean; app_id?: string };
      error?: { message?: string };
    };
    if (!debugRes.ok || !debug.data?.is_valid) {
      throw new UnauthorizedException(debug.error?.message || "Invalid Facebook token");
    }
    if (debug.data.app_id && debug.data.app_id !== appId) {
      throw new UnauthorizedException("Facebook token is not for this app");
    }
  }

  const res = await fetch(
    `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`
  );
  const data = (await res.json()) as {
    id?: string;
    email?: string;
    name?: string;
    error?: { message?: string };
  };
  if (!res.ok || !data.id) {
    throw new UnauthorizedException(data.error?.message || "Invalid Facebook token");
  }
  if (!data.email) {
    throw new UnauthorizedException(
      "Facebook did not return an email. Grant email permission and try again."
    );
  }
  return { uid: `fb:${data.id}`, email: data.email, name: data.name };
}
