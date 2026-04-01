import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Users,
  FileText,
  TrendingUp,
  Clock,
  RefreshCw,
  UserPlus,
  CreditCard,
  Link as LinkIcon,
  Search,
  Eye,
  X,
  Bot,
  Zap,
  Briefcase,
  Plus,
  Mail,
  Send,
  Trash2,
  Brain,
  MapPin,
  Bike,
  ClipboardList,
  ClipboardCheck,
  Building2,
} from 'lucide-react';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { secondaryAuth, signOutSecondaryAuth } from '../../lib/secondaryFirebaseAuth';
import { db } from '../../firebase';
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
  query,
  where,
  addDoc,
  getDoc,
  orderBy,
  limit,
  startAfter,
  documentId,
} from 'firebase/firestore';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuthStatus } from '../../contexts/AuthContext';
import { CGOEngine } from '../CGOEngine';
import { IntegralDashboard } from './IntegralDashboard';
import { ClientDashboard } from './ClientDashboard';

import { DashboardLayout } from './DashboardLayout';
import { AIResultRenderer } from '../AIResultRenderer';
import { JuxaVerifyLoader } from '../JuxaVerifyLoader';
import { LocationViewer } from '../LocationViewer';

import { FinancialDashboard } from './FinancialDashboard';
import { InvestigatorDashboard } from './InvestigatorDashboard';
import { LoongMotorAdminTab } from './LoongMotorAdminTab';
import { LoongOriginationCrmAdminPanel } from '../../pages/LoongCrmModulePage';
import { MesaOrigenQueuePanel } from './MesaOrigenQueuePanel';
import { ADMIN_ROLE_OPTIONS, CLIENT_PROFILE_OPTIONS, CLIENT_TYPE_OPTIONS } from '../../config/accessProfiles';
import { isLoongSuperAdminEmail, isSuperAdminEmail } from '../../config/superadmins';
import { LOONG_PRE_REGISTER_PATH } from '../../config/loongLinks';
import { Card } from '../ui';
import { EnterprisesPlatformTab } from '../platform/EnterprisesPlatformTab';
import { AppBreadcrumb } from '../platform/AppBreadcrumb';
import { DEFAULT_ORGANIZATION_ID_LOONG, normalizeOrganizationId, SAAS_PRODUCT_IDS } from '../../lib/organizations';
import { LoongTeamUsersPanel } from '../loong/LoongTeamUsersPanel';
import { EmbedLinksPanel } from '../platform/EmbedLinksPanel';
import {
  resolveAdminUserScope,
  userMatchesAdminScope,
  preRegMatchesAdminScope,
  defaultOrganizationIdForNewUser,
} from '../../lib/adminTenantScope';

type AdminTabId =
  | 'platform-access'
  | 'organizations'
  | 'embeds'
  | 'metrics'
  | 'users'
  | 'plans'
  | 'simulator'
  | 'investigaciones-cliente'
  | 'loong'
  | 'cgo'
  | 'crm'
  | 'ia-config'
  | 'mesa-origen';

export const AdminDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<AdminTabId>('metrics');
  const [crmSubView, setCrmSubView] = useState<'loong' | 'investigations'>('loong');
  const { user, logUserAction, clientProfile, role } = useAuthStatus();
  const isPlatformSuper = !!(user?.email && isSuperAdminEmail(user.email));
  const loongAdminSidebar = clientProfile === 'LOONG_MOTOR';
  const isLoongSuperAdminNav = !!(user?.email && isLoongSuperAdminEmail(user.email));
  const mesaOnlyUser = role === 'ANALISTA_MESA_CONTROL' && !isPlatformSuper && !isLoongSuperAdminNav;

  useEffect(() => {
    const t = searchParams.get('tab');
    if (!user?.email) return;
    if (isLoongSuperAdminEmail(user.email)) {
      if (t === 'investigaciones-cliente') {
        setActiveTab('investigaciones-cliente');
        return;
      }
      if (t === 'crm') {
        setActiveTab('crm');
        return;
      }
      if (t === 'loong') {
        setActiveTab('crm');
        setSearchParams((prev) => {
          const p = new URLSearchParams(prev);
          p.set('tab', 'crm');
          return p;
        });
      }
      return;
    }
    if (t === 'investigaciones-cliente') setActiveTab('investigaciones-cliente');
    else if (t === 'loong') setActiveTab('loong');
    else if (t === 'mesa-origen') setActiveTab('mesa-origen');
  }, [searchParams, user?.email, setSearchParams]);

  useEffect(() => {
    if (mesaOnlyUser) setActiveTab('mesa-origen');
  }, [mesaOnlyUser]);

  useEffect(() => {
    if (!isPlatformSuper && (activeTab === 'platform-access' || activeTab === 'organizations')) {
      setActiveTab('metrics');
    }
  }, [isPlatformSuper, activeTab]);

  useEffect(() => {
    if (activeTab !== 'investigaciones-cliente') return;
    if (!user?.email || !isSuperAdminEmail(user.email)) {
      setActiveTab('metrics');
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.delete('tab');
        return p;
      });
    }
  }, [activeTab, user?.email, setSearchParams]);

  useEffect(() => {
    if (
      loongAdminSidebar &&
      !isLoongSuperAdminNav &&
      !isPlatformSuper &&
      (activeTab === 'plans' || activeTab === 'cgo')
    ) {
      setActiveTab('metrics');
    }
  }, [loongAdminSidebar, isLoongSuperAdminNav, isPlatformSuper, activeTab]);

  useEffect(() => {
    if (!isLoongSuperAdminNav) return;
    const forbidden: AdminTabId[] = [
      'platform-access',
      'organizations',
      'plans',
      'simulator',
      'loong',
      'cgo',
    ];
    if (forbidden.includes(activeTab)) {
      setActiveTab('metrics');
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.delete('tab');
        return p;
      });
    }
  }, [isLoongSuperAdminNav, activeTab, setSearchParams]);

  const sidebarItems = (
    mesaOnlyUser
      ? [{ id: 'mesa-origen' as const, label: 'Mesa origen JUXA', icon: ClipboardCheck }]
      : isLoongSuperAdminNav
        ? [
            { id: 'metrics' as const, label: 'Métricas', icon: TrendingUp },
            { id: 'users' as const, label: 'Usuarios', icon: Users },
            { id: 'investigaciones-cliente' as const, label: 'Originación e investigaciones', icon: Send },
            { id: 'crm' as const, label: 'CRM', icon: ClipboardList },
            { id: 'ia-config' as const, label: 'Configuración IA', icon: Brain },
          ]
        : [
            ...(isPlatformSuper
              ? [
                  { id: 'platform-access' as const, label: 'Empresas y accesos', icon: Briefcase },
                  { id: 'organizations' as const, label: 'Organizaciones SaaS', icon: Building2 },
                  { id: 'embeds' as const, label: 'Embeds / Marketing', icon: LinkIcon },
                  { id: 'investigaciones-cliente' as const, label: 'Originación e investigaciones', icon: Send },
                  { id: 'mesa-origen' as const, label: 'Mesa origen JUXA', icon: ClipboardCheck },
                ]
              : []),
            { id: 'metrics' as const, label: 'Métricas', icon: TrendingUp },
            { id: 'users' as const, label: 'Usuarios y Solicitudes', icon: Users },
            { id: 'plans' as const, label: 'Planes de Cobro', icon: CreditCard },
            { id: 'simulator' as const, label: 'Simulador de Enlaces', icon: LinkIcon },
            { id: 'loong' as const, label: 'Loong Motor', icon: Bike },
            { id: 'crm' as const, label: 'CRM', icon: ClipboardList },
            { id: 'cgo' as const, label: 'CGO AI', icon: Bot },
            { id: 'ia-config' as const, label: 'Configuración IA', icon: Bot },
          ]
  ).filter((item): item is { id: AdminTabId; label: string; icon: typeof TrendingUp } => {
    if (
      loongAdminSidebar &&
      !isLoongSuperAdminNav &&
      !isPlatformSuper &&
      (item.id === 'plans' || item.id === 'cgo')
    ) {
      return false;
    }
    return true;
  });

  const isSuperadminInvestigacionesView =
    activeTab === 'investigaciones-cliente' && user?.email && isSuperAdminEmail(user.email);

  if (isSuperadminInvestigacionesView) {
    return (
      <div className="h-full min-h-0 flex flex-col overflow-hidden">
        <ClientDashboard />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 h-full">
      <DashboardLayout
        title="Administración"
        subtitle="Gestión global de la plataforma"
        sidebarItems={sidebarItems}
        activeTab={activeTab}
        onTabChange={(id) => {
          const next = id as AdminTabId;
          setActiveTab(next);
          setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            if (next === 'loong') p.set('tab', 'loong');
            else if (next === 'crm') p.set('tab', 'crm');
            else if (next === 'investigaciones-cliente') p.set('tab', 'investigaciones-cliente');
            else if (next === 'mesa-origen') p.set('tab', 'mesa-origen');
            else p.delete('tab');
            return p;
          });
        }}
      >
        {activeTab === 'platform-access' && <PlatformEmpresasAccessTab />}
        {activeTab === 'organizations' && <EnterprisesPlatformTab />}
        {activeTab === 'embeds' && <EmbedLinksPanel variant="platform" />}
        {activeTab === 'metrics' && <MetricsTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'plans' && <PlansTab />}
        {activeTab === 'simulator' && <SimulatorTab />}
        {activeTab === 'loong' && <LoongMotorAdminTab isPlatformSuper={isPlatformSuper} />}
        {activeTab === 'cgo' && <CGOEngine />}
        {activeTab === 'crm' && (
          <div className="space-y-4">
            <AppBreadcrumb items={[{ label: 'Administración', to: '/admin' }, { label: 'CRM' }]} />
            {isPlatformSuper && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCrmSubView('loong')}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                    crmSubView === 'loong'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  CRM Loong (originación moto)
                </button>
                <button
                  type="button"
                  onClick={() => setCrmSubView('investigations')}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                    crmSubView === 'investigations'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  CRM investigaciones (general)
                </button>
              </div>
            )}
            {(!isPlatformSuper || crmSubView === 'loong') && (
              <LoongOriginationCrmAdminPanel variant="embedded" showBackLink={false} />
            )}
            {isPlatformSuper && crmSubView === 'investigations' && (
              <div className="h-[min(78vh,900px)] min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                <ClientDashboard />
              </div>
            )}
          </div>
        )}
        {activeTab === 'mesa-origen' && (
          <div className="space-y-4">
            <AppBreadcrumb items={[{ label: 'Administración', to: '/admin' }, { label: 'Mesa origen JUXA' }]} />
            <MesaOrigenQueuePanel />
          </div>
        )}
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
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm max-w-3xl">
      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center">
        <Bot className="w-5 h-5 mr-2 text-blue-600" />
        Configuración de Dictamen IA (Ponderaciones)
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
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
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Validación de Identidad (Biometría / Documentos)</label>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{weights.identity}%</span>
          </div>
          <input 
            type="range" 
            min="0" max="100" 
            value={weights.identity} 
            onChange={(e) => setWeights({...weights, identity: parseInt(e.target.value)})}
            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Análisis Crediticio (Buró / Ingresos)</label>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{weights.credit}%</span>
          </div>
          <input 
            type="range" 
            min="0" max="100" 
            value={weights.credit} 
            onChange={(e) => setWeights({...weights, credit: parseInt(e.target.value)})}
            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Estudio Socioeconómico (Entorno / Referencias)</label>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{weights.socioeconomic}%</span>
          </div>
          <input 
            type="range" 
            min="0" max="100" 
            value={weights.socioeconomic} 
            onChange={(e) => setWeights({...weights, socioeconomic: parseInt(e.target.value)})}
            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
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
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Reportes</h3>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-juxa-accent-muted)] text-[var(--color-juxa-accent)]">
            <FileText className="h-4 w-4" />
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">1,248</p>
        <p className="mt-2 flex items-center text-xs text-emerald-600">
          <TrendingUp className="mr-1 h-3 w-3" /> +12% este mes
        </p>
      </Card>

      <Card className="shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">En Progreso</h3>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
            <Clock className="h-4 w-4" />
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">42</p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Órdenes activas</p>
      </Card>

      <Card className="shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Investigadores</h3>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300">
            <Users className="h-4 w-4" />
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">18</p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Usuarios activos</p>
      </Card>

      <Card className="shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Tiempo Promedio</h3>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">2.4d</p>
        <p className="mt-2 flex items-center text-xs text-emerald-600">
          <TrendingUp className="mr-1 h-3 w-3" /> -0.5d mejora
        </p>
      </Card>
    </div>

    <Card className="overflow-hidden p-0 shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Actividad reciente</h2>
      </div>
      <div className="p-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          El panel de actividad detallada se conectará con Firebase Functions próximamente.
        </p>
      </div>
    </Card>
  </>
);

/** Vista plataforma: pre-registros filtrados por perfil de producto (Fase 0 del plan SaaS). */
const PlatformEmpresasAccessTab: React.FC = () => {
  const { user, logUserAction } = useAuthStatus();
  const [preRegs, setPreRegs] = useState<any[]>([]);
  const [loadingPreRegs, setLoadingPreRegs] = useState(true);
  const [productFilter, setProductFilter] = useState<string>('__ALL__');
  const [preRegEmail, setPreRegEmail] = useState('');
  const [preRegRole, setPreRegRole] = useState('CLIENTE');
  const [preRegClientType, setPreRegClientType] = useState('GRATUITO');
  const [preRegClientProfile, setPreRegClientProfile] = useState('GENERAL');
  const [preRegCredits, setPreRegCredits] = useState(10);
  const [preRegPagaresCredits, setPreRegPagaresCredits] = useState(0);
  const [preRegPhone, setPreRegPhone] = useState('');
  const [preRegNote, setPreRegNote] = useState('');
  const [preRegOrganizationId, setPreRegOrganizationId] = useState('');
  const [preRegTrialEndsAt, setPreRegTrialEndsAt] = useState('');
  const [preRegTrialProduct, setPreRegTrialProduct] = useState('');
  const [preRegMaxFreeInv, setPreRegMaxFreeInv] = useState('');
  const [savingPreReg, setSavingPreReg] = useState(false);

  const fetchPreRegistered = async () => {
    setLoadingPreRegs(true);
    try {
      const snapshot = await getDocs(collection(db, 'pre_registered_users'));
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
      setPreRegs(rows);
    } catch (error) {
      console.error('Error fetching pre_registered_users:', error);
    } finally {
      setLoadingPreRegs(false);
    }
  };

  useEffect(() => {
    fetchPreRegistered();
  }, []);

  const handleSavePreRegistered = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = preRegEmail.trim().toLowerCase();
    if (!em) {
      alert('Ingresa el correo que usará la persona al registrarse en /login.');
      return;
    }
    setSavingPreReg(true);
    try {
      const payload: Record<string, unknown> = {
        role: preRegRole,
        clientType: preRegClientType,
        clientProfile: preRegClientProfile,
        credits: Number(preRegCredits),
        pagaresCredits: Number(preRegPagaresCredits),
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || '',
      };
      const ph = preRegPhone.trim();
      if (ph) payload.phone = ph;
      const nt = preRegNote.trim();
      if (nt) payload.note = nt;
      const oid = normalizeOrganizationId(preRegOrganizationId.trim() || null);
      if (oid) payload.organizationId = oid;
      const te = preRegTrialEndsAt.trim();
      if (te) {
        const d = new Date(te);
        if (!Number.isNaN(d.getTime())) payload.trialEndsAt = d.toISOString();
      }
      if (preRegTrialProduct && (SAAS_PRODUCT_IDS as readonly string[]).includes(preRegTrialProduct)) {
        payload.trialProduct = preRegTrialProduct;
      }
      const mfi = preRegMaxFreeInv.trim();
      if (mfi !== '' && !Number.isNaN(Number(mfi))) payload.maxFreeInvestigations = Number(mfi);
      await setDoc(doc(db, 'pre_registered_users', em), payload, { merge: true });
      if (logUserAction && user) {
        logUserAction(user.uid, 'ADMIN_PRE_REGISTER_USER', { email: em, role: preRegRole, clientProfile: preRegClientProfile });
      }
      alert('Listo. Al iniciar sesión, el perfil en Firestore se alineará con esta invitación.');
      setPreRegEmail('');
      setPreRegNote('');
      setPreRegOrganizationId('');
      setPreRegTrialEndsAt('');
      setPreRegTrialProduct('');
      setPreRegMaxFreeInv('');
      await fetchPreRegistered();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al guardar pre-registro.');
    } finally {
      setSavingPreReg(false);
    }
  };

  const handleDeletePreRegistered = async (emailId: string) => {
    if (!window.confirm(`¿Eliminar pre-registro para ${emailId}?`)) return;
    try {
      await deleteDoc(doc(db, 'pre_registered_users', emailId));
      if (logUserAction && user) logUserAction(user.uid, 'ADMIN_DELETE_PRE_REGISTER', { email: emailId });
      await fetchPreRegistered();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al eliminar.');
    }
  };

  const filteredPreRegs =
    productFilter === '__ALL__'
      ? preRegs
      : preRegs.filter((r) => (r.clientProfile || 'GENERAL') === productFilter);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/80 p-5 text-sm text-slate-700 dark:text-slate-200">
        <p className="font-semibold text-slate-900 dark:text-slate-100">Alcance plataforma</p>
        <p className="mt-1">
          Gestiona invitaciones por <strong>producto</strong> (perfil de cliente). Los usuarios que ya existan en{' '}
          <code className="rounded bg-white dark:bg-slate-900 px-1">users</code> recibirán rol y perfil alineados al volver a entrar, si hay
          fila en <code className="rounded bg-white dark:bg-slate-900 px-1">pre_registered_users</code> para su correo.
        </p>
        <p className="mt-3">
          <Link
            to={LOONG_PRE_REGISTER_PATH}
            className="font-medium text-amber-800 underline decoration-amber-300 underline-offset-2 hover:text-amber-950"
          >
            Alta dedicada Loong Motor y semilla de 3 cuentas de prueba
          </Link>
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Filtrar por perfil de producto</h3>
          <div className="w-full sm:w-72">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Perfil</label>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-amber-500"
            >
              <option value="__ALL__">Todos</option>
              {CLIENT_PROFILE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-amber-600" />
          Nuevo pre-registro
        </h3>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Misma acción que en &quot;Usuarios y Solicitudes&quot;: el correo debe coincidir exactamente al registrarse.
        </p>
        <form onSubmit={handleSavePreRegistered} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-200">Correo</label>
            <input
              type="email"
              required
              value={preRegEmail}
              onChange={(e) => setPreRegEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm outline-none focus:border-amber-500"
              placeholder="cliente@empresa.com"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-200">Rol</label>
            <select
              value={preRegRole}
              onChange={(e) => setPreRegRole(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-amber-500"
            >
              {ADMIN_ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-200">Tipo</label>
            <select
              value={preRegClientType}
              onChange={(e) => setPreRegClientType(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-amber-500"
            >
              {CLIENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-200">Perfil producto</label>
            <select
              value={preRegClientProfile}
              onChange={(e) => setPreRegClientProfile(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-amber-500"
            >
              {CLIENT_PROFILE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-200">Créd. inv.</label>
            <input
              type="number"
              min={0}
              value={preRegCredits}
              onChange={(e) => setPreRegCredits(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-200">Créd. pagarés</label>
            <input
              type="number"
              min={0}
              value={preRegPagaresCredits}
              onChange={(e) => setPreRegPagaresCredits(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-200">Teléfono (opcional)</label>
            <input
              type="tel"
              value={preRegPhone}
              onChange={(e) => setPreRegPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div className="lg:col-span-9">
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-200">Nota interna</label>
            <input
              type="text"
              value={preRegNote}
              onChange={(e) => setPreRegNote(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm outline-none focus:border-amber-500"
              placeholder="Ej. Trial Loong — concesionario X"
            />
          </div>
          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-200">organizationId (SaaS)</label>
            <input
              type="text"
              value={preRegOrganizationId}
              onChange={(e) => setPreRegOrganizationId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm outline-none focus:border-amber-500"
              placeholder="loong_motor"
            />
          </div>
          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-200">Fin trial usuario</label>
            <input
              type="datetime-local"
              value={preRegTrialEndsAt}
              onChange={(e) => setPreRegTrialEndsAt(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-200">Producto trial</label>
            <select
              value={preRegTrialProduct}
              onChange={(e) => setPreRegTrialProduct(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-amber-500"
            >
              <option value="">—</option>
              {SAAS_PRODUCT_IDS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-200">Máx. inv. trial</label>
            <input
              type="number"
              min={0}
              value={preRegMaxFreeInv}
              onChange={(e) => setPreRegMaxFreeInv(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm outline-none focus:border-amber-500"
              placeholder="p. ej. 5"
            />
          </div>
          <div className="lg:col-span-12">
            <button
              type="submit"
              disabled={savingPreReg}
              className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              {savingPreReg ? 'Guardando…' : 'Guardar pre-registro'}
            </button>
          </div>
        </form>

        <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4">
          <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            Lista ({filteredPreRegs.length}
            {productFilter !== '__ALL__' ? ` · filtro ${productFilter}` : ''})
          </h4>
          {loadingPreRegs ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
          ) : filteredPreRegs.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Ningún pre-registro con este filtro.</p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              {filteredPreRegs.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-950/50 px-4 py-3 text-sm">
                  <div>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{row.id}</span>
                    <span className="text-slate-500 dark:text-slate-400"> · {row.role}</span>
                    {row.clientProfile && <span className="text-slate-500 dark:text-slate-400"> · {row.clientProfile}</span>}
                    {row.organizationId && (
                      <span className="text-slate-500 dark:text-slate-400"> · org: {row.organizationId}</span>
                    )}
                    {row.note && <span className="mt-0.5 block text-xs text-slate-400 dark:text-slate-500">{row.note}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeletePreRegistered(row.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

const UsersTab = () => {
  const { user, logUserAction, clientProfile, organizationId, effectiveOrganizationId, role } = useAuthStatus();
  const isPlatformSuper = !!(user?.email && isSuperAdminEmail(user.email));
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgAllowedRoles, setOrgAllowedRoles] = useState<string[] | null>(null);

  const adminScope = useMemo(
    () =>
      resolveAdminUserScope({
        adminEmail: user?.email ?? null,
        role,
        clientProfile,
        organizationId,
      }),
    [user?.email, role, clientProfile, organizationId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isPlatformSuper) {
        setOrgAllowedRoles(null);
        return;
      }
      if (adminScope.kind !== 'organization') {
        setOrgAllowedRoles(null);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'organizations', adminScope.organizationId));
        if (cancelled) return;
        if (!snap.exists()) {
          setOrgAllowedRoles(null);
          return;
        }
        const d = snap.data() as any;
        const raw = Array.isArray(d.allowedRoles) ? d.allowedRoles.map(String) : [];
        const valid = new Set(ADMIN_ROLE_OPTIONS.map((o) => o.value));
        const filtered = raw.filter((r: string) => valid.has(r));
        setOrgAllowedRoles(filtered.length > 0 ? filtered : null);
      } catch {
        if (!cancelled) setOrgAllowedRoles(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminScope, isPlatformSuper]);

  const roleOptions = useMemo(() => {
    if (isPlatformSuper) return ADMIN_ROLE_OPTIONS;
    if (!orgAllowedRoles || orgAllowedRoles.length === 0) return ADMIN_ROLE_OPTIONS;
    const allow = new Set(orgAllowedRoles);
    return ADMIN_ROLE_OPTIONS.filter((o) => allow.has(o.value));
  }, [isPlatformSuper, orgAllowedRoles]);

  // Add User Form State
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('CLIENTE');
  const [newClientType, setNewClientType] = useState('GRATUITO');
  const [newClientProfile, setNewClientProfile] = useState('GENERAL');
  const [newCredits, setNewCredits] = useState(0);
  const [newPagaresCredits, setNewPagaresCredits] = useState(0);
  /** Solo superadmin plataforma: fuerza organizationId del usuario creado (opcional). */
  const [newOrganizationId, setNewOrganizationId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [preRegs, setPreRegs] = useState<any[]>([]);
  const [loadingPreRegs, setLoadingPreRegs] = useState(true);
  const [preRegEmail, setPreRegEmail] = useState('');
  const [preRegRole, setPreRegRole] = useState('CLIENTE');
  const [preRegClientType, setPreRegClientType] = useState('GRATUITO');
  const [preRegClientProfile, setPreRegClientProfile] = useState('GENERAL');
  const [preRegCredits, setPreRegCredits] = useState(10);
  const [preRegPagaresCredits, setPreRegPagaresCredits] = useState(0);
  const [preRegPhone, setPreRegPhone] = useState('');
  const [preRegNote, setPreRegNote] = useState('');
  const [preRegOrganizationId, setPreRegOrganizationId] = useState('');
  const [preRegTrialEndsAt, setPreRegTrialEndsAt] = useState('');
  const [preRegTrialProduct, setPreRegTrialProduct] = useState('');
  const [preRegMaxFreeInv, setPreRegMaxFreeInv] = useState('');
  const [savingPreReg, setSavingPreReg] = useState(false);

  const scopedPreRegs = useMemo(
    () => preRegs.filter((r) => preRegMatchesAdminScope(r, adminScope)),
    [preRegs, adminScope]
  );

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
    fetchPreRegistered();
  }, []);

  const reloadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const pageSize = 400;
      const docsChunk: QueryDocumentSnapshot[] = [];
      let cursor: QueryDocumentSnapshot | undefined;
      for (;;) {
        const q = cursor
          ? query(collection(db, 'users'), orderBy(documentId()), startAfter(cursor), limit(pageSize))
          : query(collection(db, 'users'), orderBy(documentId()), limit(pageSize));
        const snapshot = await getDocs(q);
        if (snapshot.empty) break;
        docsChunk.push(...snapshot.docs);
        cursor = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.size < pageSize) break;
      }
      let usersData = docsChunk.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const uidFromData = typeof data.uid === 'string' && data.uid.trim() ? data.uid.trim() : d.id;
        return { id: d.id, ...data, uid: uidFromData };
      });
      if (adminScope.kind === 'organization') {
        usersData = usersData.filter((u) => userMatchesAdminScope(u, adminScope));
      }
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, [adminScope]);

  useEffect(() => {
    reloadUsers();
  }, [reloadUsers]);

  useEffect(() => {
    if (clientProfile === 'LOONG_MOTOR') {
      setPreRegOrganizationId((prev) => (prev.trim() === '' ? DEFAULT_ORGANIZATION_ID_LOONG : prev));
    }
  }, [clientProfile]);

  useEffect(() => {
    if (isPlatformSuper) return;
    if (!orgAllowedRoles || orgAllowedRoles.length === 0) return;
    const allow = new Set(orgAllowedRoles);
    setNewRole((prev) => (allow.has(prev) ? prev : orgAllowedRoles[0]));
    setPreRegRole((prev) => (allow.has(prev) ? prev : orgAllowedRoles[0]));
    setEditRole((prev) => (prev && allow.has(prev) ? prev : prev));
  }, [isPlatformSuper, orgAllowedRoles]);

  const fetchPreRegistered = async () => {
    setLoadingPreRegs(true);
    try {
      const snapshot = await getDocs(collection(db, 'pre_registered_users'));
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
      setPreRegs(rows);
    } catch (error) {
      console.error('Error fetching pre_registered_users:', error);
    } finally {
      setLoadingPreRegs(false);
    }
  };

  const handleSavePreRegistered = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = preRegEmail.trim().toLowerCase();
    if (!em) {
      alert('Ingresa el correo que usará la persona al registrarse en /login.');
      return;
    }
    if (!isPlatformSuper && orgAllowedRoles && orgAllowedRoles.length > 0 && !orgAllowedRoles.includes(preRegRole)) {
      alert('Ese rol no está permitido para tu organización.');
      return;
    }
    setSavingPreReg(true);
    try {
      const payload: Record<string, unknown> = {
        role: preRegRole,
        clientType: preRegClientType,
        clientProfile: preRegClientProfile,
        credits: Number(preRegCredits),
        pagaresCredits: Number(preRegPagaresCredits),
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || '',
      };
      const ph = preRegPhone.trim();
      if (ph) payload.phone = ph;
      const nt = preRegNote.trim();
      if (nt) payload.note = nt;
      let oid = normalizeOrganizationId(preRegOrganizationId.trim() || null);
      if (!oid && adminScope.kind === 'organization') {
        oid = normalizeOrganizationId(adminScope.organizationId) || adminScope.organizationId;
      }
      if (oid) payload.organizationId = oid;
      const te = preRegTrialEndsAt.trim();
      if (te) {
        const d = new Date(te);
        if (!Number.isNaN(d.getTime())) payload.trialEndsAt = d.toISOString();
      }
      if (preRegTrialProduct && (SAAS_PRODUCT_IDS as readonly string[]).includes(preRegTrialProduct)) {
        payload.trialProduct = preRegTrialProduct;
      }
      const mfi = preRegMaxFreeInv.trim();
      if (mfi !== '' && !Number.isNaN(Number(mfi))) payload.maxFreeInvestigations = Number(mfi);
      await setDoc(doc(db, 'pre_registered_users', em), payload, { merge: true });
      if (logUserAction && user) {
        logUserAction(user.uid, 'ADMIN_PRE_REGISTER_USER', { email: em, role: preRegRole, clientProfile: preRegClientProfile });
      }
      alert('Listo. Cuando esa persona cree cuenta en “Registrarse”, recibirá este rol y perfil.');
      setPreRegEmail('');
      setPreRegNote('');
      setPreRegOrganizationId('');
      setPreRegTrialEndsAt('');
      setPreRegTrialProduct('');
      setPreRegMaxFreeInv('');
      await fetchPreRegistered();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al guardar pre-registro.');
    } finally {
      setSavingPreReg(false);
    }
  };

  const handleDeletePreRegistered = async (emailId: string) => {
    if (!window.confirm(`¿Eliminar pre-registro para ${emailId}?`)) return;
    try {
      await deleteDoc(doc(db, 'pre_registered_users', emailId));
      if (logUserAction && user) logUserAction(user.uid, 'ADMIN_DELETE_PRE_REGISTER', { email: emailId });
      await fetchPreRegistered();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al eliminar.');
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
    if (!selectedUserForInv || !user?.uid) return;

    try {
      const invId = crypto.randomUUID();
      const now = new Date().toISOString();
      const cp = String(selectedUserForInv.clientProfile || 'GENERAL');
      const invType =
        cp === 'LOONG_MOTOR' ? 'LOONG_MOTOR' : cp === 'HR' ? 'HR' : cp === 'CREDIT' ? 'CREDIT' : 'GENERAL';
      const investigationScope =
        invType === 'CREDIT' ? 'BASIC' : invType === 'LOONG_MOTOR' ? 'LOONG_PRECAL' : 'INTEGRAL';

      const targetOrg = normalizeOrganizationId(
        typeof selectedUserForInv.organizationId === 'string' ? selectedUserForInv.organizationId : null
      );
      const adminOrg = normalizeOrganizationId(effectiveOrganizationId ?? organizationId);
      const orgForInv =
        targetOrg ||
        adminOrg ||
        (invType === 'LOONG_MOTOR' ? DEFAULT_ORGANIZATION_ID_LOONG : null);

      await setDoc(doc(db, 'investigations', invId), {
        id: invId,
        clientId: selectedUserForInv.uid,
        requestedBy: user.uid,
        status: 'PENDING',
        title: (invTitle || 'Solicitud de investigación').trim(),
        details: (invDetails || '').trim(),
        clientProfile: invType,
        investigationType: invType,
        investigationScope,
        createdAt: now,
        updatedAt: now,
        ...(orgForInv ? { organizationId: orgForInv } : {}),
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
    if (!isPlatformSuper && orgAllowedRoles && orgAllowedRoles.length > 0 && !orgAllowedRoles.includes(newRole)) {
      alert('Ese rol no está permitido para tu organización.');
      return;
    }
    const scopeNow = resolveAdminUserScope({
      adminEmail: user?.email ?? null,
      role,
      clientProfile,
      organizationId,
    });
    const orgForUser = defaultOrganizationIdForNewUser(
      scopeNow,
      newOrganizationId.trim() ? newOrganizationId.trim() : undefined
    );

    setIsAdding(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        newEmail.toLowerCase(),
        newPassword
      );
      const newUserId = userCredential.user.uid;

      await setDoc(doc(db, 'users', newUserId), {
        uid: newUserId,
        email: newEmail.toLowerCase(),
        phone: newPhone,
        role: newRole,
        clientType: newClientType,
        clientProfile: newClientProfile,
        credits: Number(newCredits),
        pagaresCredits: Number(newPagaresCredits),
        createdAt: new Date().toISOString(),
        ...(orgForUser ? { organizationId: orgForUser } : {}),
      });

      if (logUserAction && user) {
        logUserAction(user.uid, 'ADMIN_CREATE_USER', { createdUserId: newUserId, email: newEmail });
      }

      alert('Usuario creado exitosamente en el sistema.');
      setNewEmail('');
      setNewPassword('');
      setNewPhone('');
      reloadUsers();
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'auth/email-already-in-use') {
        try {
          const q = query(collection(db, 'users'), where('email', '==', newEmail.toLowerCase()));
          const snap = await getDocs(q);
          if (snap.empty) {
            const confirmCreate = window.confirm(
              'El correo ya existe en la autenticación pero NO tiene perfil en la base de datos. ¿Deseas crear un perfil manual para este correo? El usuario podrá entrar con su contraseña actual.'
            );
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
                  isManualSync: true,
                  ...(orgForUser ? { organizationId: orgForUser } : {}),
                });
                alert('Perfil creado. El usuario se sincronizará completamente en su próximo inicio de sesión.');
                setNewEmail('');
                setNewPassword('');
                setNewPhone('');
                reloadUsers();
              } catch (e: unknown) {
                alert('Error al crear perfil manual: ' + (e instanceof Error ? e.message : String(e)));
              }
            }
          } else {
            alert('Este correo ya está registrado y tiene un perfil activo. Puedes editar sus permisos en la tabla de abajo.');
          }
        } catch (inner) {
          console.error('Error en flujo email-already-in-use:', inner);
          alert(
            'El correo ya está en uso en Authentication. No se pudo consultar Firestore: ' +
              (inner instanceof Error ? inner.message : 'error desconocido')
          );
        }
      } else {
        console.error('Error adding user:', error);
        if (err.code === 'auth/operation-not-allowed') {
          alert('ERROR CRÍTICO: El método de "Correo electrónico/contraseña" está desactivado en tu consola de Firebase.');
        } else {
          alert(`Error al agregar usuario: ${err.message || String(error)}`);
        }
      }
    } finally {
      await signOutSecondaryAuth();
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
    if (!isPlatformSuper && orgAllowedRoles && orgAllowedRoles.length > 0 && !orgAllowedRoles.includes(editRole)) {
      alert('Ese rol no está permitido para tu organización.');
      return;
    }
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
      reloadUsers();
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
        reloadUsers();
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
        reloadUsers();
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
      {isPlatformSuper ? (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-6 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-amber-950 dark:text-amber-100">Alta rápida — usuarios Loong Motor</h3>
              <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-200/80">
                Alta con correo y contraseña (mismo módulo que Equipo en el panel Loong). Para usuarios iniciales desde Superadmin.
              </p>
            </div>
          </div>
          <LoongTeamUsersPanel organizationId={DEFAULT_ORGANIZATION_ID_LOONG} />
        </div>
      ) : null}
      {user?.email && isLoongSuperAdminEmail(user.email) ? (
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
          <strong>Usuarios corporativos:</strong> concesionarios y cuentas de empresa se gestionan aquí como un solo registro de usuario (rol, perfil y{' '}
          <code className="rounded bg-white/70 px-1 py-0.5 text-xs dark:bg-slate-900/80">organizationId</code>). No hay apartados separados de empresas ni de organizaciones SaaS.
        </div>
      ) : null}
      {adminScope.kind === 'organization' ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50/90 px-4 py-3 text-sm text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-100">
          <strong>Vista acotada:</strong> solo se listan usuarios y pre-registros de tu organización{' '}
          <code className="rounded bg-white/70 dark:bg-slate-900/80 px-1.5 py-0.5 text-xs">{adminScope.organizationId}</code>
          {adminScope.looseProfiles.length > 0
            ? ` (también correos @loong.mx o perfil ${adminScope.looseProfiles.join(' / ')} sin org aún).`
            : '.'}{' '}
          Las altas inmediatas y pre-registros rellenan <code className="text-xs">organizationId</code> si lo dejas vacío.
        </div>
      ) : null}

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center">
          <UserPlus className="w-5 h-5 mr-2 text-blue-600" />
          Agregar Usuario Inmediato
        </h3>
        <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-10 gap-4 items-end">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Email</label>
            <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="usuario@empresa.com" />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Contraseña</label>
            <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="••••••••" />
          </div>
          <div className="lg:col-span-1">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Teléfono</label>
            <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="Opcional" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Rol</label>
            <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500 bg-white dark:bg-slate-900">
              {roleOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Tipo</label>
            <select value={newClientType} onChange={e => setNewClientType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500 bg-white dark:bg-slate-900">
              {CLIENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-1">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Perfil</label>
            <select value={newClientProfile} onChange={e => setNewClientProfile(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500 bg-white dark:bg-slate-900">
              {CLIENT_PROFILE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Créditos Inv.</label>
            <input type="number" min="0" value={newCredits} onChange={e => setNewCredits(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Créditos Pagarés</label>
            <input type="number" min="0" value={newPagaresCredits} onChange={e => setNewPagaresCredits(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500" />
          </div>
          {user?.email && isSuperAdminEmail(user.email) ? (
            <div className="lg:col-span-3">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
                organizationId (opcional)
                {isLoongSuperAdminEmail(user.email) ? ' — tenant / corporativo' : ''}
              </label>
              <input
                type="text"
                value={newOrganizationId}
                onChange={(e) => setNewOrganizationId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500"
                placeholder="Ej. loong_motor — vacío usa regla del tenant"
              />
            </div>
          ) : null}
          <div className="lg:col-span-10">
            <button type="submit" disabled={isAdding} className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">
              {isAdding ? 'Creando Usuario...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-amber-600" />
          Pre-registro para “Crear cuenta” en /login
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
          Define el correo exacto que usará la persona. Al registrarse sola en la pantalla de acceso, recibirá el <strong>rol</strong>, <strong>tipo</strong>, <strong>perfil</strong> y <strong>créditos</strong> que indiques aquí — sin que tú les crees la contraseña.
        </p>
        <div className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <strong className="font-semibold">Loong Motor no es un rol:</strong> en <strong>Perfil</strong> elige &quot;Loong Motor — crédito moto&quot;. Para vendedores/usuarios de concesionario usa rol{' '}
          <strong>Usuario / cliente final</strong> + ese perfil. Para quien coordina operaciones sin ser administrador del sistema, usa <strong>Supervisor (operaciones / Loong)</strong>.
        </div>
        <form onSubmit={handleSavePreRegistered} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-3">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Correo (debe coincidir al registrarse)</label>
            <input
              type="email"
              required
              value={preRegEmail}
              onChange={(e) => setPreRegEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-amber-500"
              placeholder="cliente@empresa.com"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Rol</label>
            <select value={preRegRole} onChange={(e) => setPreRegRole(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 outline-none focus:border-amber-500">
              {roleOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Tipo</label>
            <select value={preRegClientType} onChange={(e) => setPreRegClientType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 outline-none focus:border-amber-500">
              {CLIENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Perfil</label>
            <select value={preRegClientProfile} onChange={(e) => setPreRegClientProfile(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 outline-none focus:border-amber-500">
              {CLIENT_PROFILE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Créd. inv.</label>
            <input type="number" min="0" value={preRegCredits} onChange={(e) => setPreRegCredits(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Créd. pagarés</label>
            <input type="number" min="0" value={preRegPagaresCredits} onChange={(e) => setPreRegPagaresCredits(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-amber-500" />
          </div>
          <div className="lg:col-span-3">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Teléfono (opcional, se copia al perfil)</label>
            <input type="tel" value={preRegPhone} onChange={(e) => setPreRegPhone(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-amber-500" placeholder="Opcional" />
          </div>
          <div className="lg:col-span-9">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Nota interna (opcional)</label>
            <input type="text" value={preRegNote} onChange={(e) => setPreRegNote(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-amber-500" placeholder="Ej. Concesionario CDMX norte" />
          </div>
          <div className="lg:col-span-3">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
              organizationId
              {user?.email && isLoongSuperAdminEmail(user.email) ? ' (tenant / usuario corporativo)' : ' (SaaS)'}
            </label>
            <input
              type="text"
              value={preRegOrganizationId}
              onChange={(e) => setPreRegOrganizationId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-amber-500"
              placeholder="loong_motor"
            />
          </div>
          <div className="lg:col-span-3">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Fin trial usuario</label>
            <input
              type="datetime-local"
              value={preRegTrialEndsAt}
              onChange={(e) => setPreRegTrialEndsAt(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Producto trial</label>
            <select
              value={preRegTrialProduct}
              onChange={(e) => setPreRegTrialProduct(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 outline-none focus:border-amber-500"
            >
              <option value="">—</option>
              {SAAS_PRODUCT_IDS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Máx. inv. trial</label>
            <input
              type="number"
              min={0}
              value={preRegMaxFreeInv}
              onChange={(e) => setPreRegMaxFreeInv(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-amber-500"
              placeholder="p. ej. 5"
            />
          </div>
          <div className="lg:col-span-12">
            <button
              type="submit"
              disabled={savingPreReg}
              className="w-full px-4 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {savingPreReg ? 'Guardando…' : 'Guardar pre-registro'}
            </button>
          </div>
        </form>

        <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Correos pre-registrados</h4>
          {loadingPreRegs ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
          ) : scopedPreRegs.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Ninguno en tu vista. Agrega un correo arriba o revisa organizationId / perfil.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {scopedPreRegs.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50/50 dark:bg-slate-950/50 text-sm">
                  <div>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{row.id}</span>
                    <span className="text-slate-500 dark:text-slate-400"> · {row.role}</span>
                    {row.clientProfile && <span className="text-slate-500 dark:text-slate-400"> · perfil {row.clientProfile}</span>}
                    {row.organizationId && <span className="text-slate-500 dark:text-slate-400"> · org: {row.organizationId}</span>}
                    {row.note && <span className="block text-xs text-slate-400 dark:text-slate-500 mt-0.5">{row.note}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeletePreRegistered(row.id)}
                    className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 text-xs font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Usuarios Registrados</h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por email o rol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium">Rol</th>
                <th className="p-4 font-medium">Perfil</th>
                <th className="p-4 font-medium">Org</th>
                <th className="p-4 font-medium">Tipo</th>
                <th className="p-4 font-medium">Créditos Inv.</th>
                <th className="p-4 font-medium">Créditos Pagarés</th>
                <th className="p-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700 dark:text-slate-200 divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <JuxaVerifyLoader text="Cargando usuarios..." />
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={8} className="p-4 text-center text-slate-500 dark:text-slate-400">No se encontraron usuarios.</td></tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                    <td className="p-4 font-medium text-slate-900 dark:text-slate-100">{user.email}</td>
                    <td className="p-4"><span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-xs font-medium">{user.role}</span></td>
                    <td className="p-4 text-xs text-slate-600 dark:text-slate-300">{user.clientProfile || '—'}</td>
                    <td className="p-4 text-xs font-mono text-slate-600 dark:text-slate-300">{user.organizationId || '—'}</td>
                    <td className="p-4">{user.clientType}</td>
                    <td className="p-4">{user.credits || 0}</td>
                    <td className="p-4">{user.pagaresCredits || 0}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => openInvModal(user)} className="text-emerald-600 hover:text-emerald-800 font-medium text-xs flex items-center" title="Solicitar Investigación">
                          <Plus className="w-4 h-4 mr-1" /> Solicitar
                        </button>
                        <button onClick={() => handlePasswordReset(user.email)} className="text-slate-600 dark:text-slate-300 hover:text-slate-800 font-medium text-xs flex items-center" title="Reset Password">
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Solicitar Investigación (Manual)</h3>
              <button 
                onClick={() => setIsInvModalOpen(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
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
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Título / Nombre del Sujeto
                  </label>
                  <input
                    type="text"
                    required
                    value={invTitle}
                    onChange={(e) => setInvTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Ej. Juan Pérez - Estudio Socioeconómico"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Detalles Adicionales
                  </label>
                  <textarea
                    required
                    value={invDetails}
                    onChange={(e) => setInvDetails(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[100px]"
                    placeholder="Proporciona RFC, CURP, o cualquier dato relevante..."
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsInvModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-lg transition-colors"
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Editar Usuario</h2>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Email</label>
                <input type="text" disabled value={editingUser.email} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Teléfono</label>
                <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Rol</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500 bg-white dark:bg-slate-900">
                  {roleOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Tipo de Cliente</label>
                  <select value={editClientType} onChange={e => setEditClientType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500 bg-white dark:bg-slate-900">
                    {CLIENT_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Perfil</label>
                  <select value={editClientProfile} onChange={e => setEditClientProfile(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500 bg-white dark:bg-slate-900">
                    {CLIENT_PROFILE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Créditos Inv.</label>
                  <input type="number" min="0" value={editCredits} onChange={e => setEditCredits(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Créditos Pagarés</label>
                  <input type="number" min="0" value={editPagaresCredits} onChange={e => setEditPagaresCredits(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Solicitudes de Usuario</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{selectedUser.email}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950">
              {loadingInvestigations ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <JuxaVerifyLoader text="Cargando solicitudes..." />
                </div>
              ) : userInvestigations.length === 0 ? (
                <p className="text-center text-slate-500 dark:text-slate-400">Este usuario no tiene solicitudes.</p>
              ) : (
                <div className="space-y-4">
                  {userInvestigations.map(inv => (
                    <div key={inv.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-600 dark:text-slate-300 mb-2 inline-block">
                            {inv.investigationType}
                          </span>
                          <h4 className="font-bold text-slate-900 dark:text-slate-100">{inv.title}</h4>
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
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Creado: {new Date(inv.createdAt).toLocaleDateString()}</p>
                      
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
                          <strong className="block mb-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center">
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
                                    className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:border-blue-300 transition-all flex items-center"
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    {item.label}
                                  </a>
                                ));
                              } catch (e) {
                                return <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">Error al cargar evidencia</span>;
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
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center">
        <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
        Gestión de Planes de Cobro
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Plan Gratuito */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-400"></div>
          <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Gratuito</h4>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-4">$0 <span className="text-sm font-normal text-slate-500 dark:text-slate-400">/mes</span></p>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300 mb-6">
            <li>✓ 3 Investigaciones al mes</li>
            <li>✓ Reportes básicos</li>
            <li>✓ Soporte por email</li>
          </ul>
          <button className="w-full py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">Editar Plan</button>
        </div>

        {/* Plan Bolsa */}
        <div className="border border-blue-200 rounded-xl p-6 relative overflow-hidden bg-blue-50/30">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
          <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Bolsa de Créditos</h4>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-4">Variable</p>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300 mb-6">
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
          <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Suscripción Pro</h4>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-4">$4,999 <span className="text-sm font-normal text-slate-500 dark:text-slate-400">/mes</span></p>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300 mb-6">
            <li>✓ Investigaciones ilimitadas*</li>
            <li>✓ API Access</li>
            <li>✓ Marca Blanca</li>
            <li>✓ Account Manager Dedicado</li>
          </ul>
          <button className="w-full py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">Editar Plan</button>
        </div>
      </div>
    </div>
  );
};

const SimulatorTab = () => {
  const { user, logUserAction } = useAuthStatus();
  const [simType, setSimType] = useState('LOONG_MOTOR');
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
      const invId = Math.random().toString(36).substring(2, 15);
      const linkId = Math.random().toString(36).substring(2, 15);
      const isLoong = simType === 'LOONG_MOTOR';

      await setDoc(doc(db, 'investigations', invId), {
        id: invId,
        clientId: 'admin_simulator',
        requestedBy: 'admin',
        status: 'PENDING',
        title: simName,
        clientProfile: simType,
        investigationType: simType,
        candidateLink: linkId,
        ...(isLoong
          ? {
              investigationScope: 'LOONG_PRECAL',
              tipoCredito: 'Crédito moto Loong Motor',
              montoCreditoCapital: 0,
              montoCreditoIntereses: 0,
              plazoFinanciamiento: 'Por definir',
            }
          : {}),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await setDoc(doc(db, 'candidate_links', linkId), {
        linkId,
        investigationId: invId,
        clientId: 'admin_simulator',
        clientProfile: simType,
        investigationType: simType,
        ...(isLoong ? { investigationScope: 'LOONG_PRECAL' as const } : {}),
        title: simName,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
      <div className="max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-900/[0.02]">
        <h3 className="mb-2 flex items-center text-lg font-semibold text-slate-900 dark:text-slate-100">
          <LinkIcon className="mr-2 h-5 w-5 text-slate-700 dark:text-slate-200" />
          Simulador de originación de crédito
        </h3>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          Genera enlaces de prueba para el flujo de candidato en crédito (incluye Loong Motor). Otros perfiles (RRHH, proveedores) no se simulan aquí.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Tipo de originación</label>
            <select value={simType} onChange={e => setSimType(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm outline-none ring-slate-900/5 focus:border-slate-400 focus:ring-2">
              <option value="CREDIT">Crédito (general)</option>
              <option value="LOONG_MOTOR">Loong Motor — precalificación y crédito moto</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Nombre del Sujeto (Prueba)</label>
            <input type="text" value={simName} onChange={e => setSimName(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10" />
          </div>
          <button 
            onClick={handleGenerateLink}
            disabled={isGenerating}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
          >
            {isGenerating ? 'Generando...' : 'Generar Enlace de Prueba'}
          </button>

          {generatedLink && (
            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-sm font-bold text-blue-900 mb-2">Enlace Generado Exitosamente:</p>
              <div className="flex gap-2">
                <input type="text" readOnly value={generatedLink} className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-blue-200 rounded-lg text-sm text-slate-600 dark:text-slate-300 outline-none" />
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
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-blue-600" />
            Historial de Pruebas Recientes
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">
                  <th className="pb-3 font-medium">Fecha</th>
                  <th className="pb-3 font-medium">Nombre (Prueba)</th>
                  <th className="pb-3 font-medium">Tipo</th>
                  <th className="pb-3 font-medium">Estado</th>
                  <th className="pb-3 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {history.map((link) => (
                  <tr key={link.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80">
                    <td className="py-3 text-slate-600 dark:text-slate-300">{new Date(link.createdAt).toLocaleDateString()} {new Date(link.createdAt).toLocaleTimeString()}</td>
                    <td className="py-3 font-medium text-slate-900 dark:text-slate-100">{link.title}</td>
                    <td className="py-3">
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-xs font-medium">
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Dictamen de Prueba: {selectedResult.title}
              </h2>
              <button 
                onClick={() => setSelectedResult(null)}
                className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
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
                          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2">Ingresos y Egresos</h4>
                            <p className="text-sm text-slate-700 dark:text-slate-200"><span className="font-medium">Verificado:</span> {dictamen.congruenciaIngresos?.verificado ? 'Sí' : 'No'}</p>
                            <p className="text-sm text-slate-700 dark:text-slate-200"><span className="font-medium">Nivel Inferido:</span> {dictamen.congruenciaIngresos?.nivelSocioeconomicoInferido}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{dictamen.congruenciaIngresos?.detalles}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2">Domicilio y Ubicación</h4>
                            <p className="text-sm text-slate-700 dark:text-slate-200"><span className="font-medium">Verificado:</span> {dictamen.congruenciaDomicilio?.verificado ? 'Sí' : 'No'}</p>
                            <p className="text-sm text-slate-700 dark:text-slate-200"><span className="font-medium">Distancia:</span> {dictamen.congruenciaDomicilio?.distanciaMetros} metros</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{dictamen.congruenciaDomicilio?.detalles}</p>
                          </div>
                          {dictamen.congruenciaFachadaEntorno && (
                            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-700 md:col-span-2">
                              <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2">Análisis Fachada vs Entorno</h4>
                              <p className="text-sm text-slate-700 dark:text-slate-200"><span className="font-medium">Verificado:</span> {dictamen.congruenciaFachadaEntorno.verificado ? 'Sí' : 'No'}</p>
                              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{dictamen.congruenciaFachadaEntorno.detalles}</p>
                            </div>
                          )}
                          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-700 md:col-span-2">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2">Análisis Documental</h4>
                            <p className="text-sm text-slate-700 dark:text-slate-200"><span className="font-medium">Verificado:</span> {dictamen.analisisDocumental?.verificado ? 'Sí' : 'No'}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{dictamen.analisisDocumental?.detalles}</p>
                          </div>
                        </div>
                      </div>
                    );
                  } catch (e) {
                    return <p className="text-red-500">Error al procesar el dictamen.</p>;
                  }
                })()
              ) : (
                <p className="text-slate-500 dark:text-slate-400">No hay dictamen disponible para esta prueba.</p>
              )}

              {selectedResult.candidateData && (
                <div className="mt-8">
                  <h3 className="text-md font-bold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Datos Enviados por el Candidato
                  </h3>
                  
                  {(() => {
                    try {
                      const data = JSON.parse(selectedResult.candidateData);
                      return (
                        <div className="space-y-6">
                          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
                            <pre className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                              {JSON.stringify(data, null, 2)}
                            </pre>
                          </div>

                          {(data.realTimeLocation || data.mapLocation) && (
                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
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
            
            <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-950 rounded-b-2xl flex justify-end">
              <button
                onClick={() => setSelectedResult(null)}
                className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
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

