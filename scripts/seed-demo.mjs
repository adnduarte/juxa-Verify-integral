#!/usr/bin/env node
/**
 * Crea o actualiza usuarios demo en Firebase Auth + documentos en Firestore.
 * También crea los perfiles Loong de acceso rápido (/login?loong=1); misma lista que
 * src/config/loongQuickUsers.ts (LOONG_QUICK_USERS).
 *
 * Requisitos:
 *   - Firebase Admin SDK: credenciales de cuenta de servicio O credenciales de usuario (ADC).
 *   - Opción A: GOOGLE_APPLICATION_CREDENTIALS apuntando a un JSON descargado (si tu org. lo permite).
 *   - Opción B (recomendada si la consola dice que no se permiten claves en la cuenta de servicio):
 *     sin variable GOOGLE_APPLICATION_CREDENTIALS → `gcloud auth application-default login`
 *     Necesitas rol suficiente en el proyecto GCP (p. ej. Editor/Owner o permisos Firebase).
 *
 * Uso:
 *   npm run seed:demo
 *   npm run seed:loong          # solo loong.*@juxa.test + pre_reg + política simulador
 *   SEED_DEMO_PASSWORD="OtraClave" npm run seed:demo
 *   VITE_LOONG_QUICK_PASSWORD="misma_que_env_local" npm run seed:demo
 *
 * Importante: igual que Vite, se cargan .env y luego .env.local (este último gana).
 * Así VITE_LOONG_QUICK_PASSWORD definida solo en .env.local se usa al sembrar Loong.
 */

import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { dirname, isAbsolute, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
dotenv.config({ path: join(root, '.env') });
if (existsSync(join(root, '.env.local'))) {
  dotenv.config({ path: join(root, '.env.local'), override: true });
}

const config = JSON.parse(readFileSync(join(root, 'firebase-applet-config.json'), 'utf8'));

const loongOnly = process.argv.includes('--loong-only');

const password =
  process.env.SEED_DEMO_PASSWORD?.trim() ||
  process.env.VITE_DEMO_SHARED_PASSWORD?.trim() ||
  'DemoJuxa2026!';

const loongPassword =
  process.env.SEED_LOONG_PASSWORD?.trim() ||
  process.env.VITE_LOONG_QUICK_PASSWORD?.trim() ||
  password;

const DEFAULT_ORG_LOONG = 'loong_motor';

const DEMO_USERS = [
  {
    email: 'demo.admin@juxa.test',
    role: 'ADMIN',
    clientType: 'GRATUITO',
    clientProfile: 'GENERAL',
    credits: 999,
  },
  {
    email: 'demo.analyst@juxa.test',
    role: 'ANALISTA_CREDITO',
    clientType: 'GRATUITO',
    clientProfile: 'GENERAL',
    credits: 100,
  },
  {
    email: 'demo.client@juxa.test',
    role: 'CLIENTE',
    clientType: 'GRATUITO',
    clientProfile: 'LOONG_MOTOR',
    credits: 50,
  },
];

/** Misma lista que LOONG_QUICK_USERS en src/config/loongQuickUsers.ts */
const LOONG_QUICK_USERS = [
  {
    email: 'loong.superadmin@juxa.test',
    role: 'ADMIN',
    clientType: 'GRATUITO',
    clientProfile: 'LOONG_MOTOR',
    credits: 999,
  },
  {
    email: 'loong.supervisor@juxa.test',
    role: 'SUPERVISOR',
    clientType: 'GRATUITO',
    clientProfile: 'LOONG_MOTOR',
    credits: 200,
  },
  {
    email: 'loong.vendedor@juxa.test',
    role: 'CLIENTE',
    clientType: 'GRATUITO',
    clientProfile: 'LOONG_MOTOR',
    credits: 50,
  },
  {
    email: 'loong.comercial@juxa.test',
    role: 'EJECUTIVO_VENTAS',
    clientType: 'GRATUITO',
    clientProfile: 'LOONG_MOTOR',
    credits: 100,
  },
  {
    email: 'loong.mesa@juxa.test',
    role: 'ANALISTA_MESA_CONTROL',
    clientType: 'GRATUITO',
    clientProfile: 'LOONG_MOTOR',
    credits: 0,
  },
  {
    email: 'loong.atencion@juxa.test',
    role: 'ATENCION_CLIENTE',
    clientType: 'GRATUITO',
    clientProfile: 'LOONG_MOTOR',
    credits: 0,
  },
  {
    email: 'loong.cobranza.admin@juxa.test',
    role: 'ADMIN_COBRANZA',
    clientType: 'GRATUITO',
    clientProfile: 'LOONG_MOTOR',
    credits: 0,
  },
  {
    email: 'loong.cobranza.agente@juxa.test',
    role: 'AGENTE_COBRANZA',
    clientType: 'GRATUITO',
    clientProfile: 'LOONG_MOTOR',
    credits: 0,
  },
];

/**
 * Cuentas reales @loong.mx: mismo tenant `loong_motor` y misma contraseña Loong (`VITE_LOONG_QUICK_PASSWORD` / SEED_LOONG_PASSWORD).
 * Añade aquí mesa2@loong.mx, etc. El login en la app también asigna `organizationId` si falta (ver `defaultOrganizationIdFromEmail`).
 */
const LOONG_MX_CORP_USERS = [
  {
    email: 'mesa1@loong.mx',
    role: 'ANALISTA_MESA_CONTROL',
    clientType: 'GRATUITO',
    clientProfile: 'LOONG_MOTOR',
    credits: 0,
  },
];

const DEFAULT_LOONG_POLICY = {
  minDownPaymentPct: 15,
  maxLoanToIncomeRatio: 0.35,
  maxDebtToIncomeRatio: 0.45,
  minJobMonths: 6,
  minPassingScore: 62,
  maxTermMonths: 48,
  annualInterestPct: 22,
  scoreWeights: { capacity: 40, leverage: 35, behavior: 25 },
};

async function seedOneUser(auth, db, u, pass) {
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(u.email);
    await auth.updateUser(userRecord.uid, { password: pass, emailVerified: true });
    console.log(`Auth: actualizado ${u.email} (${userRecord.uid})`);
  } catch (e) {
    if (e?.code === 'auth/user-not-found') {
      userRecord = await auth.createUser({
        email: u.email,
        password: pass,
        emailVerified: true,
      });
      console.log(`Auth: creado ${u.email} (${userRecord.uid})`);
    } else {
      throw e;
    }
  }

  const uid = userRecord.uid;
  await db.collection('users').doc(uid).set(
    {
      uid,
      email: u.email,
      role: u.role,
      clientType: u.clientType,
      clientProfile: u.clientProfile,
      credits: u.credits,
      pagaresCredits: 0,
      createdAt: new Date().toISOString(),
      ...(u.organizationId ? { organizationId: u.organizationId } : {}),
    },
    { merge: true }
  );
  console.log(`Firestore: users/${uid} → ${u.role}`);
}

async function main() {
  const { default: admin } = await import('firebase-admin');
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID?.trim() || config.projectId;
  if (!admin.apps.length) {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
    if (credPath) {
      const resolved = isAbsolute(credPath) ? credPath : join(root, credPath);
      if (!existsSync(resolved)) {
        console.error('\nEl archivo de credenciales no existe en esa ruta:');
        console.error(`  ${resolved}`);
        console.error('');
        console.error('«/ruta/a/tu-serviceAccount.json» era solo un EJEMPLO en la documentación.');
        console.error('Tienes que usar la ruta real del JSON que descargas en Firebase:');
        console.error('  Consola Firebase → ⚙️ Configuración del proyecto → Cuentas de servicio →');
        console.error('  «Generar nueva clave privada» → se baja un archivo tipo *-firebase-adminsdk-*.json');
        console.error('');
        console.error('Ejemplo en Mac (sustituye por tu usuario y nombre del archivo):');
        console.error('  export GOOGLE_APPLICATION_CREDENTIALS="$HOME/Downloads/tu-proyecto-firebase-adminsdk-xxxxx.json"');
        console.error('  npm run seed:loong');
        console.error('');
        console.error('Si tu organización bloquea «Generar nueva clave privada» (política iam.disableServiceAccountKeyCreation),');
        console.error('NO necesitas JSON: usa tu usuario con gcloud (sin archivo):');
        console.error('  unset GOOGLE_APPLICATION_CREDENTIALS');
        console.error('  gcloud auth application-default login');
        console.error('  npm run seed:loong');
        console.error('');
        console.error('No pegues líneas que empiecen por # en la terminal (zsh: command not found: #).\n');
        process.exit(1);
      }
      const sa = JSON.parse(readFileSync(resolved, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(sa),
        projectId: sa.project_id || projectId,
      });
    } else {
      admin.initializeApp({ projectId });
    }
  }

  const auth = admin.auth();
  const db = admin.firestore();

  console.log(`Firebase Admin → projectId: ${projectId}${loongOnly ? ' (solo Loong)' : ''}\n`);

  if (!loongOnly) {
    for (const u of DEMO_USERS) {
      await seedOneUser(auth, db, u, password);
    }
  }

  const preRegNote = loongOnly ? 'Loong · seed npm run seed:loong' : 'Loong · seed npm run seed:demo';

  for (const u of LOONG_QUICK_USERS) {
    const withOrg = { ...u, organizationId: DEFAULT_ORG_LOONG };
    await seedOneUser(auth, db, withOrg, loongPassword);
    await db.collection('pre_registered_users').doc(u.email.toLowerCase()).set(
      {
        role: u.role,
        clientType: u.clientType,
        clientProfile: u.clientProfile,
        credits: u.credits,
        pagaresCredits: 0,
        organizationId: DEFAULT_ORG_LOONG,
        note: preRegNote,
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log(`Firestore: pre_registered_users/${u.email.toLowerCase()}`);
  }

  for (const u of LOONG_MX_CORP_USERS) {
    const withOrg = { ...u, organizationId: DEFAULT_ORG_LOONG };
    await seedOneUser(auth, db, withOrg, loongPassword);
    await db.collection('pre_registered_users').doc(u.email.toLowerCase()).set(
      {
        role: u.role,
        clientType: u.clientType,
        clientProfile: u.clientProfile,
        credits: u.credits,
        pagaresCredits: 0,
        organizationId: DEFAULT_ORG_LOONG,
        note: `${preRegNote} · @loong.mx`,
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log(`Firestore: pre_registered_users/${u.email.toLowerCase()} (@loong.mx)`);
  }

  await db.collection('clients').doc('admin_simulator').set(
    {
      loongMotorCreditPolicy: DEFAULT_LOONG_POLICY,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  console.log('Firestore: clients/admin_simulator (política Loong por defecto)');

  console.log('\n---');
  if (!loongOnly) {
    console.log('Contraseña compartida demo:', password);
  }
  console.log('Contraseña perfiles Loong (acceso rápido):', loongPassword);
  if (existsSync(join(root, '.env.local'))) {
    console.log('(Variables cargadas desde .env.local; la contraseña Loong debe coincidir con VITE_LOONG_QUICK_PASSWORD del login.)');
  } else {
    console.log('(No hay .env.local; si usas VITE_LOONG_QUICK_PASSWORD solo ahí, créala o pásala al comando para que el seed coincida con el frontend.)');
  }
  console.log('Añade en .env.local:');
  if (!loongOnly) {
    console.log(`VITE_DEMO_SHARED_PASSWORD=${password}`);
    console.log('VITE_SHOW_DEMO_LOGIN=true');
  }
  console.log(`VITE_LOONG_QUICK_PASSWORD=${loongPassword}`);
  console.log('---\n');
}

main().catch((err) => {
  const msg = String(err?.message || err);
  console.error('\nFallo al sembrar (Firebase Admin SDK).');
  if (
    msg.includes('Identity Toolkit API') ||
    msg.includes('identitytoolkit.googleapis.com') ||
    (msg.includes('SERVICE_DISABLED') && msg.includes('identity'))
  ) {
    const pid = process.env.VITE_FIREBASE_PROJECT_ID?.trim() || config.projectId;
    console.error('La API de autenticación (Identity Toolkit / Firebase Auth) está deshabilitada o ADC no tiene proyecto de cuota.');
    console.error('');
    console.error('1) Habilita la API en Google Cloud (elige el proyecto de tu app Firebase, id:', pid + '):');
    console.error('   https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=' + pid);
    console.error('   Pulsa «Habilitar» / «Enable».');
    console.error('');
    console.error('2) Asocia un proyecto de cuota a tus credenciales locales:');
    console.error('   gcloud auth application-default set-quota-project ' + pid);
    console.error('');
    console.error('3) Vuelve a ejecutar: npm run seed:loong\n');
  } else if (msg.includes('default credentials') || err?.code === 'app/invalid-credential') {
    console.error('No hay credenciales válidas para Admin SDK.');
    console.error('');
    console.error('  A) Sin JSON (útil si la consola Firebase bloquea «Generar nueva clave privada» por política de organización):');
    console.error('     unset GOOGLE_APPLICATION_CREDENTIALS');
    console.error('     gcloud auth application-default login');
    console.error('     npm run seed:loong');
    console.error('     (Instala Google Cloud SDK si hace falta; inicia sesión con una cuenta con rol Editor/Owner en el proyecto.)');
    console.error('');
    console.error('  B) Con archivo JSON (solo si tu org. permite crear claves):');
    console.error('     Firebase → ⚙️ → Cuentas de servicio → Generar nueva clave privada');
    console.error('     export GOOGLE_APPLICATION_CREDENTIALS="$HOME/Downloads/TU-ARCHIVO-firebase-adminsdk-xxxxx.json"');
    console.error('     npm run seed:loong');
    console.error('');
    console.error('  C) Sin permisos en GCP: pide a un admin que ejecute el seed o que cree usuarios en Authentication + documentos en Firestore a mano.\n');
  }
  console.error(err);
  process.exit(1);
});
