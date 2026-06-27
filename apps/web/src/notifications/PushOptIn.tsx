import { useState } from "react";
import { tokens } from "@retrorganizer/ui";
import { usePushNotifications } from "./usePushNotifications";

export function PushOptIn() {
  const { status, enable } = usePushNotifications();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"ok" | "fail" | null>(null);

  if (status === "unsupported") return null;

  if (status === "denied") {
    return (
      <span style={{ font: `12px ${tokens.font.body}`, color: tokens.color.ink, opacity: 0.7 }}>
        Notifications bloquées. Autorisez-les dans les réglages du site, puis rouvrez ce menu.
      </span>
    );
  }

  const label =
    result === "ok" ? "Appareil enregistré ✓"
    : result === "fail" ? "Échec — réessayer"
    : busy ? "Enregistrement…"
    : status === "granted" ? "Enregistrer cet appareil"
    : "Activer les notifications";

  async function onClick() {
    setBusy(true);
    setResult(null);
    try {
      setResult((await enable()) ? "ok" : "fail");
    } catch {
      setResult("fail");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={() => void onClick()} disabled={busy}
      title="Recevoir les rappels même quand l'app est fermée"
      style={{ font: `12px ${tokens.font.body}` }}>
      {label}
    </button>
  );
}
