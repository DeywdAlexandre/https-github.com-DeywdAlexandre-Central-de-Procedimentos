import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, ChevronDown, Check, User } from 'lucide-react';
import { PoliceOfficer } from '../../types.ts';

interface OfficerSearchSelectProps {
  officers: PoliceOfficer[];
  selectedOfficerId: string; // 'todos' ou ID do policial como string
  onSelectOfficer: (officerId: string) => void;
  placeholder?: string;
  className?: string;
}

export const OfficerSearchSelect: React.FC<OfficerSearchSelectProps> = ({
  officers,
  selectedOfficerId,
  onSelectOfficer,
  placeholder = 'Filtrar por policial militar...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Encontra o policial selecionado atualmente
  const selectedOfficer = useMemo(() => {
    if (selectedOfficerId === 'todos' || !selectedOfficerId) return null;
    return officers.find((o) => String(o.id) === String(selectedOfficerId)) || null;
  }, [officers, selectedOfficerId]);

  // Texto amigável para exibição no campo quando fechado
  const displayLabel = useMemo(() => {
    if (!selectedOfficer) return 'Todos os Policiais';
    return `${selectedOfficer.rank} ${selectedOfficer.fullName}${
      selectedOfficer.badge ? ` (${selectedOfficer.badge})` : ''
    }`;
  }, [selectedOfficer]);

  // Quando o policial selecionado muda externamente, sincroniza o texto do input
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm(selectedOfficer ? displayLabel : '');
    }
  }, [selectedOfficer, displayLabel, isOpen]);

  // Lista filtrada em tempo real com normalização de texto
  const filteredOfficers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return officers;

    return officers.filter((off) => {
      const name = (off.fullName || '').toLowerCase();
      const short = (off.shortName || '').toLowerCase();
      const rank = (off.rank || '').toLowerCase();
      const badge = (off.badge || '').toLowerCase();
      const aliases = (off.aliases || '').toLowerCase();

      return (
        name.includes(term) ||
        short.includes(term) ||
        rank.includes(term) ||
        badge.includes(term) ||
        aliases.includes(term)
      );
    });
  }, [officers, searchTerm]);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleCloseDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOfficer, displayLabel]);

  const handleOpenDropdown = () => {
    setIsOpen(true);
    setHighlightedIndex(-1);
    // Seleciona todo o texto para facilitar digitação de um novo termo
    setTimeout(() => {
      inputRef.current?.select();
    }, 10);
  };

  const handleCloseDropdown = () => {
    setIsOpen(false);
    setHighlightedIndex(-1);
    // Se o usuário digitou algo sem selecionar da lista, volta para o policial selecionado
    // garantindo que fique 100% preso à lista oficial
    setSearchTerm(selectedOfficer ? displayLabel : '');
  };

  const handleSelect = (officerId: string) => {
    onSelectOfficer(officerId);
    setIsOpen(false);
    setHighlightedIndex(-1);
    const chosen = officers.find((o) => String(o.id) === String(officerId));
    setSearchTerm(
      chosen ? `${chosen.rank} ${chosen.fullName}${chosen.badge ? ` (${chosen.badge})` : ''}` : ''
    );
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectOfficer('todos');
    setSearchTerm('');
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        handleOpenDropdown();
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev + 1;
        return next >= filteredOfficers.length ? 0 : next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? filteredOfficers.length - 1 : next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOfficers.length) {
        handleSelect(String(filteredOfficers[highlightedIndex].id));
      } else if (filteredOfficers.length === 1) {
        // Se só sobrou 1 policial que bate com a busca, seleciona ele automaticamente
        handleSelect(String(filteredOfficers[0].id));
      } else if (filteredOfficers.length > 0 && searchTerm.trim()) {
        // Seleciona a primeira correspondência
        handleSelect(String(filteredOfficers[0].id));
      } else if (!searchTerm.trim()) {
        handleSelect('todos');
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCloseDropdown();
    }
  };

  const isFiltered = selectedOfficerId !== 'todos' && Boolean(selectedOfficer);

  return (
    <div ref={containerRef} className={`relative inline-block text-xs ${className}`}>
      {/* Input de Busca com Relevo */}
      <div
        className={`relative flex items-center bg-white border rounded-lg transition-all shadow-2xs ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20'
            : isFiltered
            ? 'border-blue-300 bg-blue-50/30'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="pl-2.5 text-slate-400 pointer-events-none flex items-center">
          <Search className="w-3.5 h-3.5" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : selectedOfficer ? displayLabel : ''}
          placeholder={selectedOfficer ? displayLabel : placeholder}
          onFocus={handleOpenDropdown}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className="w-full py-1.5 pl-2 pr-7 bg-transparent text-xs text-slate-800 placeholder:text-slate-500 font-medium focus:outline-hidden"
        />

        {/* Botão de Limpar ou Ícone Chevron */}
        <div className="absolute right-1.5 flex items-center gap-1">
          {isFiltered && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 text-slate-400 hover:text-slate-600 rounded-sm transition-colors"
              title="Limpar filtro de policial"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (isOpen) {
                handleCloseDropdown();
              } else {
                handleOpenDropdown();
                inputRef.current?.focus();
              }
            }}
            className="p-0.5 text-slate-400 hover:text-slate-600 rounded-sm"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-150 ${
                isOpen ? 'rotate-180 text-blue-600' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Menu Suspenso / Dropdown Flutuante */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-72 sm:w-80 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1 divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
          {/* Opção Todos os Policiais */}
          <div className="p-1">
            <button
              type="button"
              onClick={() => handleSelect('todos')}
              className={`w-full text-left px-3 py-1.5 rounded-lg flex items-center justify-between transition-colors ${
                selectedOfficerId === 'todos'
                  ? 'bg-blue-50 text-blue-900 font-bold'
                  : 'text-slate-700 hover:bg-slate-100 font-medium'
              }`}
            >
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Todos os Policiais (sem filtro)</span>
              </div>
              {selectedOfficerId === 'todos' && <Check className="w-3.5 h-3.5 text-blue-600" />}
            </button>
          </div>

          {/* Lista de Policiais Filtrados */}
          <div className="max-h-60 overflow-y-auto p-1 space-y-0.5">
            {filteredOfficers.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs italic">
                Nenhum policial encontrado para "{searchTerm}"
              </div>
            ) : (
              filteredOfficers.map((off, idx) => {
                const isSelected = String(off.id) === String(selectedOfficerId);
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={off.id}
                    type="button"
                    onClick={() => handleSelect(String(off.id))}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                        : isHighlighted
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className={`px-1.5 py-0.2 rounded-sm text-[10px] font-bold shrink-0 ${
                            isSelected
                              ? 'bg-blue-700 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {off.rank}
                        </span>
                        <span className="truncate">{off.fullName}</span>
                      </div>

                      {off.badge && (
                        <span
                          className={`text-[10px] block mt-0.5 font-mono ${
                            isSelected ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          Matrícula: {off.badge}
                          {off.shortName ? ` • Guerra: ${off.shortName}` : ''}
                        </span>
                      )}
                    </div>

                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-white" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
