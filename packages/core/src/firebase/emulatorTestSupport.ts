// Test-only helper: wipe all Firestore data in the local emulator so each test
// starts from a guaranteed-clean slate (hermetic isolation). Uses the emulator's
// REST clear endpoint; not for production code.
export async function clearFirestoreEmulator(projectId: string, host = "127.0.0.1:8080"): Promise<void> {
  const url = `http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Failed to clear Firestore emulator: ${res.status} ${res.statusText}`);
  }
}
