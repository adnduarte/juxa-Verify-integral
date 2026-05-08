import React from 'react';
import { LucideIcon, LogOut, LayoutDashboard, Sparkles, ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, X, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { useAuthStatus } from '../../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';
import { BankingSecurityStandardsPanel } from '../platform/BankingSecurityStandardsPanel';

export interface DashboardSidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Encabezado de agrupación (solo desktop expandido) */
  section?: string;
  /** Metadatos opcionales (p. ej. filtro por rol en el padre); no se renderizan aquí */
  roles?: string[];
}

interface DashboardLayoutProps {
  title: string;
  subtitle?: string;
  sidebarItems: DashboardSidebarItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
  /** Panel compacto de seguridad / prácticas sector financiero en la barra lateral (desktop). */
  showFinancialComplianceAside?: boolean;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  title,
  subtitle,
  sidebarItems,
  activeTab,
  onTabChange,
  children,
  actions,
  showFinancialComplianceAside = false,
}) => {
  const { role, clientProfile, logout, user } = useAuthStatus();
  const { branding } = useTenant();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = React.useState(false);
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';

  const primary = branding.primaryColor?.trim() || '#2563eb';

  const geminiStatus = (() => {
    const override = typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY_OVERRIDE') : null;
    if (override && override.length > 10) return { configured: true, source: 'override' as const };
    const key = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    const fromEnv =
      key &&
      key !== 'MY_GEMINI_API_KEY' &&
      key !== 'undefined' &&
      key !== '' &&
      key !== 'process.env.GEMINI_API_KEY';
    return { configured: Boolean(fromEnv), source: fromEnv ? ('env' as const) : ('none' as const) };
  })();
  const isGeminiConfigured = geminiStatus.configured;

  const shellStyle = { ['--jv-primary' as string]: primary } as React.CSSProperties;

  const renderNavButtons = (opts: { mobile?: boolean }) => (
    <>
      {sidebarItems.map((item, idx) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        const prev = sidebarItems[idx - 1];
        const showSection = item.section && item.section !== prev?.section;
        const isFirstSection = showSection && idx === 0;
        return (
          <React.Fragment key={item.id}>
            {showSection && !isCollapsed && !opts.mobile && (
              <div
                className={`px-3 ${isFirstSection ? 'pb-2 pt-0' : 'mt-3 pt-4 border-t border-slate-800/70 pb-2'}`}
              >
                <div className="text-[11px] font-semibold text-slate-500 tracking-wide">{item.section}</div>
              </div>
            )}
            {showSection && opts.mobile && (
              <div
                className={`w-full shrink-0 px-1 ${idx === 0 ? 'py-2' : 'pt-4 mt-2 border-t border-slate-200 py-2'}`}
              >
                <div className="text-[11px] font-semibold text-slate-500 tracking-wide">{item.section}</div>
              </div>
            )}
            <button
              type="button"
              onClick={() => onTabChange(item.id)}
              title={item.label}
              className={`${opts.mobile ? 'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap border shrink-0' : 'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border-l-4'} ${
                isActive
                  ? opts.mobile
                    ? 'border-transparent text-white shadow-md'
                    : 'bg-white text-slate-900 shadow-md border-transparent'
                  : opts.mobile
                    ? 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 border-transparent'
              } ${opts.mobile ? '' : isCollapsed ? 'justify-center' : ''}`}
              style={
                isActive
                  ? opts.mobile
                    ? { backgroundColor: primary }
                    : { borderLeftColor: primary }
                  : undefined
              }
            >
              <Icon className={`${opts.mobile ? 'w-4 h-4' : 'w-5 h-5'} shrink-0`} />
              {!isCollapsed && !opts.mobile && <span className="truncate text-left">{item.label}</span>}
              {opts.mobile && <span>{item.label}</span>}
            </button>
          </React.Fragment>
        );
      })}
    </>
  );

  return (
    <div
      className="flex h-screen bg-slate-100 text-slate-900 font-sans overflow-hidden w-full antialiased"
      style={shellStyle}
    >
      <aside
        className={`hidden md:flex flex-col bg-slate-900 text-slate-300 border-r border-slate-800 h-full flex-shrink-0 no-print transition-all duration-300 ${
          isCollapsed ? 'w-[4.5rem]' : 'w-64'
        }`}
      >
        <div className={`p-4 border-b border-slate-800 flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div
            className="w-9 h-9 text-white flex items-center justify-center rounded-xl font-bold shadow-lg shrink-0 ring-1 ring-white/10"
            style={{ backgroundColor: primary }}
          >
            JV
          </div>
          {!isCollapsed && (
            <span className="font-bold text-lg tracking-tight text-white truncate">{branding.appName || 'Juxa Verify'}</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-2 space-y-2">
          <div className="px-2">
            <Link
              to="/dashboard"
              className={`px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors ${
                isDashboard ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title="Dashboard"
            >
              <LayoutDashboard className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span>Inicio</span>}
            </Link>
          </div>

          <div className="px-2 pt-2">
            {!isCollapsed && (
              <div className="px-3 mb-2 text-[11px] font-semibold text-slate-500 tracking-wide truncate border-b border-slate-800/50 pb-2">
                {title}
              </div>
            )}
            {actions && !isCollapsed && <div className="px-2 mb-3">{actions}</div>}
            <nav className="space-y-0.5">{renderNavButtons({})}</nav>
          </div>

          {showFinancialComplianceAside && !isCollapsed && (
            <div className="px-2 pt-2">
              <BankingSecurityStandardsPanel variant="compact" />
            </div>
          )}
        </div>

        <div className="p-3 border-t border-slate-800 space-y-3">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>

          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center flex-col' : ''}`}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ring-2 ring-slate-700"
              style={{ backgroundColor: `${primary}cc` }}
            >
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{user?.email}</p>
                <p className="text-[10px] text-slate-500 truncate">
                  {role} · {clientProfile}
                </p>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              type="button"
              onClick={() => setIsGeminiModalOpen(true)}
              title="Gestionar clave Gemini"
              className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 border text-[10px] transition-colors ${
                isGeminiConfigured
                  ? 'border-emerald-800/80 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40'
                  : 'border-amber-900/60 bg-amber-950/30 text-amber-200 hover:bg-amber-900/40'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0 opacity-80" />
              <span className="font-medium truncate flex-1 text-left">
                {isGeminiConfigured
                  ? geminiStatus.source === 'override'
                    ? 'Gemini OK · clave del navegador'
                    : 'Gemini OK · clave de entorno'
                  : 'Gemini sin clave'}
              </span>
              <span
                className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  isGeminiConfigured ? 'bg-emerald-600/90 text-white' : 'bg-amber-600/90 text-white'
                }`}
              >
                {isGeminiConfigured ? 'Gestionar' : 'Configurar'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={logout}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-red-950/50 hover:text-red-300 rounded-xl transition-colors border border-slate-700/80 ${
              isCollapsed ? 'px-0' : ''
            }`}
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-slate-100/90 min-h-0 sm:px-6 sm:py-6 lg:px-8 lg:py-7 px-4 py-4">
        <div className="max-w-7xl mx-auto min-h-full flex flex-col">
          <div className="md:hidden mb-5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500 mt-1 mb-3">{subtitle}</p>}
            {actions && <div className="mb-3">{actions}</div>}
            <nav className="flex gap-2 overflow-x-auto pb-2 items-start">{renderNavButtons({ mobile: true })}</nav>
          </div>

          <div className="hidden md:block mb-5 lg:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight text-balance">{title}</h1>
            {subtitle && <p className="text-slate-600 mt-1.5 text-sm max-w-2xl leading-relaxed">{subtitle}</p>}
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/30 p-4 sm:p-5 md:border-0 md:bg-transparent md:shadow-none md:p-0 flex-1 min-h-0">
            {children}
          </div>
        </div>
      </div>

      {isGeminiModalOpen && (
        <GeminiKeyModal
          source={geminiStatus.source}
          onClose={() => setIsGeminiModalOpen(false)}
          onSaved={() => {
            setIsGeminiModalOpen(false);
            window.location.reload();
          }}
          primaryColor={primary}
        />
      )}
    </div>
  );
};

interface GeminiKeyModalProps {
  source: 'override' | 'env' | 'none';
  onClose: () => void;
  onSaved: () => void;
  primaryColor: string;
}

const GeminiKeyModal: React.FC<GeminiKeyModalProps> = ({ source, onClose, onSaved, primaryColor }) => {
  const existing = typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY_OVERRIDE') || '' : '';
  const [value, setValue] = React.useState(existing);
  const [showKey, setShowKey] = React.useState(false);
  const [testStatus, setTestStatus] = React.useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMessage, setTestMessage] = React.useState<string | null>(null);

  const trimmed = value.trim();
  const looksValid = trimmed.length > 10;

  const handleSave = () => {
    if (!looksValid) return;
    localStorage.setItem('GEMINI_API_KEY_OVERRIDE', trimmed);
    onSaved();
  };

  const handleClear = () => {
    localStorage.removeItem('GEMINI_API_KEY_OVERRIDE');
    onSaved();
  };

  const handleTest = async () => {
    if (!looksValid) return;
    setTestStatus('testing');
    setTestMessage(null);
    try {
      // Llamada mínima al endpoint público de Gemini (1 token) para validar la clave sin usar el SDK.
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(trimmed)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
            generationConfig: { maxOutputTokens: 1 },
          }),
        }
      );
      if (r.ok) {
        setTestStatus('ok');
        setTestMessage('La clave responde correctamente.');
      } else {
        const body = await r.text();
        setTestStatus('fail');
        setTestMessage(`HTTP ${r.status}: ${body.slice(0, 180) || 'Sin detalle'}`);
      }
    } catch (e) {
      setTestStatus('fail');
      setTestMessage(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" style={{ color: primaryColor }} />
            <h3 className="text-lg font-bold text-slate-900">Clave Gemini</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 leading-relaxed">
            <p className="mb-1">
              <strong>Origen actual:</strong>{' '}
              {source === 'override'
                ? 'guardada en este navegador (localStorage)'
                : source === 'env'
                  ? 'variable de entorno (VITE_GEMINI_API_KEY)'
                  : 'no configurada'}
              .
            </p>
            <p>
              La clave se guarda solo en tu navegador. Para producción, usa{' '}
              <code className="bg-white px-1 rounded">VITE_GEMINI_API_KEY</code> o un proxy server-side.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              GEMINI_API_KEY
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setTestStatus('idle');
                  setTestMessage(null);
                }}
                placeholder="AIza..."
                className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-700"
                title={showKey ? 'Ocultar' : 'Mostrar'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {!looksValid && value.length > 0 && (
              <p className="text-[11px] text-amber-600 mt-1">Clave demasiado corta — pega la clave completa.</p>
            )}
          </div>

          {testStatus !== 'idle' && (
            <div
              className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                testStatus === 'ok'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : testStatus === 'fail'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-slate-50 text-slate-600 border border-slate-200'
              }`}
            >
              {testStatus === 'testing' ? (
                <Loader2 className="w-4 h-4 mt-0.5 animate-spin shrink-0" />
              ) : testStatus === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <span className="leading-relaxed">{testStatus === 'testing' ? 'Probando…' : testMessage}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={!looksValid || testStatus === 'testing'}
              className="flex-1 px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {testStatus === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Probar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!looksValid}
              style={{ backgroundColor: primaryColor }}
              className="flex-1 px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:opacity-90 transition-opacity"
            >
              Guardar y recargar
            </button>
          </div>

          {source === 'override' && (
            <button
              type="button"
              onClick={handleClear}
              className="w-full text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors"
            >
              Quitar clave guardada en este navegador
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
