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
  type: 'student' | 'mentor' | 'session';
  href: string;
}

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
          // Mentors: search their own students
          const { data: students } = await supabase
            .from('students')
            .select('id, name, grade')
            .eq('mentor_id', uid)
            .ilike('name', `%${q}%`)
            .limit(8);

          (students || []).forEach((s) =>
            hits.push({
              id: s.id,
              label: s.name,
              sublabel: s.grade ? `Grade ${s.grade}` : 'Student',
              type: 'student',
              href: `/student-analysis-history?studentId=${s.id}`,
            })
          );
        } else if (role === 'parent') {
          // Parents: search only their linked child
          const linkedId = profile.linked_student_id;
          if (linkedId) {
            const { data: student } = await supabase
              .from('students')
              .select('id, name, grade')
              .eq('id', linkedId)
              .ilike('name', `%${q}%`)
              .maybeSingle();

            if (student) {
              hits.push({
                id: student.id,
                label: student.name,
                sublabel: student.grade ? `Grade ${student.grade}` : 'Your Child',
                type: 'student',
                href: `/parents-hub`,
              });
            }
          }
        } else if (role === 'school') {
          // School: search mentors and students linked to this school
          const [{ data: mentors }, { data: students }] = await Promise.all([
            supabase
              .from('user_profiles')
              .select('id, full_name, email')
              .eq('school_id', uid)
              .eq('role', 'mentor')
              .ilike('full_name', `%${q}%`)
              .limit(5),
            supabase
              .from('students')
              .select('id, name, grade')
              .eq('school_id', uid)
              .ilike('name', `%${q}%`)
              .limit(5),
          ]);

          (mentors || []).forEach((m) =>
            hits.push({
              id: m.id,
              label: m.full_name,
              sublabel: m.email,
              type: 'mentor',
              href: `/school-mentor-view?mentorId=${m.id}`,
            })
          );
          (students || []).forEach((s) =>
            hits.push({
              id: s.id,
              label: s.name,
              sublabel: s.grade ? `Grade ${s.grade}` : 'Student',
              type: 'student',
              href: `/school-student-view?studentId=${s.id}`,
            })
          );
        } else if (role === 'counselor') {
          // Counselor: search students linked to their counselor_id
          const { data: students } = await supabase
            .from('students')
            .select('id, name, grade')
            .eq('counselor_id', uid)
            .ilike('name', `%${q}%`)
            .limit(8);

          (students || []).forEach((s) =>
            hits.push({
              id: s.id,
              label: s.name,
              sublabel: s.grade ? `Grade ${s.grade}` : 'Student',
              type: 'student',
              href: `/counselor-student-view?studentId=${s.id}`,
            })
          );
        }
      } catch (err) {
        console.error('[GlobalSearch]', err);
      }

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

  // Close on outside click
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
    router.push(result.href);
  };

  const typeIcon: Record<SearchResult['type'], string> = {
    student: 'AcademicCapIcon',
    mentor: 'UserIcon',
    session: 'ClipboardDocumentListIcon',
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary border border-border focus-within:border-primary/50 transition-colors">
        <Icon name="MagnifyingGlassIcon" size={15} className="text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search students…"
          className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
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
        <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-card border border-border rounded-xl shadow-lg overflow-hidden animate-fade-in">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSelect(r)}
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
