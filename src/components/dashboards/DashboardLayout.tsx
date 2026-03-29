import React from 'react';
import { LucideIcon, LogOut, Settings, LayoutDashboard } from 'lucide-react';
import { useAuthStatus } from '../../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';

interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface DashboardLayoutProps {
  title: string;
  subtitle?: string;
  sidebarItems: SidebarItem[];
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
  const { role, clientProfile, logout, user } = useAuthStatus();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';
  const isAdmin = location.pathname === '/admin';

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden w-full">
      {/* Primary Sidebar (Desktop) */}
      <aside className={`hidden md:flex flex-col bg-white border-r border-slate-200 h-full flex-shrink-0 no-print transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <div className={`p-4 border-b border-slate-200 flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center rounded-lg font-bold shadow-sm shrink-0">
            JV
          </div>
          {!isCollapsed && <span className="font-bold text-xl tracking-tight text-slate-900 truncate">JUXA VERIFY</span>}
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {/* Main Navigation */}
          <div className="space-y-1">
            <Link
              to="/dashboard"
              className={`px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors ${
                isDashboard ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title="Dashboard"
            >
              <LayoutDashboard className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span>Dashboard</span>}
            </Link>
          </div>

          {/* Contextual Navigation (Dashboard Tabs) */}
          <div>
            {!isCollapsed && (
              <div className="px-3 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider truncate">
                {title}
              </div>
            )}
            {actions && !isCollapsed && (
              <div className="px-3 mb-4">
                {actions}
              </div>
            )}
            <nav className="space-y-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    } ${isCollapsed ? 'justify-center' : ''}`}
                    title={item.label}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200">
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center p-2 mb-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title={isCollapsed ? "Expandir" : "Contraer"}
          >
            <LayoutDashboard className={`w-5 h-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
          </button>

          <div className={`flex items-center gap-3 mb-4 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{user?.email}</p>
                <p className="text-xs text-slate-500 truncate">{role} - {clientProfile}</p>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors ${isCollapsed ? 'px-0' : ''}`}
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-white sm:p-8 p-4">
        <div className="max-w-7xl mx-auto h-full">
          {/* Mobile Contextual Nav */}
          <div className="md:hidden mb-6">
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500 mb-4">{subtitle}</p>}
            
            {actions && (
              <div className="mb-4">
                {actions}
              </div>
            )}

            <nav className="flex gap-2 overflow-x-auto pb-2">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Desktop Header */}
          <div className="hidden md:block mb-8">
            <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
            {subtitle && <p className="text-slate-500 mt-1">{subtitle}</p>}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
};
