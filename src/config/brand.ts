/**
 * Identidad de producto centralizada para white-label / variantes (Juxa Verify, by Juxa, etc.).
 *
 * Superficies de marketing (Landing) deben usar `brand` + `shellClasses`, no logos ni colores sueltos.
 * El acento interactivo (CTA, nav activa) viene de tokens CSS (--color-juxa-accent); variante Loong vía data-tenant.
 */
export type BrandVariant = 'juxa-verify' | 'by-juxa';

const VARIANT = (import.meta.env.VITE_BRAND_VARIANT as BrandVariant | undefined) ?? 'juxa-verify';

const VARIANTS: Record<
  BrandVariant,
  {
    productName: string;
    subtitle: string;
    footerCredit: string;
    logoMark: string;
  }
> = {
  'juxa-verify': {
    productName: 'Juxa Verify',
    subtitle: 'Verificación integral e investigación con respaldo operativo.',
    footerCredit: 'Un producto Juxa',
    logoMark: 'JV',
  },
  'by-juxa': {
    productName: 'Verificación integral',
    subtitle: 'Plataforma profesional de validación y riesgo.',
    footerCredit: 'by Juxa',
    logoMark: 'JX',
  },
};

const active = VARIANTS[VARIANT] ?? VARIANTS['juxa-verify'];

export const brand = {
  variant: VARIANT in VARIANTS ? VARIANT : ('juxa-verify' as const),
  company: 'Juxa',
  ...active,
} as const;

/** Marca secundaria (logo mark); el acento UI principal es índigo vía CSS variables. */
export const brandClasses = {
  pageBg: 'bg-slate-100 dark:bg-[#070b14]',
  pageGradient:
    'bg-gradient-to-br from-slate-100 via-white to-slate-200 dark:from-[#070b14] dark:via-[#0c1222] dark:to-[#0f172a]',
  accent: 'text-[var(--color-juxa-accent)]',
  accentBg: 'bg-[var(--color-juxa-accent)]',
  accentHover: 'hover:opacity-90 hover:bg-[var(--color-juxa-accent-hover)]',
  card:
    'rounded-[var(--juxa-radius-card)] border border-slate-200/90 bg-white shadow-[var(--juxa-shadow-card)] dark:border-white/[0.08] dark:bg-slate-900/80',
  muted: 'text-slate-500 dark:text-slate-400',
  logoMark:
    'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-sm shadow-amber-500/20',
} as const;

/**
 * Clases del shell app (sidebar, CTAs, cards). Usan variables para respetar variante Loong (data-tenant).
 */
export const shellClasses = {
  /** Nav activa: acento contenido (no bloque sólido de color) para alinear con cards y formularios. */
  navActive:
    'bg-[var(--color-juxa-accent-muted)] text-[var(--color-juxa-accent)] font-semibold ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-juxa-accent)_20%,transparent)]',
  navInactive:
    'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100',
  navMobileActive:
    'bg-[var(--color-juxa-accent-muted)] text-[var(--color-juxa-accent)] font-semibold ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-juxa-accent)_20%,transparent)]',
  navMobileInactive:
    'bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/90',
  ctaPrimary:
    'inline-flex items-center justify-center rounded-xl bg-[var(--color-juxa-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--color-juxa-accent-foreground)] shadow-lg shadow-[color-mix(in_srgb,var(--color-juxa-accent)_25%,transparent)] transition-all hover:bg-[var(--color-juxa-accent-hover)]',
  ctaPrimaryLg:
    'inline-flex items-center justify-center rounded-2xl bg-[var(--color-juxa-accent)] px-8 py-4 text-base font-bold text-[var(--color-juxa-accent-foreground)] shadow-xl shadow-[color-mix(in_srgb,var(--color-juxa-accent)_22%,transparent)] transition-all hover:bg-[var(--color-juxa-accent-hover)]',
  linkAccent: 'text-[var(--color-juxa-accent)] hover:opacity-90 transition-opacity',
  surfaceCard: brandClasses.card,
  ringFocus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-juxa-accent)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
  /** Inputs y textareas del shell (dashboard). */
  field:
    'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-juxa-accent)] focus-visible:ring-offset-0 dark:focus-visible:ring-offset-0',
  btnSecondary:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 disabled:opacity-50',
} as const;
