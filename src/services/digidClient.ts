import { postJson } from './platformApi';

export interface DigidSignatureCreateResponse {
  envelopeId: string;
  status: string;
  signUrl: string | null;
  message?: string;
}

export async function createDigidSignatureRequest(params: {
  organizationId: string;
  contextType: string;
  contextId: string;
}): Promise<DigidSignatureCreateResponse> {
  return postJson<DigidSignatureCreateResponse>('/api/digid/signature-requests', params);
}
