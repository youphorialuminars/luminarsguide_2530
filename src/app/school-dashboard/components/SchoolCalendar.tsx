'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface SchoolEvent {
  id: string;
  event_title: string;
  start_time: string;
  event_type: 'performance_schedule' | 'holiday';
}

interface SchoolEventsCalendarProps {
  /** Optional: filter events by a specific school_id. If omitted, loads all visible events. */
  schoolId?: string | null;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function SchoolEventsCalendar({ schoolId }: SchoolEventsCalendarProps) {
  const supabase = createClient();
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState<{ year: number; month: number; day: number } | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    const now = new Date();
    setToday({ year: now.getFullYear(), month: now.getMonth(), day: now.getDate() });
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('school_events')
      .select('id, event_title, start_time, event_type')
      .order('start_time');
    if (schoolId) {
      query = query.eq('school_id', schoolId);
    }
    const { data } = await query;
    setEvents(data || []);
    setLoading(false);
  }, [supabase, schoolId]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const eventsThisMonth = events.filter((e) => {
    const d = new Date(e.start_time);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const eventsByDate = new Map<string, SchoolEvent[]>();
  eventsThisMonth.forEach((e) => {
    const d = new Date(e.start_time);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!eventsByDate.has(key)) eventsByDate.set(key, []);
    eventsByDate.get(key)!.push(e);
  });

  // Upcoming events list (next 5)
  const upcomingEvents = events
    .filter((e) => {
      if (!today) return true;
      const d = new Date(e.start_time);
      return d.getFullYear() > today.year ||
        (d.getFullYear() === today.year && d.getMonth() > today.month) ||
        (d.getFullYear() === today.year && d.getMonth() === today.month && d.getDate() >= today.day);
    })
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-5">
      {/* Read-only badge */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-info/5 border border-info/20">
        <Icon name="EyeIcon" size={14} className="text-info flex-shrink-0" />
        <p className="text-xs text-muted-foreground">Read-only view of school events synced from the School Dashboard.</p>
      </div>

      {/* Calendar Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
          className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
        >
          <Icon name="ChevronLeftIcon" size={15} />
        </button>
        <span className="text-base font-700 text-foreground min-w-[140px] text-center">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
          className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
        >
          <Icon name="ChevronRightIcon" size={15} />
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-violet-200 border border-violet-300" />
          Performance Schedule
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-200 border border-amber-300" />
          Holiday
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Icon name="ArrowPathIcon" size={22} className="text-primary animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-xs font-600 text-muted-foreground py-1">{d}</div>
          ))}
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = eventsByDate.get(dateStr) || [];
            const hasPerformance = dayEvents.some((e) => e.event_type === 'performance_schedule');
            const hasHoliday = dayEvents.some((e) => e.event_type === 'holiday');
            const isToday = today !== null && today.year === year && today.month === month && today.day === day;

            return (
              <div
                key={dateStr}
                className={`min-h-[48px] p-1 rounded-lg border text-xs transition-colors ${
                  hasPerformance ? 'bg-violet-50 border-violet-200'
                    : hasHoliday ? 'bg-amber-50 border-amber-200' : isToday ?'bg-primary/10 border-primary/30' :'border-border hover:bg-secondary/50'
                }`}
              >
                <span className={`font-600 ${isToday ? 'text-primary' : 'text-foreground'}`}>{day}</span>
                {dayEvents.map((e) => (
                  <div
                    key={e.id}
                    className={`mt-0.5 px-1 py-0.5 rounded text-[10px] font-600 truncate ${
                      e.event_type === 'performance_schedule'
                        ? 'bg-violet-200 text-violet-800' :'bg-amber-200 text-amber-800'
                    }`}
                    title={e.event_title}
                  >
                    {e.event_title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Upcoming Events List */}
      {upcomingEvents.length > 0 && (
        <div>
          <h4 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
            <Icon name="CalendarDaysIcon" size={15} className="text-primary" />
            Upcoming Events
          </h4>
          <div className="flex flex-col gap-2">
            {upcomingEvents.map((e) => (
              <div key={e.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                e.event_type === 'performance_schedule'
                  ? 'bg-violet-50 border-violet-200' :'bg-amber-50 border-amber-200'
              }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  e.event_type === 'performance_schedule' ? 'bg-violet-200' : 'bg-amber-200'
                }`}>
                  <Icon
                    name={e.event_type === 'performance_schedule' ? 'TrophyIcon' : 'SunIcon'}
                    size={15}
                    className={e.event_type === 'performance_schedule' ? 'text-violet-700' : 'text-amber-700'}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-600 text-foreground truncate">{e.event_title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <span className={`text-xs font-600 px-2 py-0.5 rounded-full border flex-shrink-0 ${
                  e.event_type === 'performance_schedule'
                    ? 'bg-violet-100 text-violet-700 border-violet-200' :'bg-amber-100 text-amber-700 border-amber-200'
                }`}>
                  {e.event_type === 'performance_schedule' ? 'Performance' : 'Holiday'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Icon name="CalendarDaysIcon" size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-600">No school events scheduled yet.</p>
          <p className="text-xs mt-1">Events added by the school will appear here.</p>
        </div>
      )}
    </div>
  );
}