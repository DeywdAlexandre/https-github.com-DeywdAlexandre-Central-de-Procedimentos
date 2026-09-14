import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Maximize2 } from 'lucide-react';
import { JudicialHearing } from '../../types.ts';
import { DayHearingsModal } from './modals/DayHearingsModal.tsx';

interface HearingsCalendarProps {
  selectedYear: number;
  selectedMonth: number;
  setSelectedYear: (year: number) => void;
  setSelectedMonth: (month: number) => void;
  filteredHearings: JudicialHearing[];
  onSelectHearing: (hearing: JudicialHearing) => void;
}

export const HearingsCalendar: React.FC<HearingsCalendarProps> = ({
  selectedYear,
  selectedMonth,
  setSelectedYear,
  setSelectedMonth,
  filteredHearings,
  onSelectHearing,
}) => {
  const [selectedDateForModal, setSelectedDateForModal] = useState<string | null>(null);
  const [expandedInlineDays, setExpandedInlineDays] = useState<Set<string>>(new Set());

  const toggleInlineExpand = (dateStr: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedInlineDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  };

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const firstDayOfWeek = new Date(selectedYear, selectedMonth - 1, 1).getDay();

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5">
      {/* Header do Mês com navegação */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <h3 className="text-base font-bold text-slate-900 capitalize">
          {new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('pt-BR', {
            month: 'long',
            year: 'numeric',
          })}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (selectedMonth === 1) {
                setSelectedMonth(12);
                setSelectedYear(selectedYear - 1);
              } else {
                setSelectedMonth(selectedMonth - 1);
              }
            }}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (selectedMonth === 12) {
                setSelectedMonth(1);
                setSelectedYear(selectedYear + 1);
              } else {
                setSelectedMonth(selectedMonth + 1);
              }
            }}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grade de dias da semana */}
      <div className="grid grid-cols-7 gap-1 pt-3 text-center text-xs font-bold text-slate-500">
        <div>Dom</div>
        <div>Seg</div>
        <div>Ter</div>
        <div>Qua</div>
        <div>Qui</div>
        <div>Sex</div>
        <div>Sáb</div>
      </div>

      {/* Dias */}
      <div className="grid grid-cols-7 gap-1 pt-2">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[90px] bg-slate-50/50 rounded-lg p-1.5" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(
            dayNum
          ).padStart(2, '0')}`;
          const dayHearings = filteredHearings.filter((h) => h.hearingDate === dateStr);

          const isExpanded = expandedInlineDays.has(dateStr);
          const displayedHearings = isExpanded ? dayHearings : dayHearings.slice(0, 2);

          return (
            <div
              key={`day-${dayNum}`}
              className={`min-h-[100px] rounded-xl p-2 border transition-all flex flex-col justify-between ${
                dayHearings.length > 0
                  ? 'bg-blue-50/40 border-blue-200 shadow-2xs'
                  : 'bg-white border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              <div>
                {/* Cabeçalho do Dia */}
                <div className="flex items-center justify-between pb-1 border-b border-slate-100 mb-1.5">
                  {dayHearings.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setSelectedDateForModal(dateStr)}
                      className="text-[10px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-0.5 hover:underline"
                      title="Ver todas as audiências deste dia em detalhes"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                      <span>{dayHearings.length} {dayHearings.length === 1 ? 'aud.' : 'aud.'}</span>
                    </button>
                  ) : (
                    <span />
                  )}
                  <span className="text-xs font-bold text-slate-700">{dayNum}</span>
                </div>

                {/* Lista de Audiências do Dia */}
                <div className="space-y-1">
                  {displayedHearings.map((h) => (
                    <div
                      key={h.id}
                      onClick={() => onSelectHearing(h)}
                      className="p-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] truncate cursor-pointer shadow-2xs transition-all hover:scale-[1.02]"
                      title={`${h.hearingTime} - Ofício ${h.noticeNumber} - ${h.court} (Clique para ofícios & ciência)`}
                    >
                      <span className="font-bold">{h.hearingTime}</span> • Ofício {h.noticeNumber}
                    </div>
                  ))}
                </div>
              </div>

              {/* Ações de Expansão */}
              {dayHearings.length > 2 && (
                <div className="pt-1.5 mt-1 border-t border-slate-200/70 flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedDateForModal(dateStr)}
                    className="btn-3d-primary w-full text-[10px] py-0.5 px-1 rounded-md"
                    title="Clique para ver todas as audiências deste dia com policiais e ofícios"
                  >
                    <span>+{dayHearings.length - 2} mais</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => toggleInlineExpand(dateStr, e)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100"
                    title={isExpanded ? 'Recolher na grade' : 'Expandir na grade'}
                  >
                    <Maximize2 className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180 text-blue-600' : ''}`} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de Detalhes e Expansão do Dia */}
      <DayHearingsModal
        isOpen={Boolean(selectedDateForModal)}
        onClose={() => setSelectedDateForModal(null)}
        dateStr={selectedDateForModal}
        hearings={
          selectedDateForModal
            ? filteredHearings.filter((h) => h.hearingDate === selectedDateForModal)
            : []
        }
        onSelectHearing={onSelectHearing}
      />
    </div>
  );
};
