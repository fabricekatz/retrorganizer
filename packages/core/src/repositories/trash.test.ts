import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { initFirebase, getFirebase } from "../firebase/app";
import { contactsRepo } from "./contacts";
import { signInAnonymously } from "firebase/auth";

let uid: string;

beforeAll(async () => {
  initFirebase({ apiKey: "x", authDomain: "x", projectId: "retrorganizer-dev", appId: "x" }, true);
  const cred = await signInAnonymously(getFirebase().auth);
  uid = cred.user.uid;
});

// Owner-scoped cleanup (the anon uid is unique to THIS test file), so it never
// wipes other emulator test files' data — uses hardDelete (the method under test).
afterEach(async () => {
  const active = await contactsRepo.listByOwner(uid);
  const deleted = await contactsRepo.listDeletedByOwner(uid);
  await Promise.all([...active, ...deleted].map((c) => contactsRepo.hardDelete(c.id)));
});

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
