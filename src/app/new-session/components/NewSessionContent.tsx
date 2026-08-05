'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { mockStudents, mockSessions, TOPICS } from '@/lib/mockData';
import type { Student } from '@/lib/mockData';
import AIRoutingIndicator from './AIRoutingIndicator';
import { toast } from 'sonner';

interface SessionForm {
  studentId: string;
  topic: string;
  score: string;
  offlineClass: string;
  onlineTask: string;
  groupTask: string;
  mentorCall: string;
  comprehensive: string;
}

function StudentSelector({
  students,
  selectedId,
  onSelect,
}: {
  students: Student[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = students.find((s) => s.id === selectedId);

  return (
    <div className="relative">
      <button
        type="button"
        className="w-full input-mystic text-left flex items-center justify-between gap-2"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-700 flex-shrink-0"
              style={{ backgroundColor: selected.avatarColor }}
            >
              {selected.avatarInitials}
            </div>
            <span className="font-600 text-foreground">{selected.name}</span>
            <span className="text-xs text-muted-foreground">{selected.grade}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">Select a student...</span>
        )}
        <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} className="text-muted-foreground flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 card-elevated-md z-20 max-h-60 overflow-y-auto scrollbar-thin animate-slide-up">
          {students.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors text-left ${
                s.id === selectedId ? 'bg-primary/5' : ''
              }`}
              onClick={() => { onSelect(s.id); setOpen(false); }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-700 flex-shrink-0"
                style={{ backgroundColor: s.avatarColor }}
              >
                {s.avatarInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-600 text-foreground">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.grade} · {s.sessionCount} sessions</p>
              </div>
              {s.id === selectedId && (
                <Icon name="CheckIcon" size={15} className="text-primary flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const OBSERVATION_FIELDS: { key: keyof Pick<SessionForm, 'offlineClass' | 'onlineTask' | 'groupTask' | 'mentorCall' | 'comprehensive'>; label: string; placeholder: string; icon: string }[] = [
  {
    key: 'offlineClass',
    label: '1. Offline Class Observations',
    placeholder: 'Describe the student\'s behaviour, engagement, and performance during in-person classroom sessions...',
    icon: 'BuildingLibraryIcon',
  },
  {
    key: 'onlineTask',
    label: '2. Online Task Performance',
    placeholder: 'Describe how the student performed on digital assignments, online quizzes, or remote tasks...',
    icon: 'ComputerDesktopIcon',
  },
  {
    key: 'groupTask',
    label: '3. Group Task Participation & Dynamics',
    placeholder: 'Describe the student\'s role, contributions, and interpersonal behaviour during group activities...',
    icon: 'UserGroupIcon',
  },
  {
    key: 'mentorCall',
    label: '4. Mentor Call Notes',
    placeholder: 'Summarise key points, concerns, and insights from your one-on-one mentor call with this student...',
    icon: 'PhoneIcon',
  },
  {
    key: 'comprehensive',
    label: '5. Comprehensive Observation',
    placeholder: 'Provide an overall synthesis of the student\'s progress, patterns, and any notable developments this period...',
    icon: 'ClipboardDocumentListIcon',
  },
];

export default function NewSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get('studentId') || '';

  const [isLoading, setIsLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(preselectedId);
  const [isCacheHit, setIsCacheHit] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SessionForm>({
    defaultValues: {
      studentId: preselectedId,
      score: '',
      topic: '',
      offlineClass: '',
      onlineTask: '',
      groupTask: '',
      mentorCall: '',
      comprehensive: '',
    },
  });

  const watchedTopic = watch('topic');
  const watchedComprehensive = watch('comprehensive') || '';
  const watchedScore = watch('score');

  // Combined observation length for AI routing
  const allObservations = [
    watch('offlineClass') || '',
    watch('onlineTask') || '',
    watch('groupTask') || '',
    watch('mentorCall') || '',
    watchedComprehensive,
  ].join(' ');

  useEffect(() => {
    setValue('studentId', selectedStudentId);
  }, [selectedStudentId, setValue]);

  // Cache detection logic
  useEffect(() => {
    if (!selectedStudentId || !watchedTopic || !watchedScore) {
      setIsCacheHit(false);
      return;
    }
    const studentSessions = mockSessions.filter(
      (s) => s.studentId === selectedStudentId && s.topic === watchedTopic
    );
    const score = parseInt(watchedScore);
    if (studentSessions.length > 0 && !isNaN(score)) {
      const close = studentSessions.find((s) => Math.abs(s.score - score) <= 8);
      setIsCacheHit(!!close);
    } else {
      setIsCacheHit(false);
    }
  }, [selectedStudentId, watchedTopic, watchedScore]);

  const selectedStudent = mockStudents.find((s) => s.id === selectedStudentId);

  const onSubmit = async (data: SessionForm) => {
    setIsLoading(true);
    // BACKEND INTEGRATION: POST /api/sessions with data; AI analysis generated server-side
    // The AI persona system prompt should be injected at the API layer
    // Model routing: sensitive topics + long observations → Gemini Pro, else Gemini Flash
    // Cache check: compare with existing sessions for this student before calling AI
    // AI ingests: score + all 5 observation fields → generates Strengths, Weaknesses, Approach, Task List
    await new Promise((r) => setTimeout(r, 2800));
    setIsLoading(false);
    toast.success('Analysis generated successfully!');
    router.push(`/student-analysis-history?studentId=${data.studentId}&newSession=true`);
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center hover:bg-secondary transition-colors"
          aria-label="Go back"
        >
          <Icon name="ArrowLeftIcon" size={17} className="text-muted-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-700 text-foreground">
            {selectedStudent ? `New Session for ${selectedStudent.name}` : 'Start New Session'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Submit observations to generate AI-powered personalized guidance
          </p>
        </div>
      </div>

      {/* AI Persona Banner */}
      <div className="card-elevated p-4 mb-5 flex items-start gap-3 border-l-4 border-l-primary">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon name="AcademicCapIcon" size={20} className="text-primary" />
        </div>
        <div>
          <p className="text-sm font-700 text-foreground">Veteran Educator AI — Active</p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
            Analysis is generated by an AI embodying 60+ years of mentorship experience across
            Educational Psychology, Well-being, Civic Sense, and Leadership development.
            All five observation areas are synthesised together with the test score.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* Section 1: Student Selection */}
        <div className="card-elevated p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-700 flex items-center justify-center">1</div>
            <h2 className="font-700 text-foreground text-base">Select Student</h2>
          </div>

          <div>
            <label className="block text-sm font-600 text-foreground mb-1.5">
              Student <span className="text-negative">*</span>
            </label>
            <StudentSelector
              students={mockStudents}
              selectedId={selectedStudentId}
              onSelect={setSelectedStudentId}
            />
            <input type="hidden" {...register('studentId', { required: 'Please select a student' })} />
            {errors.studentId && (
              <p className="text-xs text-negative mt-1.5 flex items-center gap-1">
                <Icon name="ExclamationCircleIcon" size={13} />
                {errors.studentId.message}
              </p>
            )}
          </div>

          {selectedStudent && (
            <div className="mt-4 p-3 rounded-xl bg-secondary/60 border border-border flex items-center justify-between gap-4 flex-wrap animate-fade-in">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-700 text-sm"
                  style={{ backgroundColor: selectedStudent.avatarColor }}
                >
                  {selectedStudent.avatarInitials}
                </div>
                <div>
                  <p className="font-700 text-foreground text-sm">{selectedStudent.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedStudent.grade}
                    {selectedStudent.age ? ` · Age ${selectedStudent.age}` : ''}
                    {selectedStudent.gender ? ` · ${selectedStudent.gender}` : ''}
                    {` · ${selectedStudent.sessionCount} sessions completed`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="tabular-nums text-lg font-700 text-foreground">{selectedStudent.averageScore || '—'}</p>
                  <p className="text-xs text-muted-foreground">Avg. Score</p>
                </div>
                <div>
                  <p className="text-sm font-600 text-foreground">
                    {selectedStudent.lastSessionDate !== '—' ? selectedStudent.lastSessionDate : 'No sessions yet'}
                  </p>
                  <p className="text-xs text-muted-foreground">Last Session</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Session Details */}
        <div className="card-elevated p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-700 flex items-center justify-center">2</div>
            <h2 className="font-700 text-foreground text-base">Session Details</h2>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-600 text-foreground mb-1.5">
                Core Educational Pillar <span className="text-negative">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Select the core pillar this session focuses on
              </p>
              <select
                className="input-mystic"
                {...register('topic', { required: 'Please select a pillar' })}
              >
                <option value="">Select a pillar...</option>
                {TOPICS.map((t) => (
                  <option key={`topic-opt-${t.slice(0, 20)}`} value={t}>{t}</option>
                ))}
              </select>
              {errors.topic && (
                <p className="text-xs text-negative mt-1.5 flex items-center gap-1">
                  <Icon name="ExclamationCircleIcon" size={13} />
                  {errors.topic.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-600 text-foreground mb-1.5">
                Test / Assessment Score <span className="text-negative">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Enter the score as a number (e.g. 74 for 74%, or 37 for 37/50)
              </p>
              <input
                className="input-mystic"
                type="number"
                min="0"
                max="100"
                placeholder="e.g. 74"
                {...register('score', {
                  required: 'Score is required',
                  min: { value: 0, message: 'Score cannot be negative' },
                  max: { value: 100, message: 'Score cannot exceed 100' },
                })}
              />
              {errors.score && (
                <p className="text-xs text-negative mt-1.5 flex items-center gap-1">
                  <Icon name="ExclamationCircleIcon" size={13} />
                  {errors.score.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Five Observation Fields */}
        <div className="card-elevated p-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-700 flex items-center justify-center">3</div>
            <h2 className="font-700 text-foreground text-base">Mentor Observations</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-5 ml-8">
            Complete all five observation areas. The AI synthesises all inputs together with the test score to generate the most accurate and actionable guidance.
          </p>

          <div className="flex flex-col gap-5">
            {OBSERVATION_FIELDS.map((field) => {
              const fieldError = errors[field.key];
              const fieldValue = watch(field.key) || '';
              return (
                <div key={field.key} className="p-4 rounded-xl bg-secondary/40 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon name={field.icon as any} size={14} className="text-primary" />
                    </div>
                    <label className="text-sm font-700 text-foreground">
                      {field.label} <span className="text-negative">*</span>
                    </label>
                  </div>
                  <textarea
                    className="input-mystic resize-none leading-relaxed"
                    rows={4}
                    placeholder={field.placeholder}
                    {...register(field.key, {
                      required: `${field.label} is required`,
                      minLength: { value: 20, message: 'Please provide at least 20 characters' },
                    })}
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    {fieldError ? (
                      <p className="text-xs text-negative flex items-center gap-1">
                        <Icon name="ExclamationCircleIcon" size={13} />
                        {fieldError.message}
                      </p>
                    ) : (
                      <span />
                    )}
                    <p className={`text-xs tabular-nums ${fieldValue.length > 100 ? 'text-info' : 'text-muted-foreground'}`}>
                      {fieldValue.length} chars
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Routing Indicator */}
        {watchedTopic && (
          <div className="animate-fade-in">
            <AIRoutingIndicator
              observationLength={allObservations.length}
              topic={watchedTopic}
              isCacheHit={isCacheHit}
            />
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center gap-3 pb-4">
          <button
            type="button"
            className="btn-secondary flex-none"
            onClick={() => router.back()}
          >
            <Icon name="ArrowLeftIcon" size={16} />
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-2.5 justify-center">
                <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                <span>Generating Analysis...</span>
                <span className="text-white/70 text-xs">(AI processing)</span>
              </div>
            ) : (
              <>
                <Icon name="SparklesIcon" size={17} />
                Submit for AI Analysis
              </>
            )}
          </button>
        </div>
      </form>

      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4 animate-fade-in">
          <div className="card-elevated-md p-8 flex flex-col items-center gap-4 max-w-sm text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Icon name="SparklesIcon" size={32} className="text-primary animate-pulse" />
            </div>
            <div>
              <h3 className="font-700 text-foreground text-lg">Generating Analysis</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Our veteran educator AI is synthesising all five observation areas with the test score to craft personalised guidance...
              </p>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={`dot-${i}`}
                  className="w-2 h-2 rounded-full bg-primary animate-pulse"
                  style={{ animationDelay: `${i * 0.25}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}