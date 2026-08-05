'use client';

import React, { useState, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import { mockStudents, mockSessions } from '@/lib/mockData';
import type { Student } from '@/lib/mockData';
import StudentCard from './StudentCard';
import DashboardStatsStrip from './DashboardStatsStrip';
import AddStudentModal from './AddStudentModal';

type SortOption = 'name' | 'score' | 'sessions' | 'lastSession';
type FilterOption = 'all' | 'up' | 'down' | 'stable';

export default function StudentDashboardContent() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [filterTrend, setFilterTrend] = useState<FilterOption>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [students, setStudents] = useState<Student[]>(mockStudents);

  const sessionsThisWeek = useMemo(() => {
    const weekAgo = new Date('2026-07-29');
    return mockSessions.filter((s) => new Date(s.date) >= weekAgo).length;
  }, []);

  const avgScore = useMemo(() => {
    const total = students.reduce((sum, s) => sum + s.averageScore, 0);
    return Math.round(total / students.length);
  }, [students]);

  const needAttention = useMemo(
    () => students.filter((s) => s.scoreTrend === 'down' || s.averageScore < 65).length,
    [students]
  );

  const filtered = useMemo(() => {
    let result = [...students];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.grade.toLowerCase().includes(q) ||
          s.primaryTopics.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (filterTrend !== 'all') {
      result = result.filter((s) => s.scoreTrend === filterTrend);
    }
    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'score') return b.averageScore - a.averageScore;
      if (sortBy === 'sessions') return b.sessionCount - a.sessionCount;
      if (sortBy === 'lastSession') return b.lastSessionDate.localeCompare(a.lastSessionDate);
      return 0;
    });
    return result;
  }, [students, search, filterTrend, sortBy]);

  const handleAddStudent = (data: { name: string; grade: string; notes: string }) => {
    const initials = data.name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
    const colors = ['#7C6FCD', '#5BAD8F', '#D97BB6', '#5B8FD9', '#E8A020', '#C97B7B'];
    const newStudent: Student = {
      id: `student-${Date.now()}`,
      name: data.name,
      grade: data.grade,
      mentorId: 'mentor-101',
      avatarColor: colors[students.length % colors.length],
      avatarInitials: initials,
      enrolledDate: '2026-08-05',
      lastSessionDate: '—',
      sessionCount: 0,
      averageScore: 0,
      scoreTrend: 'stable',
      primaryTopics: [],
      notes: data.notes,
    };
    setStudents((prev) => [...prev, newStudent]);
  };

  const filterOptions: { value: FilterOption; label: string; icon: string }[] = [
    { value: 'all', label: 'All Students', icon: 'UserGroupIcon' },
    { value: 'up', label: 'Improving', icon: 'ArrowTrendingUpIcon' },
    { value: 'stable', label: 'Stable', icon: 'MinusIcon' },
    { value: 'down', label: 'Declining', icon: 'ArrowTrendingDownIcon' },
  ];

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-700 text-foreground">Student Roster</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your mentorship memory — all students, all sessions, all progress.
          </p>
        </div>
        <button
          className="btn-primary self-start sm:self-auto"
          onClick={() => setShowAddModal(true)}
        >
          <Icon name="UserPlusIcon" size={17} />
          Add Student
        </button>
      </div>

      {/* Stats Strip */}
      <DashboardStatsStrip
        totalStudents={students.length}
        sessionsThisWeek={sessionsThisWeek}
        averageScore={avgScore}
        studentsNeedingAttention={needAttention}
      />

      {/* Search + Filter + Sort */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Icon
            name="MagnifyingGlassIcon"
            size={17}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            className="input-mystic pl-9"
            placeholder="Search by name, grade, or topic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              <Icon name="XMarkIcon" size={15} />
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex gap-1 p-1 rounded-xl bg-secondary border border-border">
            {filterOptions.map((f) => (
              <button
                key={`filter-${f.value}`}
                onClick={() => setFilterTrend(f.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 transition-all ${
                  filterTrend === f.value
                    ? 'bg-card text-foreground shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon name={f.icon as any} size={13} />
                <span className="hidden sm:inline">{f.label}</span>
              </button>
            ))}
          </div>

          <select
            className="input-mystic text-sm py-1.5 px-3 w-auto"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="name">Sort: Name</option>
            <option value="score">Sort: Score ↓</option>
            <option value="sessions">Sort: Sessions ↓</option>
            <option value="lastSession">Sort: Recent First</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-600 text-foreground">{filtered.length}</span> of{' '}
          <span className="font-600 text-foreground">{students.length}</span> students
        </p>
        {search && (
          <button className="btn-ghost text-xs" onClick={() => setSearch('')}>
            <Icon name="XMarkIcon" size={13} />
            Clear search
          </button>
        )}
      </div>

      {/* Student Grid */}
      {filtered.length === 0 ? (
        <div className="card-elevated flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Icon name="UserGroupIcon" size={28} className="text-muted-foreground" />
          </div>
          <h3 className="font-700 text-foreground text-lg mb-2">No students found</h3>
          <p className="text-sm text-muted-foreground max-w-xs mb-5">
            {search
              ? `No students match "${search}". Try a different name, grade, or topic.`
              : 'No students match the current filter. Try selecting "All Students".'}
          </p>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <Icon name="UserPlusIcon" size={16} />
            Add First Student
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
          {filtered.map((student) => (
            <StudentCard key={student.id} student={student} />
          ))}
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <AddStudentModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddStudent}
        />
      )}
    </div>
  );
}