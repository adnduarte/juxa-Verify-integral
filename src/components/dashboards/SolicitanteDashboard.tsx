import React, { useState, useEffect } from 'react';
import { FileText, Download, CheckCircle2, Clock, AlertCircle, Briefcase, Building2, Link as LinkIcon } from 'lucide-react';
import { db, auth } from '../../firebase';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import { useAuthStatus } from '../../contexts/AuthContext';

export const SolicitanteDashboard: React.FC = () => {
  const [investigations, setInvestigations] = useState<any[]>([]);
  const { user, logUserAction } = useAuthStatus();

  const handleDownloadPDF = async (inv: any) => {
    if (logUserAction && user) {
      logUserAction(user.uid, 'SOLICITANTE_DOWNLOAD_STATUS_PDF', { investigationId: inv.id });
    }

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text('Estado de Solicitud JUXA', 20, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text(`ID: INV-${inv.id.substring(0, 8)}`, 20, 30);
    doc.text(`Fecha: ${new Date(inv.createdAt).toLocaleDateString()}`, 20, 38);
    
    // Details
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('Detalles Generales', 20, 50);
    
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text(`Título: ${inv.title}`, 20, 60);
    doc.text(`Perfil: ${inv.clientProfile === 'HR' ? 'Recursos Humanos' : inv.clientProfile === 'CREDIT' ? 'Crédito (General)' : 'General'}`, 20, 68);
    doc.text(`Estatus: ${inv.status === 'COMPLETED' ? 'Completado' : inv.status === 'PENDING' ? 'Pendiente' : inv.status === 'IN_PROGRESS' ? 'En Progreso' : 'Requiere Atención'}`, 20, 76);
    
    // Annex: Evidence Images
    const evidenceUrls = inv.uploadedFileUrls || {};
    const urlEntries = Object.entries(evidenceUrls).filter(([_, url]) => typeof url === 'string' && url.startsWith('http'));

    if (urlEntries.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.setFont(undefined, 'bold');
      doc.text('Anexo: Evidencia Fotográfica', 20, 20);
      
      let imgY = 30;
      const labels: Record<string, string> = {
        fotoFachadaUrl: 'Foto de Fachada',
        idFrontUrl: 'Identificación (Frente)',
        idBackUrl: 'Identificación (Reverso)',
        proofOfAddressUrl: 'Comprobante de Domicilio',
        selfieUrl: 'Prueba de Vida (Selfie)'
      };

      for (const [key, url] of urlEntries) {
        try {
          const label = labels[key] || key;
          
          if (imgY > 220) {
            doc.addPage();
            imgY = 20;
          }

          doc.setFontSize(10);
          doc.setTextColor(51, 65, 85);
          doc.text(label, 20, imgY);
          imgY += 5;

          // Load image
          const imgData = await new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = reject;
            img.src = url as string;
          });

          // Add to PDF (maintain aspect ratio)
          const imgProps = doc.getImageProperties(imgData);
          const pdfWidth = 170;
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
          
          const finalHeight = Math.min(pdfHeight, 80); // Max height per image
          const finalWidth = (imgProps.width * finalHeight) / imgProps.height;

          doc.addImage(imgData, 'JPEG', 20, imgY, finalWidth, finalHeight);
          imgY += finalHeight + 15;
        } catch (err) {
          console.error(`Error adding image to PDF: ${url}`, err);
          doc.text(`[Error al cargar imagen: ${url}]`, 20, imgY);
          imgY += 10;
        }
      }
    }

    // No detailed dictamen or AI results are included for SOLICITANTE
    doc.addPage();
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Este documento es un comprobante de estado de la solicitud.', 20, 20);
    
    doc.save(`Estado_Solicitud_JUXA_${inv.id.substring(0, 6)}.pdf`);
  };

  useEffect(() => {
    if (!auth.currentUser) return;

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
      unsubscribeInv();
    };
  }, []);

  const completedCount = investigations.filter(i => i.status === 'COMPLETED').length;
  const inProgressCount = investigations.filter(i => i.status === 'IN_PROGRESS' || i.status === 'PENDING').length;
  const attentionCount = investigations.filter(i => i.status === 'REQUIRES_ATTENTION').length;

  return (
    <div className="p-4 sm:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Mi Estado de Solicitud</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Monitorea el avance de tus procesos.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Completados</h3>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{completedCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">En Progreso</h3>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{inProgressCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Requieren Atención</h3>
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{attentionCount}</p>
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Historial de Solicitudes</h2>
        </div>
        
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {investigations.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              No tienes solicitudes activas.
            </div>
          ) : (
            investigations.map((inv) => (
              <div key={inv.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ${
                    inv.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' :
                    inv.status === 'PENDING' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' :
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
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">INV-{inv.id.substring(0, 6)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        inv.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                        inv.status === 'PENDING' ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200' :
                        inv.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {inv.status === 'COMPLETED' ? 'Completado' : 
                         inv.status === 'PENDING' ? 'Pendiente' : 
                         inv.status === 'IN_PROGRESS' ? 'En Progreso' : 'Requiere Atención'}
                      </span>
                      {inv.clientProfile && inv.clientProfile !== 'GENERAL' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-100 text-purple-700">
                          {inv.clientProfile === 'HR' ? 'RRHH' : 'Crédito'}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">{inv.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{inv.details}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </p>
                    
                    {/* Progress Steps */}
                    <div className="mt-4 flex items-center gap-2">
                      <div className={`h-2 flex-1 rounded-full ${inv.status !== 'PENDING' ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                      <div className={`h-2 flex-1 rounded-full ${inv.status === 'IN_PROGRESS' || inv.status === 'COMPLETED' ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                      <div className={`h-2 flex-1 rounded-full ${inv.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                    </div>
                    <div className="flex justify-between mt-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      <span>Recibido</span>
                      <span>En Validación IA</span>
                      <span>Finalizado</span>
                    </div>
                  </div>
                </div>
                <div className="flex sm:flex-col gap-2">
                  <button 
                    onClick={() => handleDownloadPDF(inv)}
                    className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors shadow-sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Descargar Estado
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
