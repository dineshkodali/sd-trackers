import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  RotateCcw,
  Check,
  ChevronDown
} from 'lucide-react';

export interface WeekOption {
  start: string;
  end: string;
  label: string;
  count?: number;
}

export interface WeekSwitcherProps {
  startDate: string;
  endDate: string;
  onWeekChange: (startDate: string, endDate: string, label: string) => void;
  availableWeeks?: WeekOption[];
  allowAllOption?: boolean;
  activeWeekCursor?: string; // 'all' or startDate ISO string
  onCursorChange?: (cursor: string) => void;
  compact?: boolean;
  className?: string;
  title?: string;
}

function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function formatWeekLabel(startDateStr: string, endDateStr: string): string {
  const start = new Date(startDateStr || new Date());
  const end = new Date(endDateStr || startDateStr || new Date());
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Current Week';
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekNum = getISOWeekNumber(start);
  const startDay = getOrdinal(start.getDate());
  const endDay = getOrdinal(end.getDate());
  const monthName = monthNames[end.getMonth()];
  const yearShort = end.getFullYear().toString().slice(-2);

  return `Week ${weekNum} (${startDay} to ${endDay} of ${monthName} ${yearShort})`;
}

export function getWeekBounds(dateStr: string): { start: string; end: string; weekNum: number; label: string } {
  const d = new Date(dateStr || new Date());
  if (isNaN(d.getTime())) {
    const today = new Date();
    const monday = new Date(today);
    const day = today.getDay();
    const diffToMon = (day === 0 ? -6 : 1) - day;
    monday.setDate(today.getDate() + diffToMon);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const start = monday.toISOString().slice(0, 10);
    const end = sunday.toISOString().slice(0, 10);
    return {
      start,
      end,
      weekNum: getISOWeekNumber(monday),
      label: formatWeekLabel(start, end)
    };
  }

  const day = d.getDay();
  const diffToMon = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const start = monday.toISOString().slice(0, 10);
  const end = sunday.toISOString().slice(0, 10);

  return {
    start,
    end,
    weekNum: getISOWeekNumber(monday),
    label: formatWeekLabel(start, end)
  };
}

export const WeekSwitcher: React.FC<WeekSwitcherProps> = ({
  startDate,
  endDate,
  onWeekChange,
  availableWeeks = [],
  allowAllOption = false,
  activeWeekCursor,
  onCursorChange,
  compact = false,
  className = '',
  title = 'Week Switcher'
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsPickerOpen(false);
      }
    };
    if (isPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPickerOpen]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayWeek = useMemo(() => getWeekBounds(todayStr), [todayStr]);

  const currentLabel = useMemo(() => {
    if (activeWeekCursor === 'all') {
      return '📅 All Weeks (Entire History)';
    }
    return formatWeekLabel(startDate, endDate);
  }, [activeWeekCursor, startDate, endDate]);

  const isCurrentWeekActive = activeWeekCursor !== 'all' && startDate === todayWeek.start;

  // Navigate forward/backward by 1 week (7 days)
  const handleStep = (direction: 'prev' | 'next') => {
    const baseDate = (activeWeekCursor === 'all' || !startDate) ? todayWeek.start : startDate;
    const delta = direction === 'prev' ? -7 : 7;
    const newStart = addDays(baseDate, delta);
    const newEnd = addDays(newStart, 6);
    const label = formatWeekLabel(newStart, newEnd);

    if (onCursorChange) {
      onCursorChange(newStart);
    }
    onWeekChange(newStart, newEnd, label);
  };

  // Jump to specific custom start date (restricted to 7-day week)
  const handleSelectCustomDate = (pickedDate: string) => {
    if (!pickedDate) return;
    const bounds = getWeekBounds(pickedDate);
    if (onCursorChange) {
      onCursorChange(bounds.start);
    }
    onWeekChange(bounds.start, bounds.end, bounds.label);
    setIsPickerOpen(false);
  };

  // Select a preset week option
  const handleSelectWeekOption = (week: WeekOption) => {
    if (onCursorChange) {
      onCursorChange(week.start);
    }
    onWeekChange(week.start, week.end, week.label);
    setIsPickerOpen(false);
  };

  // Select all weeks
  const handleSelectAll = () => {
    if (onCursorChange) {
      onCursorChange('all');
    }
    setIsPickerOpen(false);
  };

  // Select current week
  const handleSelectCurrentWeek = () => {
    if (onCursorChange) {
      onCursorChange(todayWeek.start);
    }
    onWeekChange(todayWeek.start, todayWeek.end, todayWeek.label);
    setIsPickerOpen(false);
  };

  return (
    <div className={`relative inline-flex items-center gap-1.5 ${className}`} ref={popoverRef}>
      {/* Container with prev button, label/dropdown, next button */}
      <div className="flex items-center bg-white border border-[#8a8886] rounded-xs shadow-2xs overflow-hidden">
        {/* Previous Week Button */}
        <button
          type="button"
          onClick={() => handleStep('prev')}
          className="p-1.5 hover:bg-[#edebe9] text-[#323130] transition-colors border-r border-[#e1dfdd] focus:outline-hidden"
          title="Previous Week (Move -7 days)"
          aria-label="Previous Week"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Clickable Week Selector Trigger */}
        <button
          type="button"
          onClick={() => setIsPickerOpen(!isPickerOpen)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#242424] hover:bg-[#f3f8fd] transition-colors ${
            compact ? 'max-w-[210px]' : 'min-w-[190px]'
          } truncate text-left`}
          title="Click to choose week from calendar or recorded list"
        >
          <CalendarIcon className="w-3.5 h-3.5 text-[#0d9488] shrink-0" />
          <span className="truncate">{currentLabel}</span>
          <ChevronDown className="w-3 h-3 text-[#605e5c] shrink-0 ml-auto" />
        </button>

        {/* Next Week Button */}
        <button
          type="button"
          onClick={() => handleStep('next')}
          className="p-1.5 hover:bg-[#edebe9] text-[#323130] transition-colors border-l border-[#e1dfdd] focus:outline-hidden"
          title="Next Week (Move +7 days)"
          aria-label="Next Week"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick Jump to Today if not on current week */}
      {!isCurrentWeekActive && (
        <button
          type="button"
          onClick={handleSelectCurrentWeek}
          className="px-2 py-1 text-[11px] font-semibold bg-[#f0fdfa] hover:bg-[#d0e7fb] text-[#0f766e] border border-[#71afe5] rounded-xs transition-colors whitespace-nowrap shadow-2xs"
          title="Jump directly to current week"
        >
          Current Week
        </button>
      )}

      {/* Quick Reset to All if all option enabled and not in all mode */}
      {allowAllOption && activeWeekCursor !== 'all' && (
        <button
          type="button"
          onClick={handleSelectAll}
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-white hover:bg-[#f3f2f1] text-[#605e5c] border border-[#8a8886] rounded-xs transition-colors whitespace-nowrap shadow-2xs"
          title="Display entire recorded history"
        >
          <RotateCcw className="w-3 h-3" />
          <span>All Weeks</span>
        </button>
      )}

      {/* Dropdown Popover */}
      {isPickerOpen && (
        <div className="absolute top-full left-0 mt-1.5 z-50 w-72 bg-white border border-[#8a8886] rounded-xs shadow-lg p-3 text-xs space-y-3 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between border-b border-[#e1dfdd] pb-2">
            <span className="font-bold text-[#0f766e] flex items-center gap-1">
              <CalendarDays className="w-4 h-4 text-[#0d9488]" />
              <span>Select Week Range (7-Day Max)</span>
            </span>
            <button
              type="button"
              onClick={() => setIsPickerOpen(false)}
              className="text-neutral-400 hover:text-neutral-700 text-sm font-bold leading-none px-1"
            >
              &times;
            </button>
          </div>

          {/* Calendar Date Picker */}
          <div className="space-y-1.5">
            <label className="font-semibold text-[#605e5c] block text-[11px]">
              Pick Any Date in Target Week:
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                defaultValue={startDate || todayStr}
                onChange={e => handleSelectCustomDate(e.target.value)}
                className="flex-1 p-1.5 border border-[#8a8886] rounded-xs text-xs bg-white text-[#323130] focus:border-[#0d9488] focus:outline-hidden"
              />
            </div>
            <p className="text-[10px] text-[#605e5c] italic">
              * The 7-day Monday–Sunday week range is automatically bounded.
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 pt-1 border-t border-[#f3f2f1]">
            <button
              type="button"
              onClick={handleSelectCurrentWeek}
              className={`flex-1 py-1 px-2 text-center rounded-xs text-[11px] font-semibold transition-colors ${
                isCurrentWeekActive 
                  ? 'bg-[#0d9488] text-white' 
                  : 'bg-[#f3f2f1] hover:bg-[#edebe9] text-[#323130]'
              }`}
            >
              Current Week
            </button>

            {allowAllOption && (
              <button
                type="button"
                onClick={handleSelectAll}
                className={`flex-1 py-1 px-2 text-center rounded-xs text-[11px] font-semibold transition-colors ${
                  activeWeekCursor === 'all'
                    ? 'bg-[#0d9488] text-white'
                    : 'bg-[#f3f2f1] hover:bg-[#edebe9] text-[#323130]'
                }`}
              >
                All Weeks
              </button>
            )}
          </div>

          {/* Available / Recorded Weeks List */}
          {availableWeeks.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-[#e1dfdd]">
              <div className="font-semibold text-[#605e5c] text-[11px]">
                Recorded Weeks with Data ({availableWeeks.length}):
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {availableWeeks.map(w => {
                  const isSelected = activeWeekCursor !== 'all' && startDate === w.start;
                  return (
                    <button
                      key={w.start}
                      type="button"
                      onClick={() => handleSelectWeekOption(w)}
                      className={`w-full text-left p-1.5 rounded-xs flex items-center justify-between text-[11px] transition-colors ${
                        isSelected 
                          ? 'bg-[#f0fdfa] text-[#0f766e] font-bold border border-[#5eead4]' 
                          : 'hover:bg-[#f3f2f1] text-[#323130]'
                      }`}
                    >
                      <span className="truncate">{w.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#0d9488] shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
