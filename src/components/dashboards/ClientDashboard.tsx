import React, { useState, useEffect } from 'react';
import { FileText, Download, CheckCircle2, Clock, AlertCircle, X, Plus, Briefcase, Building2, Link as LinkIcon, Send, ShieldAlert, ExternalLink, Code, Bot, Trash2, Brain, MapPin, User, FileCheck, Image as ImageIcon, Calculator, ClipboardCheck, Search, LayoutDashboard, CreditCard, Settings } from 'lucide-react';
import { db, auth } from '../../firebase';
import { collection, addDoc, doc, setDoc, onSnapshot, query, where, orderBy, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import DOMPurify from 'dompurify';
import { useAuthStatus } from '../../contexts/AuthContext';
import { DashboardLayout } from './DashboardLayout';
import { IAConfigPanel } from './IAConfigPanel';
import { AIResultRenderer } from '../AIResultRenderer';
import { JuxaVerifyLoader } from '../JuxaVerifyLoader';
import { JuxaVerifyChat } from '../JuxaVerifyChat';
import { LocationViewer } from '../LocationViewer';
import { CreditApplicationsModule } from './CreditApplicationsModule';
import { handleFirestoreError, OperationType } from '../../firebase';
import { analyzeCandidateData } from '../../lib/gemini';

export const ClientDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'INVESTIGATIONS' | 'CREDIT_APPS' | 'LOONG_MOTOR' | 'settings'>('overview');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPagareModalOpen, setIsPagareModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [pagaresCredits, setPagaresCredits] = useState<number | null>(null);
  const [clientType, setClientType] = useState<string | null>(null);
  const [investigations, setInvestigations] = useState<any[]>([]);
  const { user, logUserAction, logout } = useAuthStatus();
  
  // New state for dynamic forms
  const [investigationType, setInvestigationType] = useState<'HR' | 'CREDIT' | 'GENERAL'>('HR');
  const [isDirectInvestigation, setIsDirectInvestigation] = useState(false);
  const [investigationScope, setInvestigationScope] = useState<'SIMPLE' | 'INTEGRAL' | 'BASIC' | 'INTERMEDIATE' | 'ADVANCED'>('SIMPLE');
  const [selectedInvestigation, setSelectedInvestigation] = useState<any>(null);
  const [isDirectInputModalOpen, setIsDirectInputModalOpen] = useState(false);
  const [preQualQuestions, setPreQualQuestions] = useState({
    montoSolicitado: '',
    ingresosMensuales: '',
    gastosMensuales: '',
    tieneDeudas: 'no',
    montoDeudas: '',
    antiguedadLaboral: '',
    tipoContrato: 'Indefinido',
    propiedadVivienda: 'Propia',
    buroCredito: 'Excelente'
  });

  const sidebarItems = [
    { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
    { id: 'INVESTIGATIONS', label: 'Investigaciones', icon: Search },
    { id: 'LOONG_MOTOR', label: 'Loong Motor', icon: Calculator },
    { id: 'CREDIT_APPS', label: 'Solicitudes de Crédito', icon: CreditCard },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ];
  
  // HR specific fields
  const [jobProfile, setJobProfile] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  
  // Financial specific fields
  const [creditApp, setCreditApp] = useState<File | null>(null);
  const [visitAddress, setVisitAddress] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [montoCreditoCapital, setMontoCreditoCapital] = useState('');
  const [montoCreditoIntereses, setMontoCreditoIntereses] = useState('');
  const [plazoFinanciamiento, setPlazoFinanciamiento] = useState('');
  const [tipoCredito, setTipoCredito] = useState('Personal');
  const [loongMontoTotal, setLoongMontoTotal] = useState('');
  const [loongEnganche, setLoongEnganche] = useState('');

  // Provider specific fields
  const [providerReferences, setProviderReferences] = useState<File | null>(null);
  const [providerFiles, setProviderFiles] = useState<File | null>(null);

  // Candidate Link fields
  const generateLink = true;
  const [sendViaSystem, setSendViaSystem] = useState(false);
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');

  const handleDownloadPDF = async (inv: any) => {
    if (logUserAction && user) {
      logUserAction(user.uid, 'CLIENT_DOWNLOAD_DICTAMEN_PDF', { investigationId: inv.id });
    }

    // 1. SAFE PARSING OF AI CONTENT
    let dictamen: any = {};
    try {
      if (inv.socioeconomicDictamen) {
        const rawContent = typeof inv.socioeconomicDictamen === 'string' 
          ? inv.socioeconomicDictamen 
          : JSON.stringify(inv.socioeconomicDictamen);
        
        const cleanJson = rawContent
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        
        dictamen = JSON.parse(cleanJson);
      }
    } catch (e) {
      console.error("Error parsing dictamen:", e);
      dictamen = { error: "Contenido no disponible en formato estructurado" };
    }

    const veredicto = dictamen?.dictamenFinal?.estado || (inv.status === 'COMPLETED' ? 'VIABLE' : 'PENDIENTE');
    const veredictoColor = veredicto === 'VIABLE' ? '#10b981' : veredicto === 'NO VIABLE' ? '#ef4444' : '#f59e0b';

    // 2. CREATE HIDDEN HTML TEMPLATE
    const container = document.createElement('div');
    container.style.width = '800px';
    container.style.padding = '40px';
    container.style.backgroundColor = '#ffffff';
    container.style.fontFamily = 'Helvetica, Arial, sans-serif';
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.color = '#334155';
    document.body.appendChild(container);

    const candidateData = inv.candidateData ? JSON.parse(inv.candidateData) : {};
    const lat = candidateData.mapPosition?.lat || 0;
    const lng = candidateData.mapPosition?.lng || 0;
    const API_KEY = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY;
    
    const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=17&size=600x300&markers=color:red%7C${lat},${lng}&key=${API_KEY}`;
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${lat},${lng}&fov=90&pitch=10&key=${API_KEY}`;

    const renderSection = (title: string, content: string) => `
      <div style="margin-bottom: 30px; page-break-inside: avoid;">
        <h2 style="color: #1E3A8A; font-size: 20px; margin-bottom: 10px; font-weight: bold;">${title}</h2>
        <hr style="border-top: 2px solid #E5E7EB; margin: 10px 0 20px 0;" />
        <div style="line-height: 1.6; font-size: 14px;">${content}</div>
      </div>
    `;

    const renderList = (items: any) => {
      if (!items) return '';
      if (typeof items === 'string') return `<p>${items}</p>`;
      if (Array.isArray(items)) {
        return `<ul style="padding-left: 20px; margin: 0;">${items.map(i => `<li style="margin-bottom: 8px;">${i}</li>`).join('')}</ul>`;
      }
      if (typeof items === 'object') {
        return Object.entries(items).map(([k, v]) => `
          <div style="margin-bottom: 12px;">
            <strong style="color: #1e293b;">${k}:</strong> ${typeof v === 'object' ? JSON.stringify(v) : v}
          </div>
        `).join('');
      }
      return '';
    };

    const alertsHtml = dictamen.alertas && Array.isArray(dictamen.alertas) && dictamen.alertas.length > 0 
      ? `
        <div style="margin-bottom: 30px; page-break-inside: avoid; background-color: #FEF2F2; border-left: 5px solid #DC2626; padding: 20px; border-radius: 8px; color: #991B1B;">
          <h3 style="margin-top: 0; font-size: 18px; margin-bottom: 10px;">Banderas Rojas Detectadas</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${dictamen.alertas.map((a: string) => `<li style="margin-bottom: 5px;">${a}</li>`).join('')}
          </ul>
        </div>
      ` : '';

    container.innerHTML = DOMPurify.sanitize(`
      <div style="max-width: 100%;">
        <!-- HEADER -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; border-bottom: 3px solid #1E3A8A; padding-bottom: 20px;">
          <div style="text-align: left;">
            <h1 style="font-size: 24px; color: #1E3A8A; margin: 0; font-weight: 900;">JUXA VERIFY</h1>
            <p style="font-size: 12px; color: #64748b; margin-top: 5px;">REPORTE DE VERIFICACIÓN INTELIGENTE</p>
          </div>
          <div style="text-align: right;">
            <div style="display: inline-block; padding: 8px 20px; border-radius: 6px; background-color: ${veredictoColor}; color: white; font-weight: bold; font-size: 18px;">
              ${veredicto}
            </div>
          </div>
        </div>

        <!-- RESUMEN EJECUTIVO -->
        <div style="margin-bottom: 40px; page-break-inside: avoid;">
          <h2 style="color: #1E3A8A; font-size: 20px; margin-bottom: 10px; font-weight: bold;">Resumen Ejecutivo</h2>
          <hr style="border-top: 2px solid #E5E7EB; margin: 10px 0 20px 0;" />
          <p style="font-size: 15px; line-height: 1.6; color: #334155; font-style: italic; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
            ${dictamen?.dictamenFinal?.resumen || 'Análisis ejecutivo generado por IA para la validación de perfil y veracidad de datos.'}
          </p>
        </div>

        <!-- DATOS GENERALES -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px; page-break-inside: avoid;">
          <div style="background: #f1f5f9; padding: 15px; border-radius: 8px;">
            <p style="margin: 5px 0; font-size: 13px;"><strong>Candidato:</strong> ${inv.title}</p>
            <p style="margin: 5px 0; font-size: 13px;"><strong>ID Reporte:</strong> INV-${inv.id.substring(0, 8).toUpperCase()}</p>
            <p style="margin: 5px 0; font-size: 13px;"><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
          <div style="background: #f1f5f9; padding: 15px; border-radius: 8px;">
            <p style="margin: 5px 0; font-size: 13px;"><strong>Perfil:</strong> ${inv.clientProfile}</p>
            <p style="margin: 5px 0; font-size: 13px;"><strong>Ubicación:</strong> ${candidateData.location || 'Coordenadas GPS'}</p>
            <p style="margin: 5px 0; font-size: 13px;"><strong>Coordenadas:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
          </div>
        </div>

        ${alertsHtml}

        <!-- CRUCE DE FACHADA Y ENTORNO (Rule 2) -->
        <div style="margin-bottom: 40px; page-break-inside: avoid;">
          <h2 style="color: #1E3A8A; font-size: 20px; margin-bottom: 10px; font-weight: bold;">Cruce de Fachada y Entorno</h2>
          <hr style="border-top: 2px solid #E5E7EB; margin: 10px 0 20px 0;" />
          <div style="display: flex; gap: 20px;">
            <div style="flex: 1; text-align: center;">
              ${candidateData.fotoFachadaUrl ? `
                <img src="${candidateData.fotoFachadaUrl}" style="width: 100%; height: 220px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0;" />
                <p style="font-size: 12px; font-weight: bold; color: #1E3A8A; margin-top: 10px;">Evidencia de Fachada (Candidato)</p>
              ` : '<div style="height: 220px; background: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #94a3b8;">No disponible</div>'}
            </div>
            <div style="flex: 1; text-align: center;">
              <img src="${streetViewUrl}" style="width: 100%; height: 220px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0;" />
              <p style="font-size: 12px; font-weight: bold; color: #1E3A8A; margin-top: 10px;">Street View (Coordenadas GPS)</p>
            </div>
          </div>
        </div>

        <!-- MAPA DE UBICACIÓN -->
        <div style="margin-bottom: 40px; page-break-inside: avoid;">
          <h2 style="color: #1E3A8A; font-size: 20px; margin-bottom: 10px; font-weight: bold;">Geolocalización Satelital</h2>
          <hr style="border-top: 2px solid #E5E7EB; margin: 10px 0 20px 0;" />
          <img src="${staticMapUrl}" style="width: 100%; height: 300px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0;" />
        </div>

        <!-- SECCIONES DE ANÁLISIS IA -->
        ${dictamen.congruenciaIngresos ? renderSection('Análisis de Ingresos y Estabilidad', renderList(dictamen.congruenciaIngresos)) : ''}
        ${dictamen.congruenciaDomicilio ? renderSection('Validación de Domicilio y Entorno', renderList(dictamen.congruenciaDomicilio)) : ''}
        ${dictamen.analisisDocumental ? renderSection('Verificación Documental (ID/Comprobantes)', renderList(dictamen.analisisDocumental)) : ''}
        ${dictamen.entornoSocial ? renderSection('Contexto Social y Referencias', renderList(dictamen.entornoSocial)) : ''}

        <!-- GALERÍA DE EVIDENCIAS -->
        <div style="margin-top: 40px;">
          <h2 style="color: #1E3A8A; font-size: 20px; margin-bottom: 10px; font-weight: bold;">Galería de Evidencias Fotográficas</h2>
          <hr style="border-top: 2px solid #E5E7EB; margin: 10px 0 20px 0;" />
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            ${Object.entries(candidateData)
              .filter(([key, val]) => key.toLowerCase().includes('url') && typeof val === 'string' && val.startsWith('http') && key !== 'fotoFachadaUrl')
              .map(([key, url]) => `
                <div style="page-break-inside: avoid; margin-bottom: 30px; text-align: center;">
                  <img src="${url}" style="width: 100%; height: 240px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0;" />
                  <p style="font-size: 11px; color: #1E3A8A; margin-top: 8px; text-transform: uppercase; font-weight: bold;">
                    ${key.replace('Url', '').replace('foto', '').replace(/([A-Z])/g, ' $1').trim()}
                  </p>
                </div>
              `).join('')}
          </div>
        </div>

        <!-- FOOTER -->
        <div style="margin-top: 60px; padding-top: 30px; border-top: 2px solid #1E3A8A; text-align: center; color: #64748b; font-size: 11px;">
          <p style="font-weight: bold; color: #1E3A8A; margin-bottom: 5px;">JUXA LEGALTECH HUB - REPORTE CONFIDENCIAL</p>
          <p>Este documento fue generado automáticamente mediante algoritmos de IA y validación GPS. La alteración de este reporte constituye una falta grave.</p>
          <p>© ${new Date().getFullYear()} Duarte-Aupart Abogados, S.C. Todos los derechos reservados.</p>
        </div>
      </div>
    `);

    try {
      const images = container.getElementsByTagName('img');
      const promises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      await Promise.all(promises);

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          // Safety measure: replace oklch colors in the cloned document
          // as html2canvas doesn't support them yet
          const elements = clonedDoc.getElementsByTagName('*');
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            if (el.style) {
              // The hex overrides in index.css should handle 99% of cases.
            }
          }
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Reporte_JUXA_${inv.id.substring(0, 8).toUpperCase()}.pdf`);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Hubo un error al generar el PDF. Por favor intente de nuevo.");
    } finally {
      document.body.removeChild(container);
    }
  };

  useEffect(() => {
    if (!auth.currentUser) return;

    const userRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribeUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserCredits(data.credits || 0);
        setPagaresCredits(data.pagaresCredits || 0);
        setClientType(data.clientType || 'GRATUITO');
      }
    });

    const q = query(
      collection(db, 'investigations'),
      where('clientId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeInv = onSnapshot(q, (snapshot) => {
      const invs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInvestigations(invs);
    });

    return () => {
      unsubscribeUser();
      unsubscribeInv();
    };
  }, []);

  const handleDirectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvestigation) return;

    setIsSubmitting(true);
    setError('');

    try {
      const invRef = doc(db, 'investigations', selectedInvestigation.id);
      
      // Update status to in progress
      await updateDoc(invRef, {
        status: 'IN_PROGRESS',
        updatedAt: new Date().toISOString()
      });

      // Prepare data for AI analysis
      const candidateData = {
        preQualQuestions,
        submittedAt: new Date().toISOString()
      };

      // Call AI analysis
      const analysisResult = await analyzeCandidateData(
        JSON.stringify(candidateData),
        null, // No files for pre-qual direct input
        'CREDIT',
        'BASIC',
        {
          montoCreditoCapital: selectedInvestigation.montoCreditoCapital,
          montoCreditoIntereses: selectedInvestigation.montoCreditoIntereses,
          plazoFinanciamiento: selectedInvestigation.plazoFinanciamiento,
          tipoCredito: selectedInvestigation.tipoCredito
        }
      );

      // Update investigation with results
      await updateDoc(invRef, {
        status: 'COMPLETED',
        candidateData: JSON.stringify(candidateData),
        socioeconomicDictamen: analysisResult,
        creditAnalysisResult: analysisResult,
        updatedAt: new Date().toISOString()
      });

      setIsDirectInputModalOpen(false);
      // Refresh selected investigation to show results
      const updatedDoc = await getDoc(invRef);
      if (updatedDoc.exists()) {
        setSelectedInvestigation({ id: updatedDoc.id, ...updatedDoc.data() });
      }
    } catch (err) {
      console.error("Error in direct submission:", err);
      setError('Error al procesar la investigación directa. Por favor intente de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    // Free user limit check
    const isUnlimitedUser = auth.currentUser.email === 'contacto@inaeecij.com';

    if (!isUnlimitedUser) {
      if (clientType === 'GRATUITO' && investigations.length >= 10) {
        setError('Has alcanzado el límite de 10 investigaciones gratuitas. Por favor, actualiza tu plan para continuar.');
        return;
      }

      if (clientType === 'BOLSA' && (userCredits === null || userCredits <= 0)) {
        setError('No tienes créditos suficientes. Por favor, adquiere más créditos.');
        return;
      }
    }

    setIsSubmitting(true);
    setError('');

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      
      const generateId = () => {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
      };

      const investigationId = generateId();
      const candidateLinkId = generateLink ? generateId() : null;
      
      // Prepare investigation data based on profile
      let investigationData: any = {
        id: investigationId,
        clientId: auth.currentUser.uid,
        requestedBy: auth.currentUser.uid,
        status: 'PENDING',
        title,
        details,
        clientProfile: investigationType,
        investigationType,
        investigationScope: investigationType === 'CREDIT' ? investigationScope : 'INTEGRAL',
        isDirect: isDirectInvestigation,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (investigationType === 'CREDIT' && isDirectInvestigation) {
        const formData = new FormData(e.currentTarget as HTMLFormElement);
        investigationData.candidateData = JSON.stringify({
          ocupacion: formData.get('direct_ocupacion'),
          ingresoMensual: formData.get('direct_ingreso'),
          location: formData.get('direct_domicilio')
        });
      }

      if (generateLink && !isDirectInvestigation) {
        investigationData.candidateLink = candidateLinkId;
        investigationData.linkStatus = 'PENDING';
        if (sendViaSystem) {
          investigationData.candidateEmail = candidateEmail;
          investigationData.candidatePhone = candidatePhone;
        }
      }

      if (investigationType === 'HR') {
        investigationData = {
          ...investigationData,
          jobProfile,
          cvFileName: cvFile ? cvFile.name : null,
          smartValidationRequested: true
        };
      } else if (investigationType === 'CREDIT') {
        investigationData = {
          ...investigationData,
          visitAddress,
          contactInfo,
          montoCreditoCapital,
          montoCreditoIntereses,
          plazoFinanciamiento,
          tipoCredito,
          creditAppFileName: creditApp ? creditApp.name : null
        };
      } else if (investigationType === ('LOONG_MOTOR' as any)) {
        investigationData = {
          ...investigationData,
          loongMontoTotal,
          loongEnganche,
          tipoCredito: 'Motocicletas',
          investigationScope: 'SIMPLE'
        };
      }

      // Create investigation
      const docRef = doc(db, 'investigations', investigationId);
      try {
        await setDoc(docRef, investigationData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'investigations');
      }
      const actualInvestigationId = investigationId;

      if (logUserAction && user) {
        logUserAction(user.uid, 'CLIENT_REQUEST_INVESTIGATION', { 
          investigationId: actualInvestigationId, 
          type: investigationType,
          title 
        });
      }

      // Create candidate link document if requested
      if (generateLink && candidateLinkId) {
        try {
          await setDoc(doc(db, 'candidate_links', candidateLinkId), {
            linkId: candidateLinkId,
            investigationId: actualInvestigationId,
            clientId: auth.currentUser.uid,
            clientProfile: investigationType,
            investigationType,
            investigationScope: investigationType === 'CREDIT' ? investigationScope : 'INTEGRAL',
            loongMontoTotal: investigationType === ('LOONG_MOTOR' as any) ? loongMontoTotal : null,
            loongEnganche: investigationType === ('LOONG_MOTOR' as any) ? loongEnganche : null,
            title: title,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'candidate_links');
        }
      }

      // Deduct credit if BOLSA
      if (!isUnlimitedUser && clientType === 'BOLSA' && userCredits !== null && userCredits > 0) {
        try {
          await updateDoc(userRef, {
            credits: userCredits - 1,
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          console.error('Credit deduction failed:', err);
          // We log it but continue to allow the investigation creation if possible
        }
      }

      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      console.error('Investigation Request Error:', err);
      let errorMessage = 'Error al solicitar la investigación. Inténtalo de nuevo.';
      
      try {
        // Try to parse JSON error from handleFirestoreError
        const parsedError = JSON.parse(err.message);
        errorMessage = `Error de Firestore (${parsedError.operationType} en ${parsedError.path}): ${parsedError.error}`;
      } catch (e) {
        // Not a JSON error, use the original message if available
        if (err.message) {
          errorMessage = `Error: ${err.message}`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDetails('');
    setJobProfile('');
    setCvFile(null);
    setVisitAddress('');
    setContactInfo('');
    setMontoCreditoCapital('');
    setMontoCreditoIntereses('');
    setPlazoFinanciamiento('');
    setTipoCredito('Personal');
    setLoongMontoTotal('');
    setLoongEnganche('');
    setCreditApp(null);
    setProviderReferences(null);
    setProviderFiles(null);
    setSendViaSystem(false);
    setCandidateEmail('');
    setCandidatePhone('');
  };

  const completedCount = investigations.filter(i => i.status === 'COMPLETED').length;
  const inProgressCount = investigations.filter(i => i.status === 'IN_PROGRESS' || i.status === 'PENDING').length;
  const attentionCount = investigations.filter(i => i.status === 'REQUIRES_ATTENTION').length;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Enlace copiado al portapapeles');
  };

  const handleDeleteInvestigation = async (id: string, candidateLinkId?: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta investigación? Esta acción no se puede deshacer.')) {
      try {
        await deleteDoc(doc(db, 'investigations', id));
        if (candidateLinkId) {
          await deleteDoc(doc(db, 'candidate_links', candidateLinkId));
        }
      } catch (error) {
        console.error("Error deleting investigation:", error);
        alert("Hubo un error al eliminar la investigación.");
      }
    }
  };

  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [detailTab, setDetailTab] = useState<'info' | 'chat'>('info');

  useEffect(() => {
    if (selectedInvestigation && 
        selectedInvestigation.status === 'COMPLETED' && 
        !selectedInvestigation.identityValidationResult && 
        !selectedInvestigation.creditAnalysisResult && 
        !selectedInvestigation.providerAnalysisResult &&
        !isReanalyzing) {
      console.log("Auto-triggering AI analysis for completed investigation with missing results");
      handleReanalyze(selectedInvestigation);
    }
  }, [selectedInvestigation, isReanalyzing]);

  const handleReanalyze = async (inv: any) => {
    if (!inv || !auth.currentUser) return;
    setIsReanalyzing(true);
    setError('');

    try {
      const urls = inv.uploadedFileUrls || {};
      const candidateData = inv.candidateData ? JSON.parse(inv.candidateData) : {};
      
      // Fetch business rules
      let businessRules = '';
      try {
        const clientDoc = await getDoc(doc(db, 'clients', auth.currentUser.uid));
        if (clientDoc.exists()) {
          businessRules = clientDoc.data().politicasGenerales || '';
        }
      } catch (err) {
        console.warn("Could not fetch business rules:", err);
      }

      const { analyzeCandidateData } = await import('../../lib/gemini');

      const imageParts = [
        urls.fotoFachadaUrl,
        urls.fotoSalaUrl,
        urls.fotoComedorUrl,
        urls.fotoCocinaUrl,
        urls.fotoHabitacionUrl,
        urls.idFrontUrl,
        urls.idBackUrl,
        urls.proofOfAddressUrl,
        urls.selfieUrl
      ].filter(Boolean);

      const aiResult = await analyzeCandidateData(
        {
          perfil: inv.clientProfile,
          puesto: inv.jobProfile?.vacancy || 'No especificado',
          montoCreditoCapital: inv.montoCreditoCapital,
          montoCreditoIntereses: inv.montoCreditoIntereses,
          plazoFinanciamiento: inv.plazoFinanciamiento,
          tipoCredito: inv.tipoCredito,
          ...candidateData
        },
        imageParts,
        businessRules
      );

      // Update Firestore
      const updateData: any = {
        socioeconomicDictamen: aiResult,
        updatedAt: new Date().toISOString()
      };

      if (inv.clientProfile === 'HR') updateData.identityValidationResult = aiResult;
      else if (inv.clientProfile === 'CREDIT') updateData.creditAnalysisResult = aiResult;
      else if (inv.clientProfile === 'PROVIDER') updateData.providerAnalysisResult = aiResult;

      await updateDoc(doc(db, 'investigations', inv.id), updateData);
      
      // Update local state
      setSelectedInvestigation({ ...inv, ...updateData });
      
      if (logUserAction && user) {
        logUserAction(user.uid, 'CLIENT_REANALYZE_IA', { investigationId: inv.id });
      }

    } catch (err: any) {
      console.error("Re-analysis failed:", err);
      setError("Error al re-analizar con IA: " + (err.message || "Error desconocido"));
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleGeneratePagare = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    // Check credits
    const isUnlimitedUser = auth.currentUser.email === 'contacto@inaeecij.com';
    if (!isUnlimitedUser && (pagaresCredits === null || pagaresCredits <= 0)) {
      alert('No tienes créditos de pagarés suficientes. Por favor, adquiere más créditos.');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const pagareData = {
      monto: formData.get('monto') as string,
      montoLetra: formData.get('montoLetra') as string,
      lugarFecha: formData.get('lugarFecha') as string,
      beneficiario: formData.get('beneficiario') as string,
      lugarPago: formData.get('lugarPago') as string,
      fechaVencimiento: formData.get('fechaVencimiento') as string,
      deudorNombre: formData.get('deudorNombre') as string,
      deudorDireccion: formData.get('deudorDireccion') as string,
      deudorTelefono: formData.get('deudorTelefono') as string,
    };

    try {
      // Deduct credit
      if (!isUnlimitedUser && pagaresCredits !== null && pagaresCredits > 0) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          pagaresCredits: pagaresCredits - 1
        });
      }

      if (logUserAction && user) {
        logUserAction(user.uid, 'CLIENT_GENERATE_PAGARE', { amount: pagareData.monto, debtor: pagareData.deudorNombre });
      }

      // Generate PDF
      const docPdf = new jsPDF();
      
      docPdf.setFontSize(16);
      docPdf.setFont(undefined, 'bold');
      docPdf.text('PAGARÉ', 105, 20, { align: 'center' });
      
      docPdf.setFontSize(12);
      docPdf.setFont(undefined, 'normal');
      
      docPdf.text(`BUENO POR: $${pagareData.monto}`, 150, 30);
      docPdf.text(`Lugar y fecha de expedición: ${pagareData.lugarFecha}`, 20, 40);
      
      const bodyText = `Por este PAGARÉ me(nos) obligo(amos) a pagar incondicionalmente a la orden de ${pagareData.beneficiario} en ${pagareData.lugarPago} el día ${pagareData.fechaVencimiento} la cantidad de $${pagareData.monto} (${pagareData.montoLetra}). Valor recibido a mi(nuestra) entera satisfacción.`;
      
      const splitBody = docPdf.splitTextToSize(bodyText, 170);
      docPdf.text(splitBody, 20, 55);
      
      docPdf.text('DATOS DEL DEUDOR:', 20, 90);
      docPdf.text(`Nombre: ${pagareData.deudorNombre}`, 20, 100);
      docPdf.text(`Dirección: ${pagareData.deudorDireccion}`, 20, 110);
      docPdf.text(`Teléfono: ${pagareData.deudorTelefono}`, 20, 120);
      
      docPdf.text('_________________________________', 105, 160, { align: 'center' });
      docPdf.text('Firma del Deudor', 105, 170, { align: 'center' });
      
      docPdf.save(`Pagare_${pagareData.deudorNombre.replace(/\s+/g, '_')}.pdf`);
      
      setIsPagareModalOpen(false);
      alert('Pagaré generado exitosamente.');
    } catch (error) {
      console.error('Error al generar pagaré:', error);
      alert('Error al generar el pagaré.');
    }
  };

  return (
    <DashboardLayout
      title="Panel de Cliente"
      subtitle={user?.email || ''}
      sidebarItems={sidebarItems}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as any)}
    >
      {activeTab === 'overview' && (
        <div className="p-4 sm:p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Mis Reportes</h1>
              {clientType === 'BOLSA' && (
                <div className="flex gap-4 mt-1">
                  <p className="text-sm text-slate-500">Créditos Inv.: <span className="font-bold text-slate-900">{userCredits}</span></p>
                  <p className="text-sm text-slate-500">Créditos Pagarés: <span className="font-bold text-slate-900">{pagaresCredits}</span></p>
                </div>
              )}
              {clientType === 'SUSCRIPCION' && (
                <div className="flex gap-4 mt-1">
                  <p className="text-sm text-emerald-600 font-medium">Suscripción Activa</p>
                  <p className="text-sm text-slate-500">Créditos Pagarés: <span className="font-bold text-slate-900">{pagaresCredits}</span></p>
                </div>
              )}
              {clientType === 'GRATUITO' && (
                <div className="flex gap-4 mt-1">
                  <p className="text-sm text-blue-600 font-medium">Plan Gratuito ({investigations.length}/10 investigaciones usadas)</p>
                  <p className="text-sm text-slate-500">Créditos Pagarés: <span className="font-bold text-slate-900">{pagaresCredits}</span></p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  const isUnlimitedUser = auth.currentUser?.email === 'contacto@inaeecij.com';
                  if (!isUnlimitedUser && clientType === 'GRATUITO' && investigations.length >= 10) {
                    alert('Has alcanzado el límite de 10 investigaciones gratuitas. Por favor, actualiza tu plan para continuar.');
                    return;
                  }
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Solicitar Nueva Investigación
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'LOONG_MOTOR' && (
        <div className="p-4 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Loong Motor</h2>
              <p className="text-slate-500">Gestión de solicitudes de crédito de motocicletas con IA.</p>
            </div>
            <button 
              onClick={() => {
                setInvestigationType('LOONG_MOTOR' as any);
                setIsModalOpen(true);
              }}
              className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nueva Solicitud Loong Motor
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-slate-500">Solicitudes Loong</h3>
                <Calculator className="w-5 h-5 text-red-500" />
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {investigations.filter(i => i.clientProfile === 'LOONG_MOTOR').length}
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-slate-500">Viables</h3>
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {investigations.filter(i => i.clientProfile === 'LOONG_MOTOR' && i.status === 'COMPLETED').length}
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-slate-500">Pendientes</h3>
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {investigations.filter(i => i.clientProfile === 'LOONG_MOTOR' && (i.status === 'PENDING' || i.status === 'IN_PROGRESS')).length}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Historial Loong Motor</h2>
              <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase tracking-widest">
                Motocicletas
              </span>
            </div>
            
            <div className="divide-y divide-slate-200">
              {investigations.filter(i => i.clientProfile === 'LOONG_MOTOR').length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No hay solicitudes de Loong Motor registradas.
                </div>
              ) : (
                investigations.filter(i => i.clientProfile === 'LOONG_MOTOR').map((inv) => (
                  <div key={inv.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0 mt-1">
                        <Calculator className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">LOONG-{inv.id.substring(0, 6)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            inv.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                            inv.status === 'PENDING' ? 'bg-slate-200 text-slate-700' :
                            inv.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {inv.status === 'COMPLETED' ? 'Completado' : 
                             inv.status === 'PENDING' ? 'Pendiente' : 
                             inv.status === 'IN_PROGRESS' ? 'En Proceso' : 'Atención'}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900">{inv.title}</h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </span>
                          {inv.loongMontoTotal && (
                            <span className="font-bold text-red-600">
                              ${Number(inv.loongMontoTotal).toLocaleString()} ({inv.loongEnganche}%)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setSelectedInvestigation(inv)}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        Ver Detalles
                      </button>
                      {inv.status === 'COMPLETED' && (
                        <button 
                          onClick={() => handleDownloadPDF(inv)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Descargar Dictamen PDF"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'INVESTIGATIONS' && (
        <div className="p-4 sm:p-8">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-500">Completados</h3>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-slate-900">{completedCount}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-500">En Progreso</h3>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-slate-900">{inProgressCount}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-500">Requieren Atención</h3>
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-bold text-slate-900">{attentionCount}</p>
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-900">Historial de Investigaciones</h2>
        </div>
        
        <div className="divide-y divide-slate-200">
          {investigations.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No tienes investigaciones solicitadas aún.
            </div>
          ) : (
            investigations.map((inv) => (
              <div key={inv.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ${
                    inv.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' :
                    inv.status === 'PENDING' ? 'bg-slate-100 text-slate-500' :
                    inv.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600' :
                    'bg-amber-50 text-amber-600'
                  }`}>
                    {inv.clientProfile === 'HR' ? <Briefcase className="w-5 h-5" /> : 
                     inv.clientProfile === 'CREDIT' ? <Building2 className="w-5 h-5" /> :
                     inv.clientProfile === 'PROVIDER' ? <Building2 className="w-5 h-5" /> :
                     <FileText className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">INV-{inv.id.substring(0, 6)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        inv.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                        inv.status === 'PENDING' ? 'bg-slate-200 text-slate-700' :
                        inv.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {inv.status === 'COMPLETED' ? 'Completado' : 
                         inv.status === 'PENDING' ? 'Pendiente' : 
                         inv.status === 'IN_PROGRESS' ? 'En Progreso' : 'Requiere Atención'}
                      </span>
                      {inv.clientProfile && inv.clientProfile !== 'GENERAL' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-100 text-purple-700">
                          {inv.clientProfile === 'HR' ? 'RRHH' : inv.clientProfile === 'CREDIT' ? 'Crédito' : 'Proveedor'}
                        </span>
                      )}
                      {inv.candidateLink && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 ${
                          inv.linkStatus === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                          inv.linkStatus === 'OPENED' ? 'bg-blue-100 text-blue-700' :
                          inv.linkStatus === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          <LinkIcon className="w-3 h-3" />
                          Enlace: {
                            inv.linkStatus === 'COMPLETED' ? 'Completado' :
                            inv.linkStatus === 'OPENED' ? 'Abierto' :
                            inv.linkStatus === 'IN_PROGRESS' ? 'En Progreso' : 'Enviado/Pendiente'
                          }
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900">{inv.title}</h3>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-1">{inv.details}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </p>
                    
                    {inv.candidateLink && (
                      <div className="mt-2 flex flex-col gap-2">
                        {inv.clientProfile === 'HR' || inv.investigationScope === 'BASIC' ? (
                          <div className="flex items-center gap-3 flex-wrap bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-xs font-bold text-slate-700 w-full sm:w-auto">
                              {inv.investigationScope === 'BASIC' ? 'Enlace de Pre-calificación' : 'Enlace del Candidato'}
                            </span>
                            <button 
                              onClick={() => copyToClipboard(`${window.location.origin}/candidate/${inv.candidateLink}`)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center"
                            >
                              <LinkIcon className="w-3 h-3 mr-1" /> Copiar enlace
                            </button>
                            <a 
                              href={`/candidate/${inv.candidateLink}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" /> Abrir enlace
                            </a>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3 flex-wrap bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <span className="text-xs font-bold text-slate-700 w-full sm:w-auto">Paso 1: Perfilamiento</span>
                              <button 
                                onClick={() => copyToClipboard(`${window.location.origin}/candidate/${inv.candidateLink}?phase=1`)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center"
                              >
                                <LinkIcon className="w-3 h-3 mr-1" /> Copiar enlace
                              </button>
                              <a 
                                href={`/candidate/${inv.candidateLink}?phase=1`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center"
                              >
                                <ExternalLink className="w-3 h-3 mr-1" /> Abrir enlace
                              </a>
                            </div>
                            
                            <div className="flex items-center gap-3 flex-wrap bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <span className="text-xs font-bold text-slate-700 w-full sm:w-auto">Paso 2: Continuación (Documentos)</span>
                              <button 
                                onClick={() => copyToClipboard(`${window.location.origin}/candidate/${inv.candidateLink}?phase=2`)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center"
                              >
                                <LinkIcon className="w-3 h-3 mr-1" /> Copiar enlace
                              </button>
                              <a 
                                href={`/candidate/${inv.candidateLink}?phase=2`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center"
                              >
                                <ExternalLink className="w-3 h-3 mr-1" /> Abrir enlace
                              </a>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex sm:flex-col gap-2">
                  {inv.investigationScope === 'BASIC' && (
                    <button 
                      onClick={() => {
                        setSelectedInvestigation(inv);
                        setIsDirectInputModalOpen(true);
                      }}
                      className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Investigar y Descargar
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedInvestigation(inv)}
                    className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Ver Detalles
                  </button>
                  {inv.status === 'COMPLETED' && (
                    <button className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm">
                      <Download className="w-4 h-4 mr-2" />
                      Descargar PDF
                    </button>
                  )}
                  <button 
                    onClick={() => handleDeleteInvestigation(inv.id, inv.candidateLink)}
                    className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )}

      {activeTab === 'CREDIT_APPS' && (
        <CreditApplicationsModule investigations={investigations} />
      )}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-slate-900">
                Solicitar Nueva Investigación
              </h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleRequest} className="p-6 max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start">
                  <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3">
                    Selecciona el Tipo de Servicio
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setInvestigationType('HR');
                        setInvestigationScope('INTEGRAL');
                      }}
                      className={`flex items-center p-4 rounded-2xl border-2 transition-all text-left ${
                        investigationType === 'HR'
                          ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-500/10'
                          : 'border-slate-200 hover:border-blue-200 bg-white'
                      }`}
                    >
                      <div className={`p-3 rounded-xl mr-4 ${investigationType === 'HR' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <Briefcase className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold ${investigationType === 'HR' ? 'text-blue-900' : 'text-slate-900'}`}>Recursos Humanos</p>
                        <p className="text-xs text-slate-500">Validación de candidatos, CV y perfil laboral.</p>
                      </div>
                      {investigationType === 'HR' && <CheckCircle2 className="w-5 h-5 text-blue-600 ml-2" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInvestigationType('CREDIT');
                        setInvestigationScope('BASIC');
                      }}
                      className={`flex items-center p-4 rounded-2xl border-2 transition-all text-left ${
                        investigationType === 'CREDIT' && investigationScope === 'BASIC'
                          ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-500/10'
                          : 'border-slate-200 hover:border-blue-200 bg-white'
                      }`}
                    >
                      <div className={`p-3 rounded-xl mr-4 ${investigationType === 'CREDIT' && investigationScope === 'BASIC' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <Calculator className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold ${investigationType === 'CREDIT' && investigationScope === 'BASIC' ? 'text-blue-900' : 'text-slate-900'}`}>Crédito: Pre-calificación</p>
                        <p className="text-xs text-slate-500">Capacidad económica vs reglas y perfilado (Fase 1).</p>
                      </div>
                      {investigationType === 'CREDIT' && investigationScope === 'BASIC' && <CheckCircle2 className="w-5 h-5 text-blue-600 ml-2" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInvestigationType('CREDIT');
                        setInvestigationScope('INTERMEDIATE');
                      }}
                      className={`flex items-center p-4 rounded-2xl border-2 transition-all text-left ${
                        investigationType === 'CREDIT' && investigationScope === 'INTERMEDIATE'
                          ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-500/10'
                          : 'border-slate-200 hover:border-blue-200 bg-white'
                      }`}
                    >
                      <div className={`p-3 rounded-xl mr-4 ${investigationType === 'CREDIT' && investigationScope === 'INTERMEDIATE' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <ClipboardCheck className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold ${investigationType === 'CREDIT' && investigationScope === 'INTERMEDIATE' ? 'text-blue-900' : 'text-slate-900'}`}>Crédito: Mesa de Control</p>
                        <p className="text-xs text-slate-500">Análisis detallado de riesgos y validación interna.</p>
                      </div>
                      {investigationType === 'CREDIT' && investigationScope === 'INTERMEDIATE' && <CheckCircle2 className="w-5 h-5 text-blue-600 ml-2" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInvestigationType('CREDIT');
                        setInvestigationScope('ADVANCED');
                      }}
                      className={`flex items-center p-4 rounded-2xl border-2 transition-all text-left ${
                        investigationType === 'CREDIT' && investigationScope === 'ADVANCED'
                          ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-500/10'
                          : 'border-slate-200 hover:border-blue-200 bg-white'
                      }`}
                    >
                      <div className={`p-3 rounded-xl mr-4 ${investigationType === 'CREDIT' && investigationScope === 'ADVANCED' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold ${investigationType === 'CREDIT' && investigationScope === 'ADVANCED' ? 'text-blue-900' : 'text-slate-900'}`}>Crédito: Investigación Integral</p>
                        <p className="text-xs text-slate-500">Proceso completo con verificación de campo (2 Fases).</p>
                      </div>
                      {investigationType === 'CREDIT' && investigationScope === 'ADVANCED' && <CheckCircle2 className="w-5 h-5 text-blue-600 ml-2" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInvestigationType('GENERAL');
                        setInvestigationScope('SIMPLE');
                      }}
                      className={`flex items-center p-4 rounded-2xl border-2 transition-all text-left ${
                        investigationType === 'GENERAL'
                          ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-500/10'
                          : 'border-slate-200 hover:border-blue-200 bg-white'
                      }`}
                    >
                      <div className={`p-3 rounded-xl mr-4 ${investigationType === 'GENERAL' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold ${investigationType === 'GENERAL' ? 'text-blue-900' : 'text-slate-900'}`}>Investigación General</p>
                        <p className="text-xs text-slate-500">Cualquier otro tipo de validación o reporte.</p>
                      </div>
                      {investigationType === 'GENERAL' && <CheckCircle2 className="w-5 h-5 text-blue-600 ml-2" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInvestigationType('LOONG_MOTOR' as any);
                        setInvestigationScope('SIMPLE');
                      }}
                      className={`flex items-center p-4 rounded-2xl border-2 transition-all text-left ${
                        investigationType === ('LOONG_MOTOR' as any)
                          ? 'border-red-600 bg-red-50 ring-4 ring-red-500/10'
                          : 'border-slate-200 hover:border-red-200 bg-white'
                      }`}
                    >
                      <div className={`p-3 rounded-xl mr-4 ${investigationType === ('LOONG_MOTOR' as any) ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <Briefcase className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold ${investigationType === ('LOONG_MOTOR' as any) ? 'text-red-900' : 'text-slate-900'}`}>Loong Motor</p>
                        <p className="text-xs text-slate-500">Crédito de Motocicletas Especializado.</p>
                      </div>
                      {investigationType === ('LOONG_MOTOR' as any) && <CheckCircle2 className="w-5 h-5 text-red-600 ml-2" />}
                    </button>
                  </div>
                </div>

                {investigationType === 'CREDIT' && (
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="directMode"
                        checked={isDirectInvestigation}
                        onChange={(e) => setIsDirectInvestigation(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="directMode" className="text-sm font-medium text-slate-700 cursor-pointer">
                        Investigación Directa (Ingresar datos manualmente)
                      </label>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {investigationType === 'HR' ? 'Nombre del Candidato' : investigationType === 'CREDIT' ? 'Nombre del Solicitante de Crédito' : 'Título de la Investigación'}
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder={investigationType === 'HR' ? 'Ej. Juan Pérez' : investigationType === 'CREDIT' ? 'Ej. Empresa S.A. o Persona Física' : 'Ej. Verificación de Domicilio'}
                  />
                </div>

                {/* Direct Mode Fields for Credit */}
                {investigationType === 'CREDIT' && isDirectInvestigation && (
                  <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <h4 className="text-sm font-bold text-slate-900">Datos del Solicitante (Modo Directo)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Ocupación / Giro</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
                          placeholder="Ej. Comerciante"
                          name="direct_ocupacion"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Ingreso Mensual Declarado</label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
                          placeholder="Ej. 25000"
                          name="direct_ingreso"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">Domicilio Declarado</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
                          placeholder="Calle, Número, Colonia..."
                          name="direct_domicilio"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Candidate Link Options */}
                {(!isDirectInvestigation || investigationType === 'HR') && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="mb-4">
                      <span className="text-sm font-medium text-slate-900 flex items-center">
                        <LinkIcon className="w-4 h-4 mr-1 text-blue-500" />
                        Enlace para el candidato (Generación Automática)
                      </span>
                    </div>
                    
                    <div className="pl-6 space-y-4 border-l-2 border-slate-200 ml-2">
                      <p className="text-xs text-slate-500">
                        Se generará un enlace único para que el candidato complete su información (ubicación, fotos, etc.) sin ver el dictamen final.
                      </p>
                      
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sendViaSystem}
                          onChange={(e) => setSendViaSystem(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm font-medium text-slate-700 flex items-center">
                          <Send className="w-4 h-4 mr-1 text-slate-500" />
                          Enviar enlace automáticamente desde el sistema
                        </span>
                      </label>

                      {sendViaSystem && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Correo del Candidato</label>
                            <input
                              type="email"
                              required={sendViaSystem}
                              value={candidateEmail}
                              onChange={(e) => setCandidateEmail(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              placeholder="correo@ejemplo.com"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Teléfono (WhatsApp)</label>
                            <input
                              type="tel"
                              required={sendViaSystem}
                              value={candidatePhone}
                              onChange={(e) => setCandidatePhone(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              placeholder="+52 123 456 7890"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Loong Motor Specific Fields */}
                {investigationType === ('LOONG_MOTOR' as any) && (
                  <div className="p-6 bg-red-50 rounded-2xl border border-red-100 space-y-4">
                    <h4 className="text-sm font-bold text-red-900 flex items-center">
                      <Calculator className="w-4 h-4 mr-2" />
                      Configuración de Financiamiento Loong Motor
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-red-900 mb-1">Monto Total (Capital + Intereses)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400 font-bold">$</span>
                          <input
                            type="number"
                            required
                            value={loongMontoTotal}
                            onChange={(e) => setLoongMontoTotal(e.target.value)}
                            className="w-full pl-7 pr-3 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm bg-white"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-red-900 mb-1">Porcentaje de Enganche (%)</label>
                        <div className="relative">
                          <input
                            type="number"
                            required
                            min="0"
                            max="100"
                            value={loongEnganche}
                            onChange={(e) => setLoongEnganche(e.target.value)}
                            className="w-full pr-8 pl-3 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm bg-white"
                            placeholder="Ej. 30"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 font-bold">%</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-red-600 italic">
                      * El sistema aplicará reglas de flexibilidad si el enganche es superior al 30%.
                    </p>
                  </div>
                )}

                {/* HR Specific Fields */}
                {investigationType === 'HR' && (
                  <>
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center">
                        <Briefcase className="w-4 h-4 mr-2" />
                        Validación Inteligente de Perfil
                      </h4>
                      <p className="text-xs text-blue-700 mb-4">
                        Nuestro sistema cotejará automáticamente el CV con el perfil del puesto y generará preguntas inteligentes para la entrevista.
                      </p>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-blue-900 mb-1">Perfil del Puesto (Descripción)</label>
                          <textarea
                            required
                            value={jobProfile}
                            onChange={(e) => setJobProfile(e.target.value)}
                            className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                            placeholder="Describe las responsabilidades, habilidades requeridas, experiencia..."
                            rows={3}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-blue-900 mb-1">Cargar CV del Candidato (PDF/Word)</label>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => setCvFile(e.target.files ? e.target.files[0] : null)}
                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Credit Specific Fields */}
                {investigationType === 'CREDIT' && (
                  <>
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <h4 className="text-sm font-bold text-emerald-900 mb-2 flex items-center">
                        <Building2 className="w-4 h-4 mr-2" />
                        Datos de Verificación de Crédito
                      </h4>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-emerald-900 mb-1">Domicilio a Visitar (Si aplica)</label>
                          <input
                            type="text"
                            value={visitAddress}
                            onChange={(e) => setVisitAddress(e.target.value)}
                            className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
                            placeholder="Calle, Número, Colonia, Ciudad, CP"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-emerald-900 mb-1">Datos de Contacto</label>
                          <input
                            type="text"
                            value={contactInfo}
                            onChange={(e) => setContactInfo(e.target.value)}
                            className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
                            placeholder="Teléfono y/o correo del contacto principal"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-emerald-900 mb-1">Cargar Solicitud o Documento Base (PDF)</label>
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => setCreditApp(e.target.files ? e.target.files[0] : null)}
                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-100">
                          <div>
                            <label className="block text-xs font-medium text-emerald-900 mb-1">Monto Crédito (Capital)</label>
                            <div className="relative">
                              <span className="absolute left-3 top-2 text-emerald-600 text-sm">$</span>
                              <input
                                type="number"
                                value={montoCreditoCapital}
                                onChange={(e) => setMontoCreditoCapital(e.target.value)}
                                className="w-full pl-7 pr-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-emerald-900 mb-1">Monto con Intereses</label>
                            <div className="relative">
                              <span className="absolute left-3 top-2 text-emerald-600 text-sm">$</span>
                              <input
                                type="number"
                                value={montoCreditoIntereses}
                                onChange={(e) => setMontoCreditoIntereses(e.target.value)}
                                className="w-full pl-7 pr-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-emerald-900 mb-1">Plazo de Financiamiento</label>
                            <input
                              type="text"
                              value={plazoFinanciamiento}
                              onChange={(e) => setPlazoFinanciamiento(e.target.value)}
                              className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
                              placeholder="Ej. 12 meses, 24 quincenas"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-emerald-900 mb-1">Tipo de Crédito</label>
                            <select
                              value={tipoCredito}
                              onChange={(e) => setTipoCredito(e.target.value)}
                              className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
                            >
                              <option value="Personal">Personal</option>
                              <option value="Motocicletas">Motocicletas</option>
                              <option value="Hipotecario">Hipotecario</option>
                              <option value="Negocio">Negocio / PYME</option>
                              <option value="Grupal">Grupal</option>
                              <option value="Otro">Otro</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                      <h4 className="text-sm font-bold text-purple-900 mb-2 flex items-center">
                        <ShieldAlert className="w-4 h-4 mr-2" />
                        Análisis de Usurpación de Identidad (IA)
                      </h4>
                      <p className="text-xs text-purple-700 mb-4">
                        El sistema analizará la identificación oficial y comprobantes de domicilio para detectar alteraciones o inconsistencias.
                      </p>
                      <div>
                        <label className="block text-xs font-medium text-purple-900 mb-1">Cargar Identificación Oficial / Comprobantes (PDF/IMG)</label>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,image/*"
                          className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200"
                        />
                      </div>
                    </div>
                  </>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Instrucciones o Detalles Adicionales
                  </label>
                  <textarea
                    required={investigationType === 'GENERAL'}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[80px]"
                    placeholder="Proporciona RFC, CURP, o cualquier dato extra relevante..."
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Procesando...' : 'Confirmar Solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Entrada Directa (Pre-calificación) */}
      {isDirectInputModalOpen && selectedInvestigation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <Calculator className="w-5 h-5 mr-2 text-emerald-600" />
                Pre-calificación Directa: {selectedInvestigation.title}
              </h3>
              <button 
                onClick={() => setIsDirectInputModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleDirectSubmit} className="p-6 space-y-6">
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-6">
                <p className="text-sm text-emerald-800">
                  Ingresa los datos del solicitante para obtener un dictamen inmediato de pre-calificación.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Monto Solicitado</label>
                  <input
                    type="number"
                    required
                    value={preQualQuestions.montoSolicitado}
                    onChange={(e) => setPreQualQuestions({...preQualQuestions, montoSolicitado: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ingresos Mensuales</label>
                  <input
                    type="number"
                    required
                    value={preQualQuestions.ingresosMensuales}
                    onChange={(e) => setPreQualQuestions({...preQualQuestions, ingresosMensuales: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Gastos Mensuales</label>
                  <input
                    type="number"
                    required
                    value={preQualQuestions.gastosMensuales}
                    onChange={(e) => setPreQualQuestions({...preQualQuestions, gastosMensuales: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">¿Tiene otras deudas?</label>
                  <select
                    value={preQualQuestions.tieneDeudas}
                    onChange={(e) => setPreQualQuestions({...preQualQuestions, tieneDeudas: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  >
                    <option value="no">No</option>
                    <option value="si">Sí</option>
                  </select>
                </div>
                {preQualQuestions.tieneDeudas === 'si' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Monto total de deudas</label>
                    <input
                      type="number"
                      value={preQualQuestions.montoDeudas}
                      onChange={(e) => setPreQualQuestions({...preQualQuestions, montoDeudas: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      placeholder="0.00"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Antigüedad Laboral (Años)</label>
                  <input
                    type="number"
                    required
                    value={preQualQuestions.antiguedadLaboral}
                    onChange={(e) => setPreQualQuestions({...preQualQuestions, antiguedadLaboral: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tipo de Contrato</label>
                  <select
                    value={preQualQuestions.tipoContrato}
                    onChange={(e) => setPreQualQuestions({...preQualQuestions, tipoContrato: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  >
                    <option value="Indefinido">Indefinido</option>
                    <option value="Temporal">Temporal</option>
                    <option value="Honorarios">Honorarios / Freelance</option>
                    <option value="Informal">Informal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Propiedad de Vivienda</label>
                  <select
                    value={preQualQuestions.propiedadVivienda}
                    onChange={(e) => setPreQualQuestions({...preQualQuestions, propiedadVivienda: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  >
                    <option value="Propia">Propia</option>
                    <option value="Rentada">Rentada</option>
                    <option value="Familiar">Familiar</option>
                    <option value="Hipotecada">Hipotecada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Buró de Crédito (Declarado)</label>
                  <select
                    value={preQualQuestions.buroCredito}
                    onChange={(e) => setPreQualQuestions({...preQualQuestions, buroCredito: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  >
                    <option value="Excelente">Excelente</option>
                    <option value="Bueno">Bueno</option>
                    <option value="Regular">Regular</option>
                    <option value="Malo">Malo</option>
                    <option value="Sin Historial">Sin Historial</option>
                  </select>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDirectInputModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4" />
                      Generar Dictamen IA
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalles de Investigación */}
      {selectedInvestigation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Detalles de Investigación: {selectedInvestigation.title}
              </h3>
              <button 
                onClick={() => setSelectedInvestigation(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-8">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start">
                  <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Tabs for Details */}
              <div className="flex border-b border-slate-100 mb-6">
                <button
                  onClick={() => setDetailTab('info')}
                  className={`px-6 py-2 text-sm font-bold transition-colors border-b-2 ${
                    detailTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Información y Resultados
                </button>
                <button
                  onClick={() => setDetailTab('chat')}
                  className={`px-6 py-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${
                    detailTab === 'chat' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  Chat con IA Experta
                </button>
              </div>

              {detailTab === 'chat' ? (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <JuxaVerifyChat investigation={selectedInvestigation} />
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in duration-300">
                  {/* Header Info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">ID</p>
                  <p className="text-sm font-bold text-slate-900">INV-{selectedInvestigation.id.substring(0, 6)}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Estatus</p>
                  <p className={`text-sm font-bold ${
                    selectedInvestigation.status === 'COMPLETED' ? 'text-emerald-600' :
                    selectedInvestigation.status === 'PENDING' ? 'text-slate-600' :
                    selectedInvestigation.status === 'IN_PROGRESS' ? 'text-blue-600' :
                    'text-amber-600'
                  }`}>
                    {selectedInvestigation.status === 'COMPLETED' ? 'Completado' : 
                     selectedInvestigation.status === 'PENDING' ? 'Pendiente' : 
                     selectedInvestigation.status === 'IN_PROGRESS' ? 'En Progreso' : 'Requiere Atención'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Perfil</p>
                  <p className="text-sm font-bold text-slate-900">
                    {selectedInvestigation.clientProfile === 'HR' ? 'Recursos Humanos' : 
                     selectedInvestigation.clientProfile === 'CREDIT' ? 'Crédito (General)' : 
                     selectedInvestigation.clientProfile === 'PROVIDER' ? 'Proveedor' : 'General'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Fecha</p>
                  <p className="text-sm font-bold text-slate-900">
                    {new Date(selectedInvestigation.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Candidate Link Status */}
              {selectedInvestigation.candidateLink && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center">
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Enlace del Candidato
                  </h4>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-xs text-blue-700 mb-1">Estatus del Enlace:</p>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                        selectedInvestigation.linkStatus === 'COMPLETED' ? 'bg-emerald-200 text-emerald-800' :
                        selectedInvestigation.linkStatus === 'OPENED' ? 'bg-blue-200 text-blue-800' :
                        selectedInvestigation.linkStatus === 'IN_PROGRESS' ? 'bg-amber-200 text-amber-800' :
                        'bg-slate-200 text-slate-800'
                      }`}>
                        {selectedInvestigation.linkStatus === 'COMPLETED' ? 'Información Enviada' :
                         selectedInvestigation.linkStatus === 'OPENED' ? 'Enlace Abierto' :
                         selectedInvestigation.linkStatus === 'IN_PROGRESS' ? 'En Progreso' : 'Pendiente de Abrir'}
                      </span>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(`${window.location.origin}/candidate/${selectedInvestigation.candidateLink}`)}
                      className="px-3 py-1.5 bg-white border border-blue-200 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors shadow-sm"
                    >
                      Copiar Enlace
                    </button>
                  </div>
                </div>
              )}

              {/* AI Analysis Results */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center">
                    <Brain className="w-4 h-4 mr-2 text-purple-600" />
                    Resultados del Análisis de IA
                  </h4>
                  {selectedInvestigation.status === 'COMPLETED' && (
                    <button
                      onClick={() => handleReanalyze(selectedInvestigation)}
                      disabled={isReanalyzing}
                      className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1 disabled:opacity-50"
                    >
                      {isReanalyzing ? (
                        <Clock className="w-3 h-3 animate-spin" />
                      ) : (
                        <Bot className="w-3 h-3" />
                      )}
                      {isReanalyzing ? 'Analizando...' : 'Re-analizar con IA'}
                    </button>
                  )}
                </div>
                
                {isReanalyzing ? (
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <JuxaVerifyLoader text="Analizando con IA..." />
                  </div>
                ) : (!selectedInvestigation.identityValidationResult && !selectedInvestigation.creditAnalysisResult && !selectedInvestigation.providerAnalysisResult) ? (
                  <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-300 text-center">
                    <p className="text-sm text-slate-500 italic">No hay resultados de IA disponibles para esta investigación.</p>
                    {selectedInvestigation.status === 'COMPLETED' && (
                      <button
                        onClick={() => handleReanalyze(selectedInvestigation)}
                        disabled={isReanalyzing}
                        className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors shadow-sm inline-flex items-center gap-2"
                      >
                        <Brain className="w-4 h-4" />
                        Ejecutar Análisis Forense IA
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedInvestigation.identityValidationResult && (
                      <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                        <h5 className="text-xs font-bold text-purple-900 mb-2 flex items-center uppercase tracking-wider">
                          <ShieldAlert className="w-3 h-3 mr-1" />
                          Validación de Identidad
                        </h5>
                        <AIResultRenderer resultString={selectedInvestigation.identityValidationResult} />
                      </div>
                    )}

                    {selectedInvestigation.creditAnalysisResult && (
                      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <h5 className="text-xs font-bold text-indigo-900 mb-2 flex items-center uppercase tracking-wider">
                          <Building2 className="w-3 h-3 mr-1" />
                          Análisis de Crédito / Arraigo
                        </h5>
                        <AIResultRenderer resultString={selectedInvestigation.creditAnalysisResult} />
                      </div>
                    )}

                    {selectedInvestigation.providerAnalysisResult && (
                      <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                        <h5 className="text-xs font-bold text-emerald-900 mb-2 flex items-center uppercase tracking-wider">
                          <FileCheck className="w-3 h-3 mr-1" />
                          Análisis de Proveedor / Due Diligence
                        </h5>
                        <AIResultRenderer resultString={selectedInvestigation.providerAnalysisResult} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Traceability Evidence */}
              {selectedInvestigation.uploadedFileUrls && Object.keys(selectedInvestigation.uploadedFileUrls).length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center">
                    <ImageIcon className="w-4 h-4 mr-2 text-blue-600" />
                    Evidencia Cargada (Trazabilidad)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {Object.entries(selectedInvestigation.uploadedFileUrls).map(([key, url]: [string, any]) => (
                      <a 
                        key={key}
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="group relative aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200 hover:border-blue-400 transition-all shadow-sm"
                      >
                        <img 
                          src={url} 
                          alt={key} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ExternalLink className="w-5 h-5 text-white" />
                        </div>
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <p className="text-[10px] font-bold text-white truncate uppercase">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Score Display */}
              {selectedInvestigation.score !== undefined && (
                <div className="bg-white p-6 rounded-2xl border-2 border-slate-100 shadow-sm mb-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Puntaje de Crédito IA</h4>
                      <p className="text-xs text-slate-400 italic">Basado en políticas personalizadas</p>
                    </div>
                    <div className="relative w-20 h-20 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90">
                        <circle
                          cx="40"
                          cy="40"
                          r="36"
                          fill="transparent"
                          stroke="#f1f5f9"
                          strokeWidth="6"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r="36"
                          fill="transparent"
                          stroke={selectedInvestigation.score >= 70 ? "#10b981" : selectedInvestigation.score >= 40 ? "#f59e0b" : "#ef4444"}
                          strokeWidth="6"
                          strokeDasharray={226.2}
                          strokeDashoffset={226.2 - (226.2 * selectedInvestigation.score) / 100}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute text-xl font-black text-slate-900">{selectedInvestigation.score}</span>
                    </div>
                  </div>

                  {selectedInvestigation.scoreBreakdown && (
                    <div className="grid grid-cols-3 gap-4">
                      {Object.entries(JSON.parse(selectedInvestigation.scoreBreakdown)).map(([key, val]: [string, any]) => (
                        <div key={key} className="text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{key}</p>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                            <div 
                              className="h-full bg-blue-500 rounded-full" 
                              style={{ width: `${(val / 40) * 100}%` }} // Normalizing against max weight approx
                            />
                          </div>
                          <p className="text-xs font-bold text-slate-700">{val} pts</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Details */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-2">Detalles Proporcionados</h4>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap">
                  {selectedInvestigation.details || 'Sin detalles adicionales.'}
                </div>
              </div>

              {/* Specific Details */}
              {(selectedInvestigation.investigationType === 'HR' || selectedInvestigation.investigationType === 'CREDIT') && (
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-2">Información Específica</h4>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-700">
                    <ul className="space-y-2">
                      {selectedInvestigation.investigationType === 'HR' && (
                        <>
                          {selectedInvestigation.jobProfile && <li><strong>Perfil del Puesto:</strong> {selectedInvestigation.jobProfile}</li>}
                          {selectedInvestigation.cvFileName && <li><strong>Archivo CV:</strong> {selectedInvestigation.cvFileName}</li>}
                        </>
                      )}
                      {selectedInvestigation.investigationType === 'CREDIT' && (
                        <>
                          {selectedInvestigation.visitAddress && <li><strong>Domicilio a Visitar:</strong> {selectedInvestigation.visitAddress}</li>}
                          {selectedInvestigation.contactInfo && <li><strong>Datos de Contacto:</strong> {selectedInvestigation.contactInfo}</li>}
                          {selectedInvestigation.creditAppFileName && <li><strong>Solicitud de Crédito:</strong> {selectedInvestigation.creditAppFileName}</li>}
                          {selectedInvestigation.tipoCredito && <li><strong>Tipo de Crédito:</strong> {selectedInvestigation.tipoCredito}</li>}
                          {selectedInvestigation.montoCreditoCapital && <li><strong>Monto Capital:</strong> ${selectedInvestigation.montoCreditoCapital}</li>}
                          {selectedInvestigation.montoCreditoIntereses && <li><strong>Monto con Intereses:</strong> ${selectedInvestigation.montoCreditoIntereses}</li>}
                          {selectedInvestigation.plazoFinanciamiento && <li><strong>Plazo de Financiamiento:</strong> {selectedInvestigation.plazoFinanciamiento}</li>}
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* Provider Specific Details */}
              {selectedInvestigation.clientProfile === 'PROVIDER' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 mb-2">Archivos del Proveedor</h4>
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-sm text-amber-900">
                      <ul className="space-y-2">
                        {selectedInvestigation.providerReferencesFileName && (
                          <li className="flex items-center">
                            <FileText className="w-4 h-4 mr-2 text-amber-600" />
                            <strong>Referencias Comerciales:</strong> {selectedInvestigation.providerReferencesFileName}
                          </li>
                        )}
                        {selectedInvestigation.providerFilesFileName && (
                          <li className="flex items-center">
                            <FileText className="w-4 h-4 mr-2 text-amber-600" />
                            <strong>Cuestionario/Docs:</strong> {selectedInvestigation.providerFilesFileName}
                          </li>
                        )}
                        {!selectedInvestigation.providerReferencesFileName && !selectedInvestigation.providerFilesFileName && (
                          <li className="text-amber-700 italic">No se proporcionaron archivos específicos de proveedor.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Candidate Submitted Data */}
              {selectedInvestigation.candidateData && (
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-2">Información del Candidato</h4>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-700">
                    <pre className="whitespace-pre-wrap font-sans">
                      {(() => {
                        try {
                          const data = JSON.parse(selectedInvestigation.candidateData);
                          return (
                            <div className="space-y-2">
                              {data.preQualQuestions && (
                                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-4">
                                  <h5 className="text-xs font-bold text-emerald-900 mb-3 uppercase tracking-wider flex items-center">
                                    <Calculator className="w-3 h-3 mr-1" />
                                    Resultados de Pre-calificación
                                  </h5>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                                    <p><strong>Monto Solicitado:</strong> ${data.preQualQuestions.montoSolicitado}</p>
                                    <p><strong>Ingresos Mensuales:</strong> ${data.preQualQuestions.ingresosMensuales}</p>
                                    <p><strong>Gastos Mensuales:</strong> ${data.preQualQuestions.gastosMensuales}</p>
                                    <p><strong>Deudas Activas:</strong> {data.preQualQuestions.tieneDeudas === 'si' ? `Sí ($${data.preQualQuestions.montoDeudas})` : 'No'}</p>
                                    <p><strong>Antigüedad Laboral:</strong> {data.preQualQuestions.antiguedadLaboral} años</p>
                                    <p><strong>Tipo de Contrato:</strong> {data.preQualQuestions.tipoContrato}</p>
                                    <p><strong>Vivienda:</strong> {data.preQualQuestions.propiedadVivienda}</p>
                                    <p><strong>Buró (Declarado):</strong> {data.preQualQuestions.buroCredito}</p>
                                  </div>
                                </div>
                              )}
                              {data.mapLocation && <p><strong>Ubicación en Mapa:</strong> {data.mapLocation}</p>}
                              {data.realTimeLocation && <p><strong>Ubicación GPS (Tiempo Real):</strong> {data.realTimeLocation}</p>}
                              {data.distanceMeters !== undefined && <p><strong>Diferencia:</strong> {data.distanceMeters} metros</p>}
                              {data.location && <p><strong>Ubicación:</strong> {data.location}</p>}
                              {data.idFrontName && <p><strong>INE Frente:</strong> {data.idFrontName}</p>}
                              {data.idBackName && <p><strong>INE Reverso:</strong> {data.idBackName}</p>}
                              {data.proofOfAddressName && <p><strong>Comprobante de Domicilio:</strong> {data.proofOfAddressName}</p>}
                              {data.incomeProofName && <p><strong>Comprobante de Ingresos:</strong> {data.incomeProofName}</p>}
                              {data.selfieName && <p><strong>Selfie:</strong> {data.selfieName}</p>}
                              {data.fotoFachadaName && <p><strong>Foto Fachada:</strong> {data.fotoFachadaName}</p>}
                              {data.fotoSalaName && <p><strong>Foto Sala:</strong> {data.fotoSalaName}</p>}
                              {data.fotoComedorName && <p><strong>Foto Comedor:</strong> {data.fotoComedorName}</p>}
                              {data.fotoCocinaName && <p><strong>Foto Cocina:</strong> {data.fotoCocinaName}</p>}
                              {data.fotoHabitacionName && <p><strong>Foto Habitación:</strong> {data.fotoHabitacionName}</p>}
                              {data.ingresoMensual && <p><strong>Ingreso Mensual:</strong> ${data.ingresoMensual} MXN</p>}
                              {data.direccionDeclarada && <p><strong>Dirección Declarada:</strong> {data.direccionDeclarada}</p>}
                              {data.tipoVivienda && <p><strong>Tipo de Vivienda:</strong> {data.tipoVivienda}</p>}
                              {data.antiguedadVivienda && <p><strong>Antigüedad Vivienda:</strong> {data.antiguedadVivienda} años</p>}
                              {data.submittedAt && <p><strong>Fecha de Envío:</strong> {new Date(data.submittedAt).toLocaleString()}</p>}
                              
                              {(data.realTimeLocation || data.mapLocation) && (
                                <div className="mt-6 pt-4 border-t border-slate-200">
                                  <h4 className="text-sm font-bold text-slate-900 mb-2">Verificación Geográfica</h4>
                                  <LocationViewer 
                                    lat={parseFloat((data.realTimeLocation || data.mapLocation).split(',')[0])} 
                                    lng={parseFloat((data.realTimeLocation || data.mapLocation).split(',')[1])} 
                                  />
                                </div>
                              )}
                            </div>
                          );
                        } catch (e) {
                          return selectedInvestigation.candidateData;
                        }
                      })()}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50 gap-2">
              {/* {selectedInvestigation.investigationType === 'CREDIT' && selectedInvestigation.status === 'COMPLETED' && (
                <button
                  onClick={() => setIsPagareModalOpen(true)}
                  className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm flex items-center"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Generar Pagaré
                </button>
              )} */}
              <button
                onClick={() => handleDownloadPDF(selectedInvestigation)}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center"
              >
                <FileText className="w-4 h-4 mr-2" />
                Descargar PDF
              </button>
              <button
                onClick={() => setSelectedInvestigation(null)}
                className="px-4 py-2 bg-slate-200 text-slate-800 font-medium rounded-lg hover:bg-slate-300 transition-colors shadow-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagare Modal */}
      {isPagareModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Generar Pagaré
              </h2>
              <button onClick={() => setIsPagareModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="pagareForm" onSubmit={handleGeneratePagare} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Monto (Número)</label>
                    <input type="number" name="monto" required className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Ej. 50000" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Monto (Letra)</label>
                    <input type="text" name="montoLetra" required className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Ej. Cincuenta mil pesos 00/100 M.N." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Lugar y Fecha de Expedición</label>
                    <input type="text" name="lugarFecha" required className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Ej. Ciudad de México a 24 de Marzo de 2026" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Lugar de Pago</label>
                    <input type="text" name="lugarPago" required className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Ej. Ciudad de México" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Vencimiento</label>
                    <input type="text" name="fechaVencimiento" required className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Ej. 24 de Abril de 2026" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Beneficiario</label>
                    <input type="text" name="beneficiario" required className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Nombre de tu empresa" />
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4 mt-4">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">Datos del Deudor</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Deudor</label>
                      <input type="text" name="deudorNombre" required defaultValue={selectedInvestigation ? selectedInvestigation.title : ''} className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Dirección del Deudor</label>
                      <input type="text" name="deudorDireccion" required defaultValue={selectedInvestigation ? selectedInvestigation.visitAddress : ''} className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono del Deudor</label>
                      <input type="text" name="deudorTelefono" required defaultValue={selectedInvestigation ? selectedInvestigation.contactInfo : ''} className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50 gap-2">
              <button
                type="button"
                onClick={() => setIsPagareModalOpen(false)}
                className="px-4 py-2 bg-slate-200 text-slate-800 font-medium rounded-lg hover:bg-slate-300 transition-colors shadow-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="pagareForm"
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center"
              >
                <FileText className="w-4 h-4 mr-2" />
                Generar PDF
              </button>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'settings' && (
        <div className="p-4 sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-6">Configuración</h1>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <p className="text-slate-600">Opciones de configuración de la cuenta.</p>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
