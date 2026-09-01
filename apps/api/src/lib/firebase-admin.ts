type AdminNs = typeof import("firebase-admin");

let initPromise: Promise<AdminNs | null> | null = null;

export async function firebaseAdmin() {
  if (!process.env.FIREBASE_PROJECT_ID) return null;
  if (!initPromise) {
    initPromise = (async () => {
      const admin = await import("firebase-admin");
      if (admin.apps.length) return admin;
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(
        /\\n/g,
        "\n"
      );
      if (clientEmail && privateKey) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          projectId,
        });
      } else {
        admin.initializeApp({ projectId });
      }
      return admin;
    })();
  }
  return initPromise;
}
