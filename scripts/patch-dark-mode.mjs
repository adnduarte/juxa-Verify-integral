/**
 * Añade utilidades Tailwind dark: junto a superficies y textos slate comunes.
 * Idempotente: no duplica si ya existe el par dark: en los ~100 caracteres siguientes.
 * (?<!:) evita tocar utilidades con prefijo (hover:, focus:, dark:, etc.).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '..', 'src');

const SKIP = new Set([
  path.join(srcRoot, 'contexts', 'ThemeContext.tsx'),
  path.join(srcRoot, 'components', 'ThemeToggle.tsx'),
]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

function peekHas(haystack, offset, needle) {
  return haystack.slice(offset, offset + 120).includes(needle);
}

function patch(content) {
  let c = content;

  const opacityPairs = [
    [/bg-white\/(\d+)/g, (op) => `bg-white/${op} dark:bg-slate-900/${op}`, 'dark:bg-slate-900/'],
    [/bg-slate-50\/(\d+)/g, (op) => `bg-slate-50/${op} dark:bg-slate-950/${op}`, 'dark:bg-slate-950/'],
    [/bg-slate-100\/(\d+)/g, (op) => `bg-slate-100/${op} dark:bg-slate-800/${op}`, 'dark:bg-slate-800/'],
  ];

  for (const [re, build, darkSig] of opacityPairs) {
    c = c.replace(re, (full, op, offset) => {
      if (peekHas(c, offset, darkSig)) return full;
      return build(op);
    });
  }

  const simple = [
    [/(?<!:)\bbg-white\b/g, 'bg-white dark:bg-slate-900', 'dark:bg-slate-900'],
    [/(?<!:)\bbg-slate-50\b/g, 'bg-slate-50 dark:bg-slate-950', 'dark:bg-slate-950'],
    [/(?<!:)\bbg-slate-100\b/g, 'bg-slate-100 dark:bg-slate-800', 'dark:bg-slate-800'],
    [/(?<!:)\bbg-slate-200\b/g, 'bg-slate-200 dark:bg-slate-700', 'dark:bg-slate-700'],
    [/(?<!:)\bborder-slate-100\b/g, 'border-slate-100 dark:border-slate-800', 'dark:border-slate-800'],
    [/(?<!:)\bborder-slate-200\b/g, 'border-slate-200 dark:border-slate-700', 'dark:border-slate-700'],
    [/(?<!:)\bborder-slate-300\b/g, 'border-slate-300 dark:border-slate-600', 'dark:border-slate-600'],
    [/(?<!:)\btext-slate-900\b/g, 'text-slate-900 dark:text-slate-100', 'dark:text-slate-100'],
    [/(?<!:)\btext-slate-800\b/g, 'text-slate-800 dark:text-slate-200', 'dark:text-slate-200'],
    [/(?<!:)\btext-slate-700\b/g, 'text-slate-700 dark:text-slate-200', 'dark:text-slate-200'],
    [/(?<!:)\btext-slate-600\b/g, 'text-slate-600 dark:text-slate-300', 'dark:text-slate-300'],
    [/(?<!:)\btext-slate-500\b/g, 'text-slate-500 dark:text-slate-400', 'dark:text-slate-400'],
    [/(?<!:)\btext-slate-400\b/g, 'text-slate-400 dark:text-slate-500', 'dark:text-slate-500'],
    [/(?<!:)\bdivide-slate-200\b/g, 'divide-slate-200 dark:divide-slate-700', 'dark:divide-slate-700'],
    [/(?<!:)\bplaceholder-slate-400\b/g, 'placeholder-slate-400 dark:placeholder-slate-500', 'dark:placeholder-slate-500'],
    [/(?<!:)\bshadow-slate-200\b/g, 'shadow-slate-200 dark:shadow-black/40', 'dark:shadow-black/40'],
    [/(?<!:)\bring-slate-200\b/g, 'ring-slate-200 dark:ring-slate-600', 'dark:ring-slate-600'],
  ];

  for (const [re, replacement, darkSig] of simple) {
    c = c.replace(re, (match, offset) => {
      if (peekHas(c, offset, darkSig)) return match;
      return replacement;
    });
  }

  const hovers = [
    [/\bhover:bg-slate-50\b/g, 'hover:bg-slate-50 dark:hover:bg-slate-800/80', 'dark:hover:bg-slate-800'],
    [/\bhover:bg-slate-100\b/g, 'hover:bg-slate-100 dark:hover:bg-slate-800', 'dark:hover:bg-slate-800'],
    [/\bhover:text-slate-900\b/g, 'hover:text-slate-900 dark:hover:text-slate-100', 'dark:hover:text-slate-100'],
    [/\bhover:text-slate-600\b/g, 'hover:text-slate-600 dark:hover:text-slate-300', 'dark:hover:text-slate-300'],
    [/\bhover:border-slate-300\b/g, 'hover:border-slate-300 dark:hover:border-slate-600', 'dark:hover:border-slate-600'],
  ];

  for (const [re, replacement, darkSig] of hovers) {
    c = c.replace(re, (match, offset) => {
      if (peekHas(c, offset, darkSig)) return match;
      return replacement;
    });
  }

  return c;
}

let changed = 0;
for (const file of walk(srcRoot)) {
  if (SKIP.has(file)) continue;
  const before = fs.readFileSync(file, 'utf8');
  const after = patch(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed++;
    console.log('patched', path.relative(srcRoot, file));
  }
}
console.log('files changed:', changed);
