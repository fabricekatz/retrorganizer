import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePushNotifications } from "./usePushNotifications";

const registerToken = vi.fn();
vi.mock("@retrorganizer/core", () => ({ fcmTokensRepo: { registerToken: (...a: unknown[]) => registerToken(...a), removeToken: vi.fn() } }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));
const getToken = vi.fn();
const onMessage = vi.fn();
vi.mock("firebase/messaging", () => ({
  isSupported: () => Promise.resolve(true),
  getMessaging: () => ({}),
  getToken: (...a: unknown[]) => getToken(...a),
  onMessage: (...a: unknown[]) => onMessage(...a),
}));
vi.mock("../firebaseConfig", () => ({ bootstrapFirebase: () => ({ app: {} }) }));

beforeEach(() => {
  registerToken.mockReset().mockResolvedValue(undefined);
  getToken.mockReset().mockResolvedValue("tok-xyz");
  vi.stubGlobal("Notification", { permission: "default", requestPermission: vi.fn().mockResolvedValue("granted") });
  vi.stubGlobal("navigator", { serviceWorker: { register: vi.fn().mockResolvedValue({}) } });
});

describe("usePushNotifications", () => {
  it("enable() stores the token after permission is granted", async () => {
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.status).toBe("default"));
    await act(async () => { await result.current.enable(); });
    expect(getToken).toHaveBeenCalled();
    expect(registerToken).toHaveBeenCalledWith("u1", "tok-xyz");
  });

  it("does not store a token when permission is denied", async () => {
    vi.stubGlobal("Notification", { permission: "default", requestPermission: vi.fn().mockResolvedValue("denied") });
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.status).toBe("default"));
    await act(async () => { await result.current.enable(); });
    expect(registerToken).not.toHaveBeenCalled();
    expect(result.current.status).toBe("denied");
  });
});
