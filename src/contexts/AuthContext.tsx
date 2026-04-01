import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  User,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  browserPopupRedirectResolver,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { isSuperAdminEmail } from '../config/superadmins';
import {
  DEFAULT_ORGANIZATION_ID_LOONG,
  defaultOrganizationIdFromEmail,
  normalizeOrganizationId,
  parseEnabledProducts,
  resolveEffectiveOrganizationId,
  SAAS_PRODUCT_IDS,
  shouldUpgradeClientProfileToLoongMotorForMxCorp,
  type SaaSProductId,
} from '../lib/organizations';

export type Role =
  | 'ADMIN'
  | 'SUPERVISOR'
  | 'EJECUTIVO_VENTAS'
  | 'ANALISTA_MESA_CONTROL'
  | 'GERENTE_DIRECTIVO'
  | 'ANALISTA_CREDITO'
  | 'INVESTIGADOR_SOCIAL'
  | 'REVISOR_RRHH'
  | 'SOLICITANTE'
  | 'CLIENTE_FINANCIERO'
  | 'INVESTIGADOR'
  | 'CLIENTE'
  | 'ATENCION_CLIENTE'
  | 'ADMIN_COBRANZA'
  | 'AGENTE_COBRANZA'
  | null;

function asTrialProduct(p: unknown): SaaSProductId | null {
  return typeof p === 'string' && (SAAS_PRODUCT_IDS as readonly string[]).includes(p) ? (p as SaaSProductId) : null;
}

interface AuthContextType {
  user: User | null;
  role: Role;
  clientProfile: string;
  clientType: string;
  /** Créditos de investigación (Firestore users.credits). */
  creditsBalance: number;
  organizationId: string | null;
  /** organizationId del documento + fallback tenant Loong si aplica; usar en escrituras a Firestore. */
  effectiveOrganizationId: string | null;
  organizationName: string | null;
  orgEnabledProducts: SaaSProductId[] | null;
  orgTrialEndsAt: string | null;
  userTrialEndsAt: string | null;
  userTrialProduct: SaaSProductId | null;
  maxFreeInvestigations: number | null;
  /** Alta Equipo Loong: mesa_control | usuario | admin | … */
  loongTeamTier: string | null;
  accountSyncNotice: string | null;
  dismissAccountSyncNotice: () => void;
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
  creditsBalance: 0,
  organizationId: null,
  effectiveOrganizationId: null,
  organizationName: null,
  orgEnabledProducts: null,
  orgTrialEndsAt: null,
  userTrialEndsAt: null,
  userTrialProduct: null,
  maxFreeInvestigations: null,
  loongTeamTier: null,
  accountSyncNotice: null,
  dismissAccountSyncNotice: () => {},
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export const useAuthStatus = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [clientProfile, setClientProfile] = useState<string>('GENERAL');
  const [clientType, setClientType] = useState<string>('GRATUITO');
  const [creditsBalance, setCreditsBalance] = useState(0);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [orgEnabledProducts, setOrgEnabledProducts] = useState<SaaSProductId[] | null>(null);
  const [orgTrialEndsAt, setOrgTrialEndsAt] = useState<string | null>(null);
  const [userTrialEndsAt, setUserTrialEndsAt] = useState<string | null>(null);
  const [userTrialProduct, setUserTrialProduct] = useState<SaaSProductId | null>(null);
  const [maxFreeInvestigations, setMaxFreeInvestigations] = useState<number | null>(null);
  const [loongTeamTier, setLoongTeamTier] = useState<string | null>(null);
  const [accountSyncNotice, setAccountSyncNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const effectiveOrganizationId = useMemo(
    () => resolveEffectiveOrganizationId(organizationId, clientProfile),
    [organizationId, clientProfile]
  );

  const dismissAccountSyncNotice = () => {
    if (user?.uid) sessionStorage.removeItem(`preRegSyncToast_${user.uid}`);
    setAccountSyncNotice(null);
  };

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && !user) {
        setLoading(true);
      }

      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          try {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);

            let currentRole: Role = 'CLIENTE';
            let currentClientType = 'GRATUITO';
            let currentCredits = 5;
            let currentPagaresCredits = 0;
            let needsUpdate = false;
            let currentClientProfile = 'GENERAL';
            let currentOrganizationId: string | null = null;
            let currentUserTrialEndsAt: string | null = null;
            let currentUserTrialProduct: SaaSProductId | null = null;
            let currentMaxFreeInv: number | null = null;
            let currentDisplayName: string | null = null;
            let currentBranchNickname: string | null = null;
            let currentBranchAddress: string | null = null;
            let currentBranchEntity: string | null = null;
            let currentLoongTeamTier: string | null = null;

            let oldDocIdToDelete: string | null = null;

            const applyUserData = (data: Record<string, unknown>) => {
              currentRole = data.role as Role;
              currentClientType = (data.clientType as string) || 'GRATUITO';
              currentClientProfile = (data.clientProfile as string) || 'GENERAL';
              currentCredits = typeof data.credits === 'number' ? data.credits : 0;
              currentPagaresCredits = typeof data.pagaresCredits === 'number' ? data.pagaresCredits : 0;
              if (typeof data.organizationId === 'string' && data.organizationId) {
                currentOrganizationId = normalizeOrganizationId(data.organizationId);
              }
              if (typeof data.trialEndsAt === 'string') currentUserTrialEndsAt = data.trialEndsAt;
              const tp = asTrialProduct(data.trialProduct);
              if (tp) currentUserTrialProduct = tp;
              if (typeof data.maxFreeInvestigations === 'number') currentMaxFreeInv = data.maxFreeInvestigations;
              if (typeof data.displayName === 'string' && data.displayName.trim()) currentDisplayName = data.displayName.trim();
              if (typeof data.branchNickname === 'string' && data.branchNickname.trim())
                currentBranchNickname = data.branchNickname.trim();
              if (typeof data.branchAddress === 'string' && data.branchAddress.trim())
                currentBranchAddress = data.branchAddress.trim();
              if (typeof data.branchEntity === 'string' && data.branchEntity.trim()) currentBranchEntity = data.branchEntity.trim();
              if (typeof data.loongTeamTier === 'string' && data.loongTeamTier.trim()) {
                currentLoongTeamTier = data.loongTeamTier.trim();
              }
            };

            if (userDoc.exists()) {
              applyUserData(userDoc.data() as Record<string, unknown>);
            } else if (firebaseUser.email) {
              const emailLower = firebaseUser.email.toLowerCase();
              try {
                const q = query(collection(db, 'users'), where('email', '==', emailLower));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                  const existingDoc = querySnapshot.docs[0];
                  if (existingDoc.id !== firebaseUser.uid) {
                    applyUserData(existingDoc.data() as Record<string, unknown>);
                    needsUpdate = true;
                    oldDocIdToDelete = existingDoc.id;
                  }
                }
              } catch (queryError) {
                console.error('Error querying users by email:', queryError);
              }
            }

            let syncedProfileFromPreRegister = false;
            if (firebaseUser.email && !isSuperAdminEmail(firebaseUser.email)) {
              const emailLower = firebaseUser.email.toLowerCase();
              try {
                const preRegSnap = await getDoc(doc(db, 'pre_registered_users', emailLower));
                if (preRegSnap.exists()) {
                  const pr = preRegSnap.data();
                  const prRole = (pr.role as Role) || currentRole;
                  const prProfile =
                    typeof pr.clientProfile === 'string' && pr.clientProfile ? pr.clientProfile : currentClientProfile;
                  const prType = typeof pr.clientType === 'string' && pr.clientType ? pr.clientType : currentClientType;

                  if (prRole !== currentRole || prProfile !== currentClientProfile || prType !== currentClientType) {
                    currentRole = prRole;
                    currentClientProfile = prProfile;
                    currentClientType = prType;
                    needsUpdate = true;
                    if (userDoc.exists()) syncedProfileFromPreRegister = true;
                  }

                  if (!userDoc.exists()) {
                    if (typeof pr.credits === 'number') currentCredits = pr.credits;
                    if (typeof pr.pagaresCredits === 'number') currentPagaresCredits = pr.pagaresCredits;
                    needsUpdate = true;
                  }

                  const prOrg = normalizeOrganizationId(
                    typeof pr.organizationId === 'string' ? pr.organizationId : null
                  );
                  if (prOrg && prOrg !== currentOrganizationId) {
                    currentOrganizationId = prOrg;
                    needsUpdate = true;
                    syncedProfileFromPreRegister = true;
                  }
                  const prLt = typeof pr.loongTeamTier === 'string' ? pr.loongTeamTier.trim() : '';
                  if (prLt && prLt !== currentLoongTeamTier) {
                    currentLoongTeamTier = prLt;
                    needsUpdate = true;
                    syncedProfileFromPreRegister = true;
                  }
                  if (typeof pr.displayName === 'string' && pr.displayName.trim() && pr.displayName.trim() !== currentDisplayName) {
                    currentDisplayName = pr.displayName.trim();
                    needsUpdate = true;
                    syncedProfileFromPreRegister = true;
                  }
                  if (
                    typeof pr.branchNickname === 'string' &&
                    pr.branchNickname.trim() &&
                    pr.branchNickname.trim() !== currentBranchNickname
                  ) {
                    currentBranchNickname = pr.branchNickname.trim();
                    needsUpdate = true;
                    syncedProfileFromPreRegister = true;
                  }
                  if (
                    typeof pr.branchAddress === 'string' &&
                    pr.branchAddress.trim() &&
                    pr.branchAddress.trim() !== currentBranchAddress
                  ) {
                    currentBranchAddress = pr.branchAddress.trim();
                    needsUpdate = true;
                    syncedProfileFromPreRegister = true;
                  }
                  if (typeof pr.branchEntity === 'string' && pr.branchEntity.trim() && pr.branchEntity.trim() !== currentBranchEntity) {
                    currentBranchEntity = pr.branchEntity.trim();
                    needsUpdate = true;
                    syncedProfileFromPreRegister = true;
                  }
                  if (typeof pr.trialEndsAt === 'string' && pr.trialEndsAt !== currentUserTrialEndsAt) {
                    currentUserTrialEndsAt = pr.trialEndsAt;
                    needsUpdate = true;
                  }
                  const prTp = asTrialProduct(pr.trialProduct);
                  if (prTp && prTp !== currentUserTrialProduct) {
                    currentUserTrialProduct = prTp;
                    needsUpdate = true;
                  }
                  if (typeof pr.maxFreeInvestigations === 'number' && pr.maxFreeInvestigations !== currentMaxFreeInv) {
                    currentMaxFreeInv = pr.maxFreeInvestigations;
                    needsUpdate = true;
                  }
                }
              } catch (preErr) {
                console.error('pre_registered_users merge:', preErr);
              }
            }

            if (firebaseUser.email && isSuperAdminEmail(firebaseUser.email)) {
              if (currentRole !== 'ADMIN') {
                currentRole = 'ADMIN';
                needsUpdate = true;
              }
            }

            if (!userDoc.exists() && firebaseUser.email && !needsUpdate) {
              try {
                const preRegDoc = await getDoc(doc(db, 'pre_registered_users', firebaseUser.email.toLowerCase()));
                if (preRegDoc.exists()) {
                  const data = preRegDoc.data();
                  currentRole = data.role as Role;
                  if (data.clientType) currentClientType = data.clientType as string;
                  if (data.clientProfile) currentClientProfile = data.clientProfile as string;
                  if (data.credits !== undefined) currentCredits = data.credits as number;
                  if (data.pagaresCredits !== undefined) currentPagaresCredits = data.pagaresCredits as number;
                  if (typeof data.organizationId === 'string') {
                    currentOrganizationId = normalizeOrganizationId(data.organizationId);
                  }
                  if (typeof data.trialEndsAt === 'string') currentUserTrialEndsAt = data.trialEndsAt;
                  const tp = asTrialProduct(data.trialProduct);
                  if (tp) currentUserTrialProduct = tp;
                  if (typeof data.maxFreeInvestigations === 'number') currentMaxFreeInv = data.maxFreeInvestigations;
                  if (typeof data.loongTeamTier === 'string' && data.loongTeamTier.trim()) {
                    currentLoongTeamTier = data.loongTeamTier.trim();
                  }
                }
              } catch (e) {
                console.error('Error checking pre-registered users', e);
              }
              needsUpdate = true;
            }

            if (!currentOrganizationId && firebaseUser.email) {
              const orgFromEmail = defaultOrganizationIdFromEmail(firebaseUser.email);
              if (orgFromEmail) {
                currentOrganizationId = orgFromEmail;
                needsUpdate = true;
              }
            }

            if (
              shouldUpgradeClientProfileToLoongMotorForMxCorp(
                firebaseUser.email,
                currentRole,
                currentClientProfile
              )
            ) {
              currentClientProfile = 'LOONG_MOTOR';
              needsUpdate = true;
            }

            if (!currentLoongTeamTier && currentRole === 'ANALISTA_MESA_CONTROL') {
              currentLoongTeamTier = 'mesa_control';
              needsUpdate = true;
            }

            const userPayload: Record<string, unknown> = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: currentRole,
              clientType: currentClientType,
              clientProfile: currentClientProfile,
              credits: currentCredits,
              pagaresCredits: currentPagaresCredits,
              createdAt:
                userDoc.exists() && userDoc.data()?.createdAt ? userDoc.data()?.createdAt : new Date().toISOString(),
            };
            if (currentOrganizationId) userPayload.organizationId = currentOrganizationId;
            if (currentUserTrialEndsAt) userPayload.trialEndsAt = currentUserTrialEndsAt;
            if (currentUserTrialProduct) userPayload.trialProduct = currentUserTrialProduct;
            if (currentMaxFreeInv != null) userPayload.maxFreeInvestigations = currentMaxFreeInv;
            if (currentDisplayName) userPayload.displayName = currentDisplayName;
            if (currentBranchNickname) userPayload.branchNickname = currentBranchNickname;
            if (currentBranchAddress) userPayload.branchAddress = currentBranchAddress;
            if (currentBranchEntity) userPayload.branchEntity = currentBranchEntity;
            if (currentLoongTeamTier) userPayload.loongTeamTier = currentLoongTeamTier;

            if (!userDoc.exists() || needsUpdate) {
              await setDoc(userDocRef, userPayload, { merge: true });
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
            setCreditsBalance(currentCredits);
            setLoongTeamTier(currentLoongTeamTier);
            setOrganizationId(currentOrganizationId);
            setUserTrialEndsAt(currentUserTrialEndsAt);
            setUserTrialProduct(currentUserTrialProduct);
            setMaxFreeInvestigations(currentMaxFreeInv);

            let oName: string | null = null;
            let oProducts: SaaSProductId[] | null = null;
            let oTrial: string | null = null;
            const orgIdForMetadata =
              currentOrganizationId ||
              (currentClientProfile === 'LOONG_MOTOR' ? DEFAULT_ORGANIZATION_ID_LOONG : null);
            if (orgIdForMetadata) {
              try {
                const orgSnap = await getDoc(doc(db, 'organizations', orgIdForMetadata));
                if (orgSnap.exists()) {
                  const o = orgSnap.data();
                  oName = typeof o.name === 'string' ? o.name : null;
                  const parsed = parseEnabledProducts(o.enabledProducts);
                  oProducts = parsed.length > 0 ? parsed : null;
                  oTrial = typeof o.trialEndsAt === 'string' ? o.trialEndsAt : null;
                }
              } catch (e) {
                console.error('organizations read:', e);
              }
            }
            setOrganizationName(oName);
            setOrgEnabledProducts(oProducts);
            setOrgTrialEndsAt(oTrial);

            if (syncedProfileFromPreRegister) {
              const k = `preRegSyncToast_${firebaseUser.uid}`;
              if (!sessionStorage.getItem(k)) {
                setAccountSyncNotice(
                  'Tu perfil y rol se alinearon con el pre-registro de tu correo. Si algo no coincide, pide a tu administrador que revise el alta en el panel.'
                );
                sessionStorage.setItem(k, '1');
              }
            }

            const lastLogin = sessionStorage.getItem(`lastLogin_${firebaseUser.uid}`);
            const now = Date.now();
            if (!lastLogin || now - parseInt(lastLogin, 10) > 1000 * 60 * 60) {
              logUserAction(firebaseUser.uid, 'LOGIN', { email: firebaseUser.email, role: currentRole });
              sessionStorage.setItem(`lastLogin_${firebaseUser.uid}`, now.toString());
            }
          } catch (error) {
            console.error('Error fetching user role:', error);
            if (firebaseUser.email && isSuperAdminEmail(firebaseUser.email)) {
              setRole('ADMIN');
            } else {
              setRole('CLIENTE');
            }
            setCreditsBalance(0);
            setOrganizationId(null);
            setOrganizationName(null);
            setOrgEnabledProducts(null);
            setOrgTrialEndsAt(null);
            setUserTrialEndsAt(null);
            setUserTrialProduct(null);
            setMaxFreeInvestigations(null);
            setLoongTeamTier(null);
          }
        } else {
          setUser(null);
          setRole(null);
          setClientProfile('GENERAL');
          setClientType('GRATUITO');
          setCreditsBalance(0);
          setOrganizationId(null);
          setOrganizationName(null);
          setOrgEnabledProducts(null);
          setOrgTrialEndsAt(null);
          setUserTrialEndsAt(null);
          setUserTrialProduct(null);
          setMaxFreeInvestigations(null);
          setLoongTeamTier(null);
          setAccountSyncNotice(null);
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
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    return result;
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerWithEmail = async (email: string, pass: string, phone?: string) => {
    const emailLower = email.trim().toLowerCase();
    const userCredential = await createUserWithEmailAndPassword(auth, emailLower, pass);
    const userDocRef = doc(db, 'users', userCredential.user.uid);

    let role: Role = 'CLIENTE';
    let clientType = 'GRATUITO';
    let clientProfile = 'GENERAL';
    let credits = 5;
    let pagaresCredits = 0;
    let phoneOut = phone?.trim() || '';
    let fromPreRegister = false;
    let orgId: string | null = null;
    let trialEnds: string | null = null;
    let trialProd: SaaSProductId | null = null;
    let maxFree: number | null = null;
    let displayName: string | null = null;
    let branchNickname: string | null = null;
    let branchAddress: string | null = null;
    let branchEntity: string | null = null;

    if (isSuperAdminEmail(emailLower)) {
      role = 'ADMIN';
      credits = 999;
    } else {
      try {
        const preSnap = await getDoc(doc(db, 'pre_registered_users', emailLower));
        if (preSnap.exists()) {
          fromPreRegister = true;
          const d = preSnap.data();
          if (d.role && typeof d.role === 'string') role = d.role as Role;
          if (d.clientType && typeof d.clientType === 'string') clientType = d.clientType;
          if (d.clientProfile && typeof d.clientProfile === 'string') clientProfile = d.clientProfile;
          if (typeof d.credits === 'number') credits = d.credits;
          if (typeof d.pagaresCredits === 'number') pagaresCredits = d.pagaresCredits;
          if (!phoneOut && typeof d.phone === 'string') phoneOut = d.phone;
          if (typeof d.organizationId === 'string') orgId = d.organizationId;
          if (typeof d.trialEndsAt === 'string') trialEnds = d.trialEndsAt;
          const tp = asTrialProduct(d.trialProduct);
          if (tp) trialProd = tp;
          if (typeof d.maxFreeInvestigations === 'number') maxFree = d.maxFreeInvestigations;
          if (typeof d.displayName === 'string' && d.displayName.trim()) displayName = d.displayName.trim();
          if (typeof d.branchNickname === 'string' && d.branchNickname.trim()) branchNickname = d.branchNickname.trim();
          if (typeof d.branchAddress === 'string' && d.branchAddress.trim()) branchAddress = d.branchAddress.trim();
          if (typeof d.branchEntity === 'string' && d.branchEntity.trim()) branchEntity = d.branchEntity.trim();
        }
      } catch (e) {
        console.error('pre_registered_users read:', e);
      }
    }

    const regPayload: Record<string, unknown> = {
      uid: userCredential.user.uid,
      email: emailLower,
      phone: phoneOut,
      role,
      clientType,
      clientProfile,
      credits,
      pagaresCredits,
      createdAt: new Date().toISOString(),
    };
    const resolvedOrg = normalizeOrganizationId(orgId) || defaultOrganizationIdFromEmail(emailLower);
    if (resolvedOrg) regPayload.organizationId = resolvedOrg;
    if (shouldUpgradeClientProfileToLoongMotorForMxCorp(emailLower, role, clientProfile)) {
      clientProfile = 'LOONG_MOTOR';
      regPayload.clientProfile = 'LOONG_MOTOR';
    }
    if (trialEnds) regPayload.trialEndsAt = trialEnds;
    if (trialProd) regPayload.trialProduct = trialProd;
    if (maxFree != null) regPayload.maxFreeInvestigations = maxFree;
    if (displayName) regPayload.displayName = displayName;
    if (branchNickname) regPayload.branchNickname = branchNickname;
    if (branchAddress) regPayload.branchAddress = branchAddress;
    if (branchEntity) regPayload.branchEntity = branchEntity;

    await setDoc(userDocRef, regPayload, { merge: true });

    await logUserAction(userCredential.user.uid, 'REGISTER', {
      email: emailLower,
      method: 'email',
      role,
      clientProfile,
      fromPreRegister,
    });
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
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
        creditsBalance,
        organizationId,
        effectiveOrganizationId,
        organizationName,
        orgEnabledProducts,
        orgTrialEndsAt,
        userTrialEndsAt,
        userTrialProduct,
        maxFreeInvestigations,
        accountSyncNotice,
        dismissAccountSyncNotice,
        loading,
        login,
        loginWithEmail,
        registerWithEmail,
        resetPassword,
        logout,
        logUserAction,
        loongTeamTier,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
