---
name: ford-audit-intelligence
description: Auditoría operativa Ford Crédito MX — snapshot agregado, checklist guiado y análisis de identidad vs expedientes de referencia (doc base).
---

# Ford audit intelligence

## Alcance

- **Runtime:** el panel `FordAuditPeriodPanel` envía a Gemini un **snapshot JSON** (conteos por estatus, etapa de pipeline, organización). No sustituye revisión legal ni acceso a PDF completos fuera del sistema.
- **Referencia conceptual:** expedientes tipo “doc base” (caso sin usurpación vs alterado/con usurpación) sirven para **tipificar** qué inconsistencias buscar (cruces documentales, coherencia domicilio/identidad, señales de alteración). Versionar aquí el checklist que debe seguir Gerencia/Dirección antes del chat libre.

## Esquema del snapshot (auditoría)

Campos típicos emitidos por la UI:

- `period`: `{ from, to }` (fechas ISO día).
- `expedientesEnPeriodo`: número.
- `porStatus`, `porEtapaPipeline`, `porOrganizacionId`: mapas string → count.
- `etiquetasAgencia`: mapa `organizationId` → nombre legible (si existe).
- `muestraIds`: hasta ~12 IDs para trazabilidad (no PII).

## Límites de PII

- No pegar en prompts: CURP completo, cuentas bancarias, teléfonos personales.
- Preferir **agregados**, IDs de expediente ya anonimizados en contexto operativo, y “hallazgos” cualitativos.

## Checklist guiado (orden sugerido)

1. Alcance temporal y volumen.
2. Desviaciones de proceso (rebotes `RETURN_TO_AGENCY`, cuellos en `MESA_CONTROL`).
3. Consistencia identidad / documentación (preanálisis, factores de riesgo).
4. Riesgos prioritarios y seguimiento.

## Integración en código

- Asistente: `chatFordAuditAssistant` en `src/lib/gemini.ts`.
- UI: `src/components/dashboards/FordAuditPeriodPanel.tsx`.
- CRM expedientes: `src/components/dashboards/CreditApplicationsModule.tsx` + `getCreditCrmCapabilities` en `src/lib/creditCrmCapabilities.ts`.
