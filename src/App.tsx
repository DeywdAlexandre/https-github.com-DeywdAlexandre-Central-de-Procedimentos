import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { ProceduresView } from './components/ProceduresView.tsx';
import { DeadlinesView } from './components/DeadlinesView.tsx';
import { HearingsView } from './components/HearingsView.tsx';
import { OfficialNoticesView } from './components/OfficialNoticesView.tsx';
import { PoliceOfficersView } from './components/PoliceOfficersView.tsx';
import { RemindersView } from './components/RemindersView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { BatchImportModal } from './components/BatchImportModal.tsx';
import { OfficialNoticeImportModal } from './components/OfficialNoticeImportModal.tsx';
import { apiRequest } from './lib/api.ts';
import { buildHearingWhatsAppMessage } from './lib/whatsapp-messages.ts';
import {
  DisciplinaryProcedure,
  ProcedureDeadline,
  JudicialHearing,
  PoliceOfficer,
  HearingReminder,
  DashboardMetrics,
} from './types.ts';
import { Shield, Lock, AlertCircle, RefreshCw, LogIn } from 'lucide-react';

function AppContent() {
  const { user, profile, loading: authLoading, signInWithGoogle, logout, token } = useAuth();

  const [currentTab, setCurrentTab] = useState<string>('painel');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [isOfficialNoticeImportOpen, setIsOfficialNoticeImportOpen] = useState(false);
  const [isNewProcedureModalOpen, setIsNewProcedureModalOpen] = useState(false);

  // Estados centrais de dados
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [procedures, setProcedures] = useState<DisciplinaryProcedure[]>([]);
  const [deadlines, setDeadlines] = useState<ProcedureDeadline[]>([]);
  const [hearings, setHearings] = useState<JudicialHearing[]>([]);
  const [officers, setOfficers] = useState<PoliceOfficer[]>([]);
  const [reminders, setReminders] = useState<HearingReminder[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Carregamento de dados
  const fetchAllData = async () => {
    if (!token) return;
    setDataLoading(true);
    try {
      const [dashData, procData, deadData, hearData, offData, remData] = await Promise.all([
        apiRequest('/api/dashboard', token).catch(() => null),
        apiRequest('/api/procedures', token).catch(() => []),
        apiRequest('/api/deadlines', token).catch(() => []),
        apiRequest('/api/hearings', token).catch(() => []),
        apiRequest('/api/officers', token).catch(() => []),
        apiRequest('/api/reminders', token).catch(() => []),
      ]);

      const loadedProcedures = Array.isArray(procData) ? procData : [];
      const loadedDeadlines = Array.isArray(deadData) ? deadData : [];
      const loadedHearings = Array.isArray(hearData) ? hearData : [];
      const loadedOfficers = Array.isArray(offData) ? offData : [];

      setProcedures(loadedProcedures);
      setDeadlines(loadedDeadlines);
      setHearings(loadedHearings);
      setOfficers(loadedOfficers);

      let normalizedReminders: HearingReminder[] = [];
      if (Array.isArray(remData)) {
        normalizedReminders = remData;
      } else if (remData && typeof remData === 'object') {
        const attemptsList = Array.isArray(remData.attempts) ? remData.attempts : [];
        const tomHearingsList = Array.isArray(remData.tomorrowHearings) ? remData.tomorrowHearings : [];

        const fromAttempts: HearingReminder[] = attemptsList.map((a: any) => ({
          id: a.id,
          hearingId: a.hearingId,
          officerId: a.officerId,
          targetType: 'audiencia',
          scheduledFor: a.scheduledFor || a.hearingDate || '',
          recipientName: a.officerName ? `${a.officerRank || ''} ${a.officerName}`.trim() : 'Policial',
          recipientPhone: a.recipientPhone || null,
          messageText: a.messageBody || buildHearingWhatsAppMessage({
            officerRank: a.officerRank,
            officerName: a.officerName,
            processNumber: a.noticeNumber,
            hearingDate: a.hearingDate,
            hearingTime: a.hearingTime,
            court: a.court,
            location: a.location,
            modality: a.modality,
          }),
          status: a.status || 'pendente',
          sentAt: a.sentAt || null,
          errorMessage: a.errorMessage || null,
        }));

        const recordedSet = new Set(attemptsList.map((a: any) => `${a.hearingId}-${a.officerId}`));

        const fromTom: HearingReminder[] = tomHearingsList
          .filter((th: any) => !recordedSet.has(`${th.hearingId}-${th.officerId}`))
          .map((th: any, idx: number) => ({
            id: th.hearingOfficerId || 900000 + idx,
            hearingId: th.hearingId,
            officerId: th.officerId,
            targetType: 'audiencia',
            scheduledFor: th.hearingDate,
            recipientName: `${th.officerRank || ''} ${th.officerName}`.trim(),
            recipientPhone: th.officerPhone || null,
            messageText: buildHearingWhatsAppMessage({
              officerRank: th.officerRank,
              officerName: th.officerName,
              processNumber: th.noticeNumber,
              hearingDate: th.hearingDate,
              hearingTime: th.hearingTime,
              court: th.court,
              location: th.location,
              modality: th.modality,
            }),
            status: 'pendente',
            sentAt: null,
            errorMessage: null,
          }));

        normalizedReminders = [...fromAttempts, ...fromTom];
      }
      setReminders(normalizedReminders);

      if (dashData && dashData.metrics) {
        setDashboardMetrics(dashData);
      } else {
        // Montar métricas calculadas em memória caso o backend retorne vazio ou falhe
        const todayStr = new Date().toISOString().split('T')[0];
        const in7DaysDate = new Date();
        in7DaysDate.setDate(in7DaysDate.getDate() + 7);
        const in7DaysStr = in7DaysDate.toISOString().split('T')[0];

        const overdueCount = loadedDeadlines.filter(
          (d: any) =>
            d.effectiveStatus === 'vencido' ||
            (d.dueDate && d.dueDate < todayStr && d.status !== 'concluido' && d.status !== 'suspenso')
        ).length;

        const upcoming7Count = loadedDeadlines.filter(
          (d: any) =>
            d.dueDate &&
            d.dueDate >= todayStr &&
            d.dueDate <= in7DaysStr &&
            d.status !== 'concluido' &&
            d.status !== 'suspenso'
        ).length;

        const pendingNoticesCount = loadedHearings.reduce(
          (acc: number, h: any) =>
            acc +
            (h.officers || []).filter(
              (ho: any) => ho.noticeStatus === 'pendente' || !ho.signedAt || !ho.acknowledgedAt
            ).length,
          0
        );

        const pendingRemCount = normalizedReminders.filter((r) => r.status === 'pendente').length;

        setDashboardMetrics({
          metrics: {
            activeProcedures: loadedProcedures.filter((p: any) => !p.archived).length,
            overdueDeadlines: overdueCount,
            upcomingDeadlines7Days: upcoming7Count,
            upcomingHearings: loadedHearings.filter((h: any) => h.status === 'agendada' || h.status === 'remarcada').length,
            pendingNotices: pendingNoticesCount,
            pendingReminders: pendingRemCount,
          },
          urgentDeadlines: loadedDeadlines.slice(0, 10),
          upcomingHearings: loadedHearings.slice(0, 8),
          recentActivity: [],
        });
      }
    } catch (err) {
      console.error('Erro ao carregar dados do sistema:', err);
    } finally {
      setDataLoading(false);
    }
  };



  useEffect(() => {
    if (token) {
      fetchAllData();
    }
  }, [token]);

  // Se estiver carregando auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-3 text-white">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-400">
            Iniciando sessão segura da Central de Procedimentos...
          </p>
        </div>
      </div>
    );
  }

  // Se não estiver logado
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* Header Visual */}
          <div className="bg-slate-950 p-6 text-center text-white space-y-2 border-b border-slate-800">
            <div className="inline-flex p-3 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 mb-1">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-lg font-extrabold tracking-tight">Central de Procedimentos</h1>
            <p className="text-xs text-slate-400 font-medium">
              Controle Administrativo de Procedimentos Disciplinares, Audiências e Prazos (PMPE)
            </p>
          </div>

          {/* Form / Botão de Acesso */}
          <div className="p-6 space-y-5">
            <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-blue-900 text-xs leading-relaxed">
              <strong className="block font-bold mb-0.5">Acesso Restrito à Equipe:</strong>
              Ferramenta interna de gestão operacional. Acesso restrito a servidores autorizados via
              conta institucional ou previamente cadastrados na lista de permissões.
            </div>

            <div className="space-y-3 pt-1">
              <button
                id="btn-google-login"
                onClick={signInWithGoogle}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-300 rounded-xl shadow-2xs bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs transition-all active:scale-[0.99]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Entrar com Conta Google</span>
              </button>
            </div>

            <div className="pt-2 text-center text-[11px] text-slate-400">
              Administrador do sistema inicial:{' '}
              <span className="font-mono text-slate-600">deywd12@gmail.com</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Se logado mas sem perfil ou desativado
  if (!profile || profile.status === 'revogado') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Acesso Pendente de Autorização</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            O seu e-mail (<strong>{user.email}</strong>) foi autenticado, mas ainda não possui
            autorização ativa no quadro de permissões da Central de Procedimentos.
          </p>
          <p className="text-xs text-slate-500">
            Solicite ao administrador (<strong>deywd12@gmail.com</strong>) a inclusão do seu e-mail
            na equipe administrativa.
          </p>
          <button
            onClick={logout}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Sair da Conta
          </button>
        </div>
      </div>
    );
  }


  // Cálculos para badges do menu lateral
  const safeProcedures = Array.isArray(procedures) ? procedures : [];
  const safeDeadlines = Array.isArray(deadlines) ? deadlines : [];
  const safeHearings = Array.isArray(hearings) ? hearings : [];
  const safeReminders = Array.isArray(reminders) ? reminders : [];

  const countOverdueDeadlines = safeDeadlines.filter((d) => d.effectiveStatus === 'vencido').length;
  const countPendingDeadlines = safeDeadlines.filter((d) => d.effectiveStatus === 'a_confirmar').length;
  const countUpcomingHearings = safeHearings.filter((h) => h.status === 'agendada').length;
  const countPendingNotices = safeHearings.reduce(
    (acc, h) =>
      acc +
      (h.officers || []).filter(
        (ho) => ho.noticeStatus === 'pendente' || !ho.signedAt || !ho.acknowledgedAt
      ).length,
    0
  );
  const countPendingReminders = safeReminders.filter((r) => r.status === 'pendente').length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Barra Lateral (Navy Blue #0f172a) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setMobileSidebarOpen(false);
        }}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        badgeCounts={{
          procedimentos: safeProcedures.filter((p) => !p.archived).length,
          prazos: countOverdueDeadlines + countPendingDeadlines,
          audiencias: countUpcomingHearings,
          oficios: countPendingNotices,
          lembretes: countPendingReminders,
        }}
      />

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header com Busca e Ações */}
        <Header
          currentTab={currentTab}
          globalSearch={globalSearch}
          onSearchChange={setGlobalSearch}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onOpenBatchImport={() => setIsBatchImportOpen(true)}
          onOpenOfficialNoticeImport={() => setIsOfficialNoticeImportOpen(true)}
          onOpenNewProcedure={() => {
            setCurrentTab('procedimentos');
            setIsNewProcedureModalOpen(true);
          }}
          onOpenNewHearing={() => {
            setCurrentTab('audiencias');
          }}
          pendingAlertsCount={countOverdueDeadlines + countPendingNotices}
        />


        {/* Área de Visualização com Padding */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          {(currentTab === 'dashboard' || currentTab === 'painel') && (
            <DashboardView
              stats={dashboardMetrics}
              metrics={dashboardMetrics}
              loading={dataLoading}
              onNavigate={setCurrentTab}
              onOpenBatchImport={() => setIsBatchImportOpen(true)}
            />
          )}


          {currentTab === 'procedimentos' && (
            <ProceduresView
              procedures={procedures}
              loading={dataLoading}
              onRefresh={fetchAllData}
              globalSearch={globalSearch}
              isCreateModalOpenExternal={isNewProcedureModalOpen}
              onCloseCreateModalExternal={() => setIsNewProcedureModalOpen(false)}
            />
          )}

          {currentTab === 'prazos' && (
            <DeadlinesView
              deadlines={deadlines}
              procedures={procedures}
              loading={dataLoading}
              onRefresh={fetchAllData}
              globalSearch={globalSearch}
            />
          )}

          {currentTab === 'audiencias' && (
            <HearingsView
              hearings={hearings}
              officers={officers}
              loading={dataLoading}
              onRefresh={fetchAllData}
              globalSearch={globalSearch}
              onOpenOfficialNoticeImport={() => setIsOfficialNoticeImportOpen(true)}
              onOpenBatchImport={() => setIsBatchImportOpen(true)}
            />
          )}

          {currentTab === 'oficios' && (
            <OfficialNoticesView
              hearings={hearings}
              officers={officers}
              loading={dataLoading}
              onRefresh={fetchAllData}
              globalSearch={globalSearch}
              onOpenOfficialNoticeImport={() => setIsOfficialNoticeImportOpen(true)}
            />
          )}

          {currentTab === 'policiais' && (
            <PoliceOfficersView
              officers={officers}
              loading={dataLoading}
              onRefresh={fetchAllData}
              globalSearch={globalSearch}
            />
          )}

          {currentTab === 'lembretes' && (
            <RemindersView
              reminders={reminders}
              loading={dataLoading}
              onRefresh={fetchAllData}
              globalSearch={globalSearch}
            />
          )}

          {currentTab === 'configuracoes' && (
            <SettingsView onRefresh={fetchAllData} globalSearch={globalSearch} />
          )}
        </main>
      </div>

      {/* Modal de Importação em Lote WhatsApp */}
      <BatchImportModal
        isOpen={isBatchImportOpen}
        onClose={() => setIsBatchImportOpen(false)}
        onSuccess={fetchAllData}
      />

      {/* Modal de Importação de Ofício Judicial */}
      <OfficialNoticeImportModal
        isOpen={isOfficialNoticeImportOpen}
        onClose={() => setIsOfficialNoticeImportOpen(false)}
        onSuccess={fetchAllData}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
