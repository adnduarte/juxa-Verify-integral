/**
 * Modo construcción local (`npm run dev` sin `VITE_USE_FIREBASE=true`):
 * - Sin Firebase Auth (sesión en `localStorage`)
 * - Firestore en memoria (sin red)
 */
export function isLocalConstructionMode(): boolean {
  if (import.meta.env.VITE_USE_FIREBASE === 'true') return false;
  return import.meta.env.DEV;
}

/** @deprecated usar isLocalConstructionMode */
export const isLocalNoFirebaseAuth = isLocalConstructionMode;
