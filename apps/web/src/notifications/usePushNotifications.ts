import { useCallback, useEffect, useState } from "react";
import { isSupported, getMessaging, getToken, onMessage } from "firebase/messaging";
import { fcmTokensRepo } from "@retrorganizer/core";
import { bootstrapFirebase } from "../firebaseConfig";
import { useAuth } from "../auth/AuthProvider";

type Status = "unsupported" | "default" | "granted" | "denied";

const VAPID_KEY: string | undefined = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export interface UsePushNotifications {
  status: Status;
  /** Requests permission if needed, then registers this device's FCM token. Returns true on success. */
  enable(): Promise<boolean>;
}

export function usePushNotifications(): UsePushNotifications {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [status, setStatus] = useState<Status>("unsupported");

  useEffect(() => {
    let active = true;
    void (async () => {
      const ok = (await isSupported().catch(() => false)) && typeof Notification !== "undefined";
      if (!active) return;
      setStatus(ok ? (Notification.permission as Status) : "unsupported");
    })();
    return () => { active = false; };
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!uid || typeof Notification === "undefined") return false;
    // Returns "granted" instantly if already granted, so this also re-registers a device.
    const permission = await Notification.requestPermission();
    setStatus(permission as Status);
    if (permission !== "granted") return false;
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const { app } = bootstrapFirebase();
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return false;
    await fcmTokensRepo.registerToken(uid, token);
    // Foreground messages: the in-app reminder toast already covers this, so suppress here to avoid double-notifying.
    onMessage(messaging, () => {});
    return true;
  }, [uid]);

  return { status, enable };
}
