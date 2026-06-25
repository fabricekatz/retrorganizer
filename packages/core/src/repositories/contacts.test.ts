import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { signInAnonymously } from "firebase/auth";
import { initFirebase } from "../firebase/app";
import { contactsRepo } from "./contacts";
import { getFirebase } from "../firebase/app";

const PROJECT_ID = "retrorganizer-dev";

let ownerId: string;

beforeAll(async () => {
  initFirebase(
    { apiKey: "x", authDomain: "x", projectId: PROJECT_ID, appId: "x" },
    true,
  );
  const { auth } = getFirebase();
  const cred = await signInAnonymously(auth);
  ownerId = cred.user.uid;
});

afterEach(async () => {
  const active = await contactsRepo.listByOwner(ownerId);
  const deleted = await contactsRepo.listDeletedByOwner(ownerId);
  await Promise.all([...active, ...deleted].map((c) => contactsRepo.hardDelete(c.id)));
});

describe("contactsRepo", () => {
  it("creates and reads back a contact", async () => {
    const created = await contactsRepo.create(ownerId, { displayName: "Ada Lovelace" });
    expect(created.id).toBeTruthy();
    expect(created.ownerId).toBe(ownerId);
    expect(created.deletedAt).toBeNull();
    const fetched = await contactsRepo.get(created.id);
    expect(fetched?.displayName).toBe("Ada Lovelace");
  });

  it("hides soft-deleted contacts from get and list", async () => {
    const c = await contactsRepo.create(ownerId, { displayName: "Temp" });
    await contactsRepo.softDelete(c.id);
    expect(await contactsRepo.get(c.id)).toBeNull();
    const list = await contactsRepo.listByOwner(ownerId);
    expect(list.find((x) => x.id === c.id)).toBeUndefined();
  });
});
