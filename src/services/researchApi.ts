import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase';

const functions = getFunctions(app);

// Types for our API
export interface CreateOrderPayload {
  type: 'SOCIOECONOMICO' | 'CREDITO';
  clientName: string;
  subjectName: string;
  notes?: string;
}

export interface UpdateOrderPayload {
  orderId: string;
  status: 'PENDIENTE' | 'EN_PROGRESO' | 'ANALISIS_IA' | 'COMPLETADO';
  investigatorId?: string;
}

export interface FinalizeReportPayload {
  orderId: string;
  dictamen: string;
  riskLevel: 'BAJO' | 'MEDIO' | 'ALTO';
  conclusions: string;
}

export interface AnalyzeEvidencePayload {
  orderId: string;
  evidenceUrls: string[]; // URLs from Firebase Storage
}

/**
 * Generic wrapper to call Firebase Cloud Functions
 */
export const callResearchService = async <T, R>(endpoint: string, payload: T): Promise<R> => {
  try {
    const callable = httpsCallable<T, R>(functions, endpoint);
    const result = await callable(payload);
    return result.data;
  } catch (error: any) {
    console.error(`Error calling function ${endpoint}:`, error);
    throw new Error(error.message || 'Error en el servicio de investigación');
  }
};

// Specific helper functions for better typing
export const createOrder = (payload: CreateOrderPayload) => 
  callResearchService<CreateOrderPayload, { orderId: string }>('createOrder', payload);

export const updateOrderStatus = (payload: UpdateOrderPayload) => 
  callResearchService<UpdateOrderPayload, { success: boolean }>('updateOrderStatus', payload);

export const finalizeReport = (payload: FinalizeReportPayload) => 
  callResearchService<FinalizeReportPayload, { success: boolean, pdfUrl: string }>('finalizeReport', payload);

export const analyzeEvidenceWithAI = (payload: AnalyzeEvidencePayload) => 
  callResearchService<AnalyzeEvidencePayload, { 
    similarityScore: number; 
    addressMatch: boolean; 
    preliminaryConclusion: string;
    riskLevel: string;
  }>('analyzeEvidence', payload);
