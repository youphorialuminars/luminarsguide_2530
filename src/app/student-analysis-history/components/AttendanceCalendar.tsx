'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import type { AttendanceRecord } from '@/lib/mockData';

interface AttendanceCalendarProps {
  studentId: string;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STORAGE_KEY = 'luminar_attendance';

function loadAttendance(): AttendanceRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAttendance(records: AttendanceRecord[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export default function AttendanceCalendar({ studentId }: AttendanceCalendarProps) {
  const today = new Date(2026, 7, 5); // Aug 5 2026 (app context date)
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [tooltip, setTooltip] = useState<{ date: string; x: number; y: number } | null>(null);

  useEffect(() => {
    setAttendance(loadAttendance());
  }, []);

  const getAttendanceForDate = (dateStr: string): 'present' | 'absent' | null => {
    const record = attendance.find((r) => r.studentId === studentId && r.date === dateStr);
    return record ? record.status : null;
  };

  const toggleAttendance = (dateStr: string, status: 'present' | 'absent') => {
    setAttendance((prev) => {
      const existing = prev.find((r) => r.studentId === studentId && r.date === dateStr);
      let updated: AttendanceRecord[];
      if (existing) {
        if (existing.status === status) {
          // Remove if clicking same status (toggle off)
          updated = prev.filter((r) => !(r.studentId === studentId && r.date === dateStr));
        } else {
          updated = prev.map((r) =>
            r.studentId === studentId && r.date === dateStr ? { ...r, status } : r
          );
        }
      } else {
        updated = [...prev, { studentId, date: dateStr, status }];
      }
      saveAttendance(updated);
      return updated;
    });
    setTooltip(null);
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Build calendar grid
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const toDateStr = (day: number) => {
    const m = String(currentMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${currentYear}-${m}-${d}`;
  };

  const isFuture = (day: number) => {
    const d = new Date(currentYear, currentMonth, day);
    return d > today;
  };

  // Stats for current month
  const monthRecords = attendance.filter((r) => {
    if (r.studentId !== studentId) return false;
    const parts = r.date.split('-');
    return parseInt(parts[0]) === currentYear && parseInt(parts[1]) - 1 === currentMonth;
  });
  const presentCount = monthRecords.filter((r) => r.status === 'present').length;
  const absentCount = monthRecords.filter((r) => r.status === 'absent').length;
  const attendanceRate = presentCount + absentCount > 0
    ? Math.round((presentCount / (presentCount + absentCount)) * 100)
    : null;

  return (
    <div className="card-elevated p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="CalendarDaysIcon" size={17} className="text-primary" />
          </div>
          <div>
            <h3 className="font-700 text-foreground text-base">Attendance Calendar</h3>
            <p className="text-xs text-muted-foreground">Click a date to mark Present or Absent</p>
          </div>
        </div>
        {attendanceRate !== null && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-700 ${
            attendanceRate >= 80 ? 'bg-positive/10 text-positive' :
            attendanceRate >= 60 ? 'bg-warning/10 text-warning': 'bg-negative/10 text-negative'
          }`}>
            <Icon name="ChartBarIcon" size={14} />
            {attendanceRate}% this month
          </div>
        )}
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="w-8 h-8 rounded-lg border border-border bg-card hover:bg-secondary flex items-center justify-center transition-colors"
          aria-label="Previous month"
        >
          <Icon name="ChevronLeftIcon" size={16} className="text-muted-foreground" />
        </button>
        <h4 className="font-700 text-foreground text-sm">
          {MONTHS[currentMonth]} {currentYear}
        </h4>
        <button
          onClick={nextMonth}
          className="w-8 h-8 rounded-lg border border-border bg-card hover:bg-secondary flex items-center justify-center transition-colors"
          aria-label="Next month"
        >
          <Icon name="ChevronRightIcon" size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="text-center text-xs font-600 text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 relative" onClick={() => setTooltip(null)}>
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="h-9" />;
          }
          const dateStr = toDateStr(day);
          const status = getAttendanceForDate(dateStr);
          const future = isFuture(day);
          const isToday =
            day === today.getDate() &&
            currentMonth === today.getMonth() &&
            currentYear === today.getFullYear();

          let cellClass = 'h-9 w-full rounded-lg flex items-center justify-center text-sm font-600 transition-all duration-150 relative ';
          if (future) {
            cellClass += 'text-muted-foreground/40 cursor-not-allowed';
          } else if (status === 'present') {
            cellClass += 'bg-[#C8F0D8] text-[#2D7A4F] border-2 border-[#8FD4A8] cursor-pointer hover:brightness-95';
          } else if (status === 'absent') {
            cellClass += 'bg-[#F5C6C9] text-[#A03040] border-2 border-[#E8969E] cursor-pointer hover:brightness-95';
          } else if (isToday) {
            cellClass += 'bg-primary/10 text-primary border-2 border-primary/40 cursor-pointer hover:bg-primary/15';
          } else {
            cellClass += 'bg-secondary/50 text-foreground border border-border cursor-pointer hover:bg-secondary hover:border-primary/30';
          }

          return (
            <div key={dateStr} className="relative">
              <button
                className={cellClass}
                disabled={future}
                onClick={(e) => {
                  e.stopPropagation();
                  if (future) return;
                  setTooltip(tooltip?.date === dateStr ? null : { date: dateStr, x: 0, y: 0 });
                }}
                aria-label={`${dateStr}: ${status || 'not marked'}`}
                title={status ? `${status.charAt(0).toUpperCase() + status.slice(1)}` : 'Click to mark'}
              >
                {day}
                {status === 'present' && (
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#2D7A4F]" />
                )}
                {status === 'absent' && (
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#A03040]" />
                )}
              </button>

              {/* Inline tooltip/picker */}
              {tooltip?.date === dateStr && (
                <div
                  className="absolute z-30 top-full mt-1 left-1/2 -translate-x-1/2 card-elevated-md p-2 flex flex-col gap-1 min-w-[110px] animate-slide-up"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-xs text-muted-foreground font-500 px-1 pb-0.5 border-b border-border">
                    {dateStr}
                  </p>
                  <button
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-600 transition-colors ${
                      status === 'present' ?'bg-[#C8F0D8] text-[#2D7A4F]' :'hover:bg-[#C8F0D8] hover:text-[#2D7A4F] text-foreground'
                    }`}
                    onClick={() => toggleAttendance(dateStr, 'present')}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2D7A4F] flex-shrink-0" />
                    Present
                    {status === 'present' && <Icon name="CheckIcon" size={11} className="ml-auto" />}
                  </button>
                  <button
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-600 transition-colors ${
                      status === 'absent' ?'bg-[#F5C6C9] text-[#A03040]' :'hover:bg-[#F5C6C9] hover:text-[#A03040] text-foreground'
                    }`}
                    onClick={() => toggleAttendance(dateStr, 'absent')}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#A03040] flex-shrink-0" />
                    Absent
                    {status === 'absent' && <Icon name="CheckIcon" size={11} className="ml-auto" />}
                  </button>
                  {status && (
                    <button
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-500 text-muted-foreground hover:bg-secondary transition-colors"
                      onClick={() => toggleAttendance(dateStr, status)}
                    >
                      <Icon name="XMarkIcon" size={11} />
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend + Stats */}
      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-[#C8F0D8] border border-[#8FD4A8]" />
            <span className="text-xs text-muted-foreground font-500">Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-[#F5C6C9] border border-[#E8969E]" />
            <span className="text-xs text-muted-foreground font-500">Absent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-secondary border border-border" />
            <span className="text-xs text-muted-foreground font-500">Not marked</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="font-600 text-[#2D7A4F]">{presentCount} Present</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-600 text-[#A03040]">{absentCount} Absent</span>
        </div>
      </div>
    </div>
  );
}
