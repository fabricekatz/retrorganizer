import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where,
} from "firebase/firestore";
import { getFirebase } from "../firebase/app";
import type { BaseEntity } from "../domain/types";

export interface Repository<T extends BaseEntity> {
  create(ownerId: string, data: Partial<T>): Promise<T>;
  get(id: string): Promise<T | null>;
  update(id: string, patch: Partial<T>): Promise<void>;
  softDelete(id: string): Promise<void>;
  listByOwner(ownerId: string): Promise<T[]>;
}

export function createRepository<T extends BaseEntity>(
  collectionName: string,
  parse: (input: unknown) => T,
): Repository<T> {
  const col = () => collection(getFirebase().db, collectionName);
  const ref = (id: string) => doc(getFirebase().db, collectionName, id);

  return {
    async create(ownerId, data) {
      const now = Date.now();
      const id = data.id ?? crypto.randomUUID();
      const entity = parse({ ...data, id, ownerId, createdAt: now, updatedAt: now, deletedAt: null });
      await setDoc(ref(id), entity as object);
      return entity;
    },
    async get(id) {
      const snap = await getDoc(ref(id));
      if (!snap.exists()) return null;
      const entity = parse(snap.data());
      return entity.deletedAt === null ? entity : null;
    },
    async update(id, patch) {
      await updateDoc(ref(id), { ...patch, updatedAt: Date.now() });
    },
    async softDelete(id) {
      await updateDoc(ref(id), { deletedAt: Date.now() });
    },
    async listByOwner(ownerId) {
      const q = query(col(), where("ownerId", "==", ownerId), where("deletedAt", "==", null));
      const snap = await getDocs(q);
      return snap.docs.map((d) => parse(d.data()));
    },
  };
}
