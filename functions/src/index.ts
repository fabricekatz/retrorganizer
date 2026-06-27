import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { parseEvent } from "../../packages/core/src/domain/event";
import { parseTask } from "../../packages/core/src/domain/task";
import { planSends, type OwnerWork } from "./orchestrate";

initializeApp();
const HALF_OPEN_DEFAULT_LOOKBACK = 6 * 60 * 60000; // first run / missing state: look back 6h

// Last 8 chars only — enough to correlate a device across runs without logging the full token.
const tail = (token: string) => `…${token.slice(-8)}`;

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

  logger.info("sweep start", { tokenDocs: tokensSnap.size, owners: tokensByOwner.size });
  if (tokensByOwner.size === 0) return; // no devices registered — nothing to do

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
    logger.info("owner scanned", {
      ownerId, tokens: tokens.map(tail), events: evSnap.size, tasks: tkSnap.size,
      lastCheck, windowMinutes: Math.round((now - lastCheck) / 60000),
    });
    work.push({
      ownerId, tokens,
      events: evSnap.docs.map((d) => parseEvent(d.data())),
      tasks: tkSnap.docs.map((d) => parseTask(d.data())),
      lastCheck,
    });
  }

  const sends = planSends(work, now);
  logger.info("planned sends", { owners: sends.length, payloads: sends.reduce((n, s) => n + s.payloads.length, 0) });

  const messaging = getMessaging();
  for (const send of sends) {
    for (const p of send.payloads) {
      const res = await messaging.sendEachForMulticast({ tokens: send.tokens, notification: p });
      const errors = res.responses.filter((r) => !r.success).map((r) => r.error?.code);
      logger.info("fcm send", {
        ownerId: send.ownerId, title: p.title,
        success: res.successCount, failure: res.failureCount, errors,
      });
      // Prune tokens that FCM reports as unregistered.
      res.responses.forEach((r, i) => {
        if (!r.success && r.error?.code === "messaging/registration-token-not-registered") {
          logger.info("pruning dead token", { token: tail(send.tokens[i]!) });
          void db.collection("fcmTokens").doc(send.tokens[i]!).delete();
        }
      });
    }
    await db.doc(`reminderState/${send.ownerId}`).set({ lastCheck: now }, { merge: true });
  }
});
