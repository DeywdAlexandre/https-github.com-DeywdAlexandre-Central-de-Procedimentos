import React, { useState } from 'react';
import {
  Bell,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RotateCcw,
  ExternalLink,
  Search,
  Filter,
  Phone,
  Send,
  Calendar,
  CheckCheck,
} from 'lucide-react';
import { HearingReminder } from '../types.ts';
import { formatDateBR } from '../lib/deadline-calculator.ts';
import { createWhatsAppUrl, openWhatsAppChat } from '../lib/whatsapp-messages.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';

interface RemindersViewProps {
  reminders: HearingReminder[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  globalSearch?: string;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  reminders,
  loading,
  onRefresh,
  globalSearch = '',
}) => {
  const { profile, token } = useAuth();
  const canEdit = profile?.role === 'editor' || profile?.role === 'administrador';

  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('todos');

  const handleUpdateStatus = async (reminder: HearingReminder, newStatus: string) => {
    try {
      // Se for um lembrete sintético ou ainda não persistido
      if ((reminder.isSynthetic || reminder.id >= 900000) && reminder.hearingId && reminder.officerId) {
        await apiRequest('/api/reminders/record-send', token, {
          method: 'POST',
          body: JSON.stringify({
            hearingId: reminder.hearingId,
            officerId: reminder.officerId,
            status: newStatus,
            recipientPhone: reminder.recipientPhone || null,
            messageBody: reminder.messageText || null,
            channel: 'whatsapp_manual',
          }),
        });
      } else {
        await apiRequest(`/api/reminders/${reminder.id}/status`, token, {
          method: 'PUT',
          body: JSON.stringify({
            status: newStatus,
            hearingId: reminder.hearingId,
            officerId: reminder.officerId,
          }),
        });
      }
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao atualizar lembrete: ${err.message}`);
    }
  };

  const handleOpenWhatsAppWeb = (r: HearingReminder) => {
    if (!r.recipientPhone) {
      alert('Telefone do destinatário não cadastrado.');
      return;
    }
    openWhatsAppChat(r.recipientPhone, r.messageText);
    // Registrar automaticamente ou sugerir confirmação
    if (r.status === 'pendente') {
      handleUpdateStatus(r, 'enviado');
    }
  };

  const safeReminders = Array.isArray(reminders) ? reminders : [];

  const filteredReminders = safeReminders.filter((r) => {
    if (statusFilter !== 'todos' && r.status !== statusFilter) return false;
    if (targetTypeFilter !== 'todos' && r.targetType !== targetTypeFilter) return false;
    if (globalSearch) {
      const term = globalSearch.toLowerCase();
      const rec = (r.recipientName || '').toLowerCase();
      const phone = (r.recipientPhone || '').toLowerCase();
      const msg = (r.messageText || '').toLowerCase();
      if (!rec.includes(term) && !phone.includes(term) && !msg.includes(term)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Controles de Filtro */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
          >
            <option value="todos">Todos os Status</option>
            <option value="pendente">Pendentes</option>
            <option value="enviado">Enviados</option>
            <option value="entregue">Entregues</option>
            <option value="lido">Lidos</option>
            <option value="falhou">Falharam</option>
            <option value="cancelado">Cancelados</option>
          </select>

          <select
            value={targetTypeFilter}
            onChange={(e) => setTargetTypeFilter(e.target.value)}
            className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
          >
            <option value="todos">Prazos & Audiências</option>
            <option value="audiencia">Somente Audiências</option>
            <option value="prazo">Somente Prazos</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Total: <strong className="text-slate-800">{filteredReminders.length}</strong> lembretes
        </div>
      </div>

      {/* Lista de Lembretes */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Carregando lembretes...</div>
        ) : filteredReminders.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Bell className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700 text-sm">Nenhum lembrete registrado</p>
            <p className="text-xs text-slate-400">
              Lembretes são gerados automaticamente nas regras de prazos (15, 7, 3, 1 dias) e audiências (5, 2 dias e véspera).
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredReminders.map((r) => {
              const isPending = r.status === 'pendente';
              const isFailed = r.status === 'falhou';

              return (
                <div
                  key={r.id}
                  id={`reminder-item-${r.id}`}
                  className="p-4 sm:p-5 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          r.status === 'pendente'
                            ? 'bg-amber-100 text-amber-800'
                            : r.status === 'enviado'
                            ? 'bg-blue-100 text-blue-800'
                            : r.status === 'entregue'
                            ? 'bg-indigo-100 text-indigo-800'
                            : r.status === 'lido'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.status === 'falhou'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {r.status}
                      </span>

                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 uppercase">
                        {r.targetType}
                      </span>

                      <span className="text-xs font-bold text-slate-900">
                        {r.recipientName || 'Sem destinatário'}
                      </span>

                      {r.recipientPhone && (
                        <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {r.recipientPhone}
                        </span>
                      )}
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 whitespace-pre-line">
                      {r.messageText}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Agendado para: {new Date(r.scheduledFor).toLocaleString('pt-BR')}
                      </span>
                      {r.sentAt && (
                        <span className="text-emerald-700 font-medium">
                          Enviado em: {new Date(r.sentAt).toLocaleString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  {canEdit && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-start pt-1">
                      {r.recipientPhone && r.status !== 'cancelado' && (
                        <button
                          onClick={() => handleOpenWhatsAppWeb(r)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors"
                          title="Abrir WhatsApp Web pré-preenchido com esta mensagem"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Enviar WhatsApp</span>
                        </button>
                      )}

                      {isPending && (
                        <button
                          onClick={() => handleUpdateStatus(r, 'enviado')}
                          className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
                          title="Marcar manualmente como enviado pela equipe"
                        >
                          Marcar Enviado
                        </button>
                      )}

                      {isFailed && (
                        <button
                          onClick={() => handleUpdateStatus(r, 'pendente')}
                          className="px-2.5 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reenviar</span>
                        </button>
                      )}

                      {r.status !== 'cancelado' && r.status !== 'lido' && (
                        <button
                          onClick={() => handleUpdateStatus(r, 'cancelado')}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                          title="Cancelar lembrete"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
