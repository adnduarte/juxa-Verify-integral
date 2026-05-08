import React, { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, browserPopupRedirectResolver } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, deleteDoc } from '@/lib/localFirestore';
import { auth, db, secondaryAuth } from '../firebase';
import { isLocalConstructionMode } from '@/lib/localDataMode';
import {
  createLocalFakeUser,
  LOCAL_SESSION_KEY,
  setLocalAuthOverlayUser,
  type LocalSessionPayload,
} from '../lib/localAuthOverlay';
import { DEV_LOCAL_PASSWORD, findDevPersonaByEmail, localDevUidFromEmail } from '@/lib/devPersonasCatalog';
import { ensureLocalDemoData } from '@/lib/devLocalBootstrap';
import { normalizeClientAccountRole } from '@/lib/clientAccountAccess';

export type Role =
  | 'ADMIN'
  | 'EJECUTIVO_VENTAS'
  | 'ANALISTA_MESA_CONTROL'
  /** Supervisión operativa programa Ford (central): gerencia. */
  | 'FORD_SUPERVISOR_GERENCIA'
  /** Supervisión operativa programa Ford (central): dirección. */
  | 'FORD_SUPERVISOR_DIRECCION'
  | 'GERENTE_DIRECTIVO'
  | 'ANALISTA_CREDITO'
  | 'INVESTIGADOR_SOCIAL'
  | 'REVISOR_RRHH'
  | 'SOLICITANTE'
  | 'CLIENTE_FINANCIERO'
  | 'OPERADOR_CAMPO'
  | 'OPERADOR_RED_VISITAS'
  | 'INVESTIGADOR' // Legacy
  | 'CLIENTE' // Legacy
  | null;

interface AuthContextType {
  user: User | null;
  role: Role;
  clientProfile: string;
  clientType: string;
  /** Multi-tenant: organización activa (Firestore `organizations/{id}`) */
  organizationId: string | null;
  /** Marca blanca: organización padre revendedora, si aplica */
  resellerId: string | null;
  /**
   * Asiento en la cuenta del cliente (Firestore `users.clientAccountRole`).
   * Solo GERENCIA, DIRECCION o SUPERADMIN (de organización) ven "Configuración" en el panel cliente; OPERATIVO la oculta.
   */
  clientAccountRole: string | null;
  loading: boolean;
  login: () => Promise<any>;
  loginWithEmail?: (email: string, pass: string) => Promise<void>;
  registerWithEmail?: (email: string, pass: string, phone?: string) => Promise<void>;
  resetPassword?: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  logUserAction?: (userId: string, action: string, details?: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  clientProfile: 'GENERAL',
  clientType: 'GRATUITO',
  organizationId: 'default',
  resellerId: null,
  clientAccountRole: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export const useAuthStatus = () => useContext(AuthContext);

const SUPERADMIN_EMAILS = [
  'aduarte@duarteaupartabogados.com',
  'amarquez@duarteaupartabogados.com',
  'mvazquez@juxa.mx',
  'aduarte@juxa.mx',
  'adnduarte1@gmail.com',
  'originacion@loong.mx',
];

function applyLocalPayload(p: LocalSessionPayload) {
  const fake = createLocalFakeUser({ uid: p.uid, email: p.email });
  setLocalAuthOverlayUser(fake);
  return fake;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [clientProfile, setClientProfile] = useState<string>('GENERAL');
  const [clientType, setClientType] = useState<string>('GRATUITO');
  const [organizationId, setOrganizationId] = useState<string | null>('default');
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [clientAccountRole, setClientAccountRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const logUserAction = async (userId: string, action: string, details: any = {}) => {
    try {
      const logsRef = collection(db, 'user_logs');
      await addDoc(logsRef, {
        userId,
        action,
        details,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error logging user action:', error);
    }
  };

  /** Restaura sesión local (sin Firebase Auth). */
  useLayoutEffect(() => {
    if (!isLocalConstructionMode()) return;
    (async () => {
      // Sembrar organizaciones + dev personas en memoria local de forma idempotente.
      await ensureLocalDemoData();
      try {
        const raw = localStorage.getItem(LOCAL_SESSION_KEY);
        if (!raw) return;
        const p = JSON.parse(raw) as LocalSessionPayload;
        const fake = applyLocalPayload(p);
        setUser(fake);
        setRole(p.role as Role);
        setClientProfile(p.clientProfile || 'GENERAL');
        setClientType(p.clientType || 'GRATUITO');
        setOrganizationId(p.organizationId || 'default');
        setResellerId(p.resellerId ?? null);
        setClientAccountRole(normalizeClientAccountRole(p.clientAccountRole ?? null));
        try {
          const userDoc = await getDoc(doc(db, 'users', p.uid));
          if (userDoc.exists()) {
            const d = userDoc.data();
            setRole((d.role as Role) || (p.role as Role));
            setClientProfile(d.clientProfile || p.clientProfile);
            setClientType(d.clientType || p.clientType);
            setOrganizationId((d.organizationId as string) || p.organizationId);
            setResellerId((d.resellerId as string | null) ?? p.resellerId);
            setClientAccountRole(normalizeClientAccountRole((d.clientAccountRole as string) ?? null));
          }
        } catch {
          /* Firestore opcional en local */
        }
      } catch (e) {
        console.warn('Sesión local inválida', e);
        localStorage.removeItem(LOCAL_SESSION_KEY);
        setLocalAuthOverlayUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (isLocalConstructionMode()) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('onAuthStateChanged fired', firebaseUser ? firebaseUser.uid : 'no user');
      setLocalAuthOverlayUser(null);

      if (firebaseUser && !user) {
        setLoading(true);
      }

      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          try {
            console.log('Fetching user doc for', firebaseUser.uid);
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            console.log('User doc exists:', userDoc.exists());

            let currentRole: Role = 'CLIENTE';
            let currentClientType = 'GRATUITO';
            let currentCredits = 5;
            let currentPagaresCredits = 0;
            let needsUpdate = false;
            let currentClientProfile = 'GENERAL';
            let currentOrganizationId = 'default';
            let currentResellerId: string | null = null;
            let currentClientAccountRole: string | null = null;
            let oldDocIdToDelete: string | null = null;

            if (userDoc.exists()) {
              const data = userDoc.data();
              currentRole = data.role as Role;
              currentClientType = data.clientType || 'GRATUITO';
              currentClientProfile = data.clientProfile || 'GENERAL';
              currentCredits = data.credits ?? 0;
              currentPagaresCredits = data.pagaresCredits ?? 0;
              currentOrganizationId = (data.organizationId as string) || 'default';
              currentResellerId = (data.resellerId as string) || null;
              currentClientAccountRole = normalizeClientAccountRole(data.clientAccountRole as string | undefined);
            } else if (firebaseUser.email) {
              const emailLower = firebaseUser.email.toLowerCase();
              console.log('User doc not found, checking by email:', emailLower);
              try {
                const q = query(collection(db, 'users'), where('email', '==', emailLower));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                  const existingDoc = querySnapshot.docs[0];
                  console.log('Found existing doc with email:', existingDoc.id);
                  if (existingDoc.id !== firebaseUser.uid) {
                    const data = existingDoc.data();
                    currentRole = data.role as Role;
                    currentClientType = data.clientType || 'GRATUITO';
                    currentClientProfile = data.clientProfile || 'GENERAL';
                    currentCredits = data.credits ?? 0;
                    currentPagaresCredits = data.pagaresCredits ?? 0;
                    currentOrganizationId = (data.organizationId as string) || 'default';
                    currentResellerId = (data.resellerId as string) || null;
                    currentClientAccountRole = normalizeClientAccountRole(data.clientAccountRole as string | undefined);
                    needsUpdate = true;
                    oldDocIdToDelete = existingDoc.id;
                  }
                }
              } catch (queryError) {
                console.error('Error querying users by email:', queryError);
              }
            }

            if (firebaseUser.email && SUPERADMIN_EMAILS.includes(firebaseUser.email.toLowerCase())) {
              if (currentRole !== 'ADMIN') {
                currentRole = 'ADMIN';
                needsUpdate = true;
              }
            } else if (!userDoc.exists() && firebaseUser.email && !needsUpdate) {
              try {
                const preRegDocRef = doc(db, 'pre_registered_users', firebaseUser.email.toLowerCase());
                const preRegDoc = await getDoc(preRegDocRef);
                if (preRegDoc.exists()) {
                  const data = preRegDoc.data();
                  currentRole = data.role as Role;
                  if (data.clientType) currentClientType = data.clientType;
                  if (data.clientProfile) currentClientProfile = data.clientProfile;
                  if (data.credits !== undefined) currentCredits = data.credits;
                  if (data.pagaresCredits !== undefined) currentPagaresCredits = data.pagaresCredits;
                  if (data.organizationId) currentOrganizationId = data.organizationId;
                  if (data.resellerId) currentResellerId = data.resellerId;
                  if (data.clientAccountRole != null && String(data.clientAccountRole).trim() !== '') {
                    currentClientAccountRole = normalizeClientAccountRole(String(data.clientAccountRole));
                  }
                }
              } catch (e) {
                console.error('Error checking pre-registered users', e);
              }
              needsUpdate = true;
            }

            if (!userDoc.exists() || needsUpdate) {
              console.log('Creating/Updating user doc for', firebaseUser.uid);
              await setDoc(
                userDocRef,
                {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  role: currentRole,
                  clientType: currentClientType,
                  clientProfile: currentClientProfile,
                  organizationId: currentOrganizationId,
                  resellerId: currentResellerId,
                  credits: currentCredits,
                  pagaresCredits: currentPagaresCredits,
                  createdAt: userDoc.exists() && userDoc.data()?.createdAt ? userDoc.data()?.createdAt : new Date().toISOString(),
                  ...(currentClientAccountRole ? { clientAccountRole: currentClientAccountRole } : {}),
                },
                { merge: true }
              );
              console.log('User doc created/updated successfully');

              if (oldDocIdToDelete) {
                try {
                  await deleteDoc(doc(db, 'users', oldDocIdToDelete));
                } catch (e) {
                  console.error('Error deleting old user doc', e);
                }
              }
            }

            setRole(currentRole);
            setClientProfile(currentClientProfile);
            setClientType(currentClientType);
            setOrganizationId(currentOrganizationId);
            setResellerId(currentResellerId);
            setClientAccountRole(currentClientAccountRole);

            const lastLogin = sessionStorage.getItem(`lastLogin_${firebaseUser.uid}`);
            const now = Date.now();
            if (!lastLogin || now - parseInt(lastLogin) > 1000 * 60 * 60) {
              logUserAction(firebaseUser.uid, 'LOGIN', { email: firebaseUser.email, role: currentRole });
              sessionStorage.setItem(`lastLogin_${firebaseUser.uid}`, now.toString());
            }
          } catch (error) {
            console.error('Error fetching user role:', error);
            if (firebaseUser.email && SUPERADMIN_EMAILS.includes(firebaseUser.email.toLowerCase())) {
              setRole('ADMIN');
            } else {
              setRole('CLIENTE');
            }
            setClientAccountRole(null);
          }
        } else {
          setUser(null);
          setRole(null);
          setClientProfile('GENERAL');
          setClientType('GRATUITO');
          setOrganizationId('default');
          setResellerId(null);
          setClientAccountRole(null);
        }
      } catch (criticalError) {
        console.error('Critical error in onAuthStateChanged:', criticalError);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    if (isLocalConstructionMode()) {
      throw new Error('Inicio con Google no está disponible sin Firebase Auth. Use los accesos rápidos o VITE_USE_FIREBASE=true.');
    }
    console.log('Login with Google initiated');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      console.log('Login with Google successful', result.user.uid);
      return result;
    } catch (error: any) {
      console.error('Login failed', error);
      if (error.code === 'auth/popup-closed-by-user') {
        console.warn('User closed the popup before finishing login.');
      }
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    if (isLocalConstructionMode()) {
      const emailLower = email.trim().toLowerCase();
      if (pass !== DEV_LOCAL_PASSWORD) {
        const err = new Error('auth/invalid-credential') as Error & { code?: string };
        err.code = 'auth/invalid-credential';
        throw err;
      }
      const persona = findDevPersonaByEmail(emailLower);
      if (persona) {
        const uid = localDevUidFromEmail(persona.email);
        const personaOrg = persona.organizationId || 'default';
        const seat = normalizeClientAccountRole(persona.clientAccountRole ?? null);
        const payload: LocalSessionPayload = {
          uid,
          email: persona.email.toLowerCase(),
          role: persona.role as string,
          clientProfile: persona.clientProfile,
          clientType: persona.clientType || 'GRATUITO',
          organizationId: personaOrg,
          resellerId: null,
          clientAccountRole: seat,
        };
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(payload));
        const fake = applyLocalPayload(payload);
        setUser(fake);
        setRole(persona.role);
        setClientProfile(persona.clientProfile);
        setClientType(persona.clientType || 'GRATUITO');
        setOrganizationId(personaOrg);
        setResellerId(null);
        setClientAccountRole(seat);
        try {
          await setDoc(
            doc(db, 'users', uid),
            {
              uid,
              email: persona.email.toLowerCase(),
              role: persona.role,
              clientType: persona.clientType || 'GRATUITO',
              clientProfile: persona.clientProfile,
              organizationId: personaOrg,
              resellerId: null,
              credits: 999,
              pagaresCredits: 99,
              createdAt: new Date().toISOString(),
              devLocalPersona: true,
              ...(seat ? { clientAccountRole: seat } : {}),
            },
            { merge: true }
          );
        } catch {
          /* sin Firestore sigue el login local */
        }
        return;
      }
      const uidFromEmail = localDevUidFromEmail(emailLower);
      const userSnap = await getDoc(doc(db, 'users', uidFromEmail));
      if (!userSnap.exists()) {
        const err = new Error('auth/invalid-credential') as Error & { code?: string };
        err.code = 'auth/invalid-credential';
        throw err;
      }
      const d = userSnap.data() as Record<string, unknown>;
      const docEmail = String(d.email || '')
        .trim()
        .toLowerCase();
      if (docEmail && docEmail !== emailLower) {
        const err = new Error('auth/invalid-credential') as Error & { code?: string };
        err.code = 'auth/invalid-credential';
        throw err;
      }
      const uid = String(d.uid || userSnap.id);
      const seat = normalizeClientAccountRole((d.clientAccountRole as string) ?? null);
      const payload: LocalSessionPayload = {
        uid,
        email: docEmail || emailLower,
        role: String(d.role || 'CLIENTE'),
        clientProfile: String(d.clientProfile || 'GENERAL'),
        clientType: String(d.clientType || 'GRATUITO'),
        organizationId: String(d.organizationId || 'default'),
        resellerId: (d.resellerId as string | null | undefined) ?? null,
        clientAccountRole: seat,
      };
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(payload));
      const fake = applyLocalPayload(payload);
      setUser(fake);
      setRole((payload.role as Role) || 'CLIENTE');
      setClientProfile(payload.clientProfile);
      setClientType(payload.clientType);
      setOrganizationId(payload.organizationId);
      setResellerId(payload.resellerId);
      setClientAccountRole(seat);
      return;
    }
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerWithEmail = async (email: string, pass: string, phone?: string) => {
    if (isLocalConstructionMode()) {
      throw new Error('Registro desactivado en modo sin Firebase Auth.');
    }
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const userDocRef = doc(db, 'users', userCredential.user.uid);

    await setDoc(
      userDocRef,
      {
        uid: userCredential.user.uid,
        email: userCredential.user.email?.toLowerCase(),
        phone: phone || '',
        role: 'CLIENTE',
        clientType: 'GRATUITO',
        clientProfile: 'GENERAL',
        organizationId: 'default',
        resellerId: null,
        credits: 5,
        pagaresCredits: 0,
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );

    if (logUserAction) {
      await logUserAction(userCredential.user.uid, 'REGISTER', { email, method: 'email' });
    }
  };

  const resetPassword = async (email: string) => {
    if (isLocalConstructionMode()) {
      return;
    }
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    if (isLocalConstructionMode()) {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      setLocalAuthOverlayUser(null);
      setUser(null);
      setRole(null);
      setClientProfile('GENERAL');
      setClientType('GRATUITO');
      setOrganizationId('default');
      setResellerId(null);
      setClientAccountRole(null);
      return;
    }
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        clientProfile,
        clientType,
        organizationId,
        resellerId,
        clientAccountRole,
        loading,
        login,
        loginWithEmail,
        registerWithEmail,
        resetPassword,
        logout,
        logUserAction,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
