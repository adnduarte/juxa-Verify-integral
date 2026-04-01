import defaultConfig from '../firebase-applet-config.json';

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId: string;
};

/**
 * Configuración Firebase para la app web.
 *
 * - Sin `VITE_FIREBASE_API_KEY` en el entorno: se usa **solo** `firebase-applet-config.json`
 *   (no hace falta ninguna variable VITE_FIREBASE_*).
 * - Con `VITE_FIREBASE_API_KEY`: se mezclan env + JSON; los campos vacíos en env se rellenan desde el JSON
 *   para no dejar `storageBucket` u otros en blanco.
 */
export function getFirebaseWebConfig(): FirebaseWebConfig {
  const env = import.meta.env;
  const def = defaultConfig as FirebaseWebConfig;
  if (env.VITE_FIREBASE_API_KEY) {
    /**
     * Evitar storageBucket '' si solo existe la API key en .env.
     */
    return {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN as string)?.trim() || def.authDomain,
      projectId: (env.VITE_FIREBASE_PROJECT_ID as string)?.trim() || def.projectId,
      storageBucket: (env.VITE_FIREBASE_STORAGE_BUCKET as string)?.trim() || def.storageBucket,
      messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID as string)?.trim() || def.messagingSenderId,
      appId: (env.VITE_FIREBASE_APP_ID as string)?.trim() || def.appId,
      firestoreDatabaseId: (env.VITE_FIREBASE_FIRESTORE_DATABASE_ID as string)?.trim() || def.firestoreDatabaseId,
    };
  }
  return def;
}

export const firebaseAppConfig = getFirebaseWebConfig();
