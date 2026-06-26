import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "retrorganizer-dev",
    firestore: { rules: readFileSync("../../firestore.rules", "utf8") },
  });
});

// Hermetic isolation: clear the (shared "retrorganizer-dev") emulator data
// before each test so this file leaves no residue for the repo test files.
beforeEach(async () => { await env.clearFirestore(); });

afterAll(async () => { await env.cleanup(); });

describe("firestore rules", () => {
  it("lets a user create their own contact", async () => {
    const db = env.authenticatedContext("u1").firestore();
    await assertSucceeds(
      setDoc(doc(db, "contacts/c1"), { ownerId: "u1", displayName: "Ada" }),
    );
  });

  it("forbids reading another user's contact", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "contacts/c2"), { ownerId: "u1", displayName: "Ada" });
    });
    const db = env.authenticatedContext("intruder").firestore();
    await assertFails(getDoc(doc(db, "contacts/c2")));
  });

  it("lets a user create their own fcmToken", async () => {
    const db = env.authenticatedContext("u1").firestore();
    await assertSucceeds(setDoc(doc(db, "fcmTokens/tok1"), { id: "tok1", ownerId: "u1", createdAt: 1, updatedAt: 1 }));
  });

  it("forbids creating an fcmToken owned by someone else", async () => {
    const db = env.authenticatedContext("u1").firestore();
    await assertFails(setDoc(doc(db, "fcmTokens/tok2"), { id: "tok2", ownerId: "u2", createdAt: 1, updatedAt: 1 }));
  });
});
