import React, { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  ShieldCheck,
  History,
  Download,
  Plus,
  Trash2,
  Lock,
  UserCheck,
  CheckCircle2,
  Clock,
  Search,
} from 'lucide-react';
import { UserProfile, AuditLogEntry } from '../types.ts';
import { exportAuditLogsToCSV } from '../lib/csv-export.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';

interface SettingsViewProps {
  onRefresh: () => Promise<void>;
  globalSearch?: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onRefresh, globalSearch = '' }) => {
  const { profile, token } = useAuth();
  const isAdmin = profile?.role === 'administrador';

  const [activeTab, setActiveTab] = useState<'usuarios' | 'auditoria' | 'parametros'>('usuarios');

  // Usuários do sistema
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'leitor' | 'editor' | 'administrador'>('editor');
  const [newUserName, setNewUserName] = useState('');

  // Logs de Auditoria
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [auditFilterAction, setAuditFilterAction] = useState<string>('todos');

  const fetchUsers = async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const data = await apiRequest('/api/users', token);
      setUsers(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const data = await apiRequest('/api/audit-logs', token);
      setLogs(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'usuarios' && isAdmin) {
      fetchUsers();
    } else if (activeTab === 'auditoria') {
      fetchLogs();
    }
  }, [activeTab]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim()) return;
    try {
      await apiRequest('/api/users', token, {
        method: 'POST',
        body: JSON.stringify({
          email: newUserEmail.trim(),
          role: newUserRole,
          displayName: newUserName.trim() || undefined,
        }),
      });
      setNewUserEmail('');
      setNewUserName('');
      await fetchUsers();
      alert('Usuário autorizado com sucesso na equipe!');
    } catch (err: any) {
      alert(`Erro ao adicionar usuário: ${err.message}`);
    }
  };

  const handleUpdateUserRole = async (userId: number, newRole: string) => {
    try {
      await apiRequest(`/api/users/${userId}/role`, token, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      await fetchUsers();
    } catch (err: any) {
      alert(`Erro ao alterar papel: ${err.message}`);
    }
  };

  const handleToggleUserActive = async (userId: number, currentActive: boolean) => {
    try {
      await apiRequest(`/api/users/${userId}/active`, token, {
        method: 'PUT',
        body: JSON.stringify({ active: !currentActive }),
      });
      await fetchUsers();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const filteredLogs = logs.filter((l) => {
    if (auditFilterAction !== 'todos' && l.action !== auditFilterAction) return false;
    if (globalSearch) {
      const term = globalSearch.toLowerCase();
      const entity = (l.entityType || '').toLowerCase();
      const user = (l.userEmail || '').toLowerCase();
      const act = (l.action || '').toLowerCase();
      if (!entity.includes(term) && !user.includes(term) && !act.includes(term)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Abas de Configuração */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('usuarios')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'usuarios'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Equipe & Controle de Acesso (RBAC)</span>
        </button>

        <button
          onClick={() => setActiveTab('auditoria')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'auditoria'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Trilha Completa de Auditoria</span>
        </button>

        <button
          onClick={() => setActiveTab('parametros')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'parametros'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Parâmetros de Prazos & Sistema</span>
        </button>
      </div>

      {/* ABA: EQUIPE & USUÁRIOS */}
      {activeTab === 'usuarios' && (
        <div className="space-y-6">
          {!isAdmin ? (
            <div className="p-6 bg-white rounded-xl border border-slate-200 text-center space-y-2">
              <Lock className="w-8 h-8 text-slate-400 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">Acesso Restrito ao Administrador</h4>
              <p className="text-xs text-slate-500">
                A gestão de usuários e permissões é exclusiva do administrador do sistema (
                <strong>deywd12@gmail.com</strong>).
              </p>
            </div>
          ) : (
            <>
              {/* Formulário de Autorização de Novo Usuário */}
              <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
                <h4 className="text-sm font-bold text-slate-900 mb-1">
                  Autorizar Novo Membro na Equipe Administrativa
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  Adicione o e-mail do servidor. Ao logar com a conta Google, ele receberá o papel
                  atribuído.
                </p>

                <form
                  onSubmit={handleAddUser}
                  className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs"
                >
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      E-mail do Usuário *
                    </label>
                    <input
                      type="email"
                      required
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="exemplo@pm.pe.gov.br ou gmail.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nome / Identificação
                    </label>
                    <input
                      type="text"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Ex.: Sgt Carlos"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Papel / RBAC *</label>
                    <select
                      value={newUserRole}
                      onChange={(e) =>
                        setNewUserRole(e.target.value as 'leitor' | 'editor' | 'administrador')
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                    >
                      <option value="leitor">Leitor (Apenas Consulta)</option>
                      <option value="editor">Editor (Cria e Altera)</option>
                      <option value="administrador">Administrador (Total)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-4 flex justify-end pt-2">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Autorizar Usuário</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Lista de Usuários Autorizados */}
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Usuários Cadastrados na Allowlist
                  </h5>
                  <span className="text-xs text-slate-500 font-medium">
                    Total: {users.length} membros
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {u.displayName || u.email}
                          </span>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[10px] font-bold uppercase ${
                              u.role === 'administrador'
                                ? 'bg-purple-100 text-purple-800'
                                : u.role === 'editor'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {u.role}
                          </span>
                          {!u.active && (
                            <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              Desativado
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500">{u.email}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <select
                          disabled={u.email === 'deywd12@gmail.com'}
                          value={u.role}
                          onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                          className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold"
                        >
                          <option value="leitor">Leitor</option>
                          <option value="editor">Editor</option>
                          <option value="administrador">Administrador</option>
                        </select>

                        {u.email !== 'deywd12@gmail.com' && (
                          <button
                            onClick={() => handleToggleUserActive(u.id, u.active)}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                              u.active
                                ? 'text-rose-700 bg-rose-50 hover:bg-rose-100'
                                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                            }`}
                          >
                            {u.active ? 'Desativar' : 'Ativar'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ABA: AUDITORIA */}
      {activeTab === 'auditoria' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <select
                value={auditFilterAction}
                onChange={(e) => setAuditFilterAction(e.target.value)}
                className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
              >
                <option value="todos">Todas as Ações</option>
                <option value="CREATE_PROCEDURE">Criação de Procedimento</option>
                <option value="UPDATE_PROCEDURE">Alteração de Procedimento</option>
                <option value="CREATE_DEADLINE">Criação de Prazo</option>
                <option value="CONFIRM_DEADLINE">Confirmação de Prazo</option>
                <option value="EXTEND_DEADLINE">Prorrogação de Prazo</option>
                <option value="RESCHEDULE_HEARING">Remarcação de Audiência</option>
                <option value="BATCH_IMPORT_HEARINGS">Importação em Lote</option>
              </select>
            </div>

            <button
              onClick={() => exportAuditLogsToCSV(filteredLogs)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exportar Trilha (CSV)</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            {loadingLogs ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                Carregando registros de auditoria...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-1">
                <History className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700 text-sm">
                  Nenhum registro de auditoria encontrado
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-slate-50 text-xs space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-white font-mono">
                          {log.action}
                        </span>
                        <span className="font-bold text-slate-800">
                          {log.entityType} #{log.entityId}
                        </span>
                      </div>
                      <span className="text-slate-400 text-[11px]">
                        {new Date(log.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="font-semibold text-slate-900">{log.userEmail}</span>
                      {log.userIp && (
                        <span className="text-[10px] text-slate-400">IP: {log.userIp}</span>
                      )}
                    </div>

                    {log.details && (
                      <pre className="p-2 bg-slate-50 rounded border border-slate-200 text-[11px] font-mono text-slate-700 overflow-x-auto">
                        {log.details}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA: PARÂMETROS */}
      {activeTab === 'parametros' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-2xs space-y-4 text-xs">
          <h4 className="text-sm font-bold text-slate-900">
            Diretrizes do Sistema & Transparência Operacional
          </h4>
          <div className="space-y-3 text-slate-600 leading-relaxed">
            <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200 text-blue-950">
              <strong className="block font-bold mb-1">
                1. O SEI como Fonte Primária da Verdade:
              </strong>
              A Central de Procedimentos é uma ferramenta de acompanhamento, controle de alertas e
              gestão de fluxo interno da equipe administrativa. A existência do processo, despachos
              e peças oficiais residem de forma definitiva no Sistema Eletrônico de Informações
              (SEI).
            </div>

            <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200 text-amber-950">
              <strong className="block font-bold mb-1">
                2. Princípio da Não-Fixação de Prazos Legais Automáticos:
              </strong>
              Em cumprimento às exigências de conformidade com a legislação estadual e militar,
              nenhum prazo é dado como juridicamente correto de forma estática. Todo cálculo
              apresenta sua memória e exige confirmação expressa da chefia ou encarregado.
            </div>

            <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200 text-emerald-950">
              <strong className="block font-bold mb-1">
                3. Ciência e Assinaturas não Presumidas:
              </strong>
              O mero disparo ou envio de mensagens via WhatsApp não substitui o recebimento da
              ciência formal do policial militar nem a assinatura do ofício de apresentação pelo
              Comandante.
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-800">
              <strong className="block font-bold mb-1">
                4. Otimização do Envio de WhatsApp (Reutilização de Aba):
              </strong>
              O sistema utiliza direcionamento fixo (<code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">whatsapp_web</code>)
              ao clicar nos botões de envio. Isso faz com que o navegador reutilize a mesma aba ou janela do WhatsApp Web
              já aberta, evitando o acúmulo de dezenas de abas repetidas.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
