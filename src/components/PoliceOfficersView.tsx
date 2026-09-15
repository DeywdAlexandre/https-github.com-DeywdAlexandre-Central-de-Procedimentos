import React, { useState } from 'react';
import {
  Shield,
  Search,
  Plus,
  Phone,
  Edit2,
  CheckCircle2,
  XCircle,
  X,
  User,
  Hash,
  Trash2,
  AlertTriangle,
  LayoutGrid,
  List as ListIcon,
  Filter,
} from 'lucide-react';
import { PoliceOfficer } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';

interface PoliceOfficersViewProps {
  officers: PoliceOfficer[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  globalSearch?: string;
}

const RANKS = [
  'Cel PM',
  'Ten Cel PM',
  'Maj PM',
  'Cap PM',
  '1º Ten PM',
  '2º Ten PM',
  'Subten PM',
  '1º Sgt PM',
  '2º Sgt PM',
  '3º Sgt PM',
  'Cb PM',
  'Sd PM',
];

export const PoliceOfficersView: React.FC<PoliceOfficersViewProps> = ({
  officers,
  loading,
  onRefresh,
  globalSearch = '',
}) => {
  const { profile, token } = useAuth();
  const canEdit = profile?.role === 'editor' || profile?.role === 'administrador';

  // Modo de visualização: Grade vs Lista (com persistência)
  const [viewMode, setViewMode] = useState<'grade' | 'lista'>(() => {
    return (
      (typeof localStorage !== 'undefined' &&
        (localStorage.getItem('officers_view_mode') as 'grade' | 'lista')) ||
      'grade'
    );
  });

  // Filtros
  const [localSearch, setLocalSearch] = useState('');
  const [rankFilter, setRankFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativos' | 'inativos'>('ativos');
  const [phoneFilter, setPhoneFilter] = useState<'todos' | 'com_fone' | 'sem_fone'>('todos');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState<PoliceOfficer | null>(null);
  const [deletingOfficer, setDeletingOfficer] = useState<PoliceOfficer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    rank: 'Sd PM',
    badge: '',
    shortName: '',
    aliases: '',
    phone: '',
    notes: '',
    active: true,
  });

  const handleSetViewMode = (mode: 'grade' | 'lista') => {
    setViewMode(mode);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('officers_view_mode', mode);
    }
  };

  const hasActiveFilters =
    Boolean(localSearch.trim()) ||
    rankFilter !== 'todos' ||
    statusFilter !== 'ativos' ||
    phoneFilter !== 'todos';

  const handleClearFilters = () => {
    setLocalSearch('');
    setRankFilter('todos');
    setStatusFilter('ativos');
    setPhoneFilter('todos');
  };

  const handleOpenCreate = () => {
    setEditingOfficer(null);
    setFormData({
      fullName: '',
      rank: 'Sd PM',
      badge: '',
      shortName: '',
      aliases: '',
      phone: '',
      notes: '',
      active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (off: PoliceOfficer) => {
    setEditingOfficer(off);
    setFormData({
      fullName: off.fullName,
      rank: off.rank,
      badge: off.badge || '',
      shortName: off.shortName || '',
      aliases: off.aliases || '',
      phone: off.phone || '',
      notes: off.notes || '',
      active: off.active,
    });
    setIsModalOpen(true);
  };

  const handleSaveOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingOfficer) {
        await apiRequest(`/api/officers/${editingOfficer.id}`, token, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await apiRequest('/api/officers', token, {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      setIsModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao salvar policial: ${err.message}`);
    }
  };

  const handleDeleteOfficer = async () => {
    if (!deletingOfficer) return;
    setIsDeleting(true);
    try {
      await apiRequest(`/api/officers/${deletingOfficer.id}`, token, {
        method: 'DELETE',
      });
      setDeletingOfficer(null);
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao excluir policial: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredOfficers = officers.filter((o) => {
    // Filtro de Situação
    if (statusFilter === 'ativos' && !o.active) return false;
    if (statusFilter === 'inativos' && o.active) return false;

    // Filtro de Telefone
    if (phoneFilter === 'com_fone' && !o.phone) return false;
    if (phoneFilter === 'sem_fone' && Boolean(o.phone)) return false;

    // Filtro de Posto / Graduação
    if (rankFilter !== 'todos') {
      if (rankFilter === 'oficiais') {
        const isOficial = ['Cel PM', 'Ten Cel PM', 'Maj PM', 'Cap PM', '1º Ten PM', '2º Ten PM'].includes(
          o.rank
        );
        if (!isOficial) return false;
      } else if (rankFilter === 'pracas') {
        const isPraca = ['Subten PM', '1º Sgt PM', '2º Sgt PM', '3º Sgt PM', 'Cb PM', 'Sd PM'].includes(
          o.rank
        );
        if (!isPraca) return false;
      } else if (o.rank !== rankFilter) {
        return false;
      }
    }

    // Busca textual (Local ou Global)
    const term = (localSearch || globalSearch).trim().toLowerCase();
    if (term) {
      const match =
        (o.fullName || '').toLowerCase().includes(term) ||
        (o.shortName && o.shortName.toLowerCase().includes(term)) ||
        (o.badge && o.badge.toLowerCase().includes(term)) ||
        (o.aliases && o.aliases.toLowerCase().includes(term)) ||
        (o.rank && o.rank.toLowerCase().includes(term));
      if (!match) return false;
    }

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Barra de Filtros e Controles */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Campo de Busca Rápida */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Buscar por nome, guerra, matrícula ou apelido..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Alternador de Modo de Visualização e Botão Novo Policial */}
          <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0">
            {/* Toggle Grade / Lista */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => handleSetViewMode('grade')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
                  viewMode === 'grade'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Exibir em grade de cartões"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grade</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode('lista')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
                  viewMode === 'lista'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Exibir em tabela / lista compacta"
              >
                <ListIcon className="w-3.5 h-3.5" />
                <span>Lista</span>
              </button>
            </div>

            {canEdit && (
              <button
                id="btn-add-officer-main"
                onClick={handleOpenCreate}
                className="btn-3d-primary px-3.5 py-1.5 rounded-lg text-xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Policial</span>
              </button>
            )}
          </div>
        </div>

        {/* Linha de Dropdowns de Filtragem */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro por Posto / Graduação */}
            <select
              value={rankFilter}
              onChange={(e) => setRankFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
            >
              <option value="todos">Todos os Postos / Graduações</option>
              <option value="oficiais">⭐ Oficiais (Cel, Ten Cel, Maj, Cap, Ten)</option>
              <option value="pracas">🛡️ Praças (Subten, Sgt, Cb, Sd)</option>
              <optgroup label="Posto Específico">
                {RANKS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </optgroup>
            </select>

            {/* Filtro de Situação */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
            >
              <option value="ativos">Apenas Ativos no Efetivo</option>
              <option value="inativos">Inativos</option>
              <option value="todos">Todas as Situações</option>
            </select>

            {/* Filtro de Telefone / Contato */}
            <select
              value={phoneFilter}
              onChange={(e) => setPhoneFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
            >
              <option value="todos">Todos os Contatos</option>
              <option value="com_fone">Com WhatsApp / Telefone</option>
              <option value="sem_fone">Sem Telefone Cadastrado</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                title="Limpar todos os filtros"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpar Filtros</span>
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Exibindo <strong>{filteredOfficers.length}</strong> de {officers.length} policiais
          </div>
        </div>
      </div>

      {/* Conteúdo: Lista / Tabela vs Grade de Cards */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm bg-white rounded-xl border border-slate-200">
          Carregando cadastro de policiais...
        </div>
      ) : filteredOfficers.length === 0 ? (
        <div className="p-12 text-center text-slate-500 space-y-2 bg-white rounded-xl border border-slate-200">
          <Shield className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-semibold text-slate-700 text-sm">Nenhum policial encontrado</p>
          <p className="text-xs text-slate-400">
            Tente ajustar os filtros de busca ou cadastre novos policiais militares.
          </p>
        </div>
      ) : viewMode === 'lista' ? (
        /* VISUALIZAÇÃO EM TABELA / LISTA COMPACTA */
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Posto / Graduação</th>
                  <th className="py-3 px-4">Policial Militar</th>
                  <th className="py-3 px-4">Matrícula</th>
                  <th className="py-3 px-4">Telefone / WhatsApp</th>
                  <th className="py-3 px-4">Situação</th>
                  {canEdit && <th className="py-3 px-4 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOfficers.map((off) => (
                  <tr key={off.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        {off.rank}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{off.fullName}</div>
                      {(off.shortName || off.aliases) && (
                        <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                          {off.shortName ? `Guerra: ${off.shortName}` : ''}
                          {off.shortName && off.aliases ? ' • ' : ''}
                          {off.aliases ? `Apelidos: ${off.aliases}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {off.badge ? `#${off.badge}` : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {off.phone ? (
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{off.phone}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 italic text-[11px]">Não informado</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          off.active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {off.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            id={`btn-table-edit-officer-${off.id}`}
                            onClick={() => handleOpenEdit(off)}
                            className="btn-3d-secondary px-2.5 py-1 text-xs text-blue-600 hover:text-blue-700"
                            title="Editar policial"
                          >
                            <Edit2 className="w-3 h-3 text-blue-500" />
                            <span>Editar</span>
                          </button>
                          <button
                            id={`btn-table-delete-officer-${off.id}`}
                            onClick={() => setDeletingOfficer(off)}
                            className="btn-3d-secondary px-2 py-1 text-xs text-rose-600 hover:text-rose-700"
                            title="Excluir policial do sistema"
                          >
                            <Trash2 className="w-3 h-3 text-rose-500" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VISUALIZAÇÃO EM GRADE DE CARDS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOfficers.map((off) => (
            <div
              key={off.id}
              id={`officer-card-${off.id}`}
              className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                      {off.rank}
                    </span>
                    {off.badge && (
                      <span className="text-[11px] font-mono text-slate-500 flex items-center gap-0.5">
                        <Hash className="w-3 h-3 text-slate-400" />
                        {off.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.2 rounded-full text-[10px] font-semibold ${
                      off.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {off.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-900">{off.fullName}</h4>
                  {off.shortName && (
                    <p className="text-xs text-slate-500">Nome de Guerra: {off.shortName}</p>
                  )}
                  {off.aliases && (
                    <p className="text-[11px] text-slate-400 italic">
                      Variações/Apelidos: {off.aliases}
                    </p>
                  )}
                </div>

                {off.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 pt-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{off.phone}</span>
                  </div>
                )}
              </div>

              {canEdit && (
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    id={`btn-delete-officer-${off.id}`}
                    onClick={() => setDeletingOfficer(off)}
                    className="btn-3d-secondary px-2.5 py-1 text-xs text-rose-600 hover:text-rose-700"
                    title="Excluir policial do sistema"
                  >
                    <Trash2 className="w-3 h-3 text-rose-500" />
                    <span>Excluir</span>
                  </button>

                  <button
                    id={`btn-edit-officer-${off.id}`}
                    onClick={() => handleOpenEdit(off)}
                    className="btn-3d-secondary px-2.5 py-1 text-xs text-blue-600 hover:text-blue-700"
                  >
                    <Edit2 className="w-3 h-3 text-blue-500" />
                    <span>Editar</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Criar / Editar Policial */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">
                {editingOfficer ? 'Editar Policial Militar' : 'Novo Policial Militar'}
              </h4>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveOfficer} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Posto / Graduação *</label>
                <select
                  value={formData.rank}
                  onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                >
                  {RANKS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Ex.: Erisvaldo da Silva Santos"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nome de Guerra</label>
                  <input
                    type="text"
                    value={formData.shortName}
                    onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                    placeholder="Ex.: Erisvaldo"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Matrícula / Identificação</label>
                  <input
                    type="text"
                    value={formData.badge}
                    onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                    placeholder="Ex.: 123456-7"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Variações de Nome / Apelidos
                </label>
                <input
                  type="text"
                  value={formData.aliases}
                  onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
                  placeholder="Ex.: Cabo Silva, Erisvaldo Santos"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Telefone WhatsApp</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Ex.: 5581999998888 (com DDD)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Número exclusivo para lembretes operacionais de audiência.
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-slate-800 font-semibold">Policial Ativo no Efetivo</span>
              </label>

              <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-3d-secondary px-3.5 py-1.5 rounded-lg text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-3d-primary px-4 py-1.5 rounded-lg text-xs"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmação de Exclusão de Policial */}
      {deletingOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-rose-100 bg-rose-50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>Excluir Policial Militar</span>
              </div>
              <button
                onClick={() => setDeletingOfficer(null)}
                disabled={isDeleting}
                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs text-slate-600">
              <p className="text-slate-700">
                Tem certeza que deseja excluir o cadastro do policial militar abaixo?
              </p>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div>
                  <strong>Posto/Graduação:</strong> {deletingOfficer.rank}
                </div>
                <div>
                  <strong>Nome Completo:</strong> {deletingOfficer.fullName}
                </div>
                {deletingOfficer.badge && (
                  <div>
                    <strong>Matrícula:</strong> {deletingOfficer.badge}
                  </div>
                )}
                {deletingOfficer.phone && (
                  <div>
                    <strong>Telefone:</strong> {deletingOfficer.phone}
                  </div>
                )}
              </div>

              <p className="text-rose-600 font-semibold text-[11px]">
                Aviso: A exclusão removerá o perfil do policial do diretório e desvinculará suas participações em audiências e lembretes pendentes.
              </p>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingOfficer(null)}
                  disabled={isDeleting}
                  className="btn-3d-secondary px-3.5 py-1.5 rounded-lg text-xs disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteOfficer}
                  disabled={isDeleting}
                  className="btn-3d-danger px-4 py-1.5 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeleting ? 'Excluindo...' : 'Sim, Excluir Policial'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
