import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, signOut as fbSignOut,
} from "firebase/auth";
import { getFirebase } from "@retrorganizer/core";

interface AuthUser { uid: string; email: string | null; }
interface AuthValue {
  user: AuthUser | null;
  loading: boolean;
  signInEmail(email: string, pw: string): Promise<void>;
  signUpEmail(email: string, pw: string): Promise<void>;
  signInGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { auth } = getFirebase();

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u ? { uid: u.uid, email: u.email } : null);
      setLoading(false);
    });
  }, [auth]);

  const value = useMemo<AuthValue>(() => ({
    user,
    loading,
    signInEmail: async (e, p) => { await signInWithEmailAndPassword(auth, e, p); },
    signUpEmail: async (e, p) => { await createUserWithEmailAndPassword(auth, e, p); },
    signInGoogle: async () => { await signInWithPopup(auth, new GoogleAuthProvider()); },
    signOut: async () => { await fbSignOut(auth); },
  }), [user, loading, auth]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
