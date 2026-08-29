export type Gender = 'Male' | 'Female' | 'Non-Binary' | 'Prefer not to say';

export interface Student {
  id: string;
  name: string;
  grade: string;
  age?: number;
  gender?: Gender;
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

export interface SessionObservations {
  offlineClass: string;
  onlineTask: string;
  groupTask: string;
  mentorCall: string;
  comprehensive: string;
}

export interface Session {
  id: string;
  studentId: string;
  date: string;
  topic: string;
  score: number;
  observation: string; // kept for backward compat (legacy)
  observations?: SessionObservations; // new structured fields
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

export interface AttendanceRecord {
  studentId: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent';
}

export const TOPICS = [
  'Relational Intelligence and Community Stewardship',
  'Digital Wisdom and Citizenship',
  'Psychological Fortitude and Mindfulness',
  'Bodily Integrity and Social Conscientiousness',
  'Authentic Identity and Purposeful Worth',
];

export const GENDER_OPTIONS: Gender[] = [
  'Male',
  'Female',
  'Non-Binary',
  'Prefer not to say',
];

export const SECURITY_QUESTIONS = [
  'What was the name of your first school?',
  'What is the name of the city where you were born?',
  'What was the name of your childhood pet?',
  "What is your mother\'s maiden name?",
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
    age: 14,
    gender: 'Male',
    mentorId: 'mentor-101',
    avatarColor: '#7C6FCD',
    avatarInitials: 'AM',
    enrolledDate: '2026-02-10',
    lastSessionDate: '2026-08-03',
    sessionCount: 8,
    averageScore: 74,
    scoreTrend: 'up',
    primaryTopics: ['Relational Intelligence and Community Stewardship', 'Psychological Fortitude and Mindfulness'],
    notes: 'Strong analytical ability, struggles with test anxiety.',
  },
  {
    id: 'student-002',
    name: 'Priya Sharma',
    grade: 'Grade 10',
    age: 15,
    gender: 'Female',
    mentorId: 'mentor-101',
    avatarColor: '#D97BB6',
    avatarInitials: 'PS',
    enrolledDate: '2026-01-15',
    lastSessionDate: '2026-08-01',
    sessionCount: 12,
    averageScore: 82,
    scoreTrend: 'up',
    primaryTopics: ['Authentic Identity and Purposeful Worth', 'Relational Intelligence and Community Stewardship'],
    notes: 'Excellent communicator, needs help with structured argumentation.',
  },
  {
    id: 'student-003',
    name: 'Rohan Kapoor',
    grade: 'Grade 8',
    age: 13,
    gender: 'Male',
    mentorId: 'mentor-101',
    avatarColor: '#5BAD8F',
    avatarInitials: 'RK',
    enrolledDate: '2026-03-05',
    lastSessionDate: '2026-07-28',
    sessionCount: 6,
    averageScore: 61,
    scoreTrend: 'down',
    primaryTopics: ['Psychological Fortitude and Mindfulness', 'Bodily Integrity and Social Conscientiousness'],
    notes: 'Bright student going through a difficult family period.',
  },
  {
    id: 'student-004',
    name: 'Ananya Iyer',
    grade: 'Grade 11',
    age: 16,
    gender: 'Female',
    mentorId: 'mentor-101',
    avatarColor: '#E8A020',
    avatarInitials: 'AI',
    enrolledDate: '2026-01-08',
    lastSessionDate: '2026-08-04',
    sessionCount: 15,
    averageScore: 88,
    scoreTrend: 'stable',
    primaryTopics: ['Digital Wisdom and Citizenship', 'Authentic Identity and Purposeful Worth'],
    notes: 'Consistently high performer, preparing for competitive exams.',
  },
  {
    id: 'student-005',
    name: 'Kabir Singh',
    grade: 'Grade 9',
    age: 14,
    gender: 'Male',
    mentorId: 'mentor-101',
    avatarColor: '#5B8FD9',
    avatarInitials: 'KS',
    enrolledDate: '2026-02-20',
    lastSessionDate: '2026-07-30',
    sessionCount: 9,
    averageScore: 69,
    scoreTrend: 'up',
    primaryTopics: ['Authentic Identity and Purposeful Worth', 'Relational Intelligence and Community Stewardship'],
    notes: 'Highly motivated, needs structure and consistent follow-up.',
  },
  {
    id: 'student-006',
    name: 'Meera Pillai',
    grade: 'Grade 10',
    age: 15,
    gender: 'Female',
    mentorId: 'mentor-101',
    avatarColor: '#C97B7B',
    avatarInitials: 'MP',
    enrolledDate: '2026-03-18',
    lastSessionDate: '2026-07-22',
    sessionCount: 5,
    averageScore: 55,
    scoreTrend: 'down',
    primaryTopics: ['Psychological Fortitude and Mindfulness', 'Bodily Integrity and Social Conscientiousness'],
    notes: 'Needs significant support; flagged for counseling referral.',
  },
  {
    id: 'student-007',
    name: 'Dev Nair',
    grade: 'Grade 8',
    age: 13,
    gender: 'Male',
    mentorId: 'mentor-101',
    avatarColor: '#7BA8C9',
    avatarInitials: 'DN',
    enrolledDate: '2026-04-01',
    lastSessionDate: '2026-08-02',
    sessionCount: 7,
    averageScore: 77,
    scoreTrend: 'up',
    primaryTopics: ['Relational Intelligence and Community Stewardship', 'Digital Wisdom and Citizenship'],
    notes: 'Natural leader, excels in group settings.',
  },
  {
    id: 'student-008',
    name: 'Sana Qureshi',
    grade: 'Grade 11',
    age: 16,
    gender: 'Female',
    mentorId: 'mentor-101',
    avatarColor: '#A594E8',
    avatarInitials: 'SQ',
    enrolledDate: '2026-01-25',
    lastSessionDate: '2026-08-05',
    sessionCount: 11,
    averageScore: 80,
    scoreTrend: 'stable',
    primaryTopics: ['Bodily Integrity and Social Conscientiousness', 'Psychological Fortitude and Mindfulness'],
    notes: 'Consistent performer, working on confidence in oral presentations.',
  },
  {
    id: 'student-009',
    name: 'Vikram Bose',
    grade: 'Grade 9',
    age: 14,
    gender: 'Male',
    mentorId: 'mentor-101',
    avatarColor: '#8FBD8F',
    avatarInitials: 'VB',
    enrolledDate: '2026-02-28',
    lastSessionDate: '2026-07-18',
    sessionCount: 4,
    averageScore: 63,
    scoreTrend: 'stable',
    primaryTopics: ['Authentic Identity and Purposeful Worth', 'Digital Wisdom and Citizenship'],
    notes: 'Irregular attendance affecting continuity.',
  },
  {
    id: 'student-010',
    name: 'Ishaan Verma',
    grade: 'Grade 10',
    age: 15,
    gender: 'Male',
    mentorId: 'mentor-101',
    avatarColor: '#D9A05B',
    avatarInitials: 'IV',
    enrolledDate: '2026-03-10',
    lastSessionDate: '2026-07-31',
    sessionCount: 8,
    averageScore: 72,
    scoreTrend: 'up',
    primaryTopics: ['Authentic Identity and Purposeful Worth', 'Relational Intelligence and Community Stewardship'],
    notes: 'Creative thinker, struggles with time management under pressure.',
  },
  {
    id: 'student-011',
    name: 'Riya Desai',
    grade: 'Grade 8',
    age: 13,
    gender: 'Female',
    mentorId: 'mentor-101',
    avatarColor: '#BD8FBD',
    avatarInitials: 'RD',
    enrolledDate: '2026-04-12',
    lastSessionDate: '2026-07-25',
    sessionCount: 6,
    averageScore: 85,
    scoreTrend: 'up',
    primaryTopics: ['Digital Wisdom and Citizenship', 'Authentic Identity and Purposeful Worth'],
    notes: 'Exceptionally self-motivated, aims for STEM career.',
  },
  {
    id: 'student-012',
    name: 'Nikhil Joshi',
    grade: 'Grade 11',
    age: 16,
    gender: 'Male',
    mentorId: 'mentor-101',
    avatarColor: '#6BAABF',
    avatarInitials: 'NJ',
    enrolledDate: '2026-01-30',
    lastSessionDate: '2026-08-04',
    sessionCount: 14,
    averageScore: 78,
    scoreTrend: 'up',
    primaryTopics: ['Relational Intelligence and Community Stewardship', 'Authentic Identity and Purposeful Worth'],
    notes: 'Debate team captain, working on academic writing formality.',
  },
];

export const mockSessions: Session[] = [
  {
    id: 'session-001',
    studentId: 'student-001',
    date: '2026-08-03',
    topic: 'Relational Intelligence and Community Stewardship',
    score: 78,
    observation:
      'Arjun showed strong conceptual understanding but struggled with time management. He became visibly anxious under pressure. His written work is neat and logical.',
    observations: {
      offlineClass: 'Arjun participated actively in classroom discussions and demonstrated strong conceptual understanding during group exercises. He was attentive and took detailed notes.',
      onlineTask: 'Completed all assigned digital tasks on time. Showed good initiative in exploring additional resources but struggled with the timed online quiz format.',
      groupTask: 'Took a supportive role in the group project but hesitated to lead. Contributed thoughtful ideas but withdrew when the group dynamic became competitive.',
      mentorCall: 'During our one-on-one call, Arjun expressed anxiety about performance evaluations. He is self-aware about his test anxiety and is open to strategies.',
      comprehensive: 'Arjun is a capable student with strong foundational skills. His primary challenge is performance anxiety under timed or evaluative conditions. With the right support, he has significant growth potential.',
    },
    analysis: {
      strengths: [
        'Solid conceptual grasp of leadership principles and team dynamics',
        'Logical and well-organized written work — clear step-by-step reasoning',
        'Self-corrects errors when given time to review',
        'Asks clarifying questions proactively — high intellectual curiosity',
      ],
      weaknesses: [
        'Significant performance drop under timed conditions — test anxiety present',
        'Hesitates to take leadership roles in competitive group settings',
        'Avoids asserting ideas when group dynamics become challenging',
        'Limited practice with real-time decision-making under pressure',
      ],
      approachRequired: [
        'Introduce timed practice sessions gradually — start with 150% time, reduce to 100% over 4 weeks',
        'Teach cognitive reframing techniques before each timed exercise',
        'Use breathing and grounding exercises at the start of each session',
        'Reinforce mastery through low-stakes daily activities to build confidence',
      ],
      taskList: [
        'Complete 2 timed leadership scenario exercises per week — log anxiety level before/after',
        'Practice "box-breathing" (4-4-4-4) technique before any timed work',
        'Lead one small group activity per week and debrief with mentor afterward',
        'Journal one "leadership win" per day — small victories build confidence',
        'Review and reflect on 3 real-world leadership case studies this month',
      ],
    },
    modelUsed: 'Gemini Flash',
    cacheHit: false,
  },
  {
    id: 'session-002',
    studentId: 'student-001',
    date: '2026-07-20',
    topic: 'Psychological Fortitude and Mindfulness',
    score: 70,
    observation:
      'Discussed strategies for managing frustration. Arjun tends to withdraw when he feels unheard. Showed good insight into his own reactions.',
    observations: {
      offlineClass: 'Arjun was quieter than usual during the offline session. He participated when directly asked but did not volunteer responses.',
      onlineTask: 'Completed the online reflection tasks thoughtfully. His written responses showed deep self-awareness about emotional triggers.',
      groupTask: 'Withdrew from the group when a disagreement arose. Did not re-engage until the mentor intervened and created space for his input.',
      mentorCall: 'Opened up about feeling overlooked in group settings. Expressed a desire to manage his reactions better. Very receptive to guidance.',
      comprehensive: 'Arjun has high emotional intelligence in reflective contexts but struggles to apply regulation strategies in real-time social situations. He is motivated to improve.',
    },
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
        'Read one chapter on emotional resilience — discuss key insights with mentor',
      ],
    },
    modelUsed: 'Gemini Flash',
    cacheHit: false,
  },
  {
    id: 'session-003',
    studentId: 'student-001',
    date: '2026-07-06',
    topic: 'Relational Intelligence and Community Stewardship',
    score: 65,
    observation: 'Struggled with asserting leadership. Made hesitant decisions in group scenarios.',
    observations: {
      offlineClass: 'Participated but was hesitant to take initiative during group activities.',
      onlineTask: 'Completed tasks adequately but showed minimal creativity in problem-solving.',
      groupTask: 'Took a follower role throughout. Did not assert ideas even when they were clearly valid.',
      mentorCall: 'Acknowledged difficulty with assertiveness. Willing to work on it.',
      comprehensive: 'Arjun needs structured opportunities to practice leadership in low-stakes environments to build his confidence.',
    },
    analysis: {
      strengths: [
        'Understands leadership concepts when explained step by step',
        'Persistent — does not give up easily',
      ],
      weaknesses: [
        'Hesitant to assert leadership — consistent pattern of deferring to others',
        'Does not verify his own ideas before dismissing them',
      ],
      approachRequired: [
        'Assign Arjun as "team lead" for small, structured tasks to build confidence',
        'Debrief after each leadership exercise to reinforce positive behaviors',
      ],
      taskList: [
        'Lead one structured group activity this week and document the experience',
        'Practice assertive communication using "I" statements daily',
        'Use color coding to highlight your own ideas in group notes before sharing',
      ],
    },
    modelUsed: 'Gemini Flash',
    cacheHit: false,
  },
  {
    id: 'session-004',
    studentId: 'student-001',
    date: '2026-06-22',
    topic: 'Relational Intelligence and Community Stewardship',
    score: 60,
    observation: 'First session on leadership. Baseline assessment. Unfamiliar with team dynamics.',
    observations: {
      offlineClass: 'First session — baseline observation. Engaged but unfamiliar with structured leadership frameworks.',
      onlineTask: 'Completed introductory tasks. No prior exposure to digital collaboration tools.',
      groupTask: 'Participated passively. Observed more than contributed.',
      mentorCall: 'Expressed interest in developing leadership skills. Motivated to learn.',
      comprehensive: 'This is a baseline session. Arjun has the foundational qualities for leadership development — curiosity, empathy, and a desire to grow.',
    },
    analysis: {
      strengths: [
        'Strong foundational interpersonal skills — empathetic and attentive',
        'Comfortable with basic collaborative tasks',
      ],
      weaknesses: [
        'No prior exposure to structured leadership frameworks',
        'Unsure of how to facilitate group discussions',
      ],
      approachRequired: [
        'Begin with foundational leadership theory before practical application',
        'Introduce simple facilitation techniques in each session',
      ],
      taskList: [
        'Complete introductory leadership self-assessment (provided)',
        'Watch 2 short videos on servant leadership — note key takeaways',
        'Create a personal "leadership values" card',
      ],
    },
    modelUsed: 'Gemini Flash',
    cacheHit: false,
  },
  {
    id: 'session-005',
    studentId: 'student-002',
    date: '2026-08-01',
    topic: 'Authentic Identity and Purposeful Worth',
    score: 85,
    observation:
      'Priya submitted outstanding reflections on civic duty but her arguments lacked logical scaffolding. Thesis statements are vague.',
    observations: {
      offlineClass: 'Priya was highly engaged in the civic discussion. Her contributions were thoughtful but sometimes lacked structured argumentation.',
      onlineTask: 'Completed all civic responsibility tasks with enthusiasm. Written responses showed sophisticated vocabulary but weak logical structure.',
      groupTask: 'Natural facilitator in group discussions. Kept the group on track and ensured all voices were heard.',
      mentorCall: 'Expressed passion for social issues. Wants to develop stronger argumentation skills to advocate more effectively.',
      comprehensive: 'Priya is an exceptional communicator with genuine civic passion. Her primary development area is structuring arguments logically to match the quality of her ideas.',
    },
    analysis: {
      strengths: [
        'Exceptional vocabulary and descriptive language — above grade level',
        'Strong narrative voice — personal writing is compelling and authentic',
        'Natural group facilitator — ensures inclusive participation',
        'Consistent effort and meets all deadlines',
      ],
      weaknesses: [
        'Thesis statements are broad and lack a clear, arguable claim',
        'Arguments drift from topic — insufficient use of logical transitions',
        'Evidence is cited but not fully analyzed',
        'Conclusion restates introduction rather than synthesizing arguments',
      ],
      approachRequired: [
        'Teach the PEEL (Point, Evidence, Explain, Link) structure explicitly',
        'Use thesis statement templates until the pattern is internalized',
        'Practice "evidence sandwiching" — claim → quote → analysis → link',
        'Study model civic essays in her interest areas',
      ],
      taskList: [
        'Rewrite last essay thesis using the "Although... I argue that... because..." template',
        'Complete 3 PEEL paragraph exercises on civic topics',
        'Annotate 2 model argumentative essays — identify each structural element',
        'Write one short civic argument piece (300 words) per week for 4 weeks',
        "Peer review a classmate's essay using the provided checklist",
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

// In-memory attendance store (keyed by studentId)
export const mockAttendance: AttendanceRecord[] = [];