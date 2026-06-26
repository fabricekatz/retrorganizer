import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { initFirebase, getFirebase } from "../firebase/app";
import { contactsRepo } from "./contacts";
import { clearFirestoreEmulator } from "../firebase/emulatorTestSupport";
import { signInAnonymously } from "firebase/auth";

const PROJECT_ID = "retrorganizer-dev";
let uid: string;

beforeAll(async () => {
  initFirebase({ apiKey: "x", authDomain: "x", projectId: PROJECT_ID, appId: "x" }, true);
  const cred = await signInAnonymously(getFirebase().auth);
  uid = cred.user.uid;
});

// Hermetic isolation: wipe the emulator before each test so every test starts
// from a clean slate, instead of relying on owner-scoped manual cleanup.
beforeEach(() => clearFirestoreEmulator(PROJECT_ID));

describe("repository trash operations", () => {
  it("listDeletedByOwner returns only soft-deleted docs; listByOwner excludes them", async () => {
    const a = await contactsRepo.create(uid, { displayName: "Garde" });
    const b = await contactsRepo.create(uid, { displayName: "Jeter" });
    await contactsRepo.softDelete(b.id);

    const active = await contactsRepo.listByOwner(uid);
    expect(active.map((c) => c.id)).toEqual([a.id]);

    const deleted = await contactsRepo.listDeletedByOwner(uid);
    expect(deleted.map((c) => c.id)).toEqual([b.id]);
  });

  it("restore brings a soft-deleted doc back into listByOwner", async () => {
    const c = await contactsRepo.create(uid, { displayName: "Restaurer" });
    await contactsRepo.softDelete(c.id);
    await contactsRepo.restore(c.id);

    expect((await contactsRepo.get(c.id))?.displayName).toBe("Restaurer");
    expect(await contactsRepo.listDeletedByOwner(uid)).toEqual([]);
    expect((await contactsRepo.listByOwner(uid)).map((x) => x.id)).toContain(c.id);
  });

  it("hardDelete permanently removes a doc", async () => {
    const c = await contactsRepo.create(uid, { displayName: "Purger" });
    await contactsRepo.softDelete(c.id);
    await contactsRepo.hardDelete(c.id);

    expect(await contactsRepo.get(c.id)).toBeNull();
    expect(await contactsRepo.listDeletedByOwner(uid)).toEqual([]);
  });
});
