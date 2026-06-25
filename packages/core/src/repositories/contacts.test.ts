import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { signInAnonymously } from "firebase/auth";
import { initFirebase } from "../firebase/app";
import { contactsRepo } from "./contacts";
import { getFirebase } from "../firebase/app";

const PROJECT_ID = "retrorganizer-dev";

async function clearFirestoreData() {
  const url = `http://127.0.0.1:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  await fetch(url, { method: "DELETE" });
}

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

beforeEach(async () => {
  await clearFirestoreData();
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
