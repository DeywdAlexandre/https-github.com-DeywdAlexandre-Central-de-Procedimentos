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

  const [activeOnly, setActiveOnly] = useState(true);
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
    if (activeOnly && !o.active) return false;
    if (globalSearch) {
      const term = globalSearch.toLowerCase();
      const match =
        o.fullName.toLowerCase().includes(term) ||
        (o.shortName && o.shortName.toLowerCase().includes(term)) ||
        (o.badge && o.badge.toLowerCase().includes(term)) ||
        (o.aliases && o.aliases.toLowerCase().includes(term));
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Controles do Topo */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Exibir apenas policiais em atividade</span>
          </label>
          <span className="text-xs text-slate-400">
            Total: <strong>{filteredOfficers.length}</strong>
          </span>
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

      {/* Grade / Lista de Policiais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-12 text-center text-slate-500 text-sm">
            Carregando cadastro de policiais...
          </div>
        ) : filteredOfficers.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-500 space-y-2 bg-white rounded-xl border border-slate-200">
            <Shield className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700 text-sm">Nenhum policial encontrado</p>
            <p className="text-xs text-slate-400">
              Cadastre novos policiais ou importe diretamente de mensagens de convocação.
            </p>
          </div>
        ) : (
          filteredOfficers.map((off) => (
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
          ))
        )}
      </div>

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
