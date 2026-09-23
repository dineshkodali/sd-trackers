import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface DateCalendarNavigatorProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  recordDates?: string[];
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toYMD(date: Date) {
  return date.toISOString().slice(0, 10);
}

export const DateCalendarNavigator: React.FC<DateCalendarNavigatorProps> = ({
  selectedDate,
  onDateChange,
  recordDates = []
}) => {
  const todayStr = toYMD(new Date());
  const parsedSelected = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(parsedSelected.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsedSelected.getMonth());
  const recordDateSet = useMemo(() => new Set(recordDates), [recordDates]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(toYMD(new Date(viewYear, viewMonth, d)));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const goBack = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };

  const goForward = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const goToToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    onDateChange(todayStr);
  };

  React.useEffect(() => {
    if (selectedDate) {
      const d = new Date(selectedDate + 'T00:00:00');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [selectedDate]);

  return (
    <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs p-3 w-full select-none">
      <div className="flex items-center justify-between mb-2.5">
        <button onClick={goBack} className="p-1 rounded hover:bg-[#f3f2f1] text-[#605e5c] hover:text-[#242424] transition-colors cursor-pointer" title="Previous month">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-[#0d9488]" />
          <span className="text-xs font-bold text-[#242424]">{monthLabel}</span>
          {(viewYear !== new Date().getFullYear() || viewMonth !== new Date().getMonth()) && (
            <button onClick={goToToday} className="text-[10px] font-semibold text-[#0d9488] hover:underline cursor-pointer">Today</button>
          )}
        </div>
        <button onClick={goForward} className="p-1 rounded hover:bg-[#f3f2f1] text-[#605e5c] hover:text-[#242424] transition-colors cursor-pointer" title="Next month">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(day => (
          <div key={day} className="text-center text-[10px] font-semibold text-[#8a8886] py-0.5">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((dateStr, idx) => {
          if (!dateStr) return <div key={`pad-${idx}`} />;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          const hasData = recordDateSet.has(dateStr);
          const dayNum = new Date(dateStr + 'T00:00:00').getDate();
          const dow = new Date(dateStr + 'T00:00:00').getDay();
          const isWeekend = dow === 0 || dow === 6;
          return (
            <button
              key={dateStr}
              onClick={() => onDateChange(dateStr)}
              title={dateStr}
              className={`relative flex flex-col items-center justify-center rounded text-[11px] font-medium py-1 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#0d9488] text-white font-bold shadow-sm'
                  : isToday
                  ? 'bg-teal-50 text-[#0d9488] font-bold border border-teal-300'
                  : isWeekend
                  ? 'text-[#a19f9d] hover:bg-[#f3f2f1]'
                  : 'text-[#323130] hover:bg-[#f3f2f1]'
              }`}
            >
              {dayNum}
              {hasData && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#0d9488]" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 pt-2 border-t border-[#edebe9] flex items-center justify-between">
        <span className="text-[10px] text-[#605e5c]">Selected:</span>
        <span className="text-[10px] font-bold text-[#242424]">
          {selectedDate
            ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
            : '—'}
        </span>
      </div>
    </div>
  );
};
