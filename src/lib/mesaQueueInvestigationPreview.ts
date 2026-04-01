/**
 * Texto compacto para mesa de control: estado del expediente + extracto de dictamen / IA.
 */

export function mesaQueueDictamenExcerpt(inv: Record<string, unknown>, maxLen = 420): string | null {
  const se = inv.socioeconomicDictamen;
  if (typeof se === 'string' && se.trim()) {
    try {
      const j = JSON.parse(se) as { dictamenFinal?: { estado?: string; resumen?: string } };
      const estado = j.dictamenFinal?.estado?.trim();
      const resumen = j.dictamenFinal?.resumen?.trim();
      if (estado || resumen) {
        const line = [estado, resumen].filter(Boolean).join(' — ');
        return line.length > maxLen ? `${line.slice(0, maxLen)}…` : line;
      }
    } catch {
      const t = se.trim();
      return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
    }
  }
  const cr = inv.creditAnalysisResult;
  if (typeof cr === 'string' && cr.trim()) {
    const t = cr.trim();
    return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
  }
  const idv = inv.identityValidationResult;
  if (typeof idv === 'string' && idv.trim()) {
    const t = idv.trim();
    return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
  }
  return null;
}

export function mesaQueueProcesoLine(inv: Record<string, unknown>): string {
  const parts = [
    inv.status != null ? `Expediente: ${String(inv.status)}` : null,
    inv.linkStatus != null ? `Enlace: ${String(inv.linkStatus)}` : null,
    inv.creditStage != null ? `Etapa crédito: ${String(inv.creditStage)}` : null,
    inv.mesaPrecalStatus != null ? `Mesa precal: ${String(inv.mesaPrecalStatus)}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Sin estado registrado aún.';
}
