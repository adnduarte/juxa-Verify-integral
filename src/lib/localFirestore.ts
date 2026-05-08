/**
 * Puente Firestore: en modo construcción local usa memoria; con `VITE_USE_FIREBASE=true` usa SDK real.
 */
import * as real from 'firebase/firestore';
import * as mem from './memoryFirestoreImpl';
import { isLocalConstructionMode } from './localDataMode';

export const getFirestore = ((app?: Parameters<typeof real.getFirestore>[0], databaseId?: string) => {
  if (isLocalConstructionMode()) return mem.getFirestore() as ReturnType<typeof real.getFirestore>;
  return real.getFirestore(app!, databaseId as string);
}) as typeof real.getFirestore;

export const collection = (...args: Parameters<typeof real.collection>) =>
  (isLocalConstructionMode() ? mem.collection : real.collection)(...args);

export const doc = (...args: Parameters<typeof real.doc>) =>
  (isLocalConstructionMode() ? mem.doc : real.doc)(...args);

export const query = (...args: Parameters<typeof real.query>) =>
  (isLocalConstructionMode() ? mem.query : real.query)(...args);

export const where = (...args: Parameters<typeof real.where>) =>
  (isLocalConstructionMode() ? mem.where : real.where)(...args);

export const orderBy = (...args: Parameters<typeof real.orderBy>) =>
  (isLocalConstructionMode() ? mem.orderBy : real.orderBy)(...args);

export const getDoc = (...args: Parameters<typeof real.getDoc>) =>
  (isLocalConstructionMode() ? mem.getDoc : real.getDoc)(...args);

export const getDocs = (...args: Parameters<typeof real.getDocs>) =>
  (isLocalConstructionMode() ? mem.getDocs : real.getDocs)(...args);

export const setDoc = (...args: Parameters<typeof real.setDoc>) =>
  (isLocalConstructionMode() ? mem.setDoc : real.setDoc)(...args);

export const addDoc = (...args: Parameters<typeof real.addDoc>) =>
  (isLocalConstructionMode() ? mem.addDoc : real.addDoc)(...args);

export const updateDoc = (...args: Parameters<typeof real.updateDoc>) =>
  (isLocalConstructionMode() ? mem.updateDoc : real.updateDoc)(...args);

export const deleteDoc = (...args: Parameters<typeof real.deleteDoc>) =>
  (isLocalConstructionMode() ? mem.deleteDoc : real.deleteDoc)(...args);

export const onSnapshot = (...args: Parameters<typeof real.onSnapshot>) =>
  (isLocalConstructionMode() ? mem.onSnapshot : real.onSnapshot)(...args) as ReturnType<typeof real.onSnapshot>;
