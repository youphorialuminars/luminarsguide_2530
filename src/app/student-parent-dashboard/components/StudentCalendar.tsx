'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';


interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time: string;
  jitsi_room: string;
  jitsi_url: string;
  notes: string | null;
}

interface AttendanceRecord {
  attendance_date: string;
  status: 'present' | 'absent';
}

interface JitsiModalProps {
  meeting: Meeting;
  onClose: () => void;
}

// ─── Jitsi Embedded Modal ─────────────────────────────────────────────────────
function JitsiModal({ meeting, onClose }: JitsiModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl bg-card rounded-2xl border border-border shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="VideoCameraIcon" size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-700 text-foreground">{meeting.title}</p>
              <p className="text-xs text-muted-foreground">{meeting.meeting_date} · {meeting.meeting_time}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close video"
          >
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        {/* Jitsi iFrame */}
        <div className="relative w-full" style={{ height: '70vh' }}>
          <iframe
            src={`https://meet.jit.si/${meeting.jitsi_room}#config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.prejoinPageEnabled=false`}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="w-full h-full border-0"
            title={`Jitsi Meet: ${meeting.title}`}
          />
        </div>

        <div className="px-5 py-3 border-t border-border bg-secondary/30 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            <Icon name="InformationCircleIcon" size={12} className="inline mr-1" />
            Room: <span className="font-mono text-foreground">{meeting.jitsi_room}</span>
          </p>
          <a
            href={meeting.jitsi_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs"
          >
            <Icon name="ArrowTopRightOnSquareIcon" size={13} />
            Open in new tab
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────
interface MiniCalendarProps {
  year: number;
  month: number;
  meetings: Meeting[];
  attendance: AttendanceRecord[];
  onDayClick: (date: string) => void;
  selectedDate: string | null;
}

function MiniCalendar({ year, month, meetings, attendance, onDayClick, selectedDate }: MiniCalendarProps) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const meetingDates = new Set(meetings.map((m) => m.meeting_date));
  const attendanceMap: Record<string, 'present' | 'absent'> = {};
  attendance.forEach((a) => { attendanceMap[a.attendance_date] = a.status; });

  const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="card-elevated p-4">
      <p className="text-sm font-700 text-foreground text-center mb-3">
        {MONTHS[month]} {year}
      </p>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-600 text-muted-foreground py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const hasMeeting = meetingDates.has(dateStr);
          const attStatus = attendanceMap[dateStr];
          const isSelected = selectedDate === dateStr;
          const isToday = dateStr === new Date().toISOString().split('T')[0];

          return (
            <button
              key={day}
              onClick={() => hasMeeting && onDayClick(dateStr)}
              className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 text-xs font-600 transition-all ${
                isSelected
                  ? 'bg-primary text-white'
                  : hasMeeting
                  ? 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer' :'text-foreground hover:bg-secondary cursor-default'
              } ${isToday && !isSelected ? 'ring-2 ring-primary/40' : ''}`}
            >
              {day}
              {hasMeeting && (
                <span className={`absolute bottom-0.5 w-1.5 h-1.5 rounded-full ${
                  attStatus === 'present' ? 'bg-positive' :
                  attStatus === 'absent'? 'bg-negative' : 'bg-primary'
                }`} />
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 justify-center">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground">Session</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-positive" />
          <span className="text-xs text-muted-foreground">Present</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-negative" />
          <span className="text-xs text-muted-foreground">Absent</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StudentCalendar() {
  const supabase = createClient();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeJitsiMeeting, setActiveJitsiMeeting] = useState<Meeting | null>(null);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Get student record for this user
    const { data: studentRow } = await supabase
      .from('students')
      .select('id')
      .eq('student_user_id', user.id)
      .single();

    if (!studentRow) { setLoading(false); return; }

    const [meetingsResult, attendanceResult] = await Promise.all([
      supabase.from('meetings').select('*').eq('student_id', studentRow.id).order('meeting_date', { ascending: true }),
      supabase.from('attendance').select('attendance_date, status').eq('student_id', studentRow.id),
    ]);

    setMeetings(meetingsResult.data || []);
    setAttendance(attendanceResult.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedMeetings = selectedDate
    ? meetings.filter((m) => m.meeting_date === selectedDate)
    : [];

  const selectedAttendance = selectedDate
    ? attendance.find((a) => a.attendance_date === selectedDate)
    : null;

  const upcomingMeetings = meetings.filter(
    (m) => m.meeting_date >= today.toISOString().split('T')[0]
  ).slice(0, 3);

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {activeJitsiMeeting && (
        <JitsiModal meeting={activeJitsiMeeting} onClose={() => setActiveJitsiMeeting(null)} />
      )}

      <div className="card-elevated p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-700 text-foreground flex items-center gap-2">
            <Icon name="CalendarDaysIcon" size={18} className="text-primary" />
            My Session Calendar
          </h2>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
              <Icon name="ChevronLeftIcon" size={16} className="text-muted-foreground" />
            </button>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
              <Icon name="ChevronRightIcon" size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        <MiniCalendar
          year={calYear}
          month={calMonth}
          meetings={meetings}
          attendance={attendance}
          onDayClick={setSelectedDate}
          selectedDate={selectedDate}
        />

        {/* Selected Day Detail */}
        {selectedDate && selectedMeetings.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-700 text-foreground">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              {selectedAttendance && (
                <span className={`flex items-center gap-1.5 text-xs font-700 px-3 py-1 rounded-full border ${
                  selectedAttendance.status === 'present' ?'bg-positive/10 text-positive border-positive/20' :'bg-negative/10 text-negative border-negative/20'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${selectedAttendance.status === 'present' ? 'bg-positive' : 'bg-negative'}`} />
                  {selectedAttendance.status === 'present' ? 'Present' : 'Absent'}
                </span>
              )}
            </div>

            {selectedMeetings.map((meeting) => (
              <div key={meeting.id} className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-700 text-foreground">{meeting.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <Icon name="ClockIcon" size={11} className="inline mr-1" />
                      {meeting.meeting_time}
                    </p>
                    {meeting.notes && (
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{meeting.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveJitsiMeeting(meeting)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-700 hover:bg-primary/90 transition-colors flex-shrink-0 shadow-sm"
                  >
                    <Icon name="VideoCameraIcon" size={15} />
                    Join Meeting
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upcoming Sessions */}
        {upcomingMeetings.length > 0 && !selectedDate && (
          <div className="mt-4">
            <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide mb-2">Upcoming Sessions</p>
            <div className="space-y-2">
              {upcomingMeetings.map((meeting) => (
                <div key={meeting.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-xs font-700 text-primary leading-none">
                        {new Date(meeting.meeting_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-sm font-800 text-primary leading-none">
                        {new Date(meeting.meeting_date + 'T00:00:00').getDate()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-600 text-foreground">{meeting.title}</p>
                      <p className="text-xs text-muted-foreground">{meeting.meeting_time}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveJitsiMeeting(meeting)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-700 hover:bg-primary/20 transition-colors border border-primary/20"
                  >
                    <Icon name="VideoCameraIcon" size={13} />
                    Join
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {meetings.length === 0 && (
          <div className="mt-4 text-center py-6">
            <Icon name="CalendarDaysIcon" size={32} className="text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-sm text-muted-foreground">No sessions scheduled yet. Your mentor will schedule sessions for you.</p>
          </div>
        )}
      </div>
    </>
  );
}
