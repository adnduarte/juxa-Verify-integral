import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Users, FileText, TrendingUp, Clock, RefreshCw, UserPlus, CreditCard, Link as LinkIcon, Search, Eye, X, Bot, Zap, Briefcase, Plus, Mail, Trash2, Brain, MapPin, Send, FlaskConical, CheckCircle2, AlertCircle, Download, UploadCloud, Image as ImageIcon, FileCheck, Copy, Settings, Building2, Factory, ShieldAlert, Calculator, ClipboardList } from 'lucide-react';
import { useJsApiLoader, Autocomplete, GoogleMap, Marker } from '@react-google-maps/api';
import { db, secondaryAuth } from '../../firebase';
import { collection, getDocs, deleteDoc, doc, setDoc, query, where, addDoc, getDoc, orderBy, onSnapshot, updateDoc } from '@/lib/localFirestore';
import { isLocalConstructionMode } from '@/lib/localDataMode';
import { localDevUidFromEmail } from '@/lib/devPersonasCatalog';
import { useAuthStatus } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { AdminViewOrganizationProvider, useAdminViewOrganization } from '../../contexts/AdminViewOrganizationContext';
import type { TenantFeatureFlags } from '../../types/saas';
import { AdminOrgToolbar, readStoredMenuIgnoreContract } from './AdminOrgToolbar';
import { toast } from 'react-hot-toast';
import { CGOEngine } from '../CGOEngine';
import { IntegralDashboard } from './IntegralDashboard';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import DOMPurify from 'dompurify';

import { DashboardLayout } from './DashboardLayout';
import { B2BWorkspaceDashboard } from './B2BWorkspaceDashboard';
import { SupplierComplianceDashboard } from './SupplierComplianceDashboard';
import { FieldNetworkDashboard } from './FieldNetworkDashboard';
import { HRDashboard } from './HRDashboard';
import { AdminIdentityTools } from './AdminIdentityTools';
import { AIResultRenderer } from '../AIResultRenderer';
import { JuxaVerifyLoader } from '../JuxaVerifyLoader';
import { LocationViewer } from '../LocationViewer';
import { compressImage } from '../../lib/imageUtils';
import { analyzeCandidateData } from '../../lib/gemini';

import { FinancialDashboard } from './FinancialDashboard';
import { InvestigatorDashboard } from './InvestigatorDashboard';
import { SaaSOrgAdminPanel } from './SaaSOrgAdminPanel';
import { FordAuditPeriodPanel } from './FordAuditPeriodPanel';

import { initializeApp } from 'firebase/app';
import { getAuth, sendPasswordResetEmail, createUserWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';

const libraries: ("places")[] = ["places"];

const TAB_PRODUCT: Partial<
  Record<
    | 'prueba-final'
    | 'metrics'
    | 'users'
    | 'links'
    | 'lab'
    | 'plans'
    | 'simulator'
    | 'cgo'
    | 'ia-config'
    | 'prequal'
    | 'saas'
    | 'b2b'
    | 'suppliers'
    | 'field'
    | 'identity'
    | 'hr-mx'
    | 'ford-audit',
    keyof TenantFeatureFlags
  >
> = {
  'prueba-final': 'creditOrigination',
  prequal: 'creditOrigination',
  links: 'creditOrigination',
  simulator: 'creditOrigination',
  lab: 'creditOrigination',
  plans: 'creditOrigination',
  metrics: 'socioeconomicStudies',
  b2b: 'b2bCollections',
  suppliers: 'supplierCompliance',
  field: 'fieldNetwork',
  identity: 'identityAntiUsurpation',
  'hr-mx': 'hrSuiteMexico',
  'ford-audit': 'creditOrigination',
  cgo: 'creditOrigination',
};

export const AdminDashboard: React.FC = () => (
  <AdminViewOrganizationProvider>
    <AdminDashboardContent />
  </AdminViewOrganizationProvider>
);

const AdminDashboardContent: React.FC = () => {
  const { user, role, logUserAction } = useAuthStatus();
  const { hasProduct } = useTenant();
  const { viewOrganizationId } = useAdminViewOrganization();
  const [menuIgnoreContract, setMenuIgnoreContract] = useState(() => readStoredMenuIgnoreContract());
  const isOriginacionUser = user?.email === 'originacion@loong.mx';
  type AdminTabId =
    | 'prueba-final'
    | 'metrics'
    | 'users'
    | 'links'
    | 'lab'
    | 'plans'
    | 'simulator'
    | 'cgo'
    | 'ia-config'
    | 'prequal'
    | 'saas'
    | 'b2b'
    | 'suppliers'
    | 'field'
    | 'identity'
    | 'hr-mx'
    | 'ford-audit';
  const [activeTab, setActiveTab] = useState<AdminTabId>(
    isOriginacionUser ? 'prueba-final' : role === 'EJECUTIVO_VENTAS' ? 'prueba-final' : 'prueba-final'
  );
  const [sellerLocation, setSellerLocation] = useState<{lat: number, lng: number} | null>(null);

  const FORD_PROGRAM_ROOT_ID = 'ford-credit-mx';
  const [fordAuditInvestigations, setFordAuditInvestigations] = useState<any[]>([]);
  const [fordAuditAgencies, setFordAuditAgencies] = useState<{ id: string; name: string }[]>([]);
  const fordAuditAgencyLabels = useMemo(
    () => Object.fromEntries(fordAuditAgencies.map((a) => [a.id, a.name])),
    [fordAuditAgencies]
  );

  useEffect(() => {
    if (role !== 'ADMIN' || activeTab !== 'ford-audit') return;
    const q = query(
      collection(db, 'investigations'),
      where('vertical', '==', 'FORD_CREDIT_MX'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setFordAuditInvestigations(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [role, activeTab]);

  useEffect(() => {
    if (role !== 'ADMIN' || activeTab !== 'ford-audit') return;
    let cancelled = false;
    (async () => {
      const q = query(collection(db, 'organizations'), where('parentOrganizationId', '==', FORD_PROGRAM_ROOT_ID));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => {
        const data = d.data() as { name?: string };
        return { id: d.id, name: data.name?.trim() || d.id };
      });
      if (!cancelled) setFordAuditAgencies(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [role, activeTab]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setSellerLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.error("Error getting seller location:", error)
      );
    }

    // Bootstrap Superadmin amarquez@juxa.mx (solo con Firebase Auth)
    const bootstrapAdmin = async () => {
      if (isLocalConstructionMode()) return;
      const adminEmail = 'amarquez@juxa.mx';
      const adminPass = 'Twn5y7788';
      try {
        const q = query(collection(db, 'users'), where('email', '==', adminEmail));
        const snap = await getDocs(q);
        if (snap.empty) {
          console.log("Bootstrapping superadmin...");
          const { secondaryAuth } = await import('../../firebase');
          const { createUserWithEmailAndPassword } = await import('firebase/auth');
          try {
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, adminEmail, adminPass);
            const uid = userCredential.user.uid;
            await setDoc(doc(db, 'users', uid), {
              uid,
              email: adminEmail,
              role: 'ADMIN',
              clientType: 'GRATUITO',
              clientProfile: 'GENERAL',
              organizationId: 'default',
              resellerId: null,
              credits: 999,
              pagaresCredits: 0,
              createdAt: new Date().toISOString()
            });
            console.log("Superadmin bootstrapped successfully.");
          } catch (authError: any) {
            if (authError.code === 'auth/email-already-in-use') {
              console.log("Admin already exists in Auth, creating Firestore profile if missing...");
              // If already in auth but not in firestore, we can't easily get the UID here without signing in
              // but the firestore.rules will still allow them as admin based on email in token.
            } else {
              console.error("Error bootstrapping admin auth:", authError);
            }
          }
        }
      } catch (e) {
        console.error("Error in bootstrapAdmin:", e);
      }
    };
    
    if (role === 'ADMIN') {
      bootstrapAdmin();
    }
  }, [role]);

  const sidebarItems = useMemo(() => {
    const sidebarItemsBase = [
      { id: 'prueba-final', label: 'Prueba Final (Envío)', icon: Send, roles: ['ADMIN', 'EJECUTIVO_VENTAS'], section: 'Operaciones' },
      { id: 'prequal', label: 'Precalificación', icon: Zap, roles: ['ADMIN', 'EJECUTIVO_VENTAS'], section: 'Operaciones' },
      { id: 'links', label: 'Generador de Enlaces', icon: Send, roles: ['ADMIN'], section: 'Operaciones' },
      { id: 'simulator', label: 'Simulador de Enlaces', icon: LinkIcon, roles: ['ADMIN'], section: 'Operaciones' },
      { id: 'lab', label: 'Laboratorio Crédito', icon: FlaskConical, roles: ['ADMIN'], section: 'Operaciones' },
      { id: 'plans', label: 'Planes de Cobro', icon: CreditCard, roles: ['ADMIN'], section: 'Operaciones' },
      { id: 'metrics', label: 'Métricas', icon: TrendingUp, roles: ['ADMIN'], section: 'Riesgo y cumplimiento' },
      { id: 'b2b', label: 'B2B / Cobranza', icon: Building2, roles: ['ADMIN'], section: 'Riesgo y cumplimiento' },
      { id: 'suppliers', label: 'Proveedores', icon: Factory, roles: ['ADMIN'], section: 'Riesgo y cumplimiento' },
      { id: 'field', label: 'Red y campo', icon: MapPin, roles: ['ADMIN'], section: 'Riesgo y cumplimiento' },
      { id: 'identity', label: 'Identidad', icon: ShieldAlert, roles: ['ADMIN'], section: 'Riesgo y cumplimiento' },
      { id: 'ford-audit', label: 'Auditoría Ford IA', icon: ClipboardList, roles: ['ADMIN'], section: 'Riesgo y cumplimiento' },
      { id: 'hr-mx', label: 'RRHH México', icon: Briefcase, roles: ['ADMIN'], section: 'Riesgo y cumplimiento' },
      { id: 'cgo', label: 'CGO AI', icon: Bot, roles: ['ADMIN'], section: 'Riesgo y cumplimiento' },
      { id: 'users', label: 'Usuarios', icon: Users, roles: ['ADMIN'], section: 'Plataforma' },
      { id: 'ia-config', label: 'Configuración IA', icon: Bot, roles: ['ADMIN'], section: 'Plataforma' },
      { id: 'saas', label: 'Onboarding / tenants', icon: Settings, roles: ['ADMIN'], section: 'Plataforma' },
    ];
    let items = sidebarItemsBase.filter((item) => {
      if (isOriginacionUser) return item.id === 'prueba-final';
      if (user?.email === 'aduarte@duarteaupartabogados.com') return true;
      return !item.roles || item.roles.includes(role || '');
    });
    const applyProductFilter =
      !menuIgnoreContract && role === 'ADMIN' && !isOriginacionUser && user?.email !== 'aduarte@duarteaupartabogados.com';
    if (applyProductFilter) {
      items = items.filter((item) => {
        const pk = TAB_PRODUCT[item.id as keyof typeof TAB_PRODUCT];
        if (pk && !hasProduct(pk)) return false;
        return true;
      });
    }
    return items;
  }, [role, user?.email, isOriginacionUser, hasProduct, menuIgnoreContract]);

  useEffect(() => {
    const ids = new Set(sidebarItems.map((i) => i.id));
    setActiveTab((prev) => {
      if (ids.has(prev)) return prev;
      const fallback = (sidebarItems[0]?.id as AdminTabId) || 'saas';
      return fallback;
    });
  }, [sidebarItems]);

  return (
    <div className="h-full min-h-0 flex flex-col px-3 sm:px-5 lg:px-6 pt-2 sm:pt-3 pb-2 sm:pb-4">
      {role === 'ADMIN' && !isOriginacionUser && (
        <AdminOrgToolbar menuIgnoreContract={menuIgnoreContract} onMenuIgnoreContractChange={setMenuIgnoreContract} />
      )}
      <DashboardLayout
        title={isOriginacionUser ? 'Panel de Originación' : (role === 'EJECUTIVO_VENTAS' ? 'Panel de Ventas' : 'Dashboard de Administración')}
        subtitle={isOriginacionUser ? 'Generación de estudios de arraigo' : (role === 'EJECUTIVO_VENTAS' ? 'Gestión de prospectos y precalificación' : 'Gestión global de la plataforma')}
        sidebarItems={sidebarItems}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as AdminTabId)}
        showFinancialComplianceAside={!isOriginacionUser && role !== 'EJECUTIVO_VENTAS'}
      >
        {activeTab === 'prueba-final' && <PruebaFinalTab sellerLocation={sellerLocation} />}
        {activeTab === 'metrics' && <MetricsTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'prequal' && <PreQualTab sellerLocation={sellerLocation} />}
        {activeTab === 'links' && <LinksTab sellerLocation={sellerLocation} />}
        {activeTab === 'lab' && <CreditLabTab sellerLocation={sellerLocation} />}
        {activeTab === 'plans' && <PlansTab />}
        {activeTab === 'simulator' && <SimulatorTab sellerLocation={sellerLocation} />}
        {activeTab === 'cgo' && <CGOEngine />}
        {activeTab === 'ia-config' && <IAConfigTab />}
        {activeTab === 'saas' && <SaaSOrgAdminPanel />}
        {activeTab === 'b2b' && <B2BWorkspaceDashboard variant="embedded" organizationIdOverride={viewOrganizationId} />}
        {activeTab === 'suppliers' && (
          <SupplierComplianceDashboard variant="embedded" organizationIdOverride={viewOrganizationId} />
        )}
        {activeTab === 'field' && (
          <FieldNetworkDashboard role="OPERADOR_RED_VISITAS" variant="embedded" organizationIdOverride={viewOrganizationId} />
        )}
        {activeTab === 'identity' && <AdminIdentityTools />}
        {activeTab === 'ford-audit' && (
          <FordAuditPeriodPanel
            investigations={fordAuditInvestigations}
            agencyLabelByOrgId={fordAuditAgencyLabels}
            variant="admin"
          />
        )}
        {activeTab === 'hr-mx' && <HRDashboard variant="embedded" />}
      </DashboardLayout>
    </div>
  );
};

const PruebaFinalTab = ({ sellerLocation }: { sellerLocation: {lat: number, lng: number} | null }) => {
  const { user, organizationId, logUserAction } = useAuthStatus();
  const { branding, organization } = useTenant();
  const primary = branding.primaryColor?.trim() || '#2563eb';
  const adminVertical = organization?.partnerVertical && organization.partnerVertical !== 'NONE'
    ? organization.partnerVertical
    : null;
  const [generatedLink, setGeneratedLink] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [candidateName, setCandidateName] = useState('');
  const [targetLocation, setTargetLocation] = useState<{lat: number, lng: number} | null>(null);
  const [targetAddress, setTargetAddress] = useState('');
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [selectedInv, setSelectedInv] = useState<any>(null);
  const [isRestarting, setIsRestarting] = useState(false);

  const handleRestartAI = async (inv: any) => {
    if (!inv.candidateData) {
      toast.error('No hay datos del candidato para analizar.');
      return;
    }
    
    setIsRestarting(true);
    try {
      const candidateData = JSON.parse(inv.candidateData);
      const urls = inv.uploadedFileUrls || {};
      
      const imageParts = [
        urls.fotoFachadaUrl || candidateData.fotoFachadaUrl,
        urls.videoFachadaUrl || candidateData.videoFachadaUrl,
        urls.fotoSalaUrl || candidateData.fotoSalaUrl,
        urls.fotoComedorUrl || candidateData.fotoComedorUrl,
        urls.fotoCocinaUrl || candidateData.fotoCocinaUrl,
        urls.fotoHabitacionUrl || candidateData.fotoHabitacionUrl,
        urls.idFrontUrl || candidateData.idFrontUrl,
        urls.idBackUrl || candidateData.idBackUrl,
        urls.proofOfAddressUrl || candidateData.proofOfAddressUrl,
        urls.selfieUrl || candidateData.selfieUrl
      ].filter(Boolean);

      // Fetch client rules if possible
      let businessRules = '';
      let scoringConfig = null;
      if (inv.clientId) {
        const clientDoc = await getDoc(doc(db, 'clients', inv.clientId));
        if (clientDoc.exists()) {
          const clientData = clientDoc.data();
          businessRules = clientData.politicasGenerales || '';
          scoringConfig = clientData.scoringConfig || null;
        }
      }

      const aiResult = await analyzeCandidateData(
        {
          perfil: inv.clientProfile || 'CREDIT',
          puesto: inv.jobProfile?.vacancy || 'No especificado',
          montoCreditoCapital: inv.montoCreditoCapital,
          montoCreditoIntereses: inv.montoCreditoIntereses,
          plazoFinanciamiento: inv.plazoFinanciamiento,
          tipoCredito: inv.tipoCredito,
          loongMontoTotal: inv.loongMontoTotal,
          loongEnganche: inv.loongEnganche,
          ...candidateData
        },
        imageParts,
        businessRules,
        'none',
        scoringConfig
      );

      const aiParsed = JSON.parse(aiResult);
      const dictamen = {
        ...aiParsed,
        congruenciaDomicilio: {
          ...(aiParsed.congruenciaDomicilio || {}),
          distanciaMetros: inv.distanceMeters || candidateData.distanceMeters || 0,
          verificado: (inv.distanceMeters || candidateData.distanceMeters || 0) < 150
        }
      };

      const updateData = {
        socioeconomicDictamen: JSON.stringify(dictamen),
        result: aiResult.includes('"estado":"VIABLE"') ? 'VIABLE' : (aiResult.includes('"estado":"REVIEW"') ? 'REVIEW' : 'NO_VIABLE'),
        status: 'COMPLETED',
        score: dictamen?.score || 0,
        scoreBreakdown: dictamen?.scoreBreakdown ? JSON.stringify(dictamen.scoreBreakdown) : null,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'investigations', inv.id), updateData);
      
      // Update selectedInv to reflect changes in modal
      setSelectedInv({ ...inv, ...updateData });
      toast.success('Análisis reiniciado con éxito');
    } catch (error: any) {
      console.error("Error restarting AI:", error);
      toast.error(`Error al reiniciar análisis: ${error.message}`);
    } finally {
      setIsRestarting(false);
    }
  };

  useEffect(() => {
    const q = query(
      collection(db, 'investigations'), 
      where('isTest', '==', true),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInvestigations(docs);
    });
    return () => unsubscribe();
  }, []);

  const autocompleteRef = useRef<any>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries
  });

  const handlePlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setTargetLocation({ lat, lng });
        if (place.formatted_address) {
          setTargetAddress(place.formatted_address);
        }
      }
    }
  };

  const handleGenerateTestLink = async () => {
    if (!candidateName.trim()) {
      alert("Por favor ingresa el nombre del solicitante.");
      return;
    }
    if (!targetLocation) {
      alert("Por favor selecciona la ubicación a investigar.");
      return;
    }
    setIsGenerating(true);
    try {
      const invId = 'test_' + Math.random().toString(36).substring(2, 10);
      // Create link
      const linkId = 'link_' + Math.random().toString(36).substring(2, 10);
      
      const investigationData = {
        id: invId,
        clientId: user?.uid || 'admin_direct',
        requestedBy: user?.uid || 'admin_direct',
        organizationId: organizationId || 'default',
        ...(adminVertical ? { vertical: adminVertical } : {}),
        status: 'PENDING',
        title: `PRUEBA FINAL: ${candidateName}`,
        clientProfile: 'CREDIT',
        investigationType: 'CREDIT',
        investigationScope: 'INTEGRAL',
        creditPipelineStage: 'PRE_QUALIFICATION',
        loongMontoTotal: null,
        loongEnganche: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByAdmin: true,
        isTest: true,
        targetLocation: targetLocation,
        targetAddress: targetAddress,
        candidateLink: linkId // Store linkId for later retrieval
      };

      await setDoc(doc(db, 'investigations', invId), investigationData);

      await setDoc(doc(db, 'candidate_links', linkId), {
        linkId,
        investigationId: invId,
        clientId: user?.uid || 'admin_direct',
        organizationId: organizationId || 'default',
        ...(adminVertical ? { vertical: adminVertical } : {}),
        clientProfile: 'CREDIT',
        investigationType: 'CREDIT',
        investigationScope: 'INTEGRAL',
        title: `PRUEBA FINAL: ${candidateName}`,
        status: 'PENDING',
        loongMontoTotal: null,
        loongEnganche: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sellerLocation: sellerLocation,
        targetLocation: targetLocation,
        targetAddress: targetAddress,
        isTest: true,
        isPreQual: true // Force pre-qual flow which has the Arraigo form
      });

      const url = `${window.location.origin}/candidate/${linkId}`;
      setGeneratedLink(url);
      
      if (logUserAction && user) {
        logUserAction(user.uid, 'GENERATE_TEST_LINK', { linkId, invId });
      }
    } catch (error) {
      console.error("Error generating test link:", error);
      alert("Error al generar enlace.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 md:space-y-6">
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/90 shadow-md shadow-slate-200/35 ring-1 ring-slate-100">
        <div className="flex items-start gap-4 mb-6">
          <div
            className="w-11 h-11 sm:w-12 sm:h-12 text-white rounded-xl flex items-center justify-center shadow-md shrink-0"
            style={{ backgroundColor: primary }}
          >
            <Send className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Prueba final — envío de enlace</h3>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              Genera un enlace para que el solicitante complete su estudio de arraigo.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">Nombre del solicitante</label>
            <input 
              type="text" 
              value={candidateName}
              onChange={e => setCandidateName(e.target.value)}
              placeholder="Ej. Juan Pérez"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50/40 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200/90 focus:border-slate-300 transition-shadow"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">Ubicación a investigar (objetivo)</label>
            {isLoaded && (
              <Autocomplete
                onLoad={ref => autocompleteRef.current = ref}
                onPlaceChanged={handlePlaceChanged}
              >
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Busca la dirección del cliente..."
                    className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl bg-slate-50/40 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200/90 focus:border-slate-300 transition-shadow"
                  />
                </div>
              </Autocomplete>
            )}
            {targetAddress && (
              <p className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Ubicación seleccionada: {targetAddress}
              </p>
            )}

            {targetLocation && (
              <div className="mt-4 h-64 w-full rounded-xl overflow-hidden border border-slate-300 z-0 relative">
                {isLoaded ? (
                  <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={targetLocation}
                    zoom={18}
                    options={{
                      streetViewControl: true,
                      mapTypeControl: false,
                      fullscreenControl: false,
                    }}
                  >
                    <Marker position={targetLocation} />
                  </GoogleMap>
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    <p className="text-slate-400 text-sm">Cargando mapa...</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <button 
            onClick={handleGenerateTestLink}
            disabled={isGenerating}
            className="w-full py-3.5 text-white rounded-xl font-semibold transition-opacity hover:opacity-95 active:opacity-90 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: primary, boxShadow: `0 4px 14px -4px ${primary}88` }}
          >
            {isGenerating ? 'Generando…' : 'Generar enlace de prueba'}
          </button>

          {generatedLink && (
            <div className="mt-8 p-6 bg-emerald-50 rounded-2xl border border-emerald-100 animate-in fade-in slide-in-from-top-4">
              <p className="text-sm font-bold text-emerald-900 mb-4 flex items-center">
                <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600" />
                Enlace Generado Exitosamente
              </p>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={generatedLink} 
                    className="flex-1 px-4 py-3 bg-white border border-emerald-200 rounded-xl text-sm text-slate-600 outline-none" 
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(generatedLink);
                      alert('Copiado al portapapeles');
                    }}
                    className="px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                  >
                    Copiar
                  </button>
                </div>
                <a 
                  href={`https://wa.me/?text=${encodeURIComponent('Hola, aquí tienes el enlace para tu estudio de arraigo: ' + generatedLink)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 bg-[#25D366] text-white rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Mail className="w-5 h-5" /> Compartir por WhatsApp
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-md shadow-slate-200/35 ring-1 ring-slate-100 overflow-hidden">
        <div className="px-5 sm:px-8 py-5 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">Historial de pruebas finales</h3>
            <p className="text-xs text-slate-500">Resultados de los dictámenes de arraigo generados.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase">
              {investigations.length} Estudios
            </span>
          </div>
        </div>
        <div className="divide-y divide-slate-200">
          {investigations.length === 0 ? (
            <div className="p-12 text-center">
              <Calculator className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500">No hay estudios de prueba registrados aún.</p>
            </div>
          ) : (
            investigations.map((inv) => (
              <div key={inv.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TEST-{inv.id.substring(5, 11)}</span>
                      {inv.candidateLink && (
                        <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          ID: {inv.candidateLink}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        inv.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                        inv.status === 'PENDING' ? 'bg-slate-200 text-slate-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {inv.status}
                      </span>
                      {inv.result && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          inv.result === 'VIABLE' ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200' : 
                          inv.result === 'REVIEW' ? 'bg-amber-500 text-white shadow-sm shadow-amber-200' :
                          'bg-red-500 text-white shadow-sm shadow-red-200'
                        }`}>
                          DICTAMEN: {inv.result === 'VIABLE' ? 'VIABLE' : inv.result === 'REVIEW' ? 'A REVISIÓN' : 'NO VIABLE'}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-900">{inv.title}</h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {inv.candidateLink && (
                    <button 
                      onClick={() => {
                        const url = `${window.location.origin}/candidate/${inv.candidateLink}`;
                        navigator.clipboard.writeText(url);
                        toast.success('Enlace copiado');
                      }}
                      className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors flex items-center gap-2"
                      title="Copiar enlace para el cliente"
                    >
                      <LinkIcon className="w-4 h-4" />
                      Copiar Enlace
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedInv(inv)}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-2"
                  >
                    <Brain className="w-4 h-4 text-blue-600" />
                    Ver Dictamen Final
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedInv && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <Brain className="w-6 h-6 text-blue-600" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">Dictamen de Arraigo IA</h3>
                    {selectedInv.candidateLink && (
                      <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        ID: {selectedInv.candidateLink}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      selectedInv.result === 'VIABLE' ? 'bg-emerald-500 text-white' : 
                      selectedInv.result === 'REVIEW' ? 'bg-amber-500 text-white' :
                      'bg-red-500 text-white'
                    }`}>
                      {selectedInv.result === 'VIABLE' ? 'VIABLE' : selectedInv.result === 'REVIEW' ? 'A REVISIÓN' : 'NO VIABLE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{selectedInv.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleRestartAI(selectedInv)}
                  disabled={isRestarting}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isRestarting ? 'animate-spin' : ''}`} />
                  {isRestarting ? 'Reiniciando...' : 'Reiniciar Análisis'}
                </button>
                <button onClick={() => setSelectedInv(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-8 overflow-y-auto flex-1">
              <AIResultRenderer 
                resultString={selectedInv.socioeconomicDictamen} 
                investigationData={selectedInv}
                onRestart={() => handleRestartAI(selectedInv)}
                isRestarting={isRestarting}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const IAConfigTab = () => {
  const [weights, setWeights] = useState({
    identity: 30,
    credit: 40,
    socioeconomic: 30
  });
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchWeights = async () => {
      try {
        const docRef = doc(db, 'settings', 'ia_weights');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setWeights({
            identity: data.identity || 30,
            credit: data.credit || 40,
            socioeconomic: data.socioeconomic || 30
          });
          if (data.geminiApiKey) setApiKey(data.geminiApiKey);
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
      await setDoc(docRef, {
        ...weights,
        geminiApiKey: apiKey
      });
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

        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 space-y-3">
          <div className="flex items-center gap-2 text-amber-800">
            <Settings className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Depuración de API Key</span>
          </div>
          <p className="text-[10px] text-amber-700">
            Si la API Key configurada en los Secretos no está siendo detectada, puedes forzar una clave aquí (se guarda solo en este navegador).
          </p>
          <div className="flex gap-2">
            <input 
              type="password"
              placeholder="Pegar API Key manualmente..."
              className="flex-1 px-3 py-2 text-xs border border-amber-200 rounded-lg outline-none focus:border-amber-400"
              onChange={(e) => {
                if (e.target.value.length > 10) {
                  localStorage.setItem('GEMINI_API_KEY_OVERRIDE', e.target.value);
                } else if (e.target.value === '') {
                  localStorage.removeItem('GEMINI_API_KEY_OVERRIDE');
                }
              }}
            />
            <button 
              onClick={() => window.location.reload()}
              className="px-3 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors"
            >
              Aplicar y Recargar
            </button>
          </div>
          <div className="text-[9px] text-amber-600 font-mono">
            Estado actual: {(() => {
              const key = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
              const override = localStorage.getItem('GEMINI_API_KEY_OVERRIDE');
              if (override) return `USANDO OVERRIDE (Longitud: ${override.length})`;
              if (key && 
                  key !== 'MY_GEMINI_API_KEY' && 
                  key !== 'undefined' && 
                  key !== '' && 
                  key !== 'process.env.GEMINI_API_KEY') return `DETECTADA EN ENTORNO (Longitud: ${key.length})`;
              return 'NO DETECTADA';
            })()}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
          <div className="text-sm">
            Total: <span className={`font-bold ${total === 100 ? 'text-emerald-600' : 'text-red-600'}`}>
              {total}%
            </span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={async () => {
                setIsSaving(true);
                setMessage('Probando conexión con Gemini...');
                try {
                  const testResultRaw = await analyzeCandidateData({
                    candidateName: "Test User",
                    direccionDeclarada: "Test Address",
                    ocupacion: "Test Job",
                    ingresoMensual: "10000",
                    gastosMensuales: "5000",
                    antiguedadVivienda: "5",
                    referencia1Nombre: "Ref 1",
                    referencia1Parentesco: "Familiar",
                    referencia2Nombre: "Ref 2",
                    referencia2Parentesco: "Amigo",
                    referenciaVecinalNombre: "Vecino",
                    justificacionDomicilio: "N/A",
                    isPreQual: true
                  }, [], "Regla de prueba", 'none', null, null);
                  
                  const testResult = JSON.parse(testResultRaw);
                  if (testResult && testResult.dictamenFinal) {
                    setMessage('✅ Conexión con Gemini EXITOSA. El modelo respondió correctamente.');
                  } else {
                    setMessage('⚠️ Conexión establecida pero la respuesta fue inesperada.');
                  }
                } catch (error: any) {
                  console.error("Error testing Gemini:", error);
                  setMessage(`❌ Error de Conexión: ${error.message || 'Error desconocido'}. Verifica tu API Key.`);
                } finally {
                  setIsSaving(false);
                }
              }}
              disabled={isSaving}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Probar Conexión IA
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving || total !== 100}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Procesando...' : 'Guardar Configuración'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const LinksTab = ({ sellerLocation }: { sellerLocation: {lat: number, lng: number} | null }) => {
  const { user, organizationId, logUserAction } = useAuthStatus();
  const { organization } = useTenant();
  const adminVertical = organization?.partnerVertical && organization.partnerVertical !== 'NONE'
    ? organization.partnerVertical
    : null;
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [linkType, setLinkType] = useState('HR');
  const [linkScope, setLinkScope] = useState('INTEGRAL');
  const [linkTitle, setLinkTitle] = useState('');
  const [loongMontoTotal, setLoongMontoTotal] = useState('');
  const [loongEnganche, setLoongEnganche] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [targetLocation, setTargetLocation] = useState<{lat: number, lng: number} | null>(null);
  const [targetAddress, setTargetAddress] = useState('');

  const autocompleteRef = useRef<any>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries
  });

  const handlePlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setTargetLocation({ lat, lng });
        if (place.formatted_address) {
          setTargetAddress(place.formatted_address);
        }
      }
    }
  };

  // New Client Modal State
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPass, setNewClientPass] = useState('');
  const [isCreatingClient, setIsCreatingClient] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const q = query(collection(db, 'users'), where('role', 'in', ['CLIENTE', 'CLIENTE_FINANCIERO']));
      const snapshot = await getDocs(q);
      const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClients(clientsData);
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientEmail || !newClientPass) return;
    setIsCreatingClient(true);
    try {
      const emailLower = newClientEmail.toLowerCase();
      let newUserId: string;
      if (isLocalConstructionMode()) {
        newUserId = localDevUidFromEmail(emailLower);
        const existing = await getDoc(doc(db, 'users', newUserId));
        if (existing.exists()) {
          alert('Ya existe un usuario local con ese correo.');
          return;
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailLower, newClientPass);
        newUserId = userCredential.user.uid;
      }

      await setDoc(doc(db, 'users', newUserId), {
        uid: newUserId,
        email: emailLower,
        role: 'CLIENTE',
        clientType: 'GRATUITO',
        clientProfile: 'CREDIT',
        credits: 10,
        organizationId: 'default',
        resellerId: null,
        createdAt: new Date().toISOString()
      });

      alert(
        isLocalConstructionMode()
          ? 'Cliente guardado en datos locales. Inicia sesión con la contraseña de desarrollo (la misma que en accesos rápidos), no con la contraseña del formulario.'
          : 'Cliente creado exitosamente.'
      );
      setIsNewClientModalOpen(false);
      setNewClientEmail('');
      setNewClientPass('');
      fetchClients();
      setSelectedClientId(newUserId);
    } catch (error: any) {
      alert('Error al crear cliente: ' + error.message);
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!selectedClientId || !linkTitle.trim()) {
      alert("Por favor selecciona un cliente e ingresa un título.");
      return;
    }
    if (!targetLocation) {
      alert("Por favor selecciona la ubicación a investigar.");
      return;
    }
    setIsGenerating(true);
    try {
      const selectedClient = clients.find(c => c.uid === selectedClientId);
      
      // Create investigation
      const invId = Math.random().toString(36).substring(2, 15);
      const investigationData = {
        id: invId,
        clientId: selectedClientId,
        requestedBy: 'admin',
        organizationId: organizationId || 'default',
        ...(adminVertical ? { vertical: adminVertical } : {}),
        status: 'PENDING',
        title: linkTitle,
        clientProfile: linkType,
        investigationType: linkType,
        investigationScope: linkType === 'CREDIT' ? linkScope : 'INTEGRAL',
        creditPipelineStage: linkType === 'CREDIT' ? 'PRE_QUALIFICATION' : undefined,
        loongMontoTotal: linkType === 'CREDIT' && loongMontoTotal ? loongMontoTotal : null,
        loongEnganche: linkType === 'CREDIT' && loongEnganche ? loongEnganche : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByAdmin: true,
        targetLocation: targetLocation,
        targetAddress: targetAddress
      };

      await setDoc(doc(db, 'investigations', invId), investigationData);

      // Create link
      const linkId = Math.random().toString(36).substring(2, 15);
      await setDoc(doc(db, 'candidate_links', linkId), {
        linkId,
        investigationId: invId,
        clientId: selectedClientId,
        organizationId: organizationId || 'default',
        ...(adminVertical ? { vertical: adminVertical } : {}),
        clientProfile: linkType,
        investigationType: linkType,
        investigationScope: linkType === 'CREDIT' ? linkScope : 'INTEGRAL',
        loongMontoTotal: linkType === 'CREDIT' && loongMontoTotal ? loongMontoTotal : null,
        loongEnganche: linkType === 'CREDIT' && loongEnganche ? loongEnganche : null,
        title: linkTitle,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sellerLocation: sellerLocation, // Store seller location for audit
        targetLocation: targetLocation,
        targetAddress: targetAddress,
        isPreQual: true
      });

      const url = `${window.location.origin}/candidate/${linkId}`;
      setGeneratedLink(url);
      
      if (logUserAction && user) {
        logUserAction(user.uid, 'ADMIN_GENERATE_CLIENT_LINK', { 
          linkId, 
          investigationId: invId, 
          clientId: selectedClientId,
          clientEmail: selectedClient?.email 
        });
      }

      alert('Enlace generado exitosamente para el cliente.');
    } catch (error) {
      console.error("Error generating client link:", error);
      alert("Error al generar enlace: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-2xl">
        <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center">
          <Send className="w-5 h-5 mr-2 text-blue-600" />
          Generador de Enlaces para Clientes
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          Genera enlaces de investigación directamente para tus clientes. El enlace podrá ser enviado al candidato final.
        </p>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-slate-700">Seleccionar Cliente</label>
              <button 
                onClick={() => setIsNewClientModalOpen(true)}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center"
              >
                <Plus className="w-3 h-3 mr-1" /> Nuevo Cliente
              </button>
            </div>
            <select 
              value={selectedClientId} 
              onChange={e => setSelectedClientId(e.target.value)} 
              className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white"
              disabled={loading}
            >
              <option value="">Selecciona un cliente...</option>
              {clients.map(c => (
                <option key={c.id} value={c.uid}>{c.email} ({c.role})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Investigación</label>
              <select value={linkType} onChange={e => setLinkType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white">
                <option value="HR">Recursos Humanos</option>
                <option value="CREDIT">Crédito</option>
                <option value="PROVIDER">Proveedores</option>
              </select>
            </div>
            {linkType === 'CREDIT' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alcance (Crédito)</label>
                <select value={linkScope} onChange={e => setLinkScope(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white">
                  <option value="BASIC">Básico (Pre-calificación)</option>
                  <option value="INTERMEDIATE">Intermedio (Mesa de Control)</option>
                  <option value="ADVANCED">Avanzado (Integral)</option>
                </select>
              </div>
            )}
          </div>

          {linkType === 'CREDIT' && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center text-blue-800 font-bold text-sm mb-2">
                <Zap className="w-4 h-4 mr-2" /> Financiamiento (opcional)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Monto Total (Capital + Intereses)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input 
                      type="number" 
                      value={loongMontoTotal} 
                      onChange={e => setLoongMontoTotal(e.target.value)} 
                      className="w-full pl-7 pr-3 py-2 border border-blue-200 rounded-lg outline-none focus:border-blue-500 bg-white text-sm"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Enganche (%)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={loongEnganche} 
                      onChange={e => setLoongEnganche(e.target.value)} 
                      className="w-full pl-3 pr-8 py-2 border border-blue-200 rounded-lg outline-none focus:border-blue-500 bg-white text-sm"
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-blue-500 italic">
                * El sistema aplicará reglas de flexibilidad si el enganche es superior al 30%.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Sujeto / Título</label>
            <input 
              type="text" 
              value={linkTitle} 
              onChange={e => setLinkTitle(e.target.value)} 
              placeholder="Ej. Juan Pérez - Crédito Personal"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500" 
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Ubicación a Investigar (Target)</label>
            {isLoaded && (
              <Autocomplete
                onLoad={ref => autocompleteRef.current = ref}
                onPlaceChanged={handlePlaceChanged}
              >
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Busca la dirección del cliente..."
                    className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </Autocomplete>
            )}
            {targetAddress && (
              <p className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Ubicación seleccionada: {targetAddress}
              </p>
            )}

            {targetLocation && (
              <div className="mt-4 h-64 w-full rounded-xl overflow-hidden border border-slate-300 z-0 relative">
                {isLoaded ? (
                  <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={targetLocation}
                    zoom={18}
                    options={{
                      streetViewControl: true,
                      mapTypeControl: false,
                      fullscreenControl: false,
                    }}
                  >
                    <Marker position={targetLocation} />
                  </GoogleMap>
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    <p className="text-slate-400 text-sm">Cargando mapa...</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <button 
            onClick={handleGenerateLink}
            disabled={isGenerating || loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isGenerating ? 'Generando...' : 'Generar y Mostrar Enlace'}
          </button>

          {generatedLink && (
            <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-sm font-bold text-emerald-900 mb-2">Enlace Generado para el Cliente:</p>
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <input type="text" readOnly value={generatedLink} className="flex-1 px-3 py-2 bg-white border border-emerald-200 rounded-lg text-sm text-slate-600 outline-none" />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(generatedLink);
                      alert('Copiado al portapapeles');
                    }}
                    className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                  >
                    Copiar
                  </button>
                </div>
                <div className="flex gap-2">
                  <a 
                    href={`https://wa.me/?text=${encodeURIComponent('Hola, aquí tienes el enlace para tu investigación: ' + generatedLink)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 px-4 py-2 bg-[#25D366] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center"
                  >
                    Compartir por WhatsApp
                  </a>
                  <a 
                    href={`mailto:?subject=Enlace de Investigación&body=${encodeURIComponent('Hola, aquí tienes el enlace para tu investigación: ' + generatedLink)}`}
                    className="flex-1 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors flex items-center justify-center"
                  >
                    Enviar por Email
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Client Modal */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Agregar Nuevo Cliente</h3>
              <button onClick={() => setIsNewClientModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateClient} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email del Cliente</label>
                <input 
                  type="email" 
                  required 
                  value={newClientEmail} 
                  onChange={e => setNewClientEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                  placeholder="cliente@empresa.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña Temporal</label>
                <input 
                  type="password" 
                  required 
                  value={newClientPass} 
                  onChange={e => setNewClientPass(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                  placeholder="••••••••"
                />
              </div>
              <button 
                type="submit" 
                disabled={isCreatingClient}
                className="w-full py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                {isCreatingClient ? 'Creando...' : 'Crear Cliente'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const CreditLabTab = ({ sellerLocation }: { sellerLocation: {lat: number, lng: number} | null }) => {
  const [labData, setLabData] = useState({
    montoSolicitado: '50000',
    ingresosMensuales: '25000',
    gastosMensuales: '12000',
    tieneDeudas: 'no',
    montoDeudas: '0',
    antiguedadLaboral: '3 años',
    tipoContrato: 'Indefinido',
    propiedadVivienda: 'Propia',
    buroCredito: 'Excelente',
    domicilioDeclarado: 'Av. Paseo de la Reforma 222, CDMX',
    ubicacionGPS: '19.4298, -99.1619', // Reforma 222
    montoCreditoCapital: '50000',
    montoCreditoIntereses: '15000',
    plazoFinanciamiento: '12 meses',
    tipoCredito: 'Personal'
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [labResult, setLabResult] = useState<string | null>(null);
  const [isFetchingGPS, setIsFetchingGPS] = useState(false);
  const [clientJourneyStep, setClientJourneyStep] = useState(0);
  const [aiProgressText, setAiProgressText] = useState('Procesando...');

  // Lab Files
  const [labFiles, setLabFiles] = useState<{
    ine: File | null;
    comprobante: File | null;
    fachada: File | null;
  }>({
    ine: null,
    comprobante: null,
    fachada: null
  });

  // Memoized Object URLs for lab files to avoid memory leaks and flickering
  const labFileUrls = useMemo(() => {
    return {
      ine: labFiles.ine ? URL.createObjectURL(labFiles.ine) : null,
      comprobante: labFiles.comprobante ? URL.createObjectURL(labFiles.comprobante) : null,
      fachada: labFiles.fachada ? URL.createObjectURL(labFiles.fachada) : null,
    };
  }, [labFiles]);

  // Clean up object URLs when component unmounts or files change
  useEffect(() => {
    return () => {
      if (labFileUrls.ine) URL.revokeObjectURL(labFileUrls.ine);
      if (labFileUrls.comprobante) URL.revokeObjectURL(labFileUrls.comprobante);
      if (labFileUrls.fachada) URL.revokeObjectURL(labFileUrls.fachada);
    };
  }, [labFileUrls]);

  const autocompleteRef = useRef<any>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries
  });

  const onPlaceChanged = () => {
    if (autocompleteRef.current !== null) {
      const place = autocompleteRef.current.getPlace();
      if (place.formatted_address) {
        setLabData(prev => ({ ...prev, domicilioDeclarado: place.formatted_address }));
      }
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setLabData(prev => ({ ...prev, ubicacionGPS: `${lat}, ${lng}` }));
      }
    }
  };

  const steps = [
    { id: 1, label: 'Validación de Identidad y Documentos', icon: UserPlus },
    { id: 2, label: 'Análisis de Arraigo (GPS vs Domicilio)', icon: MapPin },
    { id: 3, label: 'Evaluación de Capacidad y Riesgo', icon: TrendingUp },
    { id: 4, label: 'Generación de Dictamen Final', icon: FileText }
  ];

  const clientJourney = [
    { id: 1, title: 'Apertura de Enlace', desc: 'El cliente accede desde su dispositivo móvil.' },
    { id: 2, title: 'Carga de Documentos', desc: 'Sube INE y comprobante de domicilio.' },
    { id: 3, title: 'Captura de Ubicación', desc: 'El sistema valida el GPS en tiempo real.' },
    { id: 4, title: 'Formulario Económico', desc: 'Declaración de ingresos y gastos.' },
    { id: 5, title: 'Procesamiento IA', desc: 'Análisis de congruencia y arraigo.' },
    { id: 6, title: 'Dictamen Final', desc: 'Resultado de viabilidad del crédito.' }
  ];

  const getCurrentLocation = () => {
    setIsFetchingGPS(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = `${position.coords.latitude}, ${position.coords.longitude}`;
          setLabData({ ...labData, ubicacionGPS: coords });
          setIsFetchingGPS(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("No se pudo obtener la ubicación. Asegúrate de dar permisos.");
          setIsFetchingGPS(false);
        }
      );
    } else {
      alert("Geolocalización no soportada en este navegador.");
      setIsFetchingGPS(false);
    }
  };

  const handleRunLab = async (forcedScenario: string = 'none') => {
    setIsAnalyzing(true);
    setLabResult(null);
    setCurrentStep(1);
    setClientJourneyStep(1);
    
    try {
      // Simulate steps faster for better UX
      const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
      
      await delay(400);
      setClientJourneyStep(2);
      await delay(400);
      setClientJourneyStep(3);
      setCurrentStep(2);
      await delay(400);
      setClientJourneyStep(4);
      setCurrentStep(3);
      await delay(400);
      setClientJourneyStep(5);
      setCurrentStep(4);
      await delay(400);
      setClientJourneyStep(6);

      const { analyzeCandidateData } = await import('../../lib/gemini');
      
      const candidateData = {
        perfil: 'CREDIT',
        investigationScope: 'ADVANCED',
        preQualQuestions: {
          montoSolicitado: labData.montoSolicitado,
          ingresosMensuales: labData.ingresosMensuales,
          gastosMensuales: labData.gastosMensuales,
          tieneDeudas: labData.tieneDeudas,
          montoDeudas: labData.montoDeudas,
          antiguedadLaboral: labData.antiguedadLaboral,
          tipoContrato: labData.tipoContrato,
          propiedadVivienda: labData.propiedadVivienda,
          buroCredito: labData.buroCredito
        },
        location: labData.domicilioDeclarado,
        mapLocation: labData.ubicacionGPS,
        realTimeLocation: labData.ubicacionGPS,
        submittedAt: new Date().toISOString()
      };

      // Update loader text to show AI is working
      const aiSteps = [
        "Iniciando motor de auditoría...",
        "Analizando consistencia geográfica...",
        "Validando documentos vs biometría...",
        "Calculando score de riesgo subprime...",
        "Generando dictamen final..."
      ];
      
      setAiProgressText(aiSteps[0]);
      let currentAiStep = 0;
      const aiInterval = setInterval(() => {
        if (currentAiStep < aiSteps.length - 1) {
          currentAiStep++;
          setAiProgressText(aiSteps[currentAiStep]);
        }
      }, 3000);

      // Optimizar imágenes antes de enviar a la IA
      setAiProgressText("Optimizando archivos para análisis...");
      
      const safeCompress = async (file: File | null) => {
        if (!file) return null;
        try {
          return await compressImage(file, 1024);
        } catch (e) {
          console.warn("Error comprimiendo en Lab, usando original", e);
          return file;
        }
      };

      const compIne = await safeCompress(labFiles.ine);
      const compComprobante = await safeCompress(labFiles.comprobante);
      const compFachada = await safeCompress(labFiles.fachada);

      const result = await analyzeCandidateData(
        {
          ...candidateData,
          montoCreditoCapital: labData.montoCreditoCapital,
          montoCreditoIntereses: labData.montoCreditoIntereses,
          plazoFinanciamiento: labData.plazoFinanciamiento,
          tipoCredito: labData.tipoCredito,
          perfil: 'CREDIT',
          investigationScope: 'ADVANCED'
        },
        [compIne, compComprobante, compFachada].filter(f => f !== null) as File[],
        '', // businessRules
        forcedScenario, // simulationType
        null, // scoringConfig
        sellerLocation
      );

      clearInterval(aiInterval);
      setLabResult(result);
    } catch (error: any) {
      console.error("Lab Error:", error);
      alert("Error en el laboratorio: " + (error.message || "La IA tardó demasiado en responder. Por favor intenta de nuevo."));
    } finally {
      setIsAnalyzing(false);
      setCurrentStep(0);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center">
              <FlaskConical className="w-5 h-5 mr-2 text-purple-600" />
              Laboratorio de Simulación de Crédito
            </h3>
            <p className="text-sm text-slate-500">Prueba el motor de IA con escenarios reales de crédito y arraigo domiciliario.</p>
          </div>
          <button 
            onClick={() => handleRunLab()}
            disabled={isAnalyzing}
            className="px-6 py-2 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 disabled:opacity-50 flex items-center"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Analizando...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" /> Ejecutar Simulación
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => handleRunLab('positive')}
            disabled={isAnalyzing}
            className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl hover:bg-emerald-100 transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center shadow-lg shadow-emerald-200">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Auto-Viable</span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">Simulación Positiva</h4>
            <p className="text-[10px] text-slate-500 leading-tight">Carga datos ideales: ingresos altos, GPS exacto y documentos limpios.</p>
          </button>

          <button
            onClick={() => handleRunLab('consideration')}
            disabled={isAnalyzing}
            className="p-4 bg-amber-50 border border-amber-100 rounded-2xl hover:bg-amber-100 transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 bg-amber-500 text-white rounded-lg flex items-center justify-center shadow-lg shadow-amber-200">
                <AlertCircle className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">A Revisión</span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">Simulación Dudosa</h4>
            <p className="text-[10px] text-slate-500 leading-tight">Escenario con discrepancias menores en GPS e ingresos variables.</p>
          </button>

          <button
            onClick={() => handleRunLab('negative')}
            disabled={isAnalyzing}
            className="p-4 bg-red-50 border border-red-100 rounded-2xl hover:bg-red-100 transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 bg-red-500 text-white rounded-lg flex items-center justify-center shadow-lg shadow-red-200">
                <X className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Rechazo</span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">Simulación Negativa</h4>
            <p className="text-[10px] text-slate-500 leading-tight">Escenario de riesgo: GPS remoto, ingresos bajos y alertas de fraude.</p>
          </button>
        </div>

        {isAnalyzing && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Proceso Interno de Validación</h4>
              <div className="space-y-4">
                {steps.map((step) => {
                  const Icon = step.icon;
                  const isActive = currentStep === step.id;
                  const isCompleted = currentStep > step.id;
                  return (
                    <div key={step.id} className={`flex items-center gap-3 ${isActive ? 'opacity-100' : isCompleted ? 'opacity-60' : 'opacity-30'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? 'bg-purple-600 text-white animate-pulse' : isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                        {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                      </div>
                      <span className="text-[11px] font-bold text-slate-700">{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-4">Journey del Cliente (Simulado)</h4>
              <div className="space-y-3">
                {clientJourney.map((step) => {
                  const isActive = clientJourneyStep === step.id;
                  const isCompleted = clientJourneyStep > step.id;
                  return (
                    <div key={step.id} className={`flex items-start gap-3 ${isActive ? 'opacity-100' : isCompleted ? 'opacity-60' : 'opacity-30'}`}>
                      <div className={`mt-1 w-2 h-2 rounded-full ${isActive ? 'bg-blue-600 animate-ping' : isCompleted ? 'bg-blue-500' : 'bg-slate-300'}`} />
                      <div>
                        <p className="text-[11px] font-bold text-slate-900 leading-none mb-1">{step.title}</p>
                        <p className="text-[10px] text-slate-500 leading-tight">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-center bg-white rounded-xl border border-slate-200 p-4">
              <JuxaVerifyLoader text={aiProgressText} />
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Inputs Section */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Parámetros del Crédito</h4>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Capital Solicitado</label>
                  <input type="number" value={labData.montoCreditoCapital} onChange={e => setLabData({...labData, montoCreditoCapital: e.target.value, montoSolicitado: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Intereses Estimados</label>
                  <input type="number" value={labData.montoCreditoIntereses} onChange={e => setLabData({...labData, montoCreditoIntereses: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Plazo</label>
                  <input type="text" value={labData.plazoFinanciamiento} onChange={e => setLabData({...labData, plazoFinanciamiento: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Perfil Económico</h4>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Ingresos Mensuales</label>
                  <input type="number" value={labData.ingresosMensuales} onChange={e => setLabData({...labData, ingresosMensuales: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Gastos Mensuales</label>
                  <input type="number" value={labData.gastosMensuales} onChange={e => setLabData({...labData, gastosMensuales: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Buró de Crédito</label>
                  <select value={labData.buroCredito} onChange={e => setLabData({...labData, buroCredito: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                    <option>Excelente</option>
                    <option>Bueno</option>
                    <option>Regular</option>
                    <option>Malo</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prueba de Arraigo (Domicilio)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Domicilio Declarado (Texto)</label>
                  {isLoaded ? (
                    <Autocomplete
                      onLoad={autocomplete => autocompleteRef.current = autocomplete}
                      onPlaceChanged={onPlaceChanged}
                    >
                      <input 
                        type="text" 
                        value={labData.domicilioDeclarado} 
                        onChange={e => setLabData({...labData, domicilioDeclarado: e.target.value})} 
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" 
                        placeholder="Calle, Número, Colonia, CP" 
                      />
                    </Autocomplete>
                  ) : (
                    <input 
                      type="text" 
                      value={labData.domicilioDeclarado} 
                      onChange={e => setLabData({...labData, domicilioDeclarado: e.target.value})} 
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" 
                      placeholder="Calle, Número, Colonia, CP" 
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 flex justify-between">
                    Coordenadas GPS (Lat, Lng)
                    <button 
                      onClick={getCurrentLocation}
                      disabled={isFetchingGPS}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center"
                    >
                      {isFetchingGPS ? <RefreshCw className="w-2 h-2 mr-1 animate-spin" /> : <MapPin className="w-2 h-2 mr-1" />}
                      Usar mi ubicación real
                    </button>
                  </label>
                  <input type="text" value={labData.ubicacionGPS} onChange={e => setLabData({...labData, ubicacionGPS: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="19.4298, -99.1619" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic">
                * El motor comparará la dirección de texto contra las coordenadas GPS para determinar la veracidad y el arraigo del sujeto.
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Documentación de Prueba</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Identificación (INE)</label>
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <UploadCloud className={`w-6 h-6 mb-2 ${labFiles.ine ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <p className="text-[10px] text-slate-500">{labFiles.ine ? labFiles.ine.name : 'Subir INE'}</p>
                    </div>
                    <input type="file" className="hidden" onChange={e => setLabFiles({...labFiles, ine: e.target.files?.[0] || null})} />
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Comprobante Domicilio</label>
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileText className={`w-6 h-6 mb-2 ${labFiles.comprobante ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <p className="text-[10px] text-slate-500">{labFiles.comprobante ? labFiles.comprobante.name : 'Subir Comprobante'}</p>
                    </div>
                    <input type="file" className="hidden" onChange={e => setLabFiles({...labFiles, comprobante: e.target.files?.[0] || null})} />
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Foto Fachada</label>
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <ImageIcon className={`w-6 h-6 mb-2 ${labFiles.fachada ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <p className="text-[10px] text-slate-500">{labFiles.fachada ? labFiles.fachada.name : 'Subir Fachada'}</p>
                    </div>
                    <input type="file" className="hidden" onChange={e => setLabFiles({...labFiles, fachada: e.target.files?.[0] || null})} />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Results Section - Now at the bottom and full width */}
          <div className={`${labResult || isAnalyzing ? 'block' : 'hidden'} bg-slate-50 rounded-2xl border border-slate-200 p-6`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Dictamen de Auditoría IA</h4>
                  <p className="text-[10px] text-slate-500">Resultado del cruce de consistencia y análisis de riesgo</p>
                </div>
              </div>
              {labResult && (
                <button 
                  onClick={async () => {
                    const element = document.getElementById('lab-result-content');
                    if (element) {
                      const pdf = new jsPDF('p', 'mm', 'a4');
                      const pdfWidth = pdf.internal.pageSize.getWidth();
                      const pdfHeight = pdf.internal.pageSize.getHeight();

                      // Wait for all images to load
                      const images = element.getElementsByTagName('img');
                      await Promise.all(Array.from(images).map(img => {
                        if (img.complete) return Promise.resolve();
                        return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
                      }));

                      const canvas = await html2canvas(element, {
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#ffffff',
                        onclone: (clonedDoc) => {
                          const el = clonedDoc.getElementById('lab-result-content');
                          if (el) el.style.padding = '20px';
                        }
                      });

                      const imgData = canvas.toDataURL('image/jpeg', 0.95);
                      const imgProps = pdf.getImageProperties(imgData);
                      const contentHeight = (imgProps.height * pdfWidth) / imgProps.width;
                      
                      let heightLeft = contentHeight;
                      let position = 0;

                      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, contentHeight);
                      heightLeft -= pdfHeight;

                      while (heightLeft >= 0) {
                        position = heightLeft - contentHeight;
                        pdf.addPage();
                        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, contentHeight);
                        heightLeft -= pdfHeight;
                      }

                      pdf.save(`Dictamen_JUXA_LAB_${new Date().getTime()}.pdf`);
                    }
                  }}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-2 text-xs font-bold shadow-sm"
                >
                  <Download className="w-4 h-4" /> Exportar Dictamen Completo
                </button>
              )}
            </div>
            {labResult ? (
              <div id="lab-result-content" className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-5xl mx-auto">
                {/* PDF Header */}
                <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xl">JX</div>
                    <div>
                      <h1 className="text-2xl font-black text-slate-900 tracking-tight">JUXA VERIFY</h1>
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Auditoría de Crédito Subprime</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">ID Simulación</p>
                    <p className="text-sm font-mono font-bold text-slate-900">LAB-{Math.random().toString(36).substring(7).toUpperCase()}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{new Date().toLocaleString()}</p>
                  </div>
                </div>

                {/* Cross-Reference Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Cruce Geográfico</p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <p className="text-xs font-bold text-slate-700">GPS vs Domicilio Validado</p>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Cruce Documental</p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <p className="text-xs font-bold text-slate-700">INE vs Comprobante OK</p>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Riesgo Subprime</p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                      <p className="text-xs font-bold text-slate-700">Perfil Moderado</p>
                    </div>
                  </div>
                </div>

                {/* Evidence Gallery */}
                <div className="mb-8 space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center">
                    <ImageIcon className="w-4 h-4 mr-2 text-blue-600" />
                    Evidencia de Campo y Documental
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <p className="text-[9px] font-bold text-slate-400 uppercase text-center">Fachada Capturada</p>
                      <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                        {labFileUrls.fachada ? (
                          <img src={labFileUrls.fachada} alt="Fachada" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300 italic text-[10px]">Sin imagen</div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-bold text-slate-400 uppercase text-center">Street View Ref.</p>
                      <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                        <img 
                          src={`https://maps.googleapis.com/maps/api/streetview?size=400x400&location=${labData.ubicacionGPS}&key=${(import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY}`} 
                          alt="Street View" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-bold text-slate-400 uppercase text-center">Identificación (INE)</p>
                      <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                        {labFileUrls.ine ? (
                          <img src={labFileUrls.ine} alt="INE" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300 italic text-[10px]">Sin imagen</div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-bold text-slate-400 uppercase text-center">Comprobante Dom.</p>
                      <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                        {labFileUrls.comprobante ? (
                          <img src={labFileUrls.comprobante} alt="Comprobante" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300 italic text-[10px]">Sin imagen</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Analysis Result */}
                <div className="pt-6 border-t border-slate-100">
                  <AIResultRenderer resultString={labResult} />
                </div>

                {/* Footer */}
                <div className="mt-12 pt-6 border-t border-slate-100 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">JUXA LEGALTECH HUB - REPORTE CONFIDENCIAL</p>
                  <p className="text-[9px] text-slate-400 max-w-2xl mx-auto">
                    Este dictamen es una simulación generada por inteligencia artificial para fines de auditoría y prevención de fraudes en el sector subprime. 
                    La veracidad de los datos depende de los candados tecnológicos aplicados en el origen.
                  </p>
                </div>
              </div>
            ) : isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-6">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin"></div>
                  <FlaskConical className="w-8 h-8 text-purple-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="text-center">
                  <h5 className="text-lg font-bold text-slate-900 mb-2">Generando Dictamen de Auditoría...</h5>
                  <p className="text-sm text-slate-500 max-w-md mx-auto">{aiProgressText}</p>
                </div>
              </div>
            ) : null}
          </div>
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
  const [newOrganizationId, setNewOrganizationId] = useState('default');
  const [newResellerId, setNewResellerId] = useState('');
  const [newClientAccountRole, setNewClientAccountRole] = useState('');
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
  const [editOrganizationId, setEditOrganizationId] = useState('default');
  const [editResellerId, setEditResellerId] = useState('');
  const [editClientAccountRole, setEditClientAccountRole] = useState('');
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
      const emailLower = newEmail.toLowerCase();
      let newUserId: string;
      if (isLocalConstructionMode()) {
        newUserId = localDevUidFromEmail(emailLower);
        const existing = await getDoc(doc(db, 'users', newUserId));
        if (existing.exists()) {
          alert('Ya existe un usuario local con ese correo.');
          return;
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailLower, newPassword);
        newUserId = userCredential.user.uid;
      }

      await setDoc(doc(db, 'users', newUserId), {
        uid: newUserId,
        email: emailLower,
        phone: newPhone,
        role: newRole,
        clientType: newClientType,
        clientProfile: newClientProfile,
        organizationId: newOrganizationId.trim() || 'default',
        resellerId: newResellerId.trim() || null,
        credits: Number(newCredits),
        pagaresCredits: Number(newPagaresCredits),
        createdAt: new Date().toISOString(),
        ...(newClientAccountRole.trim() !== ''
          ? { clientAccountRole: newClientAccountRole.trim().toUpperCase() }
          : {}),
      });
      
      if (logUserAction && user) {
        logUserAction(user.uid, 'ADMIN_CREATE_USER', { createdUserId: newUserId, email: newEmail });
      }

      alert(
        isLocalConstructionMode()
          ? 'Usuario guardado en datos locales. Inicia sesión con la contraseña de desarrollo (accesos rápidos), no con la del formulario.'
          : 'Usuario creado exitosamente en el sistema.'
      );
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
                isManualSync: true,
                ...(newClientAccountRole.trim() !== ''
                  ? { clientAccountRole: newClientAccountRole.trim().toUpperCase() }
                  : {}),
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
    if (isLocalConstructionMode()) {
      toast('En modo local no se envían correos de Firebase. Usa la contraseña de desarrollo o crea otro usuario en la tabla.');
      return;
    }
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
        organizationId: editOrganizationId.trim() || 'default',
        resellerId: editResellerId.trim() || null,
        credits: Number(editCredits),
        pagaresCredits: Number(editPagaresCredits),
        phone: editPhone,
        updatedAt: new Date().toISOString(),
        clientAccountRole:
          editClientAccountRole.trim() === '' ? null : editClientAccountRole.trim().toUpperCase(),
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
    setEditOrganizationId(user.organizationId || 'default');
    setEditResellerId(user.resellerId || '');
    setEditClientAccountRole(
      user.clientAccountRole ? String(user.clientAccountRole).trim().toUpperCase() : ''
    );
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
              <option value="OPERADOR_CAMPO">Operador de campo</option>
              <option value="OPERADOR_RED_VISITAS">Operador red de visitas</option>
              <option value="SOLICITANTE">Solicitante</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tipo</label>
            <select value={newClientType} onChange={e => setNewClientType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 bg-white">
              <option value="GRATUITO">Gratuito</option>
              <option value="BOLSA">Bolsa</option>
              <option value="SUSCRIPCION">Suscripción</option>
              <option value="EMPRESARIAL">Empresarial (sin límite de folios)</option>
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
              <option value="INTEGRAL">Integral (firma / identidad)</option>
              <option value="B2B">B2B originación y cobranza</option>
              <option value="SUPPLIER_VALIDATION">Validación de proveedores</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">Asiento en cuenta (panel cliente)</label>
            <select
              value={newClientAccountRole}
              onChange={(e) => setNewClientAccountRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 bg-white"
            >
              <option value="">Sin definir — puede ver configuración (legacy)</option>
              <option value="OPERATIVO">Operativo — sin acceso a configuración de cuenta</option>
              <option value="GERENCIA">Gerencia</option>
              <option value="DIRECCION">Dirección</option>
              <option value="SUPERADMIN">Superadmin de cuenta (organización)</option>
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              Solo gerencia, dirección o superadmin de la organización deben ver la pestaña Configuración en el panel de cliente; asigna Operativo para el resto.
            </p>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">organizationId (tenant)</label>
            <input
              type="text"
              value={newOrganizationId}
              onChange={(e) => setNewOrganizationId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 font-mono"
              placeholder="default"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">resellerId (marca blanca, opcional)</label>
            <input
              type="text"
              value={newResellerId}
              onChange={(e) => setNewResellerId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 font-mono"
              placeholder="org padre revendedora"
            />
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
                  <option value="OPERADOR_CAMPO">Operador de campo</option>
                  <option value="OPERADOR_RED_VISITAS">Operador red de visitas</option>
                  <option value="SOLICITANTE">Solicitante</option>
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
                    <option value="EMPRESARIAL">Empresarial (sin límite de folios)</option>
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
                    <option value="INTEGRAL">Integral</option>
                    <option value="B2B">B2B</option>
                    <option value="SUPPLIER_VALIDATION">Proveedores</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Asiento en cuenta (panel cliente)</label>
                <select
                  value={editClientAccountRole}
                  onChange={(e) => setEditClientAccountRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">Sin definir — puede ver configuración (legacy)</option>
                  <option value="OPERATIVO">Operativo — sin acceso a configuración de cuenta</option>
                  <option value="GERENCIA">Gerencia</option>
                  <option value="DIRECCION">Dirección</option>
                  <option value="SUPERADMIN">Superadmin de cuenta (organización)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">organizationId</label>
                <input
                  type="text"
                  value={editOrganizationId}
                  onChange={(e) => setEditOrganizationId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">resellerId (opcional)</label>
                <input
                  type="text"
                  value={editResellerId}
                  onChange={(e) => setEditResellerId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 font-mono"
                />
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
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded-md text-slate-600">
                              {inv.investigationType}
                            </span>
                            {inv.candidateLink && (
                              <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                ID: {inv.candidateLink}
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-900">{inv.title}</h4>
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
                                  { label: 'Habitación', url: cData.fotoHabitacionUrl },
                                  { label: 'Video', url: cData.videoFachadaUrl }
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

const PreQualTab = ({ sellerLocation }: { sellerLocation: {lat: number, lng: number} | null }) => {
  const { user, role, organizationId, logUserAction } = useAuthStatus();
  const { organization } = useTenant();
  const adminVertical = organization?.partnerVertical && organization.partnerVertical !== 'NONE'
    ? organization.partnerVertical
    : null;
  const [preQualTitle, setPreQualTitle] = useState('');
  const [preQualType, setPreQualType] = useState('CREDIT');
  const [monto, setMonto] = useState('');
  const [enganche, setEnganche] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [isTestMode, setIsTestMode] = useState(false);
  
  const [preQualHistory, setPreQualHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [selectedPreQual, setSelectedPreQual] = useState<any>(null);

  useEffect(() => {
    let q = query(
      collection(db, 'investigations'),
      where('isPreQual', '==', true),
      orderBy('createdAt', 'desc')
    );

    // If not admin, only show own pre-qualifications
    if (role !== 'ADMIN' && user?.email) {
      q = query(
        collection(db, 'investigations'),
        where('isPreQual', '==', true),
        where('requestedBy', '==', user.email),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPreQualHistory(docs);
      setLoadingHistory(false);
    }, (error) => {
      console.error("Error fetching prequal history:", error);
      setLoadingHistory(false);
    });

    return () => unsubscribe();
  }, []);

  const handleGeneratePreQual = async () => {
    if (!preQualTitle.trim()) {
      alert("Por favor ingresa un nombre para el prospecto.");
      return;
    }
    setIsGenerating(true);
    try {
      const invId = `pre_${Date.now()}`;
      const linkId = `link_${Math.random().toString(36).substring(2, 15)}`;

      const investigationData = {
        id: invId,
        clientId: 'admin_direct', // Public/Direct client
        requestedBy: user?.email || 'vendedor',
        organizationId: organizationId || 'default',
        ...(adminVertical ? { vertical: adminVertical } : {}),
        status: 'PENDING',
        title: preQualTitle,
        clientProfile: preQualType,
        investigationType: preQualType,
        investigationScope: 'SIMPLE',
        creditPipelineStage: preQualType === 'CREDIT' ? 'PRE_QUALIFICATION' : undefined,
        loongMontoTotal: preQualType === 'CREDIT' && monto ? monto : null,
        loongEnganche: preQualType === 'CREDIT' && enganche ? enganche : null,
        isTestMode: isTestMode,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByAdmin: true,
        isPreQual: true,
        candidateLink: linkId // Store linkId for history access
      };

      await setDoc(doc(db, 'investigations', invId), investigationData);

      await setDoc(doc(db, 'candidate_links', linkId), {
        linkId,
        investigationId: invId,
        clientId: 'admin_direct',
        organizationId: organizationId || 'default',
        ...(adminVertical ? { vertical: adminVertical } : {}),
        clientProfile: preQualType,
        investigationType: preQualType,
        investigationScope: 'SIMPLE',
        loongMontoTotal: preQualType === 'CREDIT' && monto ? monto : null,
        loongEnganche: preQualType === 'CREDIT' && enganche ? enganche : null,
        title: preQualTitle,
        status: 'PENDING',
        isTestMode: isTestMode,
        isPreQual: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sellerLocation: sellerLocation
      });

      const url = `${window.location.origin}/candidate/${linkId}`;
      setGeneratedLink(url);
      
      if (logUserAction && user) {
        logUserAction(user.uid, 'GENERATE_PREQUAL_LINK', { linkId, type: preQualType });
      }
    } catch (error) {
      console.error("Error generating prequal link:", error);
      alert("Error al generar enlace.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReopen = async (inv: any) => {
    if (!window.confirm('¿Estás seguro de que deseas re-abrir este enlace? El candidato podrá editar su información nuevamente.')) return;
    try {
      await updateDoc(doc(db, 'investigations', inv.id), {
        status: 'OPENED',
        linkStatus: 'OPENED',
        updatedAt: new Date().toISOString()
      });
      if (inv.candidateLink) {
        await updateDoc(doc(db, 'candidate_links', inv.candidateLink), {
          status: 'OPENED',
          updatedAt: new Date().toISOString()
        });
      }
      alert('Enlace re-abierto con éxito');
    } catch (error) {
      console.error("Error re-opening link:", error);
      alert("Error al re-abrir enlace.");
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Generador de Precalificación</h3>
            <p className="text-sm text-slate-500">Crea enlaces públicos para prospectos rápidos.</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre del Prospecto</label>
            <input 
              type="text" 
              value={preQualTitle} 
              onChange={e => setPreQualTitle(e.target.value)}
              placeholder="Ej. Juan Pérez"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Producto</label>
              <select 
                value={preQualType} 
                onChange={e => setPreQualType(e.target.value)} 
                className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white transition-all"
              >
                <option value="CREDIT">Crédito</option>
                <option value="HR">Recursos Humanos</option>
              </select>
            </div>
            {preQualType === 'CREDIT' && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto total ($) — opcional</label>
                <input 
                  type="number" 
                  value={monto} 
                  onChange={e => setMonto(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all"
                />
              </div>
            )}
          </div>

          {preQualType === 'CREDIT' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Enganche (%) — opcional</label>
              <input 
                type="number" 
                value={enganche} 
                onChange={e => setEnganche(e.target.value)}
                placeholder="Ej. 30"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all"
              />
            </div>
          )}

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-900">Modo de Prueba</p>
              <p className="text-[10px] text-slate-500">Permite captura de cámara remota.</p>
            </div>
            <button 
              type="button"
              onClick={() => setIsTestMode(!isTestMode)}
              className={`w-10 h-5 rounded-full transition-colors relative ${isTestMode ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${isTestMode ? 'left-5.5' : 'left-0.5'}`} />
            </button>
          </div>

          <button 
            onClick={handleGeneratePreQual}
            disabled={isGenerating}
            className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            Generar Enlace Público
          </button>

          {generatedLink && (
            <div className="mt-6 p-5 bg-emerald-50 rounded-2xl border border-emerald-100 animate-in fade-in zoom-in">
              <p className="text-xs font-bold text-emerald-800 mb-3 uppercase tracking-wider">¡Enlace de Precalificación Listo!</p>
              <div className="flex gap-2 mb-4">
                <input type="text" readOnly value={generatedLink} className="flex-1 px-3 py-2 bg-white border border-emerald-200 rounded-lg text-xs font-mono outline-none" />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(generatedLink);
                    alert('Copiado');
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
                >
                  Copiar
                </button>
              </div>
              <div className="flex gap-2">
                <a 
                  href={`https://wa.me/?text=${encodeURIComponent('Hola, aquí tienes tu enlace de precalificación: ' + generatedLink)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2 bg-[#25D366] text-white rounded-lg text-xs font-bold text-center hover:opacity-90 transition-opacity"
                >
                  WhatsApp
                </a>
                <a 
                  href={generatedLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold text-center hover:bg-emerald-100 transition-colors"
                >
                  Abrir
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pre-qualification History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            Historial de Precalificaciones
          </h3>
        </div>
        <div className="divide-y divide-slate-200">
          {loadingHistory ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-500 text-sm">Cargando resultados...</p>
            </div>
          ) : preQualHistory.length === 0 ? (
            <div className="p-12 text-center">
              <Zap className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 text-sm">No hay precalificaciones registradas.</p>
            </div>
          ) : (
            preQualHistory.map((inv) => (
              <div key={inv.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    inv.result === 'VIABLE' ? 'bg-emerald-50 text-emerald-600' :
                    inv.result === 'REVIEW' ? 'bg-amber-50 text-amber-600' :
                    inv.result === 'NOT_VIABLE' ? 'bg-red-50 text-red-600' :
                    'bg-slate-100 text-slate-400'
                  }`}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-slate-900">{inv.title}</h4>
                      {inv.candidateLink && (
                        <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          ID: {inv.candidateLink}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        inv.result === 'VIABLE' ? 'bg-emerald-100 text-emerald-700' :
                        inv.result === 'REVIEW' ? 'bg-amber-100 text-amber-700' :
                        inv.result === 'NOT_VIABLE' ? 'bg-red-100 text-red-700' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {inv.result || 'PENDIENTE'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="font-bold text-blue-600">{inv.investigationType}</span>
                      <span>{new Date(inv.createdAt).toLocaleDateString()}</span>
                      {inv.loongMontoTotal && (
                        <span className="text-blue-700 font-bold">${Number(inv.loongMontoTotal).toLocaleString()}</span>
                      )}
                      {inv.isTestMode && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-black uppercase tracking-tighter">TEST</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {inv.candidateLink && (
                    <button 
                      onClick={() => {
                        const url = `${window.location.origin}/candidate/${inv.candidateLink}`;
                        navigator.clipboard.writeText(url);
                        alert('Enlace copiado al portapapeles');
                      }}
                      className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Copiar Enlace
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedPreQual(inv)}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                  >
                    Ver Resultado
                  </button>
                  {inv.status === 'COMPLETED' && (
                    <button 
                      onClick={() => handleReopen(inv)}
                      className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                      title="Re-abrir Enlace"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Result Modal */}
      {selectedPreQual && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg font-bold text-slate-900">Resultado de Precalificación</h3>
              </div>
              <button onClick={() => setSelectedPreQual(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8 overflow-y-auto flex-1">
              <AIResultRenderer resultString={selectedPreQual.socioeconomicDictamen} />

              {selectedPreQual.candidateData && (
                <div className="mt-8 space-y-6">
                  {(() => {
                    try {
                      const data = JSON.parse(selectedPreQual.candidateData);
                      const pq = data.preQualQuestions || {};
                      
                      const parseLocation = (locStr: string) => {
                        if (!locStr || locStr === 'No proporcionada') return null;
                        const [lat, lng] = locStr.split(',').map(s => parseFloat(s.trim()));
                        if (isNaN(lat) || isNaN(lng)) return null;
                        return { lat, lng };
                      };

                      return (
                        <>
                          <div className="space-y-4">
                            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Datos Capturados</h5>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Ingresos Totales</p>
                                <p className="text-sm font-bold text-slate-900">${(Number(pq.ingresosFijos || 0) + Number(pq.ingresosExtras || 0)).toLocaleString()}</p>
                              </div>
                              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Gastos Totales</p>
                                <p className="text-sm font-bold text-slate-900">${(Number(pq.gastosVivienda || 0) + Number(pq.gastosAlimentacion || 0) + Number(pq.gastosTransporte || 0)).toLocaleString()}</p>
                              </div>
                              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Otras Deudas</p>
                                <p className="text-sm font-bold text-slate-900">${Number(pq.otrasDeudas || 0).toLocaleString()}</p>
                              </div>
                              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Uso de Moto</p>
                                <p className="text-sm font-bold text-slate-900">{pq.usoMoto || 'N/A'}</p>
                              </div>
                              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Empresa / Puesto</p>
                                <p className="text-sm font-bold text-slate-900">{pq.empresaLaboral || 'N/A'} / {pq.puestoLaboral || 'N/A'}</p>
                              </div>
                              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Antigüedad Laboral</p>
                                <p className="text-sm font-bold text-slate-900">{pq.antiguedadLaboralAnios || '0'} años</p>
                              </div>
                              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Tiempo Residencia</p>
                                <p className="text-sm font-bold text-slate-900">{pq.tiempoResidenciaAnios || '0'} años</p>
                              </div>
                              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Zona</p>
                                <p className="text-sm font-bold text-slate-900">{pq.tipoZona || 'N/A'}</p>
                              </div>
                              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Personas en Domicilio</p>
                                <p className="text-sm font-bold text-slate-900">{pq.personasViven || 'N/A'}</p>
                              </div>
                              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Licencia</p>
                                <p className="text-sm font-bold text-slate-900">{pq.tieneLicencia || 'N/A'}</p>
                              </div>
                              <div className="p-3 bg-white border border-slate-100 rounded-xl col-span-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Referencias de Arraigo</p>
                                <div className="space-y-1 mt-1">
                                  <p className="text-xs font-bold text-slate-900">1. {pq.referencia1Nombre} ({pq.referencia1Telefono}) - {pq.referencia1Parentesco}</p>
                                  <p className="text-xs font-bold text-slate-900">2. {pq.referencia2Nombre} ({pq.referencia2Telefono}) - {pq.referencia2Parentesco}</p>
                                  <p className="text-xs font-bold text-red-600">Vecinal: {pq.referenciaVecinalNombre} ({pq.referenciaVecinalTelefono})</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Visual Evidence Section */}
                          <div className="space-y-6 pt-6 border-t border-slate-100">
                            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <ImageIcon className="w-4 h-4" />
                              Evidencia Visual y Cotejo Geográfico
                            </h5>

                            {/* Map Section */}
                            {(() => {
                              const loc = parseLocation(data.realTimeLocation);
                              if (loc) {
                                return (
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        Ubicación de Captura (GPS)
                                      </p>
                                      <span className="text-[10px] text-slate-400 font-mono">{data.realTimeLocation}</span>
                                    </div>
                                    <LocationViewer lat={loc.lat} lng={loc.lng} />
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            {/* Photos Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              {[
                                { label: 'Fachada (Abierta)', url: data.fotoFachadaUrl },
                                { label: 'Video Entrada', url: data.videoFachadaUrl, isVideo: true },
                                { label: 'Sala', url: data.fotoSalaUrl },
                                { label: 'Comedor', url: data.fotoComedorUrl },
                                { label: 'Cocina', url: data.fotoCocinaUrl },
                                { label: 'Habitación', url: data.fotoHabitacionUrl },
                                { label: 'Comprobante Domicilio', url: data.proofOfAddressUrl },
                                { label: 'INE Frente', url: data.idFrontUrl },
                                { label: 'INE Reverso', url: data.idBackUrl },
                                { label: 'Selfie', url: data.selfieUrl },
                              ].map((img, idx) => img.url && (
                                <div key={idx} className="space-y-1.5">
                                  <p className="text-[9px] font-bold text-slate-400 uppercase truncate">{img.label}</p>
                                  {img.isVideo ? (
                                    <div className="aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-900 relative group">
                                      <video 
                                        src={img.url} 
                                        className="w-full h-full object-cover"
                                        controls
                                      />
                                    </div>
                                  ) : (
                                    <div 
                                      className="aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-50 cursor-zoom-in group relative"
                                      onClick={() => window.open(img.url, '_blank')}
                                    >
                                      <img 
                                        src={img.url} 
                                        alt={img.label} 
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                                        referrerPolicy="no-referrer" 
                                      />
                                      <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-colors flex items-center justify-center">
                                        <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      );
                    } catch (e) {
                      return <p className="text-xs text-slate-400">Error al parsear datos de la investigación.</p>;
                    }
                  })()}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedPreQual(null)}
                className="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors"
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

const SimulatorTab = ({ sellerLocation }: { sellerLocation: {lat: number, lng: number} | null }) => {
  const { user, organizationId, logUserAction } = useAuthStatus();
  const { organization } = useTenant();
  const adminVertical = organization?.partnerVertical && organization.partnerVertical !== 'NONE'
    ? organization.partnerVertical
    : null;
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
        organizationId: organizationId || 'default',
        ...(adminVertical ? { vertical: adminVertical } : {}),
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
        organizationId: organizationId || 'default',
        ...(adminVertical ? { vertical: adminVertical } : {}),
        clientProfile: simType,
        investigationType: simType,
        title: simName,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sellerLocation: sellerLocation // Store seller location for audit
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
                        <div className={`p-4 rounded-xl border ${dictamen?.dictamenFinal?.estado === 'Congruente' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                          <h3 className={`text-lg font-bold mb-2 ${dictamen?.dictamenFinal?.estado === 'Congruente' ? 'text-emerald-800' : 'text-amber-800'}`}>
                            Resultado: {dictamen?.dictamenFinal?.estado || 'Revisión Manual'}
                          </h3>
                          <p className={dictamen?.dictamenFinal?.estado === 'Congruente' ? 'text-emerald-700' : 'text-amber-700'}>
                            {dictamen?.dictamenFinal?.resumen || 'Sin resumen disponible.'}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <h4 className="font-bold text-slate-900 mb-2">Ingresos y Egresos</h4>
                            <p className="text-sm text-slate-700"><span className="font-medium">Verificado:</span> {dictamen?.congruenciaIngresos?.verificado ? 'Sí' : 'No'}</p>
                            <p className="text-sm text-slate-700"><span className="font-medium">Nivel Inferido:</span> {dictamen?.congruenciaIngresos?.nivelSocioeconomicoInferido}</p>
                            <p className="text-sm text-slate-600 mt-1">{dictamen?.congruenciaIngresos?.detalles}</p>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <h4 className="font-bold text-slate-900 mb-2">Domicilio y Ubicación</h4>
                            <p className="text-sm text-slate-700"><span className="font-medium">Verificado:</span> {dictamen?.congruenciaDomicilio?.verificado ? 'Sí' : 'No'}</p>
                            <p className="text-sm text-slate-700"><span className="font-medium">Distancia:</span> {dictamen?.congruenciaDomicilio?.distanciaMetros} metros</p>
                            <p className="text-sm text-slate-600 mt-1">{dictamen?.congruenciaDomicilio?.detalles}</p>
                          </div>
                          {dictamen?.congruenciaFachadaEntorno && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 md:col-span-2">
                              <h4 className="font-bold text-slate-900 mb-2">Análisis Fachada vs Entorno</h4>
                              <p className="text-sm text-slate-700"><span className="font-medium">Verificado:</span> {dictamen?.congruenciaFachadaEntorno?.verificado ? 'Sí' : 'No'}</p>
                              <p className="text-sm text-slate-600 mt-1">{dictamen?.congruenciaFachadaEntorno?.detalles}</p>
                            </div>
                          )}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 md:col-span-2">
                            <h4 className="font-bold text-slate-900 mb-2">Análisis Documental</h4>
                            <p className="text-sm text-slate-700"><span className="font-medium">Verificado:</span> {dictamen?.analisisDocumental?.verificado ? 'Sí' : 'No'}</p>
                            <p className="text-sm text-slate-600 mt-1">{dictamen?.analisisDocumental?.detalles}</p>
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

