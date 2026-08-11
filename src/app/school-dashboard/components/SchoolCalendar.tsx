'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface SchoolEvent {
  id: string;
  title: string;
  event_date: string;
  event_type: 'performance_schedule' | 'holiday';
}

interface SchoolCalendarProps {
  schoolId: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function SchoolCalendar({ schoolId }: SchoolCalendarProps) {
  const supabase = createClient();
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [today, setToday] = useState<{ year: number; month: number; day: number } | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [form, setForm] = useState<{
    title: string;
    event_date: string;
    event_type: 'performance_schedule' | 'holiday';
  }>({
    title: '',
    event_date: '',
    event_type: 'holiday',
  });

  useEffect(() => {
    const now = new Date();
    setToday({ year: now.getFullYear(), month: now.getMonth(), day: now.getDate() });
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('school_events')
      .select('id, title, event_date, event_type')
      .eq('school_id', schoolId)
      .order('event_date');
    setEvents(data || []);
    setLoading(false);
  }, [supabase, schoolId]);

  useEffect(() => {
    if (schoolId) loadEvents();
  }, [schoolId, loadEvents]);

  const handleAddEvent = async () => {
    if (!form.title.trim()) { toast.error('Please enter an event title.'); return; }
    if (!form.event_date) { toast.error('Please select a date.'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('school_events').insert({
      school_id: schoolId,
      title: form.title.trim(),
      event_date: form.event_date,
      event_type: form.event_type,
    });
    if (error) {
      toast.error('Failed to add event.');
    } else {
      toast.success('Event added to calendar!');
      setForm({ title: '', event_date: '', event_type: 'holiday' });
      setShowForm(false);
      loadEvents();
    }
    setSubmitting(false);
  };

  const handleDeleteEvent = async (id: string) => {
    const { error } = await supabase.from('school_events').delete().eq('id', id);
    if (error) { toast.error('Failed to delete event.'); }
    else { toast.success('Event removed.'); loadEvents(); }
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const eventsThisMonth = events.filter((e) => {
    const d = new Date(e.event_date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const eventsByDate = new Map<string, SchoolEvent[]>();
  eventsThisMonth.forEach((e) => {
    const key = e.event_date;
    if (!eventsByDate.has(key)) eventsByDate.set(key, []);
    eventsByDate.get(key)!.push(e);
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
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
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary text-sm py-2 px-4"
        >
          <Icon name="PlusIcon" size={15} />
          Add Event
        </button>
      </div>

      {/* Add Event Form */}
      {showForm && (
        <div className="p-4 rounded-xl bg-secondary/50 border border-border animate-fade-in">
          <h4 className="text-sm font-700 text-foreground mb-3">New Calendar Event</h4>
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-600 text-foreground mb-1">Event Title <span className="text-negative">*</span></label>
              <input
                className="input-mystic text-sm"
                placeholder="e.g. Annual Science Fair, Diwali Holiday..."
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-600 text-foreground mb-1">Date <span className="text-negative">*</span></label>
                <input
                  type="date"
                  className="input-mystic text-sm"
                  value={form.event_date}
                  onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-600 text-foreground mb-1">Event Type</label>
                <select
                  className="input-mystic text-sm"
                  value={form.event_type}
                  onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value as any }))}
                >
                  <option value="performance_schedule">Performance Schedule</option>
                  <option value="holiday">Holiday</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddEvent}
                disabled={submitting}
                className="btn-primary text-sm py-2 px-4"
              >
                {submitting ? <><Icon name="ArrowPathIcon" size={13} className="animate-spin" /> Saving...</> : <><Icon name="CheckIcon" size={13} /> Save Event</>}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="btn-secondary text-sm py-2 px-4"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
                className={`min-h-[52px] p-1 rounded-lg border text-xs transition-colors ${
                  hasPerformance ? 'bg-violet-50 border-violet-200'
                    : hasHoliday ? 'bg-amber-50 border-amber-200' : isToday ?'bg-primary/10 border-primary/30' :'border-border hover:bg-secondary/50'
                }`}
              >
                <span className={`font-600 ${isToday ? 'text-primary' : 'text-foreground'}`}>{day}</span>
                {dayEvents.map((e) => (
                  <div
                    key={e.id}
                    className={`mt-0.5 px-1 py-0.5 rounded text-[10px] font-600 truncate cursor-pointer group flex items-center justify-between gap-0.5 ${
                      e.event_type === 'performance_schedule'
                        ? 'bg-violet-200 text-violet-800' :'bg-amber-200 text-amber-800'
                    }`}
                    title={e.title}
                  >
                    <span className="truncate">{e.title}</span>
                    <button
                      onClick={() => handleDeleteEvent(e.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      title="Remove event"
                    >
                      <Icon name="XMarkIcon" size={9} />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Upcoming Events List */}
      {events.length > 0 && (
        <div>
          <h4 className="text-sm font-700 text-foreground mb-3">All Events</h4>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
            {events.map((e) => (
              <div
                key={e.id}
                className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                  e.event_type === 'performance_schedule'
                    ? 'bg-violet-50 border-violet-200' :'bg-amber-50 border-amber-200'
                }`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  e.event_type === 'performance_schedule' ? 'bg-violet-500' : 'bg-amber-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-600 text-foreground truncate">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' · '}
                    {e.event_type === 'performance_schedule' ? 'Performance Schedule' : 'Holiday'}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteEvent(e.id)}
                  className="text-muted-foreground hover:text-negative transition-colors flex-shrink-0"
                  title="Delete event"
                >
                  <Icon name="TrashIcon" size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
