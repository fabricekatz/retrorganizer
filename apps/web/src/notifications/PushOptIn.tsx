import { tokens } from "@retrorganizer/ui";
import { usePushNotifications } from "./usePushNotifications";

export function PushOptIn() {
  const { status, enable } = usePushNotifications();
  if (status !== "default") return null;
  return (
    <button type="button" onClick={() => void enable()}
      title="Recevoir les rappels même quand l'app est fermée"
      style={{ font: `12px ${tokens.font.body}` }}>
      Activer les notifications
    </button>
  );
}
