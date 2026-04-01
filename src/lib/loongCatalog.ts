export type LoongCatalogItem = {
  id: string;
  organizationId: string;
  name: string;
  sku?: string;
  price: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export function normalizeCatalogPrice(input: unknown): number {
  const n = typeof input === 'number' ? input : Number(String(input ?? '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

export function parseCatalogCsv(text: string): Omit<LoongCatalogItem, 'id'>[] {
  const lines = text
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = (key: string) => header.findIndex((h) => h === key);
  const iOrg = idx('organizationid');
  const iName = idx('name');
  const iSku = idx('sku');
  const iPrice = idx('price');
  const iActive = idx('active');

  if (iOrg < 0 || iName < 0 || iPrice < 0) {
    throw new Error('CSV inválido. Encabezados requeridos: organizationId,name,price (opcionales: sku,active).');
  }

  const out: Omit<LoongCatalogItem, 'id'>[] = [];
  for (const row of lines.slice(1)) {
    const cols = row.split(',').map((c) => c.trim());
    const organizationId = cols[iOrg] || '';
    const name = cols[iName] || '';
    const price = normalizeCatalogPrice(cols[iPrice]);
    const sku = iSku >= 0 ? cols[iSku] || undefined : undefined;
    const activeRaw = iActive >= 0 ? cols[iActive] : '';
    const active =
      typeof activeRaw === 'string' && activeRaw
        ? !['0', 'false', 'no', 'n', 'inactivo'].includes(activeRaw.trim().toLowerCase())
        : true;

    if (!organizationId || !name) continue;
    out.push({ organizationId, name, sku, price, active });
  }
  return out;
}

