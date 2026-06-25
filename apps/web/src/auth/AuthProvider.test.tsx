import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthProvider";

vi.mock("@retrorganizer/core", () => ({
  getFirebase: () => ({ auth: {} }),
  initFirebase: () => ({ auth: {} }),
}));

let authCallback: (u: unknown) => void = () => {};
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => { authCallback = cb; return () => {}; },
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: class {},
  signOut: vi.fn(),
}));

function Probe() {
  const { user, loading } = useAuth();
  return <div>{loading ? "loading" : user ? `user:${user.uid}` : "anon"}</div>;
}

describe("AuthProvider", () => {
  beforeEach(() => { authCallback = () => {}; });

  it("exposes the authenticated user once auth state resolves", () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText("loading")).toBeInTheDocument();
    act(() => authCallback({ uid: "u1", email: "ada@x.io" }));
    expect(screen.getByText("user:u1")).toBeInTheDocument();
  });

  it("shows anon when no user", () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    act(() => authCallback(null));
    expect(screen.getByText("anon")).toBeInTheDocument();
  });
});
