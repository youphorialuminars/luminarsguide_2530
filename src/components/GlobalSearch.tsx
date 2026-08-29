'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  type: 'student' | 'mentor' | 'section';
  href: string;
}

interface SectionDef {
  label: string;
  href: string;
}

const SECTIONS_BY_ROLE: Record<string, SectionDef[]> = {
  mentor: [
    { label: 'Student Roster', href: '/student-dashboard?tab=roster' },
    { label: 'Attendance', href: '/student-dashboard?tab=attendance' },
    { label: 'Schedule Sessions', href: '/student-dashboard?tab=calendar' },
    { label: 'Calendar', href: '/student-dashboard?tab=calendar' },
    { label: 'Self-Reflection & Peer Ranking', href: '/student-dashboard?tab=reflections' },
    { label: 'Reflections', href: '/student-dashboard?tab=reflections' },
    { label: 'Manage Surveys', href: '/student-dashboard?tab=surveys' },
    { label: 'Surveys', href: '/student-dashboard?tab=surveys' },
    { label: 'Assign Tasks', href: '/student-dashboard?tab=tasks' },
    { label: 'Tasks', href: '/student-dashboard?tab=tasks' },
    { label: 'Parent Queries', href: '/student-dashboard?tab=parent-queries' },
    { label: 'Parent Activities', href: '/student-dashboard?tab=parent-activities' },
    { label: 'Programs & Events', href: '/student-dashboard?tab=programs' },
    { label: 'New Session', href: '/new-session' },
    { label: 'Analysis', href: '/student-analysis-history' },
    { label: 'Network & Links', href: '/network-links' },
    { label: 'Settings', href: '/settings' },
  ],
  student: [
    { label: 'My Quest', href: '/student-parent-dashboard?tab=overview' },
    { label: 'My Tasks', href: '/student-parent-dashboard?tab=tasks' },
    { label: 'Tasks', href: '/student-parent-dashboard?tab=tasks' },
    { label: 'Surveys', href: '/student-parent-dashboard?tab=surveys' },
    { label: 'Calendar', href: '/student-parent-dashboard?tab=calendar' },
    { label: 'Attendance', href: '/student-parent-dashboard?tab=calendar' },
    { label: 'Report Card', href: '/student-parent-dashboard?tab=report' },
    { label: 'Mentor Feedback', href: '/student-parent-dashboard?tab=feedback' },
    { label: 'Feedback', href: '/student-parent-dashboard?tab=feedback' },
    { label: 'Programs & Events', href: '/student-parent-dashboard?tab=programs' },
    { label: 'Network & Links', href: '/network-links' },
    { label: 'Settings', href: '/settings' },
  ],
  school: [
    { label: 'Institutional Overview', href: '/school-dashboard?tab=overview' },
    { label: 'Overview', href: '/school-dashboard?tab=overview' },
    { label: 'Student Directory', href: '/school-dashboard?tab=students' },
    { label: 'Mentor Directory', href: '/school-dashboard?tab=mentors' },
    { label: 'Invite Codes', href: '/school-dashboard?tab=invites' },
    { label: 'School Calendar', href: '/school-dashboard?tab=calendar' },
    { label: 'Calendar', href: '/school-dashboard?tab=calendar' },
    { label: 'Programs & Events', href: '/school-dashboard?tab=programs' },
    { label: 'Network & Links', href: '/network-links' },
    { label: 'Settings', href: '/settings' },
  ],
  counselor: [
    { label: 'Overview', href: '/counselor-dashboard?tab=overview' },
    { label: 'Mentor Directory', href: '/counselor-dashboard?tab=mentors' },
    { label: 'Student Directory', href: '/counselor-dashboard?tab=students' },
    { label: 'Invite Codes', href: '/counselor-dashboard?tab=invites' },
    { label: 'Programs & Events', href: '/counselor-dashboard?tab=programs' },
    { label: 'Network & Links', href: '/network-links' },
    { label: 'Settings', href: '/settings' },
  ],
  parent: [
    { label: "Child's Overview", href: '/parents-hub' },
    { label: 'Overview', href: '/parents-hub' },
    { label: 'Mentor Overview', href: '/parents-hub' },
    { label: 'Action Center', href: '/parents-hub' },
    { label: 'Activities', href: '/parents-hub' },
    { label: 'Programs & Events', href: '/parents-hub' },
    { label: 'Leaderboard', href: '/parents-hub' },
    { label: 'Network & Links', href: '/network-links' },
    { label: 'Settings', href: '/settings' },
  ],
  admin: [
    { label: 'Overview', href: '/admin-dashboard' },
    { label: 'Schools', href: '/admin-dashboard' },
    { label: 'All Mentors', href: '/admin-dashboard' },
    { label: 'All Students', href: '/admin-dashboard' },
    { label: 'Link a School', href: '/admin-dashboard' },
    { label: 'Programs & Events', href: '/admin-dashboard' },
    { label: 'Network & Links', href: '/network-links' },
    { label: 'Settings', href: '/settings' },
  ],
};

export default function GlobalSearch() {
  const router = useRouter();
  const { profile } = useAuth();
  const supabase = createClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    async (q: string) => {
      if (!q.trim() || !profile) {
        setResults([]);
        return;
      }
      setLoading(true);
      const role = profile.role;
      const uid = profile.id;
      const hits: SearchResult[] = [];

      try {
        if (role === 'mentor') {
          const { data: students } = await supabase
            .from('students')
            .select('id, name, grade')
            .eq('mentor_id', uid)
            .ilike('name', `%${q}%`)
            .limit(6);

          (students || []).forEach((s) =>
            hits.push({
              id: s.id,
              label: s.name,
              sublabel: s.grade ? `Grade ${s.grade}` : 'Student',
              type: 'student',
              href: `/student-dashboard?tab=roster&q=${encodeURIComponent(s.name)}`,
            })
          );
        } else if (role === 'school') {
          const [{ data: schoolMentors }, { data: schoolStudents }] = await Promise.all([
            supabase
              .from('user_profiles')
              .select('id, full_name, email')
              .eq('school_id', uid)
              .eq('role', 'mentor')
              .ilike('full_name', `%${q}%`)
              .limit(5),
            supabase
              .from('user_profiles')
              .select('id, full_name')
              .eq('school_id', uid)
              .eq('role', 'student')
              .ilike('full_name', `%${q}%`)
              .limit(5),
          ]);

          (schoolMentors || []).forEach((m) =>
            hits.push({
              id: m.id,
              label: m.full_name,
              sublabel: m.email,
              type: 'mentor',
              href: `/school-dashboard?tab=mentors&q=${encodeURIComponent(m.full_name)}`,
            })
          );
          (schoolStudents || []).forEach((s) =>
            hits.push({
              id: s.id,
              label: s.full_name,
              sublabel: 'Student',
              type: 'student',
              href: `/school-dashboard?tab=students&q=${encodeURIComponent(s.full_name)}`,
            })
          );
         } else if (role === 'counselor') {
          const { data: students } = await supabase
            .from('user_profiles')
            .select('id, full_name')
            .eq('counselor_id', uid)
            .eq('role', 'student')
            .ilike('full_name', `%${q}%`)
            .limit(8);

          (students || []).forEach((s) =>
            hits.push({
              id: s.id,
              label: s.full_name,
              sublabel: 'Student',
              type: 'student',
              href: `/counselor-dashboard?tab=students&q=${encodeURIComponent(s.full_name)}`,
            })
          );
        }
        // Student role: no people search, sections only (added below for all roles)
      } catch (err) {
        console.error('[GlobalSearch]', err);
      }

      // Section matches (available to every role)
      const roleSections = SECTIONS_BY_ROLE[role] || [];
      roleSections
        .filter((sec) => sec.label.toLowerCase().includes(q.toLowerCase()))
        .forEach((sec) =>
          hits.push({
            id: `section-${sec.href}`,
            label: sec.label,
            sublabel: 'Section',
            type: 'section',
            href: sec.href,
          })
        );

      setResults(hits);
      setLoading(false);
    },
    [profile, supabase]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        search(query);
        setOpen(true);
      } else {
        setResults([]);
        setOpen(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (result: SearchResult) => {
    setQuery('');
    setOpen(false);
    window.location.href = result.href;
  };

  const typeIcon: Record<SearchResult['type'], string> = {
    student: 'AcademicCapIcon',
    mentor: 'UserIcon',
    section: 'Squares2X2Icon',
  };

  // Students don't search other people — placeholder reflects that
  const placeholder = (profile?.role === 'student' || profile?.role === 'parent') ? 'Search sections…' : 'Search students, sections…';

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-secondary border border-border focus-within:border-primary/50 transition-colors">
        <Icon name="MagnifyingGlassIcon" size={16} className="text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground outline-none w-full min-w-0"
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
        />
        {loading && (
          <Icon name="ArrowPathIcon" size={13} className="text-muted-foreground animate-spin flex-shrink-0" />
        )}
        {query && !loading && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <Icon name="XMarkIcon" size={13} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-card border border-border rounded-xl shadow-lg overflow-hidden animate-fade-in max-h-80 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(r); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon name={typeIcon[r.type] as any} size={14} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-600 text-foreground truncate">{r.label}</p>
                {r.sublabel && (
                  <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query.trim().length >= 2 && !loading && results.length === 0 && (
        <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-card border border-border rounded-xl shadow-lg px-4 py-3 animate-fade-in">
          <p className="text-sm text-muted-foreground text-center">No results found</p>
        </div>
      )}
    </div>
  );
}