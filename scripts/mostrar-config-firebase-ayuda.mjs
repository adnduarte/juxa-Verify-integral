#!/usr/bin/env node
/**
 * Muestra firebase-applet-config.json y recuerda dónde obtener cada campo en Firebase Console.
 * Uso: npm run firebase:ayuda-config
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pathJson = join(root, 'firebase-applet-config.json');

let cfg;
try {
  cfg = JSON.parse(readFileSync(pathJson, 'utf8'));
} catch (e) {
  console.error('No se pudo leer firebase-applet-config.json. Crea el archivo en la raíz del repo.\n', e.message);
  process.exit(1);
}

console.log('\n=== Valores actuales (firebase-applet-config.json) ===\n');
console.log(JSON.stringify(cfg, null, 2));

console.log(`
=== Dónde obtener / qué es cada campo ===

Firebase Console: https://console.firebase.google.com
  → Tu proyecto → ⚙️ "Configuración del proyecto" → pestaña "General"
  → Bajar a "Tus aplicaciones" → app Web (ícono </>)
  → Objeto firebaseConfig o campos equivalentes

  apiKey              → apiKey
  authDomain          → authDomain
  projectId           → projectId
  storageBucket       → storageBucket
  messagingSenderId   → messagingSenderId
  appId               → appId

  firestoreDatabaseId → Casi siempre: (default)
     Solo cambia si en Firestore creaste una base con nombre distinto al predeterminado.

Firestore (crear la base si aún no existe):
  Menú: Build → Firestore Database → "Crear base de datos"

Reglas del proyecto (desde la raíz del repo):
  npm run deploy:rules
  (o deploy:firestore-rules, deploy:firestore-indexes, deploy:storage)

Guía detallada en español:
  docs/donde-sacar-firebase-y-firestore.md
`);
