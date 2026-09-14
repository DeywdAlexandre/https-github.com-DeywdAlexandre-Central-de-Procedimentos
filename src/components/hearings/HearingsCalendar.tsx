import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { JudicialHearing } from '../../types.ts';

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

          return (
            <div
              key={`day-${dayNum}`}
              className={`min-h-[95px] rounded-lg p-1.5 border transition-all ${
                dayHearings.length > 0
                  ? 'bg-blue-50/30 border-blue-200'
                  : 'bg-white border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              <div className="text-right text-xs font-bold text-slate-700">{dayNum}</div>
              <div className="space-y-1 mt-1">
                {dayHearings.slice(0, 2).map((h) => (
                  <div
                    key={h.id}
                    onClick={() => onSelectHearing(h)}
                    className="p-1 rounded-sm bg-indigo-600 text-white text-[10px] truncate cursor-pointer hover:bg-indigo-700"
                    title={`${h.hearingTime} - Ofício ${h.noticeNumber} - ${h.court}`}
                  >
                    <span className="font-bold">{h.hearingTime}</span> Ofício {h.noticeNumber}
                  </div>
                ))}
                {dayHearings.length > 2 && (
                  <span className="text-[10px] text-blue-700 font-bold block">
                    +{dayHearings.length - 2} mais
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
