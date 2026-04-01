/**
 * Segunda instancia de Firebase Auth para crear usuarios sin cerrar la sesión del admin actual.
 * Debe usar la misma config que `src/firebase.ts` (incl. overrides VITE_FIREBASE_* en .env.local);
 * si no, el alta desde Equipo crearía usuarios en otro proyecto y el login fallaría.
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, signOut, type Auth } from 'firebase/auth';
import { firebaseAppConfig } from '../firebaseConfig';

function getSecondaryApp(): FirebaseApp {
  const name = 'Secondary';
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;
  return initializeApp(firebaseAppConfig as Record<string, unknown>, name);
}

export const secondaryApp = getSecondaryApp();
export const secondaryAuth: Auth = getAuth(secondaryApp);

/** Evita que la instancia secundaria quede con sesión del usuario creado (puede bloquear siguientes altas). */
export async function signOutSecondaryAuth(): Promise<void> {
  try {
    await signOut(secondaryAuth);
  } catch {
    /* ignore */
  }
}
