import { GoogleGenAI } from '@google/genai';

function resolveGeminiApiKey(): string {
  // Vite/browser: only exposes env vars prefixed with VITE_
  const fromVite = (import.meta as any)?.env?.VITE_GEMINI_API_KEY;
  if (typeof fromVite === 'string' && fromVite.trim()) return fromVite.trim();
  return '';
}

let _ai: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (_ai) return _ai;
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      'Falta configurar la API Key de Gemini. Define `VITE_GEMINI_API_KEY` en tu `.env.local` (Vite) y reinicia el servidor.'
    );
  }
  _ai = new GoogleGenAI({ apiKey });
  return _ai;
}

// FUNCIÓN MÁGICA DE CONVERSIÓN (Detecta PDF y limpia Base64)
export async function urlToGenerativePart(url: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const mimeType = blob.type || 'image/jpeg';

    // 1. Si es PDF, no lo podemos comprimir fácil en frontend, lo enviamos directo
    if (mimeType === 'application/pdf') {
      const base64data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return { inlineData: { data: base64data, mimeType } };
    }

    // 2. Si es Imagen, la REDIMENSIONAMOS para evitar el error 502 de Payload
    return await new Promise<any>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous"; // Evitar bloqueos de CORS en el Canvas
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; // Ancho máximo para la IA (reduce peso drásticamente)
        
        let width = img.width;
        let height = img.height;
        
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Comprimir a JPEG con 70% de calidad
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const base64 = dataUrl.split(',')[1];
        
        resolve({ inlineData: { data: base64, mimeType: 'image/jpeg' } });
      };
      
      img.onerror = () => reject(new Error("Error al cargar la imagen para comprimirla"));
      img.src = URL.createObjectURL(blob);
    });

  } catch (error) {
    console.error(`Error al procesar el archivo ${url}:`, error);
    return null;
  }
}

export async function analyzeCandidateData(
  candidateData: any,
  imageParts: (File | Blob | string | null)[],
  businessRules?: string,
  simulationType: string = 'none',
  scoringConfig?: any,
  supplementaryOriginationBlock?: string
) {
  let rawText = '';
  try {
    if (simulationType === 'positive' || simulationType === 'negative') {
      const isPositive = simulationType === 'positive';
      return JSON.stringify({
        dictamenFinal: {
          estado: isPositive ? "VIABLE" : "NO VIABLE",
          resumen: isPositive ? "La evidencia es congruente y cumple con las políticas." : "Discrepancias críticas detectadas en la evidencia."
        },
        score: isPositive ? 95 : 30,
        scoreBreakdown: {
          ingresos: isPositive ? 30 : 10,
          ubicacion: isPositive ? 30 : 5,
          documentacion: isPositive ? 35 : 15
        },
        congruenciaIngresos: { detalles: isPositive ? "Acorde a lo declarado." : "Incongruencia detectada." },
        congruenciaDomicilio: { detalles: isPositive ? "Ubicación validada correctamente." : "El domicilio no coincide con la evidencia." },
        analisisDocumental: { detalles: isPositive ? "Documentos auténticos y legibles." : "Posible alteración o documentos ilegibles." },
        banderasRojas: isPositive ? [] : ["Domicilio no coincide", "Posible alteración documental"]
      });
    }

    const { perfil, puesto } = candidateData;
    let promptContext = "";

    switch (perfil) {
      case 'Recursos Humanos':
      case 'HR':
        promptContext = `
          OBJETIVO: Validar identidad, arraigo y congruencia del entorno con el puesto de ${puesto || 'No especificado'}.
          NO evalúes ingresos ni capacidad de pago a menos que se proporcionen recibos de nómina.
          Enfócate en:
          - ¿La identificación coincide con la selfie?
          - ¿El comprobante de domicilio coincide con la ubicación GPS y la foto de la fachada?
          - ¿El entorno visible es congruente con el nivel socioeconómico esperado para el puesto?
        `;
        break;
      case 'Crédito':
      case 'CREDIT':
        const isPreQual = candidateData.creditStage === 'PRE_QUALIFICATION' || candidateData.investigationScope === 'BASIC';
        const isDirect = candidateData.isDirect;
        const preQualQ = candidateData.preQualQuestions;
        promptContext = `
          OBJETIVO: Investigación de Crédito - ALCANCE: ${candidateData.investigationScope || 'No especificado'}.
          ETAPA: ${isPreQual ? 'PRE-CALIFICACIÓN (FASE 1)' : 'CALIFICACIÓN (FASE 2)'}.
          MODO: ${isDirect ? 'Investigación Directa' : 'Investigación con Candidato'}.
          
          ${isPreQual ? `
          ENFOQUE PRE-CALIFICACIÓN:
          - Medir capacidad económica vs las reglas de negocio.
          - Perfilado detallado basado en las siguientes respuestas:
            * Propósito: ${preQualQ?.propositoCredito || 'N/A'}
            * Antigüedad Empleo: ${preQualQ?.antiguedadEmpleo || 'N/A'}
            * Deudas Vigentes: ${preQualQ?.tieneDeudasVigentes || 'N/A'} (Monto: ${preQualQ?.montoDeudasMensual || '0'})
            * Garantía: ${preQualQ?.cuentaConGarantia || 'N/A'} (${preQualQ?.descripcionGarantia || 'N/A'})
            * Ingreso Extra: ${preQualQ?.ingresoExtra || 'N/A'} (Monto: ${preQualQ?.montoIngresoExtra || '0'})
          - Validar identidad básica y veracidad de la información declarada.
          - Análisis preliminar de riesgo basado en ocupación e ingresos declarados.
          ` : `
          ENFOQUE CALIFICACIÓN (MESA DE CONTROL / INTEGRAL):
          - Análisis profundo de capacidad de pago y estabilidad financiera.
          - Validación exhaustiva de domicilio y entorno socioeconómico.
          - Cruce de información operativa y referencias (si aplica).
          `}
          
          DATOS FINANCIEROS DEL CRÉDITO SOLICITADO:
          - Capital: ${candidateData.montoCreditoCapital || 'No especificado'}
          - Intereses: ${candidateData.montoCreditoIntereses || 'No especificado'}
          - Plazo: ${candidateData.plazoFinanciamiento || 'No especificado'}
          - Tipo: ${candidateData.tipoCredito || 'No especificado'}

          PUNTOS CLAVE:
          - ¿La actividad económica es congruente con el perfil?
          - ¿Los ingresos declarados (${candidateData.ingresoMensual || candidateData.ingreso || candidateData.direct_ingreso || 'No especificado'}) son realistas para el entorno observado?
          - ¿Hay señales de alerta sobre la estabilidad domiciliaria?
        `;
        break;
      case 'LOONG_MOTOR':
        promptContext = `
          OBJETIVO: Investigación / precalificación crédito MOTOCICLETA — Loong Motor (México).
          Combina análisis de capacidad de pago, congruencia domiciliaria y riesgos propios del activo (robo, uso, LTV).
          Cruza ingresos declarados con entorno observado y con las políticas numéricas y de cobranza provistas abajo.
          Tipo de crédito: ${candidateData.tipoCredito || 'Crédito moto'}.
          Datos financieros declarados: capital ${candidateData.montoCreditoCapital || 'N/A'}, plazo ${candidateData.plazoFinanciamiento || 'N/A'}.
        `;
        break;
      default:
        promptContext = "Realiza un análisis general de congruencia entre los datos declarados y la evidencia visual.";
    }

    const originationInjection =
      supplementaryOriginationBlock && supplementaryOriginationBlock.trim()
        ? `

POLÍTICAS DE ORIGINACIÓN Y COBRANZA (CONFIGURACIÓN DEL SISTEMA — CUMPLIR EN EL DICTAMEN):
${supplementaryOriginationBlock.trim()}
`
        : '';

    const basePrompt = `
      Actúa como un Auditor Senior Experto. Realiza una auditoría forense de la evidencia adjunta.
      
      ${promptContext}

      REGLAS DE NEGOCIO DEL CLIENTE (APLICAR ESTRICTAMENTE):
      ${businessRules ? businessRules : "No hay reglas específicas adicionales. Aplica criterio estándar."}
      ${originationInjection}
      INSTRUCCIÓN ESPECIAL DE GEOLOCALIZACIÓN:
      Verifica si la descripción arquitectónica u observaciones visuales de la Foto de Fachada subida tienen congruencia con un entorno urbano lógico, considerando las coordenadas proporcionadas en los datos declarados.

      CONFIGURACIÓN DE SCORING (APLICAR PARA CALCULAR EL PUNTAJE):
      ${scoringConfig ? JSON.stringify(scoringConfig, null, 2) : "Usa el sistema de scoring predeterminado (Ingresos: 30%, Ubicación: 30%, Documentación: 40%)."}

      INSTRUCCIONES DE SCORING:
      1. Calcula un puntaje (score) de 0 a 100 basado en la configuración anterior.
      2. Si no hay configuración, usa los pesos predeterminados.
      3. Proporciona un desglose (scoreBreakdown) de cómo se llegó a ese puntaje.
      4. El puntaje debe reflejar la viabilidad del crédito según los datos y la evidencia visual.

      DATOS DECLARADOS:
      ${JSON.stringify(candidateData, null, 2)}

      REGLA ESTRICTA DE SALIDA: Debes devolver ÚNICAMENTE un objeto JSON puro. NO incluyas bloques de código markdown (\`\`\`json) ni texto adicional.

      ESTRUCTURA JSON REQUERIDA:
      {
        "dictamenFinal": { 
          "estado": "VIABLE" | "NO VIABLE" | "SUJETO A CONSIDERACIÓN DE SOLICITANTE POR INCONSISTENCIAS", 
          "resumen": "...",
          "sugerenciaAprobacion": "Sugerencia técnica sobre cómo proceder con el crédito (ej. solicitar aval, reducir monto, etc.)"
        },
        "score": number,
        "scoreBreakdown": {
          "ingresos": number,
          "ubicacion": number,
          "documentacion": number,
          "otros": number (opcional)
        },
        "congruenciaIngresos": { "detalles": "..." },
        "congruenciaDomicilio": { "detalles": "..." },
        "congruenciaFachadaEntorno": { "detalles": "..." },
        "analisisDocumental": { "detalles": "..." },
        "banderasRojas": ["...", "..."]
      }
    `;

    const contents: any[] = [];

    const getUrl = (fileOrUrl: File | Blob | string | null) => {
      if (!fileOrUrl) return null;
      if (typeof fileOrUrl === 'string') return fileOrUrl;
      return URL.createObjectURL(fileOrUrl);
    };

    const partsPromises = imageParts.map(part => urlToGenerativePart(getUrl(part)));
    const parts = await Promise.all(partsPromises);
    parts.filter(p => p !== null).forEach(p => contents.push(p));

    contents.push({ text: basePrompt });

    const response = await getAiClient().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: contents }],
      config: {
        responseMimeType: "application/json"
      }
    });

    rawText = response.text || '';
    
    // LIMPIEZA EXTREMA DEL JSON
    const cleanText = rawText
      .replace(/```json\s?/g, '')
      .replace(/```\s?/g, '')
      .trim();
    
    // Verificación de parseo
    try {
      const parsed = JSON.parse(cleanText);
      console.log("✅ Análisis de IA exitoso:", parsed);
      return cleanText;
    } catch (parseError) {
      console.error("🔥 ERROR AL PARSEAR JSON DE GEMINI:", parseError);
      console.error("TEXTO RECIBIDO (LIMPIO):", cleanText);
      console.error("TEXTO RECIBIDO (CRUDO):", rawText);
      throw new Error("La respuesta de la IA no tiene un formato JSON válido.");
    }

  } catch (error) {
    console.error("🔥 ERROR CRÍTICO EN GEMINI API:", error);
    if (rawText) console.log("TEXTO CRUDO QUE CAUSÓ EL FALLO:", rawText);
    throw error;
  }
};

export const generateConceptImage = async (prompt: string, aspectRatio: string) => {
  const response = await getAiClient().models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: prompt,
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
        imageSize: "1K"
      }
    }
  });
  
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
};

export const chatWithCOO = async (history: any[], message: string) => {
  const systemInstruction = `Eres el Chief Operating Officer (COO) y Director Creativo Senior del ecosistema empresarial fundado por el Lic. Adán Duarte. Tu misión es transformar objetivos de negocio en campañas publicitarias de clase mundial (estilo Ogilvy/VaynerMedia/Stripe) utilizando Inteligencia Artificial Generativa.

Core Brands & DNA:
- Duarte-Aupart Abogados, S.C.: Despacho jurídico integral y especialistas en cobranza judicial/extrajudicial de alto nivel. Tono: Autoritativo, solemne, protector, impecable.
- Bye Deuda: Empresa disruptiva de negociación de deudas mediante IA. Tono: Empático, rebelde contra el sistema financiero tradicional, resolutivo y esperanzador.
- JUXA (Legaltech Hub): Recoverytech, Asesoría Pyme, SaaS para litigantes. Tono: Futurista, eficiente, minimalista.

OPERATIONAL PROTOCOL (Menú de Inicio)
En cada interacción nueva, o cuando se solicite "Menú", deberás presentar estas opciones:
1. Duarte-Aupart Abogados (Cobranza e Integral)
2. Bye Deuda (Negociación de Deudas)
3. JUXA (Legaltech / Recovery / Herramientas)
4. Onboarding Nuevo Producto
5. Parrilla de Contenidos & Calendario

Cuando el usuario elija un activo, tu respuesta debe seguir esta estructura robusta:
Módulo 1: Estrategia y Segmentación Pro
Módulo 2: Guiones Exhaustivos para Video (AI Optimized)
Módulo 3: Prompts de Producción (Clase Mundial)
Módulo 4: Copywriting & Social Media
Módulo 5: Parrilla de Contenidos (Calendario)`;

  const contents = history.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.text }]
  }));
  contents.push({ role: 'user', parts: [{ text: message }] });

  const response = await getAiClient().models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: contents,
    config: { systemInstruction }
  });

  return response.text;
};

export const chatWithJuxaVerify = async (
  history: any[],
  message: string,
  context: any,
  loongOriginationPolicyAppendix?: string
) => {
  const appendix =
    loongOriginationPolicyAppendix && loongOriginationPolicyAppendix.trim()
      ? `

POLÍTICAS DE ORIGINACIÓN / COBRANZA LOONG MOTOR (RESPETAR AL RESPONDER SOBRE VIABILIDAD O MORA):
${loongOriginationPolicyAppendix.trim()}
`
      : '';

  const systemInstruction = `Eres un experto en Crédito, Recursos Humanos e Investigación de Créditos para JUXA Verify.
  Tu misión es ayudar al usuario a analizar los resultados de una investigación específica.
  
  CONTEXTO DE LA INVESTIGACIÓN ACTUAL:
  ${JSON.stringify(context, null, 2)}
  ${appendix}
  Instrucciones:
  1. Responde de manera profesional, técnica y precisa.
  2. Utiliza el contexto proporcionado para dar respuestas específicas sobre el candidato o solicitante.
  3. Si te preguntan sobre riesgos, sé directo y fundamenta tu respuesta en los datos.
  4. Puedes dar consejos generales sobre mejores prácticas en RRHH o Crédito, pero siempre prioriza el caso actual.
  5. Mantén un tono autoritativo pero colaborativo.`;

  const contents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  const response = await getAiClient().models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: [...contents, { role: 'user', parts: [{ text: message }] }],
    config: { systemInstruction }
  });

  return response.text;
};

// Fin del archivo
