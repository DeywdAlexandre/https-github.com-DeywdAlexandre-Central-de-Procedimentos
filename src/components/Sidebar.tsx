import React from 'react';
import {
  LayoutDashboard,
  FileText,
  ClockAlert,
  Gavel,
  FileCheck,
  Shield,
  BellRing,
  Settings,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Layers,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export type NavTab =
  | 'painel'
  | 'procedimentos'
  | 'prazos'
  | 'audiencias'
  | 'oficios'
  | 'policiais'
  | 'lembretes'
  | 'configuracoes';

export interface BadgeCounts {
  overdueDeadlines?: number;
  upcomingDeadlines?: number;
  pendingNotices?: number;
  tomorrowReminders?: number;
  procedimentos?: number;
  prazos?: number;
  audiencias?: number;
  oficios?: number;
  lembretes?: number;
}

interface SidebarProps {
  currentTab: NavTab | string;
  onSelectTab: (tab: any) => void;
  badgeCounts?: BadgeCounts;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  badgeCounts = {} as BadgeCounts,
  mobileOpen: externalMobileOpen,
  setMobileOpen: externalSetMobileOpen,
}) => {

  const [internalMobileOpen, setInternalMobileOpen] = React.useState(false);
  const mobileOpen = externalMobileOpen !== undefined ? externalMobileOpen : internalMobileOpen;
  const setMobileOpen = externalSetMobileOpen || setInternalMobileOpen;

  const { profile, logout } = useAuth();

  const navItems: {
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    badgeColor?: string;
  }[] = [
    {
      id: 'painel',
      label: 'Painel',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'procedimentos',
      label: 'Procedimentos',
      icon: <FileText className="w-5 h-5" />,
      badge: badgeCounts.procedimentos,
      badgeColor: 'bg-slate-700 text-white',
    },
    {
      id: 'prazos',
      label: 'Prazos',
      icon: <ClockAlert className="w-5 h-5" />,
      badge: badgeCounts.overdueDeadlines ?? badgeCounts.prazos,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'audiencias',
      label: 'Audiências',
      icon: <Gavel className="w-5 h-5" />,
      badge: badgeCounts.audiencias,
      badgeColor: 'bg-blue-600 text-white',
    },
    {
      id: 'oficios',
      label: 'Ofícios',
      icon: <FileCheck className="w-5 h-5" />,
      badge: badgeCounts.pendingNotices ?? badgeCounts.oficios,
      badgeColor: 'bg-amber-500 text-slate-900',
    },
    {
      id: 'policiais',
      label: 'Policiais',
      icon: <Shield className="w-5 h-5" />,
    },
    {
      id: 'lembretes',
      label: 'Lembretes',
      icon: <BellRing className="w-5 h-5" />,
      badge: badgeCounts.tomorrowReminders ?? badgeCounts.lembretes,
      badgeColor: 'bg-emerald-500 text-white',
    },
    {
      id: 'configuracoes',
      label: 'Equipe & Ajustes',
      icon: <Settings className="w-5 h-5" />,
    },
  ];


  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'administrador':
        return 'Administrador';
      case 'editor':
        return 'Editor Adm.';
      case 'somente_leitura':
        return 'Consulta';
      default:
        return 'Membro';
    }
  };

  const getRoleBadgeStyle = (role?: string) => {
    switch (role) {
      case 'administrador':
        return 'bg-amber-400/20 text-amber-300 border-amber-400/30';
      case 'editor':
        return 'bg-blue-400/20 text-blue-300 border-blue-400/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <>
      {/* Backdrop mobile */}
      {mobileOpen && (
        <div
          id="sidebar-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 xl:w-72 bg-[#0c1427] text-slate-200 border-r border-slate-800 transition-transform duration-200 ease-in-out lg:static lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:z-30 ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header da Sidebar */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800/80 bg-[#080e1c]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-800 text-white shadow-md shadow-blue-950/50 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold tracking-tight text-white truncate">
                Central de Procedimentos
              </h1>
              <p className="text-[11px] text-slate-400 font-medium truncate flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                Controle Interno PMPE
              </p>
            </div>
          </div>

          <button
            id="btn-close-mobile-sidebar"
            onClick={() => setMobileOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 lg:hidden transition-colors"
            aria-label="Fechar menu lateral"
          >
            <X className="w-5 h-5" />
          </button>
        </div>


        {/* Links de navegação */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-btn-${item.id}`}
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                        item.badgeColor || 'bg-slate-700 text-slate-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-4 h-4 opacity-70" />}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Rodapé da Sidebar com perfil e logout */}
        <div className="p-3 border-t border-slate-800/80 bg-[#080e1c]">
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center justify-center font-bold text-xs uppercase">
                  {profile?.name ? profile.name.slice(0, 2) : 'PM'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">
                    {profile?.name || profile?.email || 'Membro da Equipe'}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{profile?.email}</p>
                </div>
              </div>
              <button
                id="btn-logout"
                title="Sair do sistema"
                onClick={logout}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
              <span className="text-slate-400">Perfil:</span>
              <span
                className={`px-2 py-0.5 rounded-md border font-semibold ${getRoleBadgeStyle(
                  profile?.role
                )}`}
              >
                {getRoleLabel(profile?.role)}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
