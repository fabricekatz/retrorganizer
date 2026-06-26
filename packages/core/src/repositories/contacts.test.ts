import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { signInAnonymously } from "firebase/auth";
import { initFirebase } from "../firebase/app";
import { contactsRepo } from "./contacts";
import { getFirebase } from "../firebase/app";
import { clearFirestoreEmulator } from "../firebase/emulatorTestSupport";

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

// Hermetic isolation: wipe the emulator before each test (clean slate).
beforeEach(() => clearFirestoreEmulator(PROJECT_ID));

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
