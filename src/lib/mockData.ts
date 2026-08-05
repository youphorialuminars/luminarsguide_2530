export interface Student {
  id: string;
  name: string;
  grade: string;
  mentorId: string;
  avatarColor: string;
  avatarInitials: string;
  enrolledDate: string;
  lastSessionDate: string;
  sessionCount: number;
  averageScore: number;
  scoreTrend: 'up' | 'down' | 'stable';
  primaryTopics: string[];
  notes: string;
}

export interface Session {
  id: string;
  studentId: string;
  date: string;
  topic: string;
  score: number;
  observation: string;
  analysis: SessionAnalysis;
  modelUsed: string;
  cacheHit: boolean;
}

export interface SessionAnalysis {
  strengths: string[];
  weaknesses: string[];
  approachRequired: string[];
  taskList: string[];
}

export const TOPICS = [
  'Mathematics — Algebra',
  'Mathematics — Geometry',
  'Science — Physics',
  'Science — Biology',
  'English — Reading Comprehension',
  'English — Writing & Composition',
  'History & Civic Sense',
  'Emotional Regulation',
  'Social Responsibility',
  'Digital & Privacy Literacy',
  'Physical Safety & Well-being',
  'Team Building & Leadership',
  'Sexual Well-being Education',
  'Distress Tolerance',
];

export const SECURITY_QUESTIONS = [
  'What was the name of your first school?',
  'What is the name of the city where you were born?',
  'What was the name of your childhood pet?',
  'What is your mother\'s maiden name?',
  'What street did you grow up on?',
  'What was the name of your first teacher?',
  'What was the make of your first vehicle?',
  'What is the name of your favorite childhood friend?',
];

export const mockStudents: Student[] = [
  {
    id: 'student-001',
    name: 'Arjun Mehta',
    grade: 'Grade 9',
    mentorId: 'mentor-101',
    avatarColor: '#7C6FCD',
    avatarInitials: 'AM',
    enrolledDate: '2026-02-10',
    lastSessionDate: '2026-08-03',
    sessionCount: 8,
    averageScore: 74,
    scoreTrend: 'up',
    primaryTopics: ['Mathematics — Algebra', 'Emotional Regulation'],
    notes: 'Strong analytical ability, struggles with test anxiety.',
  },
  {
    id: 'student-002',
    name: 'Priya Sharma',
    grade: 'Grade 10',
    mentorId: 'mentor-101',
    avatarColor: '#D97BB6',
    avatarInitials: 'PS',
    enrolledDate: '2026-01-15',
    lastSessionDate: '2026-08-01',
    sessionCount: 12,
    averageScore: 82,
    scoreTrend: 'up',
    primaryTopics: ['English — Writing & Composition', 'Leadership'],
    notes: 'Excellent communicator, needs help with structured argumentation.',
  },
  {
    id: 'student-003',
    name: 'Rohan Kapoor',
    grade: 'Grade 8',
    mentorId: 'mentor-101',
    avatarColor: '#5BAD8F',
    avatarInitials: 'RK',
    enrolledDate: '2026-03-05',
    lastSessionDate: '2026-07-28',
    sessionCount: 6,
    averageScore: 61,
    scoreTrend: 'down',
    primaryTopics: ['Science — Physics', 'Distress Tolerance'],
    notes: 'Bright student going through a difficult family period.',
  },
  {
    id: 'student-004',
    name: 'Ananya Iyer',
    grade: 'Grade 11',
    mentorId: 'mentor-101',
    avatarColor: '#E8A020',
    avatarInitials: 'AI',
    enrolledDate: '2026-01-08',
    lastSessionDate: '2026-08-04',
    sessionCount: 15,
    averageScore: 88,
    scoreTrend: 'stable',
    primaryTopics: ['Mathematics — Algebra', 'Digital & Privacy Literacy'],
    notes: 'Consistently high performer, preparing for competitive exams.',
  },
  {
    id: 'student-005',
    name: 'Kabir Singh',
    grade: 'Grade 9',
    mentorId: 'mentor-101',
    avatarColor: '#5B8FD9',
    avatarInitials: 'KS',
    enrolledDate: '2026-02-20',
    lastSessionDate: '2026-07-30',
    sessionCount: 9,
    averageScore: 69,
    scoreTrend: 'up',
    primaryTopics: ['History & Civic Sense', 'Social Responsibility'],
    notes: 'Highly motivated, needs structure and consistent follow-up.',
  },
  {
    id: 'student-006',
    name: 'Meera Pillai',
    grade: 'Grade 10',
    mentorId: 'mentor-101',
    avatarColor: '#C97B7B',
    avatarInitials: 'MP',
    enrolledDate: '2026-03-18',
    lastSessionDate: '2026-07-22',
    sessionCount: 5,
    averageScore: 55,
    scoreTrend: 'down',
    primaryTopics: ['Science — Biology', 'Emotional Regulation'],
    notes: 'Needs significant support; flagged for counseling referral.',
  },
  {
    id: 'student-007',
    name: 'Dev Nair',
    grade: 'Grade 8',
    mentorId: 'mentor-101',
    avatarColor: '#7BA8C9',
    avatarInitials: 'DN',
    enrolledDate: '2026-04-01',
    lastSessionDate: '2026-08-02',
    sessionCount: 7,
    averageScore: 77,
    scoreTrend: 'up',
    primaryTopics: ['English — Reading Comprehension', 'Team Building & Leadership'],
    notes: 'Natural leader, excels in group settings.',
  },
  {
    id: 'student-008',
    name: 'Sana Qureshi',
    grade: 'Grade 11',
    mentorId: 'mentor-101',
    avatarColor: '#A594E8',
    avatarInitials: 'SQ',
    enrolledDate: '2026-01-25',
    lastSessionDate: '2026-08-05',
    sessionCount: 11,
    averageScore: 80,
    scoreTrend: 'stable',
    primaryTopics: ['Mathematics — Geometry', 'Physical Safety & Well-being'],
    notes: 'Consistent performer, working on confidence in oral presentations.',
  },
  {
    id: 'student-009',
    name: 'Vikram Bose',
    grade: 'Grade 9',
    mentorId: 'mentor-101',
    avatarColor: '#8FBD8F',
    avatarInitials: 'VB',
    enrolledDate: '2026-02-28',
    lastSessionDate: '2026-07-18',
    sessionCount: 4,
    averageScore: 63,
    scoreTrend: 'stable',
    primaryTopics: ['Science — Physics', 'Civic Sense'],
    notes: 'Irregular attendance affecting continuity.',
  },
  {
    id: 'student-010',
    name: 'Ishaan Verma',
    grade: 'Grade 10',
    mentorId: 'mentor-101',
    avatarColor: '#D9A05B',
    avatarInitials: 'IV',
    enrolledDate: '2026-03-10',
    lastSessionDate: '2026-07-31',
    sessionCount: 8,
    averageScore: 72,
    scoreTrend: 'up',
    primaryTopics: ['English — Writing & Composition', 'Social Responsibility'],
    notes: 'Creative thinker, struggles with time management under pressure.',
  },
  {
    id: 'student-011',
    name: 'Riya Desai',
    grade: 'Grade 8',
    mentorId: 'mentor-101',
    avatarColor: '#BD8FBD',
    avatarInitials: 'RD',
    enrolledDate: '2026-04-12',
    lastSessionDate: '2026-07-25',
    sessionCount: 6,
    averageScore: 85,
    scoreTrend: 'up',
    primaryTopics: ['Mathematics — Algebra', 'Digital & Privacy Literacy'],
    notes: 'Exceptionally self-motivated, aims for STEM career.',
  },
  {
    id: 'student-012',
    name: 'Nikhil Joshi',
    grade: 'Grade 11',
    mentorId: 'mentor-101',
    avatarColor: '#6BAABF',
    avatarInitials: 'NJ',
    enrolledDate: '2026-01-30',
    lastSessionDate: '2026-08-04',
    sessionCount: 14,
    averageScore: 78,
    scoreTrend: 'up',
    primaryTopics: ['History & Civic Sense', 'Team Building & Leadership'],
    notes: 'Debate team captain, working on academic writing formality.',
  },
];

export const mockSessions: Session[] = [
  {
    id: 'session-001',
    studentId: 'student-001',
    date: '2026-08-03',
    topic: 'Mathematics — Algebra',
    score: 78,
    observation:
      'Arjun showed strong conceptual understanding of quadratic equations but struggled with time management during the test. He became visibly anxious when asked to solve problems under a time limit. His written work is neat and logical.',
    analysis: {
      strengths: [
        'Solid conceptual grasp of quadratic equations and factoring methods',
        'Logical and well-organized written work — clear step-by-step reasoning',
        'Self-corrects errors when given time to review',
        'Asks clarifying questions proactively — high intellectual curiosity',
      ],
      weaknesses: [
        'Significant performance drop under timed conditions — test anxiety present',
        'Speed-accuracy trade-off: rushes final steps when stressed',
        'Avoids word problems that involve multi-step reasoning under pressure',
        'Limited practice with exam-format question structures',
      ],
      approachRequired: [
        'Introduce timed practice sessions gradually — start with 150% time, reduce to 100% over 4 weeks',
        'Teach cognitive reframing techniques before each timed exercise',
        'Use breathing and grounding exercises at the start of each session',
        'Reinforce mastery through low-stakes daily quizzes to build confidence',
      ],
      taskList: [
        'Complete 2 timed algebra sets per week (20 min each) — log anxiety level before/after',
        'Practice "box-breathing" (4-4-4-4) technique before any timed work',
        'Attempt 5 word problems per session using the RUCSAC framework',
        'Review and annotate 3 past exam papers to understand question patterns',
        'Journal one "math win" per day — small victories build confidence',
      ],
    },
    modelUsed: 'Gemini Flash',
    cacheHit: false,
  },
  {
    id: 'session-002',
    studentId: 'student-001',
    date: '2026-07-20',
    topic: 'Emotional Regulation',
    score: 70,
    observation:
      'Discussed strategies for managing frustration during group projects. Arjun tends to withdraw when he feels unheard. Showed good insight into his own reactions during our conversation.',
    analysis: {
      strengths: [
        'High self-awareness — can identify emotional triggers accurately',
        'Articulates feelings clearly in one-on-one conversations',
        'Willing to reflect on past behavior without defensiveness',
      ],
      weaknesses: [
        'Withdraws from group dynamics when feeling overlooked',
        'Difficulty using emotional regulation strategies in real-time',
        'Tends to ruminate after conflict rather than resolving it',
      ],
      approachRequired: [
        'Practice "name it to tame it" labeling strategy in the moment',
        'Role-play conflict scenarios in a safe mentoring environment',
        'Build a personal "emotional toolkit" — list of go-to strategies',
      ],
      taskList: [
        'Keep a daily mood log — rate emotions 1-10 and note triggers',
        'Practice one regulation strategy per week — document results',
        'Role-play 2 difficult group scenarios with mentor before next group project',
        'Read Chapter 3 of "The Whole-Brain Child" — discuss key insights',
      ],
    },
    modelUsed: 'Gemini Pro',
    cacheHit: false,
  },
  {
    id: 'session-003',
    studentId: 'student-001',
    date: '2026-07-06',
    topic: 'Mathematics — Algebra',
    score: 65,
    observation: 'Struggled with factoring trinomials. Made careless errors on signs.',
    analysis: {
      strengths: [
        'Understands the concept of factoring when explained step by step',
        'Persistent — does not give up easily',
      ],
      weaknesses: [
        'Sign errors in factoring — consistent pattern of negative sign mistakes',
        'Does not verify answers by expanding back',
      ],
      approachRequired: [
        'Drill sign rules with dedicated 10-minute warm-ups',
        'Mandate answer verification step in all algebra work',
      ],
      taskList: [
        'Complete sign-rules worksheet (provided) — 3 times this week',
        'For every factored answer, expand and verify before moving on',
        'Use color coding: circle all negative signs in red before starting',
      ],
    },
    modelUsed: 'Gemini Flash',
    cacheHit: false,
  },
  {
    id: 'session-004',
    studentId: 'student-001',
    date: '2026-06-22',
    topic: 'Mathematics — Algebra',
    score: 60,
    observation: 'First session on algebra. Baseline assessment. Unfamiliar with factoring.',
    analysis: {
      strengths: [
        'Strong arithmetic foundation — mental math is accurate',
        'Comfortable with basic equation solving (one variable)',
      ],
      weaknesses: [
        'No prior exposure to factoring — starting from scratch',
        'Unsure of BODMAS in complex expressions',
      ],
      approachRequired: [
        'Begin with GCF factoring before introducing trinomials',
        'Revisit BODMAS with worked examples in each session',
      ],
      taskList: [
        'Complete GCF factoring practice set (10 problems) daily',
        'Watch Khan Academy: "Introduction to Factoring" — 3 videos',
        'Create a personal BODMAS reference card',
      ],
    },
    modelUsed: 'Gemini Flash',
    cacheHit: false,
  },
  {
    id: 'session-005',
    studentId: 'student-002',
    date: '2026-08-01',
    topic: 'English — Writing & Composition',
    score: 85,
    observation:
      'Priya submitted an outstanding personal essay but her argumentative essay structure was weak. Thesis statements are vague. Her vocabulary is sophisticated but arguments lack logical scaffolding.',
    analysis: {
      strengths: [
        'Exceptional vocabulary and descriptive language — above grade level',
        'Strong narrative voice — personal writing is compelling and authentic',
        'High reading comprehension — references texts accurately',
        'Consistent effort and meets all deadlines',
      ],
      weaknesses: [
        'Thesis statements are broad and lack a clear, arguable claim',
        'Body paragraphs drift from topic — insufficient use of transitions',
        'Evidence is cited but not fully analyzed (quote-dropping)',
        'Conclusion restates introduction rather than synthesizing arguments',
      ],
      approachRequired: [
        'Teach the PEEL (Point, Evidence, Explain, Link) paragraph structure explicitly',
        'Use thesis statement templates until the pattern is internalized',
        'Practice "evidence sandwiching" — claim → quote → analysis → link',
        'Study model argumentative essays in her interest areas',
      ],
      taskList: [
        'Rewrite last essay thesis using the "Although... I argue that... because..." template',
        'Complete 3 PEEL paragraph exercises on assigned topics',
        'Annotate 2 model argumentative essays — identify each structural element',
        'Write one short argumentative piece (300 words) per week for 4 weeks',
        'Peer review a classmate\'s essay using the provided checklist',
      ],
    },
    modelUsed: 'Gemini Flash',
    cacheHit: false,
  },
];

export const mockMentors = [
  {
    id: 'mentor-101',
    name: 'Dr. Kavita Rao',
    email: 'kavita.rao@luminarsguide.edu',
    password: 'Luminar@2026',
    securityQuestion: 'What was the name of your first school?',
    securityAnswer: 'Sunshine Primary',
    joinedDate: '2026-01-01',
  },
];