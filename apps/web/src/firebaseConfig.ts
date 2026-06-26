import { initFirebase } from "@retrorganizer/core";

export function bootstrapFirebase() {
  return initFirebase(
    {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "demo",
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "demo",
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "retrorganizer-dev",
      appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "demo",
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "demo",
    },
    import.meta.env.VITE_USE_EMULATORS === "true",
  );
}
