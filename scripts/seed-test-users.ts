import admin from 'firebase-admin';

type TestUserSpec = {
  email: string;
  password: string;
  role:
    | 'ADMIN'
    | 'EJECUTIVO_VENTAS'
    | 'ANALISTA_MESA_CONTROL'
    | 'GERENTE_DIRECTIVO'
    | 'ANALISTA_CREDITO'
    | 'INVESTIGADOR_SOCIAL'
    | 'REVISOR_RRHH'
    | 'SOLICITANTE'
    | 'CLIENTE_FINANCIERO'
    | 'CLIENTE';
  clientProfile?: 'GENERAL' | 'HR' | 'CREDIT' | 'SME' | 'INVESTIGACION';
  clientType?: 'GRATUITO' | 'PAGO';
  credits?: number;
  pagaresCredits?: number;
};

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function parseServiceAccount(): admin.ServiceAccount {
  const raw = mustGetEnv('FIREBASE_SERVICE_ACCOUNT_JSON');
  try {
    const parsed = JSON.parse(raw);
    return parsed as admin.ServiceAccount;
  } catch (e) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON must be a valid JSON string. Tip: wrap it in single quotes in your shell.'
    );
  }
}

async function ensureApp() {
  if (admin.apps.length) return admin.app();
  const serviceAccount = parseServiceAccount();
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

function defaultUsers(): TestUserSpec[] {
  // Password default is intentionally simple for local testing only.
  const password = process.env.TEST_USERS_PASSWORD || 'Test1234!';

  return [
    { email: 'admin.test@juxa.local', password, role: 'ADMIN' },
    { email: 'ventas.test@juxa.local', password, role: 'EJECUTIVO_VENTAS' },
    { email: 'mesa.test@juxa.local', password, role: 'ANALISTA_MESA_CONTROL' },
    { email: 'gerente.test@juxa.local', password, role: 'GERENTE_DIRECTIVO' },
    { email: 'credito.test@juxa.local', password, role: 'ANALISTA_CREDITO' },
    { email: 'social.test@juxa.local', password, role: 'INVESTIGADOR_SOCIAL' },
    { email: 'rrhh.test@juxa.local', password, role: 'REVISOR_RRHH' },
    { email: 'solicitante.test@juxa.local', password, role: 'SOLICITANTE' },
    { email: 'clientehr.test@juxa.local', password, role: 'CLIENTE', clientProfile: 'HR', clientType: 'PAGO' },
    { email: 'clientecredit.test@juxa.local', password, role: 'CLIENTE', clientProfile: 'CREDIT', clientType: 'PAGO' },
    { email: 'clientesme.test@juxa.local', password, role: 'CLIENTE', clientProfile: 'SME', clientType: 'PAGO' },
    { email: 'clienteinv.test@juxa.local', password, role: 'CLIENTE', clientProfile: 'INVESTIGACION', clientType: 'PAGO' },
    { email: 'banco.test@juxa.local', password, role: 'CLIENTE_FINANCIERO', clientProfile: 'CREDIT', clientType: 'PAGO' },
  ];
}

async function upsertAuthUser(spec: TestUserSpec) {
  try {
    const existing = await admin.auth().getUserByEmail(spec.email);
    return existing;
  } catch (e: any) {
    if (e?.code !== 'auth/user-not-found') throw e;
    return await admin.auth().createUser({
      email: spec.email,
      password: spec.password,
      emailVerified: true,
      disabled: false,
    });
  }
}

async function upsertUserDoc(uid: string, spec: TestUserSpec) {
  const db = admin.firestore();
  const ref = db.collection('users').doc(uid);
  const now = new Date().toISOString();

  const role = spec.role;
  const clientProfile = spec.clientProfile || 'GENERAL';
  const clientType = spec.clientType || 'GRATUITO';
  const credits = spec.credits ?? (role === 'CLIENTE' ? 5 : 0);
  const pagaresCredits = spec.pagaresCredits ?? 0;

  await ref.set(
    {
      uid,
      email: spec.email.toLowerCase(),
      role,
      clientProfile,
      clientType,
      credits,
      pagaresCredits,
      createdAt: now,
      updatedAt: now,
      seed: {
        source: 'scripts/seed-test-users.ts',
        at: now,
      },
    },
    { merge: true }
  );
}

async function main() {
  await ensureApp();

  const users = defaultUsers();
  const dryRun = process.env.DRY_RUN === 'true';

  if (dryRun) {
    console.log('DRY_RUN=true. Would create/update the following users:');
    for (const u of users) console.log(`- ${u.email} (${u.role}${u.clientProfile ? `, ${u.clientProfile}` : ''})`);
    return;
  }

  console.log(`Seeding ${users.length} test users into Firebase Auth + Firestore...`);

  for (const spec of users) {
    const authUser = await upsertAuthUser(spec);
    await upsertUserDoc(authUser.uid, spec);
    console.log(`OK: ${spec.email} -> uid=${authUser.uid} role=${spec.role}`);
  }

  console.log('Done.');
  console.log(`Default password: ${process.env.TEST_USERS_PASSWORD || 'Test1234!'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

