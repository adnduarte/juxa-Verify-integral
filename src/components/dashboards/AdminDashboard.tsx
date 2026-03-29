import React, { useState, useEffect } from 'react';
import { Users, FileText, TrendingUp, Clock, RefreshCw, UserPlus, CreditCard, Link as LinkIcon, Search, Eye, X, Bot, Zap, Briefcase, Plus, Mail, Trash2, Brain, MapPin } from 'lucide-react';
import { db } from '../../firebase';
import { collection, getDocs, deleteDoc, doc, setDoc, query, where, addDoc, getDoc } from 'firebase/firestore';
import { useAuthStatus } from '../../contexts/AuthContext';
import { CGOEngine } from '../CGOEngine';
import { IntegralDashboard } from './IntegralDashboard';

import { DashboardLayout } from './DashboardLayout';
import { AIResultRenderer } from '../AIResultRenderer';
import { JuxaVerifyLoader } from '../JuxaVerifyLoader';
import { LocationViewer } from '../LocationViewer';

import { FinancialDashboard } from './FinancialDashboard';
import { InvestigatorDashboard } from './InvestigatorDashboard';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'users' | 'plans' | 'simulator' | 'cgo' | 'ia-config'>('metrics');
  const { user, logUserAction } = useAuthStatus();

  const sidebarItems = [
    { id: 'metrics', label: 'Métricas', icon: TrendingUp },
    { id: 'users', label: 'Usuarios y Solicitudes', icon: Users },
    { id: 'plans', label: 'Planes de Cobro', icon: CreditCard },
    { id: 'simulator', label: 'Simulador de Enlaces', icon: LinkIcon },
    { id: 'cgo', label: 'CGO AI', icon: Bot },
    { id: 'ia-config', label: 'Configuración IA', icon: Bot },
  ];

  return (
    <div className="p-4 sm:p-8 h-full">
      <DashboardLayout
        title="Dashboard de Administración"
        subtitle="Gestión global de la plataforma"
        sidebarItems={sidebarItems}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as any)}
      >
        {activeTab === 'metrics' && <MetricsTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'plans' && <PlansTab />}
        {activeTab === 'simulator' && <SimulatorTab />}
        {activeTab === 'cgo' && <CGOEngine />}
        {activeTab === 'ia-config' && <IAConfigTab />}
      </DashboardLayout>
    </div>
  );
};

const IAConfigTab = () => {
  const [weights, setWeights] = useState({
    identity: 30,
    credit: 40,
    socioeconomic: 30
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchWeights = async () => {
      try {
        const docRef = doc(db, 'settings', 'ia_weights');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setWeights(docSnap.data() as any);
        }
      } catch (error) {
        console.error("Error fetching IA weights:", error);
      }
    };
    fetchWeights();
  }, []);

  const handleSave = async () => {
    const total = weights.identity + weights.credit + weights.socioeconomic;
    if (total !== 100) {
      setMessage(`El total debe sumar 100%. Actual: ${total}%`);
      return;
    }

    setIsSaving(true);
    setMessage('');
    try {
      const docRef = doc(db, 'settings', 'ia_weights');
      await setDoc(docRef, weights);
      setMessage('Configuración guardada exitosamente.');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error("Error saving IA weights:", error);
      setMessage('Error al guardar la configuración.');
    } finally {
      setIsSaving(false);
    }
  };

  const total = weights.identity + weights.credit + weights.socioeconomic;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-3xl">
      <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center">
        <Bot className="w-5 h-5 mr-2 text-blue-600" />
        Configuración de Dictamen IA (Ponderaciones)
      </h3>
      <p className="text-sm text-slate-500 mb-6">
        Ajusta los pesos de cada módulo de validación para el cálculo del score final de riesgo. El total debe sumar 100%.
      </p>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes('Error') || message.includes('100%') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {message}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <div className="flex justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700">Validación de Identidad (Biometría / Documentos)</label>
            <span className="text-sm font-bold text-slate-900">{weights.identity}%</span>
          </div>
          <input 
            type="range" 
            min="0" max="100" 
            value={weights.identity} 
            onChange={(e) => setWeights({...weights, identity: parseInt(e.target.value)})}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700">Análisis Crediticio (Buró / Ingresos)</label>
            <span className="text-sm font-bold text-slate-900">{weights.credit}%</span>
          </div>
          <input 
            type="range" 
            min="0" max="100" 
            value={weights.credit} 
            onChange={(e) => setWeights({...weights, credit: parseInt(e.target.value)})}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700">Estudio Socioeconómico (Entorno / Referencias)</label>
            <span className="text-sm font-bold text-slate-900">{weights.socioeconomic}%</span>
          </div>
          <input 
            type="range" 
            min="0" max="100" 
            value={weights.socioeconomic} 
            onChange={(e) => setWeights({...weights, socioeconomic: parseInt(e.target.value)})}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
          <div className="text-sm">
            Total: <span className={`font-bold ${total === 100 ? 'text-emerald-600' : 'text-red-600'}`}>
              {total}%
            </span>
          </div>
          <button 
            onClick={handleSave}
            disabled={isSaving || total !== 100}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </div>
    </div>
  );
};

const MetricsTab = () => (
  <>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-500">Total Reportes</h3>
          <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-900">1,248</p>
        <p className="text-xs text-emerald-600 mt-2 flex items-center">
          <TrendingUp className="w-3 h-3 mr-1" /> +12% este mes
        </p>
      </div>
      
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-500">En Progreso</h3>
          <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-900">42</p>
        <p className="text-xs text-slate-500 mt-2">Órdenes activas</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-500">Investigadores</h3>
          <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-900">18</p>
        <p className="text-xs text-slate-500 mt-2">Usuarios activos</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-500">Tiempo Promedio</h3>
          <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-900">2.4d</p>
        <p className="text-xs text-emerald-600 mt-2 flex items-center">
          <TrendingUp className="w-3 h-3 mr-1" /> -0.5d mejora
        </p>
      </div>
    </div>

    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-900">Actividad Reciente</h2>
      </div>
      <div className="p-6">
        <p className="text-sm text-slate-500">El panel de actividad detallada se conectará con Firebase Functions próximamente.</p>
      </div>
    </div>
  </>
);

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';

const secondaryApp = initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

const UsersTab = () => {
  const { user, logUserAction } = useAuthStatus();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add User Form State
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('CLIENTE');
  const [newClientType, setNewClientType] = useState('GRATUITO');
  const [newClientProfile, setNewClientProfile] = useState('GENERAL');
  const [newCredits, setNewCredits] = useState(0);
  const [newPagaresCredits, setNewPagaresCredits] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Edit User State
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editRole, setEditRole] = useState('');
  const [editClientType, setEditClientType] = useState('');
  const [editClientProfile, setEditClientProfile] = useState('');
  const [editCredits, setEditCredits] = useState(0);
  const [editPagaresCredits, setEditPagaresCredits] = useState(0);
  const [editPhone, setEditPhone] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // View User Investigations State
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userInvestigations, setUserInvestigations] = useState<any[]>([]);
  const [loadingInvestigations, setLoadingInvestigations] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const [isInvModalOpen, setIsInvModalOpen] = useState(false);
  const [selectedUserForInv, setSelectedUserForInv] = useState<any>(null);
  const [invTitle, setInvTitle] = useState('');
  const [invDetails, setInvDetails] = useState('');

  const openInvModal = (user: any) => {
    setSelectedUserForInv(user);
    setInvTitle('');
    setInvDetails('');
    setIsInvModalOpen(true);
  };

  const handleCreateInvestigation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForInv) return;

    try {
      await addDoc(collection(db, 'investigations'), {
        userId: selectedUserForInv.uid,
        title: invTitle,
        details: invDetails,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: selectedUserForInv.clientProfile || 'GENERAL',
        createdByAdmin: true
      });

      setIsInvModalOpen(false);
      alert('Investigación solicitada exitosamente para el usuario.');
    } catch (error) {
      console.error('Error creating investigation:', error);
      alert('Hubo un error al crear la investigación.');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) {
      alert("Por favor ingresa email y contraseña.");
      return;
    }
    setIsAdding(true);
    try {
      // Create user in secondary auth instance to avoid signing out the admin
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newEmail.toLowerCase(), newPassword);
      const newUserId = userCredential.user.uid;

      // Save to users collection
      await setDoc(doc(db, 'users', newUserId), {
        uid: newUserId,
        email: newEmail.toLowerCase(),
        phone: newPhone,
        role: newRole,
        clientType: newClientType,
        clientProfile: newClientProfile,
        credits: Number(newCredits),
        pagaresCredits: Number(newPagaresCredits),
        createdAt: new Date().toISOString()
      });
      
      if (logUserAction && user) {
        logUserAction(user.uid, 'ADMIN_CREATE_USER', { createdUserId: newUserId, email: newEmail });
      }

      alert('Usuario creado exitosamente en el sistema.');
      setNewEmail('');
      setNewPassword('');
      setNewPhone('');
      fetchUsers(); // Refresh the list
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        // Check if they exist in Firestore
        const q = query(collection(db, 'users'), where('email', '==', newEmail.toLowerCase()));
        const snap = await getDocs(q);
        if (snap.empty) {
          const confirmCreate = window.confirm('El correo ya existe en la autenticación pero NO tiene perfil en la base de datos. ¿Deseas crear un perfil manual para este correo? El usuario podrá entrar con su contraseña actual.');
          if (confirmCreate) {
            try {
              await addDoc(collection(db, 'users'), {
                email: newEmail.toLowerCase(),
                phone: newPhone,
                role: newRole,
                clientType: newClientType,
                clientProfile: newClientProfile,
                credits: Number(newCredits),
                pagaresCredits: Number(newPagaresCredits),
                createdAt: new Date().toISOString(),
                isManualSync: true
              });
              alert('Perfil creado. El usuario se sincronizará completamente en su próximo inicio de sesión.');
              setNewEmail('');
              setNewPassword('');
              setNewPhone('');
              fetchUsers();
            } catch (e: any) {
              alert('Error al crear perfil manual: ' + e.message);
            }
          }
        } else {
          alert('Este correo ya está registrado y tiene un perfil activo. Puedes editar sus permisos en la tabla de abajo.');
        }
      } else {
        console.error("Error adding user:", error);
        if (error.code === 'auth/operation-not-allowed') {
          alert('ERROR CRÍTICO: El método de "Correo electrónico/contraseña" está desactivado en tu consola de Firebase.');
        } else {
          alert(`Error al agregar usuario: ${error.message}`);
        }
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handlePasswordReset = async (email: string) => {
    if (!window.confirm(`¿Enviar correo de restablecimiento de contraseña a ${email}?`)) return;
    try {
      await sendPasswordResetEmail(secondaryAuth, email);
      alert('Correo de restablecimiento enviado exitosamente.');
    } catch (error: any) {
      console.error("Error sending password reset:", error);
      alert('Error al enviar correo: ' + error.message);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsEditing(true);
    try {
      await setDoc(doc(db, 'users', editingUser.uid), {
        role: editRole,
        clientType: editClientType,
        clientProfile: editClientProfile,
        credits: Number(editCredits),
        pagaresCredits: Number(editPagaresCredits),
        phone: editPhone,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      if (logUserAction && user) {
        logUserAction(user.uid, 'ADMIN_EDIT_USER', { editedUserId: editingUser.uid, email: editingUser.email });
      }

      alert('Usuario actualizado exitosamente.');
      setEditingUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error("Error updating user:", error);
      alert(`Error al actualizar usuario: ${error.message}`);
    } finally {
      setIsEditing(false);
    }
  };

  const handleResetPlan = async (targetUser: any) => {
    try {
      if (targetUser.clientType === 'GRATUITO') {
        const confirmReset = window.confirm(`¿Deseas resetear el conteo de investigaciones gratuitas para ${targetUser.email}? Esto les dará 10 investigaciones nuevas.`);
        if (!confirmReset) return;

        const q = query(collection(db, 'investigations'), where('clientId', '==', targetUser.uid));
        const snap = await getDocs(q);
        const count = snap.size;

        await setDoc(doc(db, 'users', targetUser.uid), {
          freeInvestigationsOffset: count,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        
        if (logUserAction && user) {
          logUserAction(user.uid, 'ADMIN_RESET_PLAN', { targetUserId: targetUser.uid, email: targetUser.email, offset: count });
        }
        alert('Conteo de plan gratuito reseteado con éxito.');
        fetchUsers();
      } else if (targetUser.clientType === 'BOLSA') {
        const credits = window.prompt(`¿Cuántos créditos de investigación deseas asignar a la bolsa de ${targetUser.email}?`, '50');
        if (credits === null) return;
        
        const numCredits = parseInt(credits, 10);
        if (isNaN(numCredits) || numCredits < 0) {
          alert('Por favor, ingresa un número válido de créditos.');
          return;
        }

        await setDoc(doc(db, 'users', targetUser.uid), {
          credits: numCredits,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        
        if (logUserAction && user) {
          logUserAction(user.uid, 'ADMIN_RESET_BAG', { targetUserId: targetUser.uid, email: targetUser.email, credits: numCredits });
        }
        alert(`Bolsa reseteada a ${numCredits} créditos con éxito.`);
        fetchUsers();
      } else {
        alert('El reseteo de plan solo aplica para clientes GRATUITO o BOLSA.');
      }
    } catch (error: any) {
      console.error("Error resetting plan:", error);
      alert('Error al resetear el plan: ' + error.message);
    }
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setEditRole(user.role || 'CLIENTE');
    setEditClientType(user.clientType || 'GRATUITO');
    setEditClientProfile(user.clientProfile || 'GENERAL');
    setEditCredits(user.credits || 0);
    setEditPagaresCredits(user.pagaresCredits || 0);
    setEditPhone(user.phone || '');
  };

  const viewUserInvestigations = async (user: any) => {
    setSelectedUser(user);
    setLoadingInvestigations(true);
    try {
      const q = query(collection(db, 'investigations'), where('clientId', '==', user.uid));
      const snapshot = await getDocs(q);
      const invData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUserInvestigations(invData);
    } catch (error) {
      console.error("Error fetching investigations:", error);
    } finally {
      setLoadingInvestigations(false);
    }
  };

  const handleDeleteInvestigation = async (id: string, candidateLinkId?: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta investigación? Esta acción no se puede deshacer.')) {
      try {
        await deleteDoc(doc(db, 'investigations', id));
        if (candidateLinkId) {
          await deleteDoc(doc(db, 'candidate_links', candidateLinkId));
        }
        // Refresh the list
        setUserInvestigations(prev => prev.filter(inv => inv.id !== id));
      } catch (error) {
        console.error("Error deleting investigation:", error);
        alert("Hubo un error al eliminar la investigación.");
      }
    }
  };

  const filteredUsers = users.filter(u => {
    const emailMatch = u.email ? u.email.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const roleMatch = u.role ? u.role.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    return emailMatch || roleMatch;
  });

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
          <UserPlus className="w-5 h-5 mr-2 text-blue-600" />
          Agregar Usuario Inmediato
        </h3>
        <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-10 gap-4 items-end">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
            <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="usuario@empresa.com" />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">Contraseña</label>
            <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="••••••••" />
          </div>
          <div className="lg:col-span-1">
            <label className="block text-xs font-medium text-slate-700 mb-1">Teléfono</label>
            <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="Opcional" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Rol</label>
            <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 bg-white">
              <option value="CLIENTE">Cliente</option>
              <option value="CLIENTE_FINANCIERO">Cliente Financiero / Banco</option>
              <option value="INVESTIGADOR">Investigador</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tipo</label>
            <select value={newClientType} onChange={e => setNewClientType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 bg-white">
              <option value="GRATUITO">Gratuito</option>
              <option value="BOLSA">Bolsa</option>
              <option value="SUSCRIPCION">Suscripción</option>
            </select>
          </div>
          <div className="lg:col-span-1">
            <label className="block text-xs font-medium text-slate-700 mb-1">Perfil</label>
            <select value={newClientProfile} onChange={e => setNewClientProfile(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 bg-white">
              <option value="GENERAL">General</option>
              <option value="INVESTIGACION">Solo Investigación (SaaS)</option>
              <option value="HR">Recursos Humanos</option>
              <option value="CREDIT">Crédito (General)</option>
              <option value="SME">Pyme</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Créditos Inv.</label>
            <input type="number" min="0" value={newCredits} onChange={e => setNewCredits(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Créditos Pagarés</label>
            <input type="number" min="0" value={newPagaresCredits} onChange={e => setNewPagaresCredits(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500" />
          </div>
          <div className="lg:col-span-10">
            <button type="submit" disabled={isAdding} className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">
              {isAdding ? 'Creando Usuario...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="text-lg font-bold text-slate-900">Usuarios Registrados</h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por email o rol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium">Rol</th>
                <th className="p-4 font-medium">Tipo</th>
                <th className="p-4 font-medium">Créditos Inv.</th>
                <th className="p-4 font-medium">Créditos Pagarés</th>
                <th className="p-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <JuxaVerifyLoader text="Cargando usuarios..." />
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-slate-500">No se encontraron usuarios.</td></tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-900">{user.email}</td>
                    <td className="p-4"><span className="px-2 py-1 bg-slate-100 rounded-md text-xs font-medium">{user.role}</span></td>
                    <td className="p-4">{user.clientType}</td>
                    <td className="p-4">{user.credits || 0}</td>
                    <td className="p-4">{user.pagaresCredits || 0}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => openInvModal(user)} className="text-emerald-600 hover:text-emerald-800 font-medium text-xs flex items-center" title="Solicitar Investigación">
                          <Plus className="w-4 h-4 mr-1" /> Solicitar
                        </button>
                        <button onClick={() => handlePasswordReset(user.email)} className="text-slate-600 hover:text-slate-800 font-medium text-xs flex items-center" title="Reset Password">
                          <Mail className="w-4 h-4 mr-1" /> Reset
                        </button>
                        <button onClick={() => handleResetPlan(user)} className="text-indigo-600 hover:text-indigo-800 font-medium text-xs flex items-center" title="Resetear Plan o Bolsa">
                          <RefreshCw className="w-4 h-4 mr-1" /> Reset Plan
                        </button>
                        <button onClick={() => openEditModal(user)} className="text-amber-600 hover:text-amber-800 font-medium text-xs flex items-center">
                          Editar
                        </button>
                        <button onClick={() => viewUserInvestigations(user)} className="text-blue-600 hover:text-blue-800 font-medium text-xs flex items-center">
                          <Eye className="w-4 h-4 mr-1" /> Ver Solicitudes
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Solicitar Investigación (Admin) */}
      {isInvModalOpen && selectedUserForInv && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Solicitar Investigación (Manual)</h3>
              <button 
                onClick={() => setIsInvModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
                <span className="sr-only">Cerrar</span>
              </button>
            </div>
            
            <form onSubmit={handleCreateInvestigation} className="p-6">
              <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                Solicitando para el cliente: <strong>{selectedUserForInv.email}</strong>
                <br />
                Perfil: <strong>{selectedUserForInv.clientProfile || 'General'}</strong>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Título / Nombre del Sujeto
                  </label>
                  <input
                    type="text"
                    required
                    value={invTitle}
                    onChange={(e) => setInvTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Ej. Juan Pérez - Estudio Socioeconómico"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Detalles Adicionales
                  </label>
                  <textarea
                    required
                    value={invDetails}
                    onChange={(e) => setInvDetails(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[100px]"
                    placeholder="Proporciona RFC, CURP, o cualquier dato relevante..."
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsInvModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Crear Solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Editar Usuario</h2>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="text" disabled value={editingUser.email} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 bg-white">
                  <option value="CLIENTE">Cliente</option>
                  <option value="CLIENTE_FINANCIERO">Cliente Financiero / Banco</option>
                  <option value="INVESTIGADOR">Investigador</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Cliente</label>
                  <select value={editClientType} onChange={e => setEditClientType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 bg-white">
                    <option value="GRATUITO">Gratuito</option>
                    <option value="BOLSA">Bolsa</option>
                    <option value="SUSCRIPCION">Suscripción</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Perfil</label>
                  <select value={editClientProfile} onChange={e => setEditClientProfile(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 bg-white">
                    <option value="GENERAL">General</option>
                    <option value="INVESTIGACION">Solo Investigación (SaaS)</option>
                    <option value="HR">Recursos Humanos</option>
                    <option value="CREDIT">Crédito (General)</option>
                    <option value="SME">Pyme</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Créditos Inv.</label>
                  <input type="number" min="0" value={editCredits} onChange={e => setEditCredits(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Créditos Pagarés</label>
                  <input type="number" min="0" value={editPagaresCredits} onChange={e => setEditPagaresCredits(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={isEditing} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {isEditing ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Investigations Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Solicitudes de Usuario</h2>
                <p className="text-sm text-slate-500">{selectedUser.email}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              {loadingInvestigations ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <JuxaVerifyLoader text="Cargando solicitudes..." />
                </div>
              ) : userInvestigations.length === 0 ? (
                <p className="text-center text-slate-500">Este usuario no tiene solicitudes.</p>
              ) : (
                <div className="space-y-4">
                  {userInvestigations.map(inv => (
                    <div key={inv.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded-md text-slate-600 mb-2 inline-block">
                            {inv.investigationType}
                          </span>
                          <h4 className="font-bold text-slate-900">{inv.title}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            inv.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                            inv.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {inv.status}
                          </span>
                          <button 
                            onClick={() => handleDeleteInvestigation(inv.id, inv.candidateLink)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            title="Eliminar investigación"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mb-4">Creado: {new Date(inv.createdAt).toLocaleDateString()}</p>
                      
                      {/* Show AI Results if completed */}
                      {(inv.identityValidationResult || inv.creditAnalysisResult || inv.providerAnalysisResult || inv.socioeconomicDictamen) && (
                        <div className="mt-4">
                          <strong className="block mb-2 text-blue-800 flex items-center text-sm">
                            <Brain className="w-4 h-4 mr-2" />
                            Dictamen Final de IA:
                          </strong>
                          <AIResultRenderer resultString={inv.identityValidationResult || inv.creditAnalysisResult || inv.providerAnalysisResult || inv.socioeconomicDictamen} />
                        </div>
                      )}

                      {/* Show Uploaded Files for Traceability */}
                      {inv.candidateData && (
                        <div className="mt-4">
                          <strong className="block mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
                            <FileText className="w-3 h-3 mr-1" />
                            Evidencia para Trazabilidad:
                          </strong>
                          <div className="flex flex-wrap gap-2">
                            {(() => {
                              try {
                                const cData = JSON.parse(inv.candidateData);
                                const urls = [
                                  { label: 'INE F', url: cData.idFrontUrl },
                                  { label: 'INE R', url: cData.idBackUrl },
                                  { label: 'Comprobante', url: cData.proofOfAddressUrl },
                                  { label: 'Selfie', url: cData.selfieUrl },
                                  { label: 'Fachada', url: cData.fotoFachadaUrl },
                                  { label: 'Sala', url: cData.fotoSalaUrl },
                                  { label: 'Comedor', url: cData.fotoComedorUrl },
                                  { label: 'Cocina', url: cData.fotoCocinaUrl },
                                  { label: 'Habitación', url: cData.fotoHabitacionUrl }
                                ].filter(item => item.url);

                                return urls.map((item, idx) => (
                                  <a 
                                    key={idx} 
                                    href={item.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="px-3 py-1 bg-white border border-slate-200 rounded-md text-[10px] font-medium text-slate-600 hover:bg-slate-50 hover:border-blue-300 transition-all flex items-center"
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    {item.label}
                                  </a>
                                ));
                              } catch (e) {
                                return <span className="text-[10px] text-slate-400 italic">Error al cargar evidencia</span>;
                              }
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PlansTab = () => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
        <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
        Gestión de Planes de Cobro
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Plan Gratuito */}
        <div className="border border-slate-200 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-400"></div>
          <h4 className="text-xl font-bold text-slate-900 mb-2">Gratuito</h4>
          <p className="text-3xl font-extrabold text-slate-900 mb-4">$0 <span className="text-sm font-normal text-slate-500">/mes</span></p>
          <ul className="space-y-2 text-sm text-slate-600 mb-6">
            <li>✓ 3 Investigaciones al mes</li>
            <li>✓ Reportes básicos</li>
            <li>✓ Soporte por email</li>
          </ul>
          <button className="w-full py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Editar Plan</button>
        </div>

        {/* Plan Bolsa */}
        <div className="border border-blue-200 rounded-xl p-6 relative overflow-hidden bg-blue-50/30">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
          <h4 className="text-xl font-bold text-slate-900 mb-2">Bolsa de Créditos</h4>
          <p className="text-3xl font-extrabold text-slate-900 mb-4">Variable</p>
          <ul className="space-y-2 text-sm text-slate-600 mb-6">
            <li>✓ Compra créditos por volumen</li>
            <li>✓ Los créditos no expiran</li>
            <li>✓ Reportes con IA Avanzada</li>
            <li>✓ Soporte prioritario</li>
          </ul>
          <button className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Configurar Precios</button>
        </div>

        {/* Plan Suscripción */}
        <div className="border border-purple-200 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-purple-500"></div>
          <h4 className="text-xl font-bold text-slate-900 mb-2">Suscripción Pro</h4>
          <p className="text-3xl font-extrabold text-slate-900 mb-4">$4,999 <span className="text-sm font-normal text-slate-500">/mes</span></p>
          <ul className="space-y-2 text-sm text-slate-600 mb-6">
            <li>✓ Investigaciones ilimitadas*</li>
            <li>✓ API Access</li>
            <li>✓ Marca Blanca</li>
            <li>✓ Account Manager Dedicado</li>
          </ul>
          <button className="w-full py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Editar Plan</button>
        </div>
      </div>
    </div>
  );
};

const SimulatorTab = () => {
  const { user, logUserAction } = useAuthStatus();
  const [simType, setSimType] = useState('HR');
  const [simName, setSimName] = useState('Candidato de Prueba');
  const [generatedLink, setGeneratedLink] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [loadingResult, setLoadingResult] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const q = query(collection(db, 'candidate_links'), where('clientId', '==', 'admin_simulator'));
      const snapshot = await getDocs(q);
      const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setHistory(links);
    } catch (error) {
      console.error("Error fetching simulator history:", error);
    }
  };

  const handleViewResult = async (investigationId: string) => {
    setLoadingResult(true);
    try {
      const docRef = doc(db, 'investigations', investigationId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSelectedResult(docSnap.data());
        if (logUserAction && user) {
          logUserAction(user.uid, 'ADMIN_VIEW_DICTAMEN', { investigationId });
        }
      } else {
        alert("No se encontró el resultado de la investigación.");
      }
    } catch (error) {
      console.error("Error fetching result:", error);
      alert("Error al cargar el resultado.");
    } finally {
      setLoadingResult(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!simName.trim()) {
      alert("Por favor ingresa un nombre para la prueba.");
      return;
    }
    setIsGenerating(true);
    try {
      // Create a dummy investigation
      const invId = Math.random().toString(36).substring(2, 15);
      await setDoc(doc(db, 'investigations', invId), {
        id: invId,
        clientId: 'admin_simulator',
        requestedBy: 'admin',
        status: 'PENDING',
        title: simName,
        clientProfile: simType,
        investigationType: simType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Create link
      const linkId = Math.random().toString(36).substring(2, 15);
      await setDoc(doc(db, 'candidate_links', linkId), {
        linkId,
        investigationId: invId,
        clientId: 'admin_simulator',
        clientProfile: simType,
        investigationType: simType,
        title: simName,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const url = `${window.location.origin}/candidate/${linkId}`;
      setGeneratedLink(url);
      
      if (logUserAction && user) {
        logUserAction(user.uid, 'ADMIN_GENERATE_SIMULATOR_LINK', { linkId, investigationId: invId, type: simType });
      }

      fetchHistory();
    } catch (error) {
      console.error("Error generating simulated link:", error);
      alert("Error al generar enlace de prueba: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-2xl">
        <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center">
          <LinkIcon className="w-5 h-5 mr-2 text-blue-600" />
          Simulador de Flujo (Pruebas)
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          Genera un enlace de prueba para visualizar la experiencia del candidato/cliente según el tipo de investigación.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Flujo a Simular</label>
            <select value={simType} onChange={e => setSimType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white">
              <option value="HR">Recursos Humanos (Candidato)</option>
              <option value="CREDIT">Crédito (General)</option>
              <option value="PROVIDER">Proveedores</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Sujeto (Prueba)</label>
            <input type="text" value={simName} onChange={e => setSimName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500" />
          </div>
          <button 
            onClick={handleGenerateLink}
            disabled={isGenerating}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {isGenerating ? 'Generando...' : 'Generar Enlace de Prueba'}
          </button>

          {generatedLink && (
            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-sm font-bold text-blue-900 mb-2">Enlace Generado Exitosamente:</p>
              <div className="flex gap-2">
                <input type="text" readOnly value={generatedLink} className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm text-slate-600 outline-none" />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(generatedLink);
                    alert('Copiado al portapapeles');
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Copiar
                </button>
                <a 
                  href={generatedLink} 
                  target="_blank" 
                  rel="noreferrer"
                  className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center"
                >
                  Abrir <Eye className="w-4 h-4 ml-1" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-blue-600" />
            Historial de Pruebas Recientes
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-sm text-slate-500">
                  <th className="pb-3 font-medium">Fecha</th>
                  <th className="pb-3 font-medium">Nombre (Prueba)</th>
                  <th className="pb-3 font-medium">Tipo</th>
                  <th className="pb-3 font-medium">Estado</th>
                  <th className="pb-3 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {history.map((link) => (
                  <tr key={link.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 text-slate-600">{new Date(link.createdAt).toLocaleDateString()} {new Date(link.createdAt).toLocaleTimeString()}</td>
                    <td className="py-3 font-medium text-slate-900">{link.title}</td>
                    <td className="py-3">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">
                        {link.investigationType}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${link.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {link.status === 'COMPLETED' ? 'Completado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="py-3">
                      {link.status === 'COMPLETED' ? (
                        <button
                          onClick={() => handleViewResult(link.investigationId)}
                          disabled={loadingResult}
                          className="text-emerald-600 hover:text-emerald-800 font-medium flex items-center"
                        >
                          Ver Dictamen <FileText className="w-4 h-4 ml-1" />
                        </button>
                      ) : (
                        <a 
                          href={`${window.location.origin}/candidate/${link.id}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-medium flex items-center"
                        >
                          Abrir <Eye className="w-4 h-4 ml-1" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-slate-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Dictamen de Prueba: {selectedResult.title}
              </h2>
              <button 
                onClick={() => setSelectedResult(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {selectedResult.socioeconomicDictamen ? (
                (() => {
                  try {
                    const dictamen = JSON.parse(selectedResult.socioeconomicDictamen);
                    return (
                      <div className="space-y-6">
                        <div className={`p-4 rounded-xl border ${dictamen.dictamenFinal?.estado === 'Congruente' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                          <h3 className={`text-lg font-bold mb-2 ${dictamen.dictamenFinal?.estado === 'Congruente' ? 'text-emerald-800' : 'text-amber-800'}`}>
                            Resultado: {dictamen.dictamenFinal?.estado || 'Revisión Manual'}
                          </h3>
                          <p className={dictamen.dictamenFinal?.estado === 'Congruente' ? 'text-emerald-700' : 'text-amber-700'}>
                            {dictamen.dictamenFinal?.resumen || 'Sin resumen disponible.'}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <h4 className="font-bold text-slate-900 mb-2">Ingresos y Egresos</h4>
                            <p className="text-sm text-slate-700"><span className="font-medium">Verificado:</span> {dictamen.congruenciaIngresos?.verificado ? 'Sí' : 'No'}</p>
                            <p className="text-sm text-slate-700"><span className="font-medium">Nivel Inferido:</span> {dictamen.congruenciaIngresos?.nivelSocioeconomicoInferido}</p>
                            <p className="text-sm text-slate-600 mt-1">{dictamen.congruenciaIngresos?.detalles}</p>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <h4 className="font-bold text-slate-900 mb-2">Domicilio y Ubicación</h4>
                            <p className="text-sm text-slate-700"><span className="font-medium">Verificado:</span> {dictamen.congruenciaDomicilio?.verificado ? 'Sí' : 'No'}</p>
                            <p className="text-sm text-slate-700"><span className="font-medium">Distancia:</span> {dictamen.congruenciaDomicilio?.distanciaMetros} metros</p>
                            <p className="text-sm text-slate-600 mt-1">{dictamen.congruenciaDomicilio?.detalles}</p>
                          </div>
                          {dictamen.congruenciaFachadaEntorno && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 md:col-span-2">
                              <h4 className="font-bold text-slate-900 mb-2">Análisis Fachada vs Entorno</h4>
                              <p className="text-sm text-slate-700"><span className="font-medium">Verificado:</span> {dictamen.congruenciaFachadaEntorno.verificado ? 'Sí' : 'No'}</p>
                              <p className="text-sm text-slate-600 mt-1">{dictamen.congruenciaFachadaEntorno.detalles}</p>
                            </div>
                          )}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 md:col-span-2">
                            <h4 className="font-bold text-slate-900 mb-2">Análisis Documental</h4>
                            <p className="text-sm text-slate-700"><span className="font-medium">Verificado:</span> {dictamen.analisisDocumental?.verificado ? 'Sí' : 'No'}</p>
                            <p className="text-sm text-slate-600 mt-1">{dictamen.analisisDocumental?.detalles}</p>
                          </div>
                        </div>
                      </div>
                    );
                  } catch (e) {
                    return <p className="text-red-500">Error al procesar el dictamen.</p>;
                  }
                })()
              ) : (
                <p className="text-slate-500">No hay dictamen disponible para esta prueba.</p>
              )}

              {selectedResult.candidateData && (
                <div className="mt-8">
                  <h3 className="text-md font-bold text-slate-900 mb-4 border-b border-slate-200 pb-2 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Datos Enviados por el Candidato
                  </h3>
                  
                  {(() => {
                    try {
                      const data = JSON.parse(selectedResult.candidateData);
                      return (
                        <div className="space-y-6">
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 overflow-x-auto">
                            <pre className="text-xs text-slate-700 whitespace-pre-wrap">
                              {JSON.stringify(data, null, 2)}
                            </pre>
                          </div>

                          {(data.realTimeLocation || data.mapLocation) && (
                            <div className="pt-4 border-t border-slate-200">
                              <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-red-500" />
                                Verificación Geográfica (Street View)
                              </h4>
                              <LocationViewer 
                                lat={parseFloat((data.realTimeLocation || data.mapLocation).split(',')[0])} 
                                lng={parseFloat((data.realTimeLocation || data.mapLocation).split(',')[1])} 
                              />
                            </div>
                          )}
                        </div>
                      );
                    } catch (e) {
                      return <p className="text-red-500">Error al procesar los datos del candidato.</p>;
                    }
                  })()}
                </div>
              )}
            </div>
            
            <div className="border-t border-slate-200 p-4 bg-slate-50 rounded-b-2xl flex justify-end">
              <button
                onClick={() => setSelectedResult(null)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

