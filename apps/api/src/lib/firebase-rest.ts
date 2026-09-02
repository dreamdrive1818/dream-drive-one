import { BadRequestException, UnauthorizedException } from "@nestjs/common";

export async function firebaseSignInWithPassword(email: string, password: string) {
  const key = process.env.FIREBASE_API_KEY;
  if (!key) {
    throw new BadRequestException("Firebase is not configured on the API");
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        password,
        returnSecureToken: true,
      }),
    }
  );
  const data = (await res.json()) as {
    idToken?: string;
    localId?: string;
    email?: string;
    displayName?: string;
    error?: { message?: string };
  };
  if (!res.ok || !data.idToken || !data.localId) {
    throw new UnauthorizedException(data.error?.message || "Invalid credentials");
  }
  return {
    idToken: data.idToken,
    uid: data.localId,
    email: data.email ?? email,
    name: data.displayName,
  };
}
