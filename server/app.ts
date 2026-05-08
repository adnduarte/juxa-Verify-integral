/**
 * API local para motor IA servidor, anti-usurpación y stub DIGID (plan maestro).
 * Ejecutar: npm run api:dev
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

const PORT = Number(process.env.PLATFORM_API_PORT) || 8787;
const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));

const getGemini = () => {
  const key = process.env.GEMINI_API_KEY || '';
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
};

const SOCIOECONOMIC_SCHEMA_HINT = `Responde SOLO JSON válido con esta forma:
{
  "congruenciaIngresos": { "verificado": boolean, "nivelSocioeconomicoInferido": string, "detalles": string },
  "congruenciaDomicilio": { "verificado": boolean, "distanciaMetros": number, "detalles": string },
  "dictamenFinal": { "estado": "Congruente" | "Inconsistente" | "Requiere Revisión Manual", "resumen": string }
}`;

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasGemini: Boolean(getGemini()) });
});

app.post('/api/ia/validate-socioeconomic', async (req, res) => {
  try {
    const { payload, organizationId } = req.body as { payload?: unknown; organizationId?: string };
    const text =
      typeof payload === 'string'
        ? payload
        : payload != null
          ? JSON.stringify(payload).slice(0, 120_000)
          : '';
    if (!text) {
      res.status(400).json({ error: 'payload requerido' });
      return;
    }
    const ai = getGemini();
    if (!ai) {
      res.status(503).json({ error: 'GEMINI_API_KEY no configurada en el servidor' });
      return;
    }
    const model = process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash';
    const prompt = `Eres analista de estudios socioeconómicos para México. Cruza consistencia de ingresos vs evidencias y domicilio vs coordenadas si vienen en el JSON.
Tenant: ${organizationId || 'default'}
${SOCIOECONOMIC_SCHEMA_HINT}
Datos del caso (JSON o texto):
${text}`;
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' },
    });
    const raw = response.text?.trim() || '';
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    const slice = jsonStart >= 0 ? raw.slice(jsonStart, jsonEnd + 1) : raw;
    const parsed = JSON.parse(slice);
    res.json({ source: 'server', organizationId: organizationId || null, result: parsed });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'validate-socioeconomic failed' });
  }
});

const INITIAL_RUBRIC_JSON_HINT = `Responde SOLO JSON válido con esta forma exacta:
{
  "identityUsurpation": {
    "riskScore": number,
    "factors": string[],
    "recommendation": "PASS"|"REVIEW"|"BLOCK",
    "checkedAt": string (ISO-8601)
  },
  "digitalDocumentForensicsMx": {
    "summary": string,
    "indicativeFindings": string[],
    "confidenceNotes": string
  },
  "dtiInitial": {
    "ingresoMensualDeclarado": number|null,
    "gastosMensualesDeclarados": number|null,
    "deudaMensualEstimada": number|null,
    "dtiRatio": number|null,
    "dtiFormulaNote": string,
    "flags": string[]
  },
  "rubricGate": "PASS"|"REVIEW"|"BLOCK",
  "validationSummary": string,
  "generatedAt": string,
  "rulesFingerprint": string
}`;

app.post('/api/credit/initial-rubric', async (req, res) => {
  try {
    const body = req.body as {
      organizationId?: string;
      mergedRules?: string;
      rulesFingerprint?: string;
      casePayload?: Record<string, unknown>;
    };
    const mergedRules = (body.mergedRules || '').slice(0, 60_000);
    const fingerprint = (body.rulesFingerprint || '').slice(0, 200);
    const orgId = body.organizationId || 'default';
    const payloadText =
      body.casePayload != null ? JSON.stringify(body.casePayload).slice(0, 100_000) : '';

    if (!payloadText) {
      res.status(400).json({ error: 'casePayload requerido' });
      return;
    }

    const ai = getGemini();
    const checkedAt = new Date().toISOString();

    if (!ai) {
      res.json({
        source: 'server-fallback',
        organizationId: orgId,
        result: {
          identityUsurpation: {
            riskScore: 40,
            factors: ['Sin motor IA en servidor: resultado heurístico'],
            recommendation: 'REVIEW',
            checkedAt,
          },
          digitalDocumentForensicsMx: {
            summary: 'Sin IA: no se analizaron metadatos ni consistencia documental.',
            indicativeFindings: [],
            confidenceNotes: 'Configure GEMINI_API_KEY en el servidor.',
          },
          dtiInitial: {
            ingresoMensualDeclarado: null,
            gastosMensualesDeclarados: null,
            deudaMensualEstimada: null,
            dtiRatio: null,
            dtiFormulaNote: 'DTI = obligaciones mensuales estimadas / ingreso mensual bruto declarado (originación).',
            flags: [],
          },
          rubricGate: 'REVIEW',
          validationSummary:
            'Motor IA no disponible: la solicitud debe revisarse manualmente antes de avanzar pipeline.',
          generatedAt: checkedAt,
          rulesFingerprint: fingerprint || 'none',
        },
      });
      return;
    }

    const model = process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash';
    const prompt = `Eres especialista en originación de crédito automotriz en México y analista de riesgos operativo.

IMPORTANTE:
- Los hallazgos sobre documentos digitales son INDICIOS OPERATIVOS para mesa de control, NO constancia pericial ni dictamen jurídico.
- Usa lenguaje prudente: "indicios", "inconsistencias aparentes", "requiere corroboración".

CONTEXTO TENANT: ${orgId}

REGLAS DE NEGOCIO A APLICAR (prioridad alta):
${mergedRules || '(sin reglas adicionales; usa criterio estándar de originación retail México)'}

${INITIAL_RUBRIC_JSON_HINT}

INSTRUCCIONES DE CÁLCULO Y ANÁLISIS:
1) Anti-usurpación: resume señales de coherencia del expediente (nombre, domicilio, montos, canal) y asigna riskScore 0-100 y recommendation.
2) Documental MX: comenta consistencia típica INE/comprobante de domicilio/comprobante de ingresos (formato, datos cruzados); si solo hay URLs, infiere limitaciones.
3) DTI inicial: a partir de ingresos y gastos declarados en el payload y deuda mensual estimada (incluye cuotas declaradas y, si hay monto/plazo de crédito, una cuota orientativa), calcula dtiRatio = obligaciones mensuales relevantes / ingreso mensual. Si faltan datos, deja null y explícalo en flags.
4) rubricGate: PASS si la solicitud y rubros iniciales son validables con la evidencia; REVIEW si falta información o hay fricción moderada; BLOCK solo ante contradicciones graves o fraude probable.
5) validationSummary: 2-4 frases sobre si el expediente puede continuar validación formal de mesa.
6) Copia rulesFingerprint exactamente: "${fingerprint}"

CASO (JSON):
${payloadText}`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' },
    });
    const raw = response.text?.trim() || '';
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    const slice = jsonStart >= 0 ? raw.slice(jsonStart, jsonEnd + 1) : raw;
    const parsed = JSON.parse(slice) as Record<string, unknown>;
    if (!parsed.generatedAt) parsed.generatedAt = checkedAt;
    if (fingerprint && !parsed.rulesFingerprint) parsed.rulesFingerprint = fingerprint;
    res.json({ source: 'server', organizationId: orgId, result: parsed });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'initial-rubric failed' });
  }
});

app.post('/api/identity/anti-usurpation', async (req, res) => {
  try {
    const { summary, organizationId } = req.body as { summary?: string; organizationId?: string };
    const text = (summary || '').slice(0, 50_000);
    if (!text) {
      res.status(400).json({ error: 'summary requerido' });
      return;
    }
    const ai = getGemini();
    if (!ai) {
      res.json({
        source: 'server-fallback',
        organizationId: organizationId || null,
        result: {
          riskScore: 35,
          factors: ['Sin motor IA en servidor: resultado heurístico'],
          recommendation: 'REVIEW',
          checkedAt: new Date().toISOString(),
        },
      });
      return;
    }
    const model = process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash';
    const prompt = `Evalúa riesgo de usurpación de identidad (México). Responde SOLO JSON:
{"riskScore": number 0-100, "factors": string[], "recommendation": "PASS"|"REVIEW"|"BLOCK", "checkedAt": "${new Date().toISOString()}"}
Resumen de señales:
${text}`;
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' },
    });
    const raw = response.text?.trim() || '';
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    const slice = jsonStart >= 0 ? raw.slice(jsonStart, jsonEnd + 1) : raw;
    const parsed = JSON.parse(slice);
    res.json({ source: 'server', organizationId: organizationId || null, result: parsed });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'anti-usurpation failed' });
  }
});

/** Stub DIGID: reemplazar por llamadas reales a la API del proveedor. */
app.post('/api/digid/signature-requests', (req, res) => {
  const { organizationId, contextType, contextId } = req.body as Record<string, string>;
  if (!organizationId || !contextType || !contextId) {
    res.status(400).json({ error: 'organizationId, contextType, contextId requeridos' });
    return;
  }
  const envelopeId = `mock_${contextType}_${contextId}_${Date.now()}`;
  res.json({
    envelopeId,
    status: 'MOCK',
    signUrl: null,
    message: 'Integración DIGID pendiente: use webhook /api/digid/webhook para simular completado.',
  });
});

app.post('/api/digid/webhook', (req, res) => {
  console.info('[DIGID webhook stub]', JSON.stringify(req.body).slice(0, 2000));
  res.json({ received: true });
});

app.listen(PORT, () => {
  console.log(`Platform API http://127.0.0.1:${PORT}`);
});
