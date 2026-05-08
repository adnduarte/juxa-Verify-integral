/**
 * Firestore en memoria (solo construcción local). Sin red ni proyecto Firebase.
 */
import type { Firestore } from 'firebase/firestore';
import { DEV_LOCAL_PERSONAS, localDevUidFromEmail } from './devPersonasCatalog';

const DB = Symbol('memory-db');

type DocRef = { __kind: 'doc'; path: string };
type ColRef = { __kind: 'col'; path: string };
type QueryRef = { __kind: 'query'; col: string; constraints: Constraint[] };

type Constraint =
  | { t: 'where'; field: string; op: string; value: unknown }
  | { t: 'orderBy'; field: string; dir: 'asc' | 'desc' };

const documents = new Map<string, Record<string, unknown>>();
const snapshotListeners = new Set<() => void>();

function notifyListeners() {
  snapshotListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* noop */
    }
  });
}

let seeded = false;
function ensureSeedUsers() {
  if (seeded) return;
  seeded = true;
  const now = new Date().toISOString();
  for (const p of DEV_LOCAL_PERSONAS) {
    const uid = localDevUidFromEmail(p.email);
    const path = `users/${uid}`;
    documents.set(path, {
      uid,
      email: p.email.toLowerCase(),
      role: p.role,
      clientType: p.clientType || 'GRATUITO',
      clientProfile: p.clientProfile,
      organizationId: p.organizationId || 'default',
      resellerId: null,
      credits: 999,
      pagaresCredits: 99,
      createdAt: now,
      updatedAt: now,
      devLocalPersona: true,
      ...(p.clientAccountRole ? { clientAccountRole: p.clientAccountRole.toUpperCase() } : {}),
    });
  }
  documents.set('organizations/default', {
    name: 'Organización principal',
    parentOrganizationId: null,
    branding: { appName: 'Juxa Verify', primaryColor: '#2563eb' },
    features: {},
    createdAt: now,
    updatedAt: now,
  });
}

export function getFirestore(): Firestore {
  return DB as unknown as Firestore;
}

export function collection(_db: unknown, path: string, ...segments: string[]): ColRef {
  ensureSeedUsers();
  return { __kind: 'col', path: [path, ...segments].join('/') };
}

export function doc(_db: unknown, path: string, ...segments: string[]): DocRef {
  ensureSeedUsers();
  return { __kind: 'doc', path: [path, ...segments].join('/') };
}

export function query(base: ColRef | QueryRef, ...constraints: Constraint[]): QueryRef {
  if (base.__kind === 'col') {
    return { __kind: 'query', col: base.path, constraints: constraints as Constraint[] };
  }
  return {
    __kind: 'query',
    col: base.col,
    constraints: [...base.constraints, ...(constraints as Constraint[])],
  };
}

export function where(field: string, op: string, value: unknown): Constraint {
  return { t: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): Constraint {
  return { t: 'orderBy', field, dir: direction };
}

function listCollectionDocs(col: string): { id: string; path: string; data: Record<string, unknown> }[] {
  const prefix = `${col}/`;
  const out: { id: string; path: string; data: Record<string, unknown> }[] = [];
  for (const [path, data] of documents) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length);
    if (rest.includes('/')) continue;
    out.push({ id: rest, path, data });
  }
  return out;
}

function applyWheres(
  rows: { id: string; path: string; data: Record<string, unknown> }[],
  constraints: Constraint[]
): { id: string; path: string; data: Record<string, unknown> }[] {
  const wheres = constraints.filter((c): c is Extract<Constraint, { t: 'where' }> => c.t === 'where');
  let r = rows;
  for (const w of wheres) {
    if (w.op === 'in' && Array.isArray(w.value)) {
      const arr = w.value as unknown[];
      r = r.filter((row) => arr.includes(row.data[w.field]));
      continue;
    }
    if (w.op === '==') {
      r = r.filter((row) => row.data[w.field] === w.value || row.data[w.field] == w.value);
    }
  }
  const ob = constraints.find((c): c is Extract<Constraint, { t: 'orderBy' }> => c.t === 'orderBy');
  if (ob) {
    const mult = ob.dir === 'desc' ? -1 : 1;
    r = [...r].sort((a, b) => {
      const va = a.data[ob.field];
      const vb = b.data[ob.field];
      if (va === vb) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string' && typeof vb === 'string') return va < vb ? -mult : mult;
      return (va as number) < (vb as number) ? -mult : mult;
    });
  }
  return r;
}

function makeDocSnap(path: string) {
  const id = path.split('/').pop() || path;
  return {
    id,
    ref: { __kind: 'doc', path } as DocRef,
    exists: () => documents.has(path),
    data: () => {
      const data = documents.get(path);
      return data === undefined ? undefined : { ...data };
    },
    metadata: { fromCache: false, hasPendingWrites: false },
  };
}

function makeQuerySnap(col: string, constraints: Constraint[]) {
  const rows = applyWheres(listCollectionDocs(col), constraints);
  const docs = rows.map((row) => ({
    id: row.id,
    ref: { __kind: 'doc', path: row.path } as DocRef,
    exists: () => true,
    data: () => ({ ...row.data }),
    metadata: { fromCache: false, hasPendingWrites: false },
  }));
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
    forEach(fn: (d: (typeof docs)[0]) => void) {
      docs.forEach(fn);
    },
  };
}

export async function getDoc(ref: DocRef) {
  ensureSeedUsers();
  return makeDocSnap(ref.path);
}

export async function getDocs(q: QueryRef | ColRef) {
  ensureSeedUsers();
  if (q.__kind === 'col') {
    return makeQuerySnap(q.path, []);
  }
  return makeQuerySnap(q.col, q.constraints);
}

export async function setDoc(ref: DocRef, data: Record<string, unknown>, opts?: { merge?: boolean }) {
  ensureSeedUsers();
  const prev = documents.get(ref.path);
  const next =
    opts?.merge && prev ? { ...prev, ...data, updatedAt: new Date().toISOString() } : { ...data };
  documents.set(ref.path, next);
  notifyListeners();
}

export async function addDoc(colRef: ColRef, data: Record<string, unknown>) {
  ensureSeedUsers();
  const id = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  const path = `${colRef.path}/${id}`;
  documents.set(path, { ...data, id });
  notifyListeners();
  return { id };
}

export async function updateDoc(ref: DocRef, data: Record<string, unknown>) {
  ensureSeedUsers();
  const prev = documents.get(ref.path) || {};
  documents.set(ref.path, { ...prev, ...data, updatedAt: new Date().toISOString() });
  notifyListeners();
}

export async function deleteDoc(ref: DocRef) {
  documents.delete(ref.path);
  notifyListeners();
}

export function onSnapshot(
  target: DocRef | QueryRef | ColRef,
  onNext: (snap: unknown) => void,
  onError?: (e: Error) => void
): () => void {
  ensureSeedUsers();
  const run = () => {
    try {
      if (target.__kind === 'doc') {
        onNext(makeDocSnap(target.path));
      } else if (target.__kind === 'col') {
        onNext(makeQuerySnap(target.path, []));
      } else {
        onNext(makeQuerySnap(target.col, target.constraints));
      }
    } catch (e) {
      onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  };
  run();
  snapshotListeners.add(run);
  return () => snapshotListeners.delete(run);
}
