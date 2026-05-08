import { addDoc, collection } from '@/lib/localFirestore';
import { db } from '../firebase';

export async function seedDemoSectorData(params: { organizationId: string; assignedToUid: string }) {
  const { organizationId, assignedToUid } = params;
  const now = new Date().toISOString();

  await (addDoc as (col: unknown, data: object) => Promise<unknown>)(collection(db as never, 'b2b_portfolios'), {
    organizationId,
    name: 'Cartera demo (seed)',
    currency: 'MXN',
    totalExposure: 0,
    notes: 'Generado desde panel admin — demo',
    createdAt: now,
    updatedAt: now,
  });

  await (addDoc as (col: unknown, data: object) => Promise<unknown>)(collection(db as never, 'suppliers'), {
    organizationId,
    legalName: `Proveedor demo ${new Date().toISOString().slice(0, 10)}`,
    rfc: '',
    verificationStep: 'INTAKE',
    score: null,
    complianceNotes: 'Seed admin',
    createdAt: now,
    updatedAt: now,
  });

  await (addDoc as (col: unknown, data: object) => Promise<unknown>)(collection(db as never, 'field_visits'), {
    organizationId,
    investigationId: null,
    portfolioId: null,
    assignedToUid,
    purpose: 'INVESTIGATION',
    status: 'SCHEDULED',
    notes: 'Visita demo — seed desde admin',
    createdAt: now,
    updatedAt: now,
  });
}
