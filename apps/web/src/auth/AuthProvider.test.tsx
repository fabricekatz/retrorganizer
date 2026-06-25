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

type AuthValueRef = ReturnType<typeof useAuth>;
let capturedAuth: AuthValueRef | null = null;
function CaptureAuth() {
  capturedAuth = useAuth();
  return null;
}

describe("AuthProvider", () => {
  beforeEach(() => { authCallback = () => {}; capturedAuth = null; });

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

  it("delegates signInEmail and signInGoogle to the correct firebase/auth functions", async () => {
    const { signInWithEmailAndPassword, signInWithPopup } = await import("firebase/auth");
    render(<AuthProvider><CaptureAuth /></AuthProvider>);
    act(() => authCallback(null));

    await act(async () => { await capturedAuth!.signInEmail("ada@x.io", "pw"); });
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(), "ada@x.io", "pw"
    );

    await act(async () => { await capturedAuth!.signInGoogle(); });
    expect(signInWithPopup).toHaveBeenCalled();
  });
});
