import type { User } from 'firebase/auth';

let overlayUser: User | null = null;

export function setLocalAuthOverlayUser(user: User | null): void {
  overlayUser = user;
}

export function getLocalAuthOverlayUser(): User | null {
  return overlayUser;
}

/** Objeto compatible con `User` para el SDK y componentes (sin backend Auth). */
export function createLocalFakeUser(params: {
  uid: string;
  email: string;
}): User {
  const { uid, email } = params;
  return {
    uid,
    email,
    emailVerified: true,
    isAnonymous: false,
    metadata: {} as User['metadata'],
    providerData: [],
    refreshToken: '',
    tenantId: null,
    displayName: null,
    phoneNumber: null,
    photoURL: null,
    providerId: 'local-dev',
    delete: async () => {},
    getIdToken: async () => 'local-dev-token',
    getIdTokenResult: async () =>
      ({
        token: 'local-dev-token',
        authTime: new Date().toISOString(),
        issuedAtTime: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 3600000).toISOString(),
        signInProvider: 'local',
        signInSecondFactor: null,
        claims: {},
      }) as Awaited<ReturnType<User['getIdTokenResult']>>,
    reload: async () => {},
    toJSON: () => ({ uid, email }),
  } as unknown as User;
}

export const LOCAL_SESSION_KEY = 'juxa_local_dev_session_v1';

export interface LocalSessionPayload {
  uid: string;
  email: string;
  role: string;
  clientProfile: string;
  organizationId: string;
  resellerId: string | null;
  clientType: string;
  /** Asiento en cuenta cliente (gerencia / dirección / superadmin de org); opcional en dev local */
  clientAccountRole?: string | null;
}
