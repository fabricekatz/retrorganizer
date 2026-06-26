import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { signInAnonymously } from "firebase/auth";
import { initFirebase, getFirebase } from "../firebase/app";
import { contactsRepo } from "./contacts";
import { tasksRepo } from "./tasks";
import { eventsRepo } from "./events";
import { categoriesRepo } from "./categories";
import { clearCategoryReferences } from "./categoryCleanup";
import { clearFirestoreEmulator } from "../firebase/emulatorTestSupport";

const PROJECT_ID = "retrorganizer-dev";
let ownerId: string;

beforeAll(async () => {
  initFirebase({ apiKey: "x", authDomain: "x", projectId: PROJECT_ID, appId: "x" }, true);
  const { auth } = getFirebase();
  const cred = await signInAnonymously(auth);
  ownerId = cred.user.uid;
});

// Hermetic isolation: wipe the emulator before each test (clean slate).
beforeEach(() => clearFirestoreEmulator(PROJECT_ID));

describe("clearCategoryReferences", () => {
  it("nulls categoryId on referencing contacts, tasks, and events; leaves others", async () => {
    const cat = await categoriesRepo.create(ownerId, { name: "Travail", color: "#2f6f4f" });
    const other = await categoriesRepo.create(ownerId, { name: "Perso", color: "#a8431f" });

    const c1 = await contactsRepo.create(ownerId, { displayName: "Linked", categoryId: cat.id });
    const c2 = await contactsRepo.create(ownerId, { displayName: "Keep", categoryId: other.id });
    const t1 = await tasksRepo.create(ownerId, { title: "Linked task", categoryId: cat.id });
    const start = Date.now();
    const e1 = await eventsRepo.create(ownerId, { title: "Linked event", start, end: start + 3600000, categoryId: cat.id });

    await clearCategoryReferences(ownerId, cat.id);

    expect((await contactsRepo.get(c1.id))?.categoryId).toBeNull();
    expect((await contactsRepo.get(c2.id))?.categoryId).toBe(other.id);
    expect((await tasksRepo.get(t1.id))?.categoryId).toBeNull();
    expect((await eventsRepo.get(e1.id))?.categoryId).toBeNull();
  });
});
