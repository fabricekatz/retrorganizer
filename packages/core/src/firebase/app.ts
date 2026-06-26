import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
}

let cached: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;

export function initFirebase(config: FirebaseConfig, useEmulators = false) {
  if (cached) return cached;
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (useEmulators) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  cached = { app, auth, db };
  return cached;
}

export function getFirebase() {
  if (!cached) throw new Error("Firebase not initialized — call initFirebase() first");
  return cached;
}
