import { addDoc, collection, onSnapshot, orderBy, query, type Firestore } from 'firebase/firestore';

export const LOONG_VENDOR_CONTACT_SUBCOLLECTION = 'vendor_contact';

export type VendorContactDoc = {
  id: string;
  createdAt: string;
  authorUid: string;
  authorEmail?: string;
  kind: 'comment' | 'file';
  text: string;
  storageUrl?: string;
  fileName?: string;
};

export function vendorContactCollectionRef(db: Firestore, investigationId: string) {
  return collection(db, 'investigations', investigationId, LOONG_VENDOR_CONTACT_SUBCOLLECTION);
}

export function subscribeVendorContactThread(
  db: Firestore,
  investigationId: string,
  onNext: (rows: VendorContactDoc[]) => void,
  onError?: (e: unknown) => void
) {
  const q = query(vendorContactCollectionRef(db, investigationId), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as VendorContactDoc[];
      onNext(rows);
    },
    (err) => onError?.(err)
  );
}

export async function addVendorContactComment(
  db: Firestore,
  investigationId: string,
  input: { authorUid: string; authorEmail?: string | null; text: string }
): Promise<void> {
  const now = new Date().toISOString();
  await addDoc(vendorContactCollectionRef(db, investigationId), {
    createdAt: now,
    authorUid: input.authorUid,
    authorEmail: input.authorEmail || null,
    kind: 'comment',
    text: input.text.trim(),
  });
}

export async function addVendorContactFile(
  db: Firestore,
  investigationId: string,
  input: {
    authorUid: string;
    authorEmail?: string | null;
    storageUrl: string;
    fileName: string;
    caption?: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await addDoc(vendorContactCollectionRef(db, investigationId), {
    createdAt: now,
    authorUid: input.authorUid,
    authorEmail: input.authorEmail || null,
    kind: 'file',
    text: (input.caption || `Archivo: ${input.fileName}`).trim(),
    storageUrl: input.storageUrl,
    fileName: input.fileName,
  });
}
