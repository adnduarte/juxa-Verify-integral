#!/usr/bin/env node
/**
 * Diagnóstico rápido antes de seed:demo / seed:loong.
 * Uso: npm run seed:check
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, isAbsolute, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
dotenv.config({ path: join(root, '.env'), quiet: true });
if (existsSync(join(root, '.env.local'))) {
  dotenv.config({ path: join(root, '.env.local'), override: true, quiet: true });
}

const config = JSON.parse(readFileSync(join(root, 'firebase-applet-config.json'), 'utf8'));
const projectId = process.env.VITE_FIREBASE_PROJECT_ID?.trim() || config.projectId;

function which(cmd) {
  try {
    const out = execSync(`which ${cmd}`, { encoding: 'utf8' }).trim();
    return out || null;
  } catch {
    return null;
  }
}

console.log('\n=== Juxa Verify — comprobar entorno para seed (Firebase Admin) ===\n');
console.log('Proyecto Firebase (app + seed):', projectId);
console.log('');

const credRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
if (!credRaw) {
  console.log('GOOGLE_APPLICATION_CREDENTIALS: (no definida) → el seed usará Application Default Credentials si existen.');
} else {
  const resolved = isAbsolute(credRaw) ? credRaw : join(root, credRaw);
  if (existsSync(resolved)) {
    console.log('GOOGLE_APPLICATION_CREDENTIALS: OK →', resolved);
  } else {
    console.log('GOOGLE_APPLICATION_CREDENTIALS: RUTA INVÁLIDA →', resolved);
    console.log('  Corrige la ruta o ejecuta: unset GOOGLE_APPLICATION_CREDENTIALS');
  }
}
console.log('');

const gcloud = which('gcloud');
if (gcloud) {
  console.log('gcloud:', gcloud);
  try {
    execSync('gcloud auth application-default print-access-token', {
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 15000,
    });
    console.log('Application Default Credentials (usuario): parece configuradas (token obtenido).');
  } catch {
    console.log('Application Default Credentials: NO listas. Ejecuta:');
    console.log('  gcloud auth application-default login');
  }
} else {
  console.log('gcloud: NO instalado o no está en el PATH.');
  console.log('');
  console.log('>>> Pasos exactos (Mac, Homebrew) — copia línea a línea:');
  console.log('');
  console.log('    brew install --cask google-cloud-sdk');
  console.log('');
  console.log('Cierra esta terminal y abre una nueva para que exista `gcloud` en el PATH (a veces hace falta reiniciar Cursor).');
  console.log('');
  console.log('    gcloud --version');
  console.log('    unset GOOGLE_APPLICATION_CREDENTIALS');
  console.log('    gcloud auth application-default login');
  console.log('    cd "' + root + '"');
  console.log('    npm run seed:loong');
  console.log('    npm run dev');
  console.log('');
  console.log('Luego entra en: http://localhost:5177/login?loong=1  (botones de prueba Loong)');
  console.log('Sin Homebrew: https://cloud.google.com/sdk/docs/install-sdk');
}
console.log('');

const hasLoongPass = !!(process.env.SEED_LOONG_PASSWORD?.trim() || process.env.VITE_LOONG_QUICK_PASSWORD?.trim());
console.log(
  'Contraseña Loong (VITE_LOONG_QUICK_PASSWORD / SEED_LOONG_PASSWORD):',
  hasLoongPass ? 'definida en entorno' : 'no → el seed usará DemoJuxa2026! para Loong (alinea .env.local con el login)'
);
console.log('');

console.log('--- Siguiente paso ---\n');
if (credRaw && !existsSync(isAbsolute(credRaw) ? credRaw : join(root, credRaw))) {
  console.log('1) Arregla GOOGLE_APPLICATION_CREDENTIALS o: unset GOOGLE_APPLICATION_CREDENTIALS');
}
if (!gcloud && !credRaw) {
  console.log('1) Instala Google Cloud SDK y: gcloud auth application-default login');
  console.log('   O consigue un JSON de cuenta de servicio y export GOOGLE_APPLICATION_CREDENTIALS=ruta/al.json\n');
} else if (gcloud) {
  try {
    execSync('gcloud auth application-default print-access-token', { stdio: 'pipe', timeout: 15000 });
    console.log('1) npm run seed:loong');
    console.log('2) npm run dev   → http://localhost:5177/  (login con ?loong=1 para acceso rápido)\n');
  } catch {
    console.log('1) gcloud auth application-default login');
    console.log('2) npm run seed:loong');
    console.log('3) npm run dev\n');
  }
} else if (credRaw && existsSync(isAbsolute(credRaw) ? credRaw : join(root, credRaw))) {
  console.log('1) npm run seed:loong');
  console.log('2) npm run dev\n');
} else {
  console.log('1) Configura credenciales (gcloud ADC o JSON válido)');
  console.log('2) npm run seed:loong');
  console.log('3) npm run dev\n');
}
