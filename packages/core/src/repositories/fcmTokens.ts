import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { getFirebase } from "../firebase/app";

export const fcmTokensRepo = {
  async registerToken(ownerId: string, token: string): Promise<void> {
    const now = Date.now();
    await setDoc(
      doc(getFirebase().db, "fcmTokens", token),
      { id: token, ownerId, createdAt: now, updatedAt: now },
      { merge: true },
    );
  },
  async removeToken(token: string): Promise<void> {
    await deleteDoc(doc(getFirebase().db, "fcmTokens", token));
  },
};
