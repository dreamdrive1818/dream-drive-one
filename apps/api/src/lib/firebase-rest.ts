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
