import React from 'react';
import {
  Menu,
  Plus,
  Search,
  MessageSquareShare,
  CalendarDays,
  FilePlus,
  Clock,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { NavTab } from './Sidebar.tsx';

interface HeaderProps {
  currentTab: NavTab | string;
  onOpenMobileSidebar?: () => void;
  onOpenNewProcedure?: () => void;
  onOpenNewHearing?: () => void;
  onOpenBatchImport?: () => void;
  onOpenOfficialNoticeImport?: () => void;
  globalSearch?: string;
  setGlobalSearch?: (term: string) => void;
  onSearchChange?: (term: string) => void;
  pendingAlertsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobileSidebar,
  onOpenNewProcedure,
  onOpenNewHearing,
  onOpenBatchImport,
  onOpenOfficialNoticeImport,
  globalSearch = '',
  setGlobalSearch,
  onSearchChange,
  pendingAlertsCount,
}) => {
  const { profile } = useAuth();
  const canEdit = profile?.role === 'editor' || profile?.role === 'administrador';

  const handleSearchChange = (val: string) => {
    if (onSearchChange) onSearchChange(val);
    if (setGlobalSearch) setGlobalSearch(val);
  };

  const tabTitles: Record<string, { title: string; subtitle: string }> = {
    painel: {
      title: 'Painel Geral de Controle',
      subtitle: 'Visão consolidada de procedimentos disciplinares, prazos e audiências',
    },
    dashboard: {
      title: 'Painel Geral de Controle',
      subtitle: 'Visão consolidada de procedimentos disciplinares, prazos e audiências',
    },
    procedimentos: {
      title: 'Procedimentos Disciplinares',
      subtitle: 'Acompanhamento rigoroso de PDS e Sindicâncias da PMPE',
    },
    prazos: {
      title: 'Gestão de Prazos',
      subtitle: 'Controle com cálculo transparente, confirmação explícita e histórico',
    },
    audiencias: {
      title: 'Audiências Judiciais',
      subtitle: 'Apresentação de policiais militares e controle de ofícios',
    },
    oficios: {
      title: 'Ofícios de Apresentação',
      subtitle: 'Acompanhamento de emissão, assinatura, ciência e termos de comparecimento',
    },
    policiais: {
      title: 'Cadastro de Policiais',
      subtitle: 'Diretório interno compartilhado de policiais militares convocados',
    },
    lembretes: {
      title: 'Lembretes e Comunicações',
      subtitle: 'Avisos de audiências para o dia seguinte e canal WhatsApp',
    },
    configuracoes: {
      title: 'Equipe e Configurações',
      subtitle: 'Gestão de acesso seguro, auditoria e parâmetros do sistema',
    },
  };

  const currentHeaderInfo = tabTitles[currentTab] || {
    title: 'Central de Procedimentos',
    subtitle: 'Controle Administrativo de Procedimentos Disciplinares, Audiências e Prazos (PMPE)',
  };

  const { title, subtitle } = currentHeaderInfo;


  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/90 shadow-2xs px-4 sm:px-8 py-3.5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Lado esquerdo: Título e toggle mobile */}
        <div className="flex items-center gap-3">
          <button
            id="btn-mobile-sidebar-toggle"
            onClick={onOpenMobileSidebar}
            className="p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg lg:hidden"
            aria-label="Abrir menu lateral"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h2>
            <p className="text-xs text-slate-500 font-medium hidden sm:block">{subtitle}</p>
          </div>
        </div>

        {/* Lado direito: Busca e Ações Rápidas */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Campo de Busca Global */}
          <div className="relative flex-1 sm:w-64 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="global-search-input"
              type="text"
              placeholder="Buscar SEI, ofício, policial..."
              value={globalSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder-slate-400 transition-all"
            />
          </div>

          {/* Horário e Fuso */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200 text-slate-600 text-xs font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Fuso: America/Recife</span>
          </div>

          {/* Botões de Ação Rápida */}
          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                id="btn-quick-batch-import"
                onClick={onOpenBatchImport}
                className="btn-3d-emerald px-3 py-1.5 text-xs rounded-lg"
                title="Importar texto copiado do WhatsApp"
              >
                <MessageSquareShare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Importar</span> WhatsApp
              </button>

              <button
                id="btn-quick-official-notice-import"
                onClick={onOpenOfficialNoticeImport}
                className="btn-3d-secondary px-3 py-1.5 text-xs rounded-lg"
                title="Importar audiência colando texto de Ofício Judicial"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Importar</span> Ofício
              </button>

              <button
                id="btn-quick-new-procedure"
                onClick={onOpenNewProcedure}
                className="btn-3d-primary px-3 py-1.5 text-xs rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Procedimento</span>
              </button>

              <button
                id="btn-quick-new-hearing"
                onClick={onOpenNewHearing}
                className="btn-3d-indigo px-3 py-1.5 text-xs rounded-lg"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">+ Audiência</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
