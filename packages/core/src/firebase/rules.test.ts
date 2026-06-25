import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
});
