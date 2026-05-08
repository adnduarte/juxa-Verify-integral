import { GoogleGenAI } from '@google/genai';

// The GEMINI_API_KEY is injected by AI Studio into process.env.GEMINI_API_KEY
// and is also available via import.meta.env.VITE_GEMINI_API_KEY if defined in vite.config.ts.
const getApiKey = () => {
  const override = typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY_OVERRIDE') : null;
  if (override) return override;
  return process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
};

const apiKey = getApiKey();

if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'undefined' || apiKey === '') {
  console.warn("⚠️ AVISO: GEMINI_API_KEY no está configurada. Las funciones de IA no funcionarán hasta que configures una API Key válida en el panel de Secretos de AI Studio.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

// Recommended models per instructions
const TEXT_MODEL = 'gemini-3-flash-preview';
const IMAGE_MODEL = 'gemini-2.5-flash-image';

// FUNCIÓN MÁGICA DE CONVERSIÓN (Optimizada para evitar errores de carga y tamaño)
export async function urlToGenerativePart(fileOrUrl: File | Blob | string | null) {
  if (!fileOrUrl) return null;
  
  try {
    let blob: Blob;
    let mimeType: string;

    if (typeof fileOrUrl === 'string') {
      try {
        const response = await fetch(fileOrUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        blob = await response.blob();
        mimeType = blob.type || 'image/jpeg';
      } catch (e) {
        console.error("Error fetching URL:", fileOrUrl, e);
        return null;
      }
    } else {
      blob = fileOrUrl;
      mimeType = fileOrUrl.type || 'image/jpeg';
    }

    // Validar tipos soportados
    const isImage = mimeType.startsWith('image/');
    const isPDF = mimeType === 'application/pdf';
    const isVideo = mimeType.startsWith('video/');

    if (!isImage && !isPDF && !isVideo) {
      console.warn(`Tipo de archivo no soportado: ${mimeType}`);
      return null;
    }

    // 1. Si es PDF o Video, lo enviamos directo (limitando a archivos razonables)
    if (isPDF || isVideo) {
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

    // 2. Si es Imagen, la REDIMENSIONAMOS agresivamente para evitar el error 500 de Payload
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await new Promise<any>((resolve, reject) => {
        const img = new Image();
        if (typeof fileOrUrl === 'string') {
          img.crossOrigin = "Anonymous";
        }
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800; // Un poco más de margen
          
          let width = img.width;
          let height = img.height;
          
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("No se pudo obtener el contexto del canvas"));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          // Comprimir a JPEG con 60% de calidad
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          const base64 = dataUrl.split(',')[1];
          
          URL.revokeObjectURL(objectUrl);
          resolve({ inlineData: { data: base64, mimeType: 'image/jpeg' } });
        };
        
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error(`Error al decodificar la imagen: ${mimeType}`));
        };
        img.src = objectUrl;
      });
    } catch (e) {
      URL.revokeObjectURL(objectUrl);
      throw e;
    }

  } catch (error) {
    console.error(`Error al procesar archivo:`, error);
    return null;
  }
}

export async function analyzeCandidateData(
  candidateData: any, 
  imageParts: (File | Blob | string | null)[], 
  businessRules?: string, 
  simulationType: string = 'none', 
  scoringConfig?: any,
  sellerLocation?: {lat: number, lng: number} | null
) {
  // Check for API key before starting
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'undefined' || apiKey === '') {
    throw new Error("Configuración de IA incompleta: La GEMINI_API_KEY no está configurada en el panel de Secretos de AI Studio.");
  }

  let rawText = '';
  try {
    if (simulationType === 'positive' || simulationType === 'negative' || simulationType === 'consideration') {
      const isPositive = simulationType === 'positive';
      const isConsideration = simulationType === 'consideration';
      
      return JSON.stringify({
        dictamenFinal: {
          estado: isPositive ? "VIABLE" : isConsideration ? "A CONSIDERACIÓN" : "NO VIABLE",
          resumen: isPositive 
            ? "La evidencia es congruente y cumple con las políticas de riesgo. El arraigo domiciliario está plenamente validado." 
            : isConsideration 
              ? "Se detectaron discrepancias menores en los comprobantes de ingresos, pero el arraigo domiciliario es sólido. Se recomienda aval o garantía prendaria."
              : "Discrepancias críticas detectadas en la evidencia. El domicilio declarado no coincide con la geolocalización GPS.",
          semaforo: isPositive ? "VERDE" : isConsideration ? "AMARILLO" : "ROJO"
        },
        score: isPositive ? 95 : isConsideration ? 65 : 30,
        scoreBreakdown: {
          capacidadPago: isPositive ? 30 : isConsideration ? 20 : 10,
          arraigoDomiciliario: isPositive ? 40 : isConsideration ? 35 : 5,
          confiabilidadDocumental: isPositive ? 30 : isConsideration ? 10 : 15
        },
        auditoriaGeografica: {
          distanciaEstimadaMetros: isPositive ? 12 : isConsideration ? 85 : 1500,
          congruenciaGpsDomicilio: isPositive ? "ALTA" : isConsideration ? "MEDIA" : "BAJA",
          detalles: isPositive 
            ? "Ubicación validada correctamente dentro del rango de 50 metros." 
            : isConsideration 
              ? "Ubicación detectada a 85 metros del domicilio declarado. Dentro de margen tolerable para zona urbana densa."
              : "El domicilio declarado se encuentra a más de 1.5km de la captura GPS. Posible fraude de identidad."
        },
        congruenciaIngresos: { 
          detalles: isPositive 
            ? "Acorde a lo declarado y verificado mediante estados de cuenta." 
            : isConsideration 
              ? "Ingresos variables. Se requiere validación adicional de antigüedad laboral."
              : "Incongruencia detectada entre el perfil de egresos y los ingresos declarados." 
        },
        analisisFachada: { 
          detalles: isPositive 
            ? "Fachada coincide plenamente con la descripción y Street View." 
            : isConsideration 
              ? "Fachada coincide parcialmente. Se observa mantenimiento reciente no reflejado en mapas antiguos."
              : "Fachada no coincide con el entorno geográfico declarado." 
        },
        banderasRojas: isPositive 
          ? [] 
          : isConsideration 
            ? ["Ingresos variables", "Comprobante a nombre de tercero"]
            : ["Domicilio no coincide", "Posible alteración documental", "Ubicación GPS remota"]
      });
    }

    const parsedData = typeof candidateData === 'string' ? JSON.parse(candidateData) : candidateData;
    
    // Calculate distance between seller and candidate if available
    let sellerAlert = "No disponible";
    if (sellerLocation && parsedData.realTimeLocation) {
      try {
        const [cLat, cLng] = typeof parsedData.realTimeLocation === 'string' 
          ? parsedData.realTimeLocation.split(',').map(Number)
          : [parsedData.realTimeLocation.lat, parsedData.realTimeLocation.lng];
          
        const R = 6371e3;
        const φ1 = sellerLocation.lat * Math.PI/180;
        const φ2 = cLat * Math.PI/180;
        const Δφ = (cLat - sellerLocation.lat) * Math.PI/180;
        const Δλ = (cLng - sellerLocation.lng) * Math.PI/180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const d = R * c;
        
        if (d > 500) {
          sellerAlert = `ALERTA CRÍTICA: El vendedor generó el enlace a ${Math.round(d)}m de la ubicación actual del cliente. Posible fraude o gestión remota no autorizada.`;
        } else {
          sellerAlert = "Vendedor y cliente en la misma ubicación (Validado).";
        }
      } catch (e) {
        console.error("Error calculating seller distance:", e);
      }
    }

    // Calculate distance to target location (30m rule)
    let targetAlert = "No disponible";
    let distanceToTarget = null;
    if (parsedData.targetLocation && parsedData.realTimeLocation) {
      try {
        const tLat = parsedData.targetLocation.lat;
        const tLng = parsedData.targetLocation.lng;
        const [cLat, cLng] = typeof parsedData.realTimeLocation === 'string' 
          ? parsedData.realTimeLocation.split(',').map(Number)
          : [parsedData.realTimeLocation.lat, parsedData.realTimeLocation.lng];

        const R = 6371e3;
        const φ1 = tLat * Math.PI/180;
        const φ2 = cLat * Math.PI/180;
        const Δφ = (cLat - tLat) * Math.PI/180;
        const Δλ = (cLng - tLng) * Math.PI/180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        distanceToTarget = R * c;
        
        if (distanceToTarget > 30) {
          targetAlert = `ALERTA DE ARRAIGO: El cliente capturó la evidencia a ${Math.round(distanceToTarget)}m de la ubicación objetivo (${parsedData.targetAddress}). El límite es 30m.`;
        } else {
          targetAlert = `COINCIDENCIA EXITOSA: El cliente se encuentra a ${Math.round(distanceToTarget)}m de la ubicación objetivo.`;
        }
      } catch (e) {
        console.error("Error calculating target distance:", e);
      }
    }

    const { perfil, puesto, loongMontoTotal, loongEnganche } = parsedData;
    const legacyRetailCredit =
      perfil === 'LOONG_MOTOR' || !!(loongMontoTotal || loongEnganche);
    let promptContext = '';

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
      case 'LOONG_MOTOR': {
        const isPreQual =
          candidateData.creditStage === 'PRE_QUALIFICATION' || candidateData.investigationScope === 'BASIC';
        const isDirect = candidateData.isDirect;
        const preQualQ = candidateData.preQualQuestions;
        promptContext = `
            OBJETIVO: Investigación de crédito (Juxa Verify) — ALCANCE: ${candidateData.investigationScope || 'No especificado'}.
            ETAPA: ${isPreQual ? 'PRE-CALIFICACIÓN (FASE 1)' : 'CALIFICACIÓN (FASE 2)'}.
            MODO: ${isDirect ? 'Investigación Directa' : 'Investigación con Candidato'}.
            
            ${
              legacyRetailCredit
                ? `
            ÉNFASIS RETAIL / ARRAIGO DE CAMPO:
            - Prioriza estabilidad residencial, evidencia de domicilio y trazabilidad de campo frente a ingresos declarados.
            - Monto / enganche declarados (si existen): ${loongMontoTotal || 'N/A'} / ${loongEnganche || 'N/A'} — úsalos solo como contexto, no como criterio único de dictamen en precalificación simple.
            - Analiza video de fachada, coherencia de interiores y coincidencia con ubicación objetivo.
            `
                : ''
            }
            
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
      }
      default:
        promptContext = 'Realiza un análisis general de congruencia entre los datos declarados y la evidencia visual.';
    }

    const basePrompt = `
      Actúa como un Auditor Senior Experto. Realiza una auditoría forense de la evidencia adjunta.
      
      ${promptContext}

      REGLAS DE NEGOCIO DEL CLIENTE (APLICAR ESTRICTAMENTE):
      ${businessRules ? businessRules : "No hay reglas específicas adicionales. Aplica criterio estándar."}

      INSTRUCCIÓN ESPECIAL DE GEOLOCALIZACIÓN Y ARRAIGO (PERFIL SUBPRIME):
      1. CRUCE DE CONSISTENCIA GEOGRÁFICA: Compara el "Domicilio Declarado" contra las "Coordenadas GPS de Captura". 
      2. REGLA DE ARRAIGO SUBPRIME (30 METROS): En perfiles de alto riesgo (ej. motocicletas), el arraigo es positivo si la distancia entre la captura GPS y la ubicación objetivo es <= 30 metros.
      3. DICTAMEN DE COINCIDENCIA:
         - Analiza la foto de la fachada vs Street View.
         - Valida si el comprobante de domicilio coincide con la ubicación y la fachada.
         - Si la distancia es > 30m, el dictamen de arraigo debe ser penalizado severamente.
      4. SEMÁFORO DE RIESGO:
         - VERDE: Distancia <= 30m entre GPS y Ubicación Objetivo.
         - AMARILLO: Distancia entre 30m y 100m.
         - ROJO: Distancia > 100m (Indicio de fraude o "crédito de favor").
      5. AUDITORÍA VISUAL: Compara la Foto de Fachada subida por el usuario contra la descripción del entorno. Busca indicios de "re-fotografía" (fotos de pantallas).

      CONFIGURACIÓN DE SCORING (APLICAR PARA CALCULAR EL PUNTAJE):
      ${legacyRetailCredit
        ? 'Para crédito retail con énfasis en arraigo: Arraigo domiciliario 70%, verificación de identidad 20%, documentación 10%; ingresos como contexto secundario.'
        : scoringConfig
          ? JSON.stringify(scoringConfig, null, 2)
          : 'Usa el sistema de scoring predeterminado (Ingresos: 30%, Ubicación: 40%, Documentación: 30%).'}

      INSTRUCCIONES DE SCORING:
      1. Calcula un puntaje (score) de 0 a 100.
      2. Proporciona un desglose (scoreBreakdown).
      3. El puntaje debe ser severo con la discrepancia geográfica en perfiles Subprime.

      DATOS DECLARADOS Y METADATOS DE CAPTURA:
      ${JSON.stringify(candidateData, null, 2)}

      REGLA ESTRICTA DE SALIDA: Debes devolver ÚNICAMENTE un objeto JSON puro.

      AUDITORÍA DE ORIGEN (VENDEDOR VS CLIENTE):
      ${sellerAlert}

      AUDITORÍA DE COINCIDENCIA (CLIENTE VS OBJETIVO):
      ${targetAlert}

      ESTRUCTURA JSON REQUERIDA:
      {
        "dictamenFinal": { 
          "estado": "VIABLE" | "NO VIABLE" | "SUJETO A CONSIDERACIÓN", 
          "resumen": "...",
          "dictamenArraigo": "Análisis detallado de la estabilidad domiciliaria y validación de campo.",
          "analisisForenseIdentidad": "Resultado de la validación de la identificación oficial y prevención de usurpación.",
          "sugerenciaAprobacion": "Sugerencia técnica (ej. solicitar aval, reducir monto, etc.)",
          "mitigacionSugerida": "Medidas de mitigación como GPS (GAS) y/o AVAL",
          "semaforo": "VERDE" | "AMARILLO" | "ROJO",
          "alertaVendedor": "${sellerAlert}",
          "alertaCoincidencia": "${targetAlert}"
        },
        "score": number,
        "scoreBreakdown": {
          "capacidadPago": number,
          "arraigoDomiciliario": number,
          "confiabilidadDocumental": number,
          "verificacionIdentidad": number
        },
        "auditoriaGeografica": {
          "distanciaEstimadaMetros": number,
          "congruenciaGpsDomicilio": "ALTA" | "MEDIA" | "BAJA",
          "detalles": "..."
        },
        "congruenciaIngresos": { "detalles": "..." },
        "analisisFachada": { 
          "detalles": "...",
          "comparativoStreetView": "Descripción de similitudes/diferencias visuales esperadas contra mapas",
          "validacionVideo": "Análisis de la entrada y transición mostrada en el video"
        },
        "banderasRojas": ["...", "..."]
      }
    `;

    const contents: any[] = [];

    const partsPromises = (imageParts || []).map(part => urlToGenerativePart(part));
    const parts = await Promise.all(partsPromises);
    parts.filter(p => p !== null).forEach(p => contents.push(p));

    contents.push({ text: basePrompt });

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
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
  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: prompt,
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
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

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: contents,
    config: { systemInstruction }
  });

  return response.text;
};

export const chatWithJuxaVerify = async (history: any[], message: string, context: any) => {
  const systemInstruction = `Eres un experto en Crédito, Recursos Humanos e Investigación de Créditos para JUXA Verify.
  Tu misión es ayudar al usuario a analizar los resultados de una investigación específica.
  
  CONTEXTO DE LA INVESTIGACIÓN ACTUAL:
  ${JSON.stringify(context, null, 2)}
  
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

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [...contents, { role: 'user', parts: [{ text: message }] }],
    config: { systemInstruction }
  });

  return response.text;
};

/** Chat contextual para supervisores operativos del programa Ford (sin expediente individual). */
export const chatFordOperationsAssistant = async (
  history: { role: 'user' | 'model'; text: string }[],
  message: string,
  operationsSnapshot: Record<string, unknown>
) => {
  const systemInstruction = `Eres un asistente de IA para supervisión operativa de Ford Crédito México (vista programa central).
Tu audiencia es gerencia y dirección: interpretan red de agencias, volumen de créditos, estados de expedientes y riesgos operativos.

SNAPSHOT ACTUAL (JSON; es la fuente de verdad para cifras y listas):
${JSON.stringify(operationsSnapshot, null, 2)}

Reglas:
1. Responde en español, tono profesional y directo.
2. No inventes números ni agencias: solo usa lo que aparece en el snapshot. Si falta dato, dilo.
3. Puedes sugerir preguntas de seguimiento, hipótesis cualitativas o buenas prácticas, marcándolas como tales.
4. Si el usuario pide detalle de un expediente que no está en el snapshot, indica que debe abrir el pipeline o la mesa.`;

  const contents = history.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }],
  }));

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [...contents, { role: 'user', parts: [{ text: message }] }],
    config: { systemInstruction },
  });

  return response.text;
};

/** Interpreta lenguaje natural → filtros CRM (solo cliente; sin llamadas externas). */
export type ParsedCreditCrmFilter = {
  pipelineStage?: string | null;
  entityState?: string | null;
  organizationId?: string | null;
  keywords?: string | null;
};

export const parseCreditCrmFilterFromText = async (
  message: string,
  agencyIdsSample: string[]
): Promise<ParsedCreditCrmFilter | null> => {
  const systemInstruction = `Eres un asistente que convierte una petición en español en filtros para una tabla de expedientes de crédito (Ford México / agencias).
Responde ÚNICAMENTE con un objeto JSON válido, sin markdown, con estas claves opcionales:
- "pipelineStage": uno de PRE_QUALIFICATION | MESA_CONTROL | RETURN_TO_AGENCY | ANALYSIS | CONDITIONS | PLACEMENT | SIGNED_CLOSED | null
- "entityState": código de entidad MX de 3 letras (ej. JAL, CMX, NLE) o null
- "organizationId": si el usuario nombra una agencia y conoces el id exacto de la lista permitida, o null
- "keywords": texto para buscar en título o referencia de contrato, o null

Agencias conocidas (IDs exactos si los mencionan): ${JSON.stringify(agencyIdsSample)}

Si no puedes inferir algo, usa null. Ejemplo: {"pipelineStage":"MESA_CONTROL","entityState":"JAL","organizationId":null,"keywords":"rodriguez"}`;

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [{ role: 'user', parts: [{ text: message }] }],
    config: { systemInstruction },
  });

  const raw = (response.text || '').trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as ParsedCreditCrmFilter;
  } catch {
    return null;
  }
};

/** Auditoría por periodos — programa Ford / cumplimiento (snapshot agregado). */
export const chatFordAuditAssistant = async (
  history: { role: 'user' | 'model'; text: string }[],
  message: string,
  auditSnapshot: Record<string, unknown>
) => {
  const systemInstruction = `Eres un auditor inteligente para Ford Crédito México y originación de crédito.
Recibes un SNAPSHOT JSON de un periodo (expedientes agregados, etapas, agencias). No inventes expedientes ni cifras fuera del snapshot.
Ayuda a detectar desviaciones operativas, riesgos de cumplimiento e inconsistencias de proceso (sin sustituir dictamen legal).
Responde en español, tono ejecutivo y accionable.

SNAPSHOT:
${JSON.stringify(auditSnapshot, null, 2)}`;

  const contents = history.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }],
  }));

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [...contents, { role: 'user', parts: [{ text: message }] }],
    config: { systemInstruction },
  });

  return response.text;
};

// Fin del archivo
