import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, browserPopupRedirectResolver } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export type Role = 
  | 'ADMIN' 
  | 'EJECUTIVO_VENTAS' 
  | 'ANALISTA_MESA_CONTROL' 
  | 'GERENTE_DIRECTIVO' 
  | 'ANALISTA_CREDITO' 
  | 'INVESTIGADOR_SOCIAL' 
  | 'REVISOR_RRHH' 
  | 'SOLICITANTE'
  | 'CLIENTE_FINANCIERO'
  | 'INVESTIGADOR' // Legacy
  | 'CLIENTE' // Legacy
  | null;

interface AuthContextType {
  user: User | null;
  role: Role;
  clientProfile: string;
  clientType: string;
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
  'adnduarte1@gmail.com'
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [clientProfile, setClientProfile] = useState<string>('GENERAL');
  const [clientType, setClientType] = useState<string>('GRATUITO');
  const [loading, setLoading] = useState(true);

  const logUserAction = async (userId: string, action: string, details: any = {}) => {
    try {
      const logsRef = collection(db, 'user_logs');
      await addDoc(logsRef, {
        userId,
        action,
        details,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error logging user action:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("onAuthStateChanged fired", firebaseUser ? firebaseUser.uid : "no user");
      
      // If we have a user but haven't loaded their data yet, set loading to true
      if (firebaseUser && !user) {
        setLoading(true);
      }

      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          try {
            console.log("Fetching user doc for", firebaseUser.uid);
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            console.log("User doc exists:", userDoc.exists());
            
            let currentRole: Role = 'CLIENTE';
            let currentClientType = 'GRATUITO';
            let currentCredits = 5; // Default credits for new web registrations
            let currentPagaresCredits = 0;
            let needsUpdate = false;

            let currentClientProfile = 'GENERAL';

            let oldDocIdToDelete: string | null = null;

            if (userDoc.exists()) {
              const data = userDoc.data();
              currentRole = data.role as Role;
              currentClientType = data.clientType || 'GRATUITO';
              currentClientProfile = data.clientProfile || 'GENERAL';
              currentCredits = data.credits ?? 0;
              currentPagaresCredits = data.pagaresCredits ?? 0;
            } else if (firebaseUser.email) {
              const emailLower = firebaseUser.email.toLowerCase();
              console.log("User doc not found, checking by email:", emailLower);
              // If UID doc doesn't exist, check if there's a user doc with this email (e.g. created via admin dashboard or legacy)
              try {
                const q = query(collection(db, 'users'), where('email', '==', emailLower));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                  const existingDoc = querySnapshot.docs[0];
                  console.log("Found existing doc with email:", existingDoc.id);
                  if (existingDoc.id !== firebaseUser.uid) {
                    const data = existingDoc.data();
                    currentRole = data.role as Role;
                    currentClientType = data.clientType || 'GRATUITO';
                    currentClientProfile = data.clientProfile || 'GENERAL';
                    currentCredits = data.credits ?? 0;
                    currentPagaresCredits = data.pagaresCredits ?? 0;
                    needsUpdate = true; // We need to write this to the new UID doc
                    oldDocIdToDelete = existingDoc.id;
                  }
                }
              } catch (queryError) {
                console.error("Error querying users by email:", queryError);
              }
            }

            // Force superadmin role if email matches
            if (firebaseUser.email && SUPERADMIN_EMAILS.includes(firebaseUser.email.toLowerCase())) {
              if (currentRole !== 'ADMIN') {
                currentRole = 'ADMIN';
                needsUpdate = true;
              }
            } else if (!userDoc.exists() && firebaseUser.email && !needsUpdate) {
              // Check if pre-registered (legacy fallback)
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
                }
              } catch (e) {
                console.error("Error checking pre-registered users", e);
              }
              needsUpdate = true;
            }

            if (!userDoc.exists() || needsUpdate) {
              console.log("Creating/Updating user doc for", firebaseUser.uid);
              await setDoc(userDocRef, {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                role: currentRole,
                clientType: currentClientType,
                clientProfile: currentClientProfile,
                credits: currentCredits,
                pagaresCredits: currentPagaresCredits,
                createdAt: (userDoc.exists() && userDoc.data()?.createdAt) ? userDoc.data()?.createdAt : new Date().toISOString()
              }, { merge: true });
              console.log("User doc created/updated successfully");

              // If we migrated from an old doc with a different ID, delete it
              if (oldDocIdToDelete) {
                try {
                  await deleteDoc(doc(db, 'users', oldDocIdToDelete));
                } catch (e) {
                  console.error("Error deleting old user doc", e);
                }
              }
            }

            setRole(currentRole);
            setClientProfile(currentClientProfile);
            setClientType(currentClientType);

            // Log login action if not already logged recently (simple check)
            const lastLogin = sessionStorage.getItem(`lastLogin_${firebaseUser.uid}`);
            const now = Date.now();
            if (!lastLogin || now - parseInt(lastLogin) > 1000 * 60 * 60) { // Log once per hour per session
              logUserAction(firebaseUser.uid, 'LOGIN', { email: firebaseUser.email, role: currentRole });
              sessionStorage.setItem(`lastLogin_${firebaseUser.uid}`, now.toString());
            }
          } catch (error) {
            console.error("Error fetching user role:", error);
            // If error occurs, fallback to superadmin check or CLIENTE
            if (firebaseUser.email && SUPERADMIN_EMAILS.includes(firebaseUser.email.toLowerCase())) {
               setRole('ADMIN');
            } else {
               setRole('CLIENTE');
            }
          }
        } else {
          setUser(null);
          setRole(null);
          setClientProfile('GENERAL');
          setClientType('GRATUITO');
        }
      } catch (criticalError) {
        console.error("Critical error in onAuthStateChanged:", criticalError);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    console.log("Login with Google initiated");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      // Using browserPopupRedirectResolver can help in some iframe/sandboxed environments
      const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      console.log("Login with Google successful", result.user.uid);
      return result;
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/popup-closed-by-user') {
        console.warn("User closed the popup before finishing login.");
      }
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerWithEmail = async (email: string, pass: string, phone?: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const userDocRef = doc(db, 'users', userCredential.user.uid);
    
    // We create the document immediately with required fields to satisfy security rules
    // and ensure the user is correctly registered in the database.
    await setDoc(userDocRef, {
      uid: userCredential.user.uid,
      email: userCredential.user.email?.toLowerCase(),
      phone: phone || '',
      role: 'CLIENTE',
      clientType: 'GRATUITO',
      clientProfile: 'GENERAL',
      credits: 5,
      pagaresCredits: 0,
      createdAt: new Date().toISOString()
    }, { merge: true });

    if (logUserAction) {
      await logUserAction(userCredential.user.uid, 'REGISTER', { email, method: 'email' });
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, clientProfile, clientType, loading, login, loginWithEmail, registerWithEmail, resetPassword, logout, logUserAction }}>
      {children}
    </AuthContext.Provider>
  );
};
