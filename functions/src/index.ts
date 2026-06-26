import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { parseEvent } from "../../packages/core/src/domain/event";
import { parseTask } from "../../packages/core/src/domain/task";
import { planSends, type OwnerWork } from "./orchestrate";

initializeApp();
const HALF_OPEN_DEFAULT_LOOKBACK = 6 * 60 * 60000; // first run / missing state: look back 6h

export const sendReminders = onSchedule("every 5 minutes", async () => {
  const db = getFirestore();
  const now = Date.now();

  // Owners that have at least one registered device.
  const tokensSnap = await db.collection("fcmTokens").get();
  const tokensByOwner = new Map<string, string[]>();
  for (const d of tokensSnap.docs) {
    const ownerIdRaw = d.get("ownerId");
    const ownerId = typeof ownerIdRaw === "string" ? ownerIdRaw : undefined;
    if (!ownerId) continue;
    const arr = tokensByOwner.get(ownerId) ?? [];
    arr.push(d.id);
    tokensByOwner.set(ownerId, arr);
  }

  const work: OwnerWork[] = [];
  for (const [ownerId, tokens] of tokensByOwner) {
    const stateRef = db.doc(`reminderState/${ownerId}`);
    const stateSnap = await stateRef.get();
    const lastCheckRaw = stateSnap.get("lastCheck");
    const lastCheck = typeof lastCheckRaw === "number" ? lastCheckRaw : now - HALF_OPEN_DEFAULT_LOOKBACK;
    const [evSnap, tkSnap] = await Promise.all([
      db.collection("events").where("ownerId", "==", ownerId).where("deletedAt", "==", null).get(),
      db.collection("tasks").where("ownerId", "==", ownerId).where("deletedAt", "==", null).get(),
    ]);
    work.push({
      ownerId, tokens,
      events: evSnap.docs.map((d) => parseEvent(d.data())),
      tasks: tkSnap.docs.map((d) => parseTask(d.data())),
      lastCheck,
    });
  }

  const messaging = getMessaging();
  for (const send of planSends(work, now)) {
    for (const p of send.payloads) {
      const res = await messaging.sendEachForMulticast({ tokens: send.tokens, notification: p });
      // Prune tokens that FCM reports as unregistered.
      res.responses.forEach((r, i) => {
        if (!r.success && r.error?.code === "messaging/registration-token-not-registered") {
          void db.collection("fcmTokens").doc(send.tokens[i]!).delete();
        }
      });
    }
    await db.doc(`reminderState/${send.ownerId}`).set({ lastCheck: now }, { merge: true });
  }
});
