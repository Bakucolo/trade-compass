import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Briefcase,
  Eye,
  Calendar as CalendarIcon,
  Sparkles,
  ExternalLink,
  Bell,
  Clock,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { EarningsItem } from '@/services/earningsService';

interface EarningsCalendarViewProps {
  items: EarningsItem[];
  selectedDate: string | null; // ISO Date YYYY-MM-DD or null
  onSelectDate: (dateStr: string | null) => void;
  onNavigateToResearch?: (symbol: string) => void;
  onOpenPriceAlert?: (item: EarningsItem) => void;
}

export function EarningsCalendarView({
  items,
  selectedDate,
  onSelectDate,
  onNavigateToResearch,
  onOpenPriceAlert,
}: EarningsCalendarViewProps) {
  // Calendar Month State (Year and Month 0-indexed)
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigation Handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    const todayStr = today.toISOString().split('T')[0];
    onSelectDate(todayStr);
  };

  // Group earnings items by YYYY-MM-DD date key
  const earningsByDate = useMemo(() => {
    const map = new Map<string, EarningsItem[]>();
    for (const item of items) {
      if (!item.earningsDate) continue;
      const dateKey = item.earningsDate.split('T')[0];
      const list = map.get(dateKey) || [];
      list.push(item);
      map.set(dateKey, list);
    }
    return map;
  }, [items]);

  // Compute Calendar Grid Days
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: Array<{
      date: Date;
      dateKey: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      earnings: EarningsItem[];
    }> = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const d = new Date(year, month - 1, dayNum);
      const dateKey = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateKey,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateKey === todayStr,
        isSelected: selectedDate === dateKey,
        earnings: earningsByDate.get(dateKey) || [],
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const d = new Date(year, month, dayNum);
      const dateKey = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateKey,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: dateKey === todayStr,
        isSelected: selectedDate === dateKey,
        earnings: earningsByDate.get(dateKey) || [],
      });
    }

    // Next month padding to fill out 5 or 6 weeks (35 or 42 grid cells)
    const remainingCells = (7 - (days.length % 7)) % 7;
    for (let dayNum = 1; dayNum <= remainingCells; dayNum++) {
      const d = new Date(year, month + 1, dayNum);
      const dateKey = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateKey,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateKey === todayStr,
        isSelected: selectedDate === dateKey,
        earnings: earningsByDate.get(dateKey) || [],
      });
    }

    return days;
  }, [year, month, earningsByDate, selectedDate]);

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Calendar Header / Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card/70 backdrop-blur-xl border border-border/70 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/15 text-primary border border-primary/30">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">{monthName}</h2>
            <p className="text-xs text-muted-foreground">
              Click any calendar day to inspect reporting catalysts & earnings releases
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedDate && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSelectDate(null)}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear Day Filter
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleToday}
            className="h-8 text-xs font-semibold bg-background/60 hover:bg-accent border-border/60"
          >
            Today
          </Button>

          <div className="flex items-center rounded-lg border border-border/60 bg-background/60 overflow-hidden">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="w-[1px] h-4 bg-border/60" />
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Weekday Header */}
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-muted-foreground tracking-wider uppercase">
        <div className="py-1">Sun</div>
        <div className="py-1">Mon</div>
        <div className="py-1">Tue</div>
        <div className="py-1">Wed</div>
        <div className="py-1">Thu</div>
        <div className="py-1">Fri</div>
        <div className="py-1">Sat</div>
      </div>

      {/* 7-Column Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day) => {
          const hasEarnings = day.earnings.length > 0;
          const portfolioEarnings = day.earnings.filter((e) => e.isPortfolioHolding);

          return (
            <div
              key={day.dateKey}
              onClick={() => onSelectDate(day.isSelected ? null : day.dateKey)}
              className={cn(
                "min-h-[115px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between relative group",
                day.isCurrentMonth
                  ? "bg-card/50 hover:bg-card/90 border-border/60 hover:border-primary/50 shadow-xs"
                  : "bg-background/25 border-border/30 opacity-40 hover:opacity-80",
                day.isToday && "ring-2 ring-primary/60 bg-primary/5 border-primary/40",
                day.isSelected && "border-indigo-500 bg-indigo-950/30 ring-2 ring-indigo-500/50 shadow-md",
                hasEarnings && !day.isSelected && "border-border/80 hover:border-amber-500/50"
              )}
            >
              {/* Day Header Row */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    "text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center transition-all",
                    day.isToday
                      ? "bg-primary text-primary-foreground font-black"
                      : day.isSelected
                      ? "bg-indigo-500 text-white font-bold"
                      : "text-foreground/80 group-hover:text-foreground"
                  )}
                >
                  {day.dayNumber}
                </span>

                {hasEarnings && (
                  <div className="flex items-center gap-1">
                    {portfolioEarnings.length > 0 && (
                      <span
                        className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"
                        title={`${portfolioEarnings.length} Portfolio Holding(s) Reporting`}
                      />
                    )}
                    <span className="text-[10px] font-mono font-bold text-amber-400">
                      {day.earnings.length} {day.earnings.length === 1 ? 'co' : 'cos'}
                    </span>
                  </div>
                )}
              </div>

              {/* Earnings Company Badges / Pills */}
              <div className="space-y-1 my-auto overflow-hidden">
                {day.earnings.slice(0, 3).map((item) => (
                  <div
                    key={item.symbol}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDate(day.dateKey);
                    }}
                    className={cn(
                      "p-1 px-1.5 rounded-lg text-[11px] font-mono font-bold flex items-center justify-between border transition-all group/item shadow-2xs",
                      item.isPortfolioHolding
                        ? "bg-purple-950/40 border-purple-500/50 text-purple-200 hover:bg-purple-900/50"
                        : item.isWatchlist
                        ? "bg-sky-950/40 border-sky-500/50 text-sky-200 hover:bg-sky-900/50"
                        : "bg-secondary/70 border-border/70 text-foreground hover:bg-secondary"
                    )}
                  >
                    <div className="flex items-center gap-1 min-w-0 truncate">
                      {item.timing === 'BMO' ? (
                        <Sun className="w-2.5 h-2.5 text-amber-400 shrink-0" title="Before Market Open" />
                      ) : item.timing === 'AMC' ? (
                        <Moon className="w-2.5 h-2.5 text-indigo-400 shrink-0" title="After Market Close" />
                      ) : null}
                      <span className="truncate">{item.symbol}</span>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      {item.isPortfolioHolding && (
                        <Briefcase className="w-2.5 h-2.5 text-purple-400" title="Portfolio Holding" />
                      )}
                      {item.epsEstimate != null && (
                        <span className="text-[9px] text-muted-foreground opacity-80">
                          ${item.epsEstimate.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {day.earnings.length > 3 && (
                  <div className="text-[10px] text-center font-bold text-muted-foreground hover:text-foreground">
                    +{day.earnings.length - 3} more
                  </div>
                )}
              </div>

              {/* Bottom Subtle Day Status */}
              <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
                <span>{day.earnings.length > 0 ? `${day.earnings.length} reporting` : ''}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
