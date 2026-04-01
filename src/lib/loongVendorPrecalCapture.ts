import { doc, getDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';

export function storageContentTypeForVendorFile(file: File): string {
  if (file.type && file.type.length > 0) return file.type;
  const n = file.name.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

/**
 * Sube INE (frente) capturada por el vendedor al expediente de precal Loong.
 * Mezcla con uploadedFileUrls existentes si ya hubiera claves.
 */
export async function uploadVendorIneToInvestigation(
  db: Firestore,
  storage: FirebaseStorage,
  input: { investigationId: string; vendorUid: string; file: File }
): Promise<string> {
  if (input.file.size > 15 * 1024 * 1024) {
    throw new Error('El archivo supera 15 MB.');
  }
  const safe = input.file.name.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'ine';
  const path = `loong_vendor_docs/${input.investigationId}/${input.vendorUid}/ine_${Date.now()}_${safe}`;
  const sref = ref(storage, path);
  await uploadBytes(sref, input.file, { contentType: storageContentTypeForVendorFile(input.file) });
  const url = await getDownloadURL(sref);

  const invRef = doc(db, 'investigations', input.investigationId);
  const snap = await getDoc(invRef);
  const prev = snap.exists() ? snap.data()?.uploadedFileUrls : undefined;
  const merged: Record<string, string> =
    prev != null && typeof prev === 'object' && !Array.isArray(prev)
      ? { ...(prev as Record<string, string>) }
      : {};
  merged.vendorIneFrente = url;

  await updateDoc(invRef, {
    uploadedFileUrls: merged,
    updatedAt: new Date().toISOString(),
  });
  return url;
}
