import React from 'react';
import { LucideIcon, LogOut, Home, ChevronsLeftRight } from 'lucide-react';
import { useAuthStatus } from '../../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { brand, brandClasses, shellClasses } from '../../config/brand';
import { roleLabelEs } from '../../config/accessProfiles';
import { loongUserHasMesaDeskVisibility } from '../../lib/loongMesaDeskAccess';
import { ThemeToggle } from '../ThemeToggle';

export interface DashboardSidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Si está definido, el ítem es un enlace (p. ej. módulos en ruta propia). */
  to?: string;
}

function sidebarLinkActive(
  item: DashboardSidebarItem,
  activeTab: string,
  pathname: string,
  search: string
): boolean {
  if (!item.to) return activeTab === item.id;
  if (item.to === '/dashboard/loong/crm') return pathname === '/dashboard/loong/crm';
  if (item.to === '/admin/loong/crm') return pathname === '/admin/loong/crm';
  try {
    const u = new URL(item.to, window.location.origin);
    if (u.pathname === '/dashboard' && u.searchParams.has('tab')) {
      const want = u.searchParams.get('tab');
      const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
      const current = sp.get('tab');
      if (pathname !== '/dashboard') return false;
      if (want === 'pipeline') return current === 'pipeline' || current === null || current === '';
      return current === want;
    }
    return pathname === u.pathname && search === (u.search || '');
  } catch {
    return false;
  }
}

interface DashboardLayoutProps {
  title: string;
  subtitle?: string;
  sidebarItems: DashboardSidebarItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  title,
  subtitle,
  sidebarItems,
  activeTab,
  onTabChange,
  children,
  actions
}) => {
  const { role, clientProfile, logout, user, loongTeamTier } = useAuthStatus();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const location = useLocation();
  const mesaClienteLoong =
    role === 'CLIENTE' &&
    loongUserHasMesaDeskVisibility({
      role,
      userEmail: user?.email,
      loongTeamTier,
    });
  const roleProfileSubtitle = mesaClienteLoong
    ? 'Mesa de control · Loong Motor'
    : `${roleLabelEs(role)}${clientProfile === 'LOONG_MOTOR' ? ' · Loong Motor' : ` · ${clientProfile}`}`;
  const { pathname, search } = location;
  /** En /dashboard las pestañas del módulo ya cumplen el rol de inicio; evita duplicar "Dashboard" + "Resumen". */
  const showJumpToOperative = pathname.startsWith('/admin');

  return (
    <div className="flex h-screen bg-[var(--color-juxa-surface-page)] text-slate-900 dark:text-slate-100 font-sans overflow-hidden w-full">
      {/* Primary Sidebar (Desktop) */}
      <aside
        className={`hidden md:flex flex-col bg-white dark:bg-[var(--color-juxa-surface-elevated)] border-r border-slate-200/90 dark:border-slate-800 h-full flex-shrink-0 no-print transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}
      >
        <div
          className={`p-4 border-b border-slate-200/90 dark:border-slate-800 flex items-center gap-3 ${isCollapsed ? 'flex-col justify-center gap-2' : 'justify-between'}`}
        >
          <div className={`flex items-center gap-3 min-w-0 ${isCollapsed ? '' : 'flex-1'}`}>
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${brandClasses.logoMark}`}
            >
              {brand.logoMark}
            </div>
            {!isCollapsed && (
              <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-slate-100 truncate">{brand.productName}</span>
            )}
          </div>
          <ThemeToggle size="sm" className={isCollapsed ? '' : 'shrink-0'} />
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {showJumpToOperative && (
            <div className="space-y-1">
              <Link
                to="/dashboard"
                className={`px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  isCollapsed ? 'justify-center' : ''
                }`}
                title="Volver al panel operativo"
              >
                <Home className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span>Panel operativo</span>}
              </Link>
            </div>
          )}

          {/* Módulo activo (pestañas) */}
          <div>
            {!isCollapsed && (
              <div className="mb-2 flex flex-col gap-1 px-3">
                <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500">
                  {title}
                </div>
                {clientProfile === 'LOONG_MOTOR' && (
                  <span className="w-fit rounded-md border border-[var(--color-juxa-accent-muted)] bg-[var(--color-juxa-accent-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-juxa-accent)]">
                    Módulo Loong
                  </span>
                )}
              </div>
            )}
            {actions && !isCollapsed && (
              <div className="px-3 mb-4">
                {actions}
              </div>
            )}
            <nav className="space-y-0.5">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = sidebarLinkActive(item, activeTab, pathname, search);
                const cls = `w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-150 ${
                  isActive ? shellClasses.navActive : shellClasses.navInactive
                } ${isCollapsed ? 'justify-center' : ''}`;
                if (item.to) {
                  return (
                    <Link key={item.id} to={item.to} className={cls} title={item.label}>
                      <Icon className={`w-5 h-5 shrink-0 ${isActive ? '' : 'opacity-85'}`} strokeWidth={isActive ? 2.25 : 2} />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                }
                return (
                    <button
                    key={item.id}
                    type="button"
                    onClick={() => onTabChange(item.id)}
                    className={cls}
                    title={item.label}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${isActive ? '' : 'opacity-85'}`} strokeWidth={isActive ? 2.25 : 2} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200/90 dark:border-slate-800">
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center p-2 mb-4 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title={isCollapsed ? "Expandir" : "Contraer"}
          >
            <ChevronsLeftRight className={`w-5 h-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
          </button>

          <div className={`flex items-center gap-3 mb-4 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold shrink-0">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{user?.email}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{roleProfileSubtitle}</p>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors ${isCollapsed ? 'px-0' : ''}`}
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-[var(--color-juxa-surface-elevated)] sm:p-8 p-4">
        <div className="max-w-7xl mx-auto h-full">
          {/* Mobile Contextual Nav */}
          <div className="md:hidden mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{subtitle}</p>}
            
            {actions && (
              <div className="mb-4">
                {actions}
              </div>
            )}

            <nav className="flex gap-2 overflow-x-auto pb-2">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = sidebarLinkActive(item, activeTab, pathname, search);
                const cls = `flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm transition-colors duration-150 ${
                  isActive ? shellClasses.navMobileActive : shellClasses.navMobileInactive
                }`;
                if (item.to) {
                  return (
                    <Link key={item.id} to={item.to} className={cls}>
                      <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2.25 : 2} />
                      {item.label}
                    </Link>
                  );
                }
                return (
                  <button key={item.id} type="button" onClick={() => onTabChange(item.id)} className={cls}>
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2.25 : 2} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Desktop Header */}
          <div className="hidden md:block mb-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
            {subtitle && <p className="text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
};
