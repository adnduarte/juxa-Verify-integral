import React from 'react';
import { Shield, Lock, FileSearch, Users, Server, Sparkles } from 'lucide-react';

type Variant = 'full' | 'compact';

const SECTIONS: { title: string; icon: React.ElementType; bullets: string[] }[] = [
  {
    title: 'Gobierno y segregación de funciones',
    icon: Users,
    bullets: [
      'El alta de organizaciones en red y la asignación masiva de permisos corresponden a roles centrales (p. ej. Dirección del programa, Administración de plataforma), no a operadores de sucursal.',
      'Flujo recomendado Ford: Gerencia del programa envía solicitud de alta; Dirección aprueba (cuatro ojos: quien propone no autoriza). Opcionalmente Dirección o ADMIN realizan alta directa documentada.',
      'Gerencia de agencia de concesionario opera expedientes en su organización; no expande la red OEM desde esta plataforma.',
    ],
  },
  {
    title: 'Identidad, acceso y sesiones',
    icon: Lock,
    bullets: [
      'Autenticación reforzada (MFA) para cuentas con acceso a datos sensibles o configuración.',
      'Principio de menor privilegio: cada usuario solo ve expedientes y acciones estrictamente necesarios para su rol.',
      'Cierre de sesión en equipos compartidos; no reutilizar cuentas genéricas para trámites identificables.',
    ],
  },
  {
    title: 'Confidencialidad e integridad de datos',
    icon: Shield,
    bullets: [
      'Transporte cifrado (HTTPS/TLS) entre navegador y servicios; datos en reposo protegidos por el proveedor cloud conforme a estándares del sector.',
      'Minimización: recolectar y mostrar solo los datos necesarios para la decisión o el cumplimiento normativo.',
      'Sin almacenar PAN/CVV de tarjetas en esta aplicación; datos de pago deben canalizarse por procesadores certificados cuando aplique.',
    ],
  },
  {
    title: 'Auditoría y trazabilidad',
    icon: FileSearch,
    bullets: [
      'Acciones relevantes (altas de organización, cambios de configuración, decisiones de mesa) deben quedar registradas para reconstrucción de eventos.',
      'Los registros son evidencia para supervisión interna, auditorías y resolución de incidentes.',
    ],
  },
  {
    title: 'Continuidad y cadena de suministro',
    icon: Server,
    bullets: [
      'Revisiones periódicas de dependencias críticas (identidad, almacenamiento, modelos de IA) y planes de respuesta ante incidentes.',
      'Subprocesadores y APIs externas sujetos a evaluación de riesgo y acuerdos de tratamiento de datos.',
    ],
  },
  {
    title: 'Uso de IA generativa',
    icon: Sparkles,
    bullets: [
      'No ingresar en prompts datos personales innecesarios o secretos comerciales; preferir agregados y contexto operativo ya anonimizado cuando sea posible.',
      'Validar salidas de modelos para decisiones que impacten a personas: la IA asiste, no sustituye el juicio humano ni políticas de crédito.',
    ],
  },
];

export const BankingSecurityStandardsPanel: React.FC<{ variant?: Variant }> = ({ variant = 'full' }) => {
  if (variant === 'compact') {
    return (
      <details className="rounded-lg border border-slate-800/80 bg-slate-950/40 text-left">
        <summary className="cursor-pointer list-none px-3 py-2.5 flex items-center gap-2 text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition-colors">
          <Shield className="w-3.5 h-3.5 shrink-0 text-emerald-400/90" />
          <span className="truncate">Seguridad · prácticas sector financiero</span>
        </summary>
        <div className="px-3 pb-3 pt-0 space-y-2 border-t border-slate-800/60">
          <p className="text-[10px] text-slate-500 leading-relaxed pt-2">
            Referencia interna alineada a buenas prácticas (ISO 27001, PCI DSS donde aplique a entorno de pago, NFPS/NIST como guía de ciberseguridad).
          </p>
          <ul className="text-[10px] text-slate-400 space-y-1.5 leading-snug list-disc pl-3.5">
            <li>Menor privilegio y MFA en cuentas sensibles.</li>
            <li>Cuatro ojos en altas de red (solicitud ≠ aprobación).</li>
            <li>Datos mínimos; sin PAN/CVV en la app.</li>
            <li>Auditoría de acciones críticas.</li>
          </ul>
        </div>
      </details>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-[#003478]" />
          Seguridad y buenas prácticas (plataforma financiera)
        </h2>
        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
          Marco orientativo para equipos de originación, mesa de control y supervisión. No sustituye políticas internas ni lineamientos del programa OEM /
          institución financiera.
        </p>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-950">
        <p className="font-semibold mb-1">Referencias de cumplimiento (orientativas)</p>
        <p className="leading-relaxed">
          ISO/IEC 27001 (SGSI), controles PCI DSS para entornos que procesan pagos con tarjeta, y marcos locales de ciberseguridad financiera (p. ej. guías de
          supervisión bancaria y NFPS en México) como referencia para evaluaciones periódicas.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map(({ title, icon: Icon, bullets }) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Icon className="w-5 h-5 text-slate-700 shrink-0" />
              <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
            </div>
            <ul className="text-sm text-slate-600 space-y-2 leading-relaxed list-disc pl-4">
              {bullets.map((b, i) => (
                <li key={`${title}-${i}`}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};
