import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { signInAnonymously } from "firebase/auth";
import { initFirebase, getFirebase } from "../firebase/app";
import { getDoc, doc } from "firebase/firestore";
import { fcmTokensRepo } from "./fcmTokens";
import { clearFirestoreEmulator } from "../firebase/emulatorTestSupport";

const PROJECT_ID = "retrorganizer-dev";
let ownerId: string;

beforeAll(async () => {
  initFirebase({ apiKey: "x", authDomain: "x", projectId: PROJECT_ID, appId: "x" }, true);
  const cred = await signInAnonymously(getFirebase().auth);
  ownerId = cred.user.uid;
});
beforeEach(() => clearFirestoreEmulator(PROJECT_ID));

describe("fcmTokensRepo", () => {
  it("registers a token idempotently under the token id with ownerId", async () => {
    await fcmTokensRepo.registerToken(ownerId, "tok-abc");
    await fcmTokensRepo.registerToken(ownerId, "tok-abc"); // again — no duplicate
    const snap = await getDoc(doc(getFirebase().db, "fcmTokens", "tok-abc"));
    expect(snap.exists()).toBe(true);
    expect(snap.data()?.ownerId).toBe(ownerId);
  });

  it("removeToken deletes the token doc", async () => {
    await fcmTokensRepo.registerToken(ownerId, "tok-del");
    await fcmTokensRepo.removeToken("tok-del");
    const snap = await getDoc(doc(getFirebase().db, "fcmTokens", "tok-del"));
    expect(snap.exists()).toBe(false);
  });
});
