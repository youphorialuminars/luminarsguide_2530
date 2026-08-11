import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// REQUIRED ENVIRONMENT VARIABLES (add to .env):
//   GEMINI_API_KEY          — Google AI Studio (Primary)
//   GROQ_API_KEY            — Groq (Fallback 1)
//   COHERE_API_KEY          — Cohere (Fallback 2)
//   OPENROUTER_API_KEY      — OpenRouter (Fallback 3)
//   HUGGINGFACE_API_KEY     — Hugging Face (Fallback 4)
// ============================================================

const PROVIDER_TIMEOUT_MS = 8000; // 8-second timeout per provider

const VETERAN_EDUCATOR_PERSONA = `You are an extraordinarily accomplished and empathetic senior educator. You have 60+ years of active experience, are now retired, and are considered a veteran holding profound wisdom in mentorship. You are not a strict disciplinarian, but a guide. Your academic specializations include Educational Psychology, Team Building & Leadership development, Digital and Privacy Literacy (very modern understanding), and crucial aspects of student well-being: Emotional Regulation, Distress Tolerance, Personal Safety, Consent and Boundaries, Civic Sense, and Social Responsibility. In your long career, you have conducted seminal research across all these fields, personally taught over 3,000,000 students, and successfully empowered them across these diverse domains.

Your task is to analyse the mentor's observations about a student and produce a structured four-part educational guidance report. You must synthesise ALL five observation areas together with the test score to produce the most accurate, holistic, and actionable guidance possible.

IMPORTANT INSTRUCTIONS:
- Be warm, empathetic, and constructive — never harsh or discouraging
- Ground every recommendation in the specific observations provided
- The Task List must be highly practical, specific, and immediately actionable
- Tailor depth and sensitivity to the pillar being assessed
- For sensitive pillars (Emotional Resilience, Personal Safety, Consent), use extra care and compassion
- Output ONLY valid JSON — no markdown, no preamble, no explanation outside the JSON`;

const SENSITIVE_PILLARS = [
  'Emotional Resilience and Mental Well-being',
  'Personal Safety, Consent, and Boundaries',
];

interface AnalysisRequest {
  studentName: string;
  studentGrade: string;
  studentAge?: number;
  studentGender?: string;
  pillar: string;
  testScore: number;
  observations: {
    offlineClass: string;
    onlineTask: string;
    groupTask: string;
    mentorCall: string;
    comprehensive: string;
  };
  previousSessions?: Array<{ topic: string; score: number; date: string }>;
}

interface AnalysisResult {
  strengths: string[];
  weaknesses: string[];
  approachRequired: string[];
  taskList: string[];
}

// ── Helpers ──────────────────────────────────────────────────

function buildUserPrompt(body: AnalysisRequest): string {
  const { studentName, studentGrade, studentAge, studentGender, pillar, testScore, observations, previousSessions } = body;

  const studentContext = [
    `Student Name: ${studentName}`,
    `Grade: ${studentGrade}`,
    studentAge ? `Age: ${studentAge}` : null,
    studentGender ? `Gender: ${studentGender}` : null,
  ].filter(Boolean).join('\n');

  const previousContext = previousSessions && previousSessions.length > 0
    ? `\nPREVIOUS SESSION HISTORY (for context and progression tracking):\n${previousSessions.map(s => `- ${s.date}: ${s.topic}, Score: ${s.score}`).join('\n')}`
    : '';

  return `Please analyse the following student session data and generate a comprehensive four-part educational guidance report.

STUDENT PROFILE:
${studentContext}

SESSION DATA:
Core Educational Pillar: ${pillar}
Test / Assessment Score: ${testScore}/100${previousContext}

MENTOR OBSERVATIONS (Five Areas):

1. OFFLINE CLASS OBSERVATIONS:
${observations.offlineClass}

2. ONLINE TASK PERFORMANCE:
${observations.onlineTask}

3. GROUP TASK PARTICIPATION & DYNAMICS:
${observations.groupTask}

4. MENTOR CALL NOTES:
${observations.mentorCall}

5. COMPREHENSIVE OBSERVATION:
${observations.comprehensive}

Based on ALL five observation areas synthesised together with the test score of ${testScore}/100, generate the four-part guidance report.

Respond with ONLY this JSON structure (no markdown, no extra text):
{
  "strengths": ["strength 1", "strength 2", "strength 3", "strength 4"],
  "weaknesses": ["weakness 1", "weakness 2", "weakness 3", "weakness 4"],
  "approachRequired": ["approach 1", "approach 2", "approach 3", "approach 4"],
  "taskList": ["task 1", "task 2", "task 3", "task 4", "task 5"]
}

Requirements:
- strengths: 3-5 specific, evidence-based strengths drawn from the observations
- weaknesses: 3-5 specific development areas (frame constructively, not harshly)
- approachRequired: 3-5 concrete pedagogical strategies the mentor should employ
- taskList: 4-6 highly practical, immediately actionable tasks for the student — CRITICAL CONSTRAINT: every task in the taskList MUST be an individual, self-directed activity that can be completed independently at home or online (e.g., watch a video, complete an online quiz, write a journal entry, read an article, do a solo exercise). Do NOT suggest group activities, in-person meetups, or tasks requiring other people. Tasks must be specific to the pillar "${pillar}" and the five observation areas.`;
}

function parseAnalysisJSON(raw: string): AnalysisResult {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in response');
    parsed = JSON.parse(match[0]);
  }
  return {
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
    approachRequired: Array.isArray(parsed.approachRequired) ? parsed.approachRequired : [],
    taskList: Array.isArray(parsed.taskList) ? parsed.taskList : [],
  };
}

function isRetryableError(status: number): boolean {
  return status === 429 || status >= 500;
}

// ── Provider: Gemini ─────────────────────────────────────────

async function tryGemini(userPrompt: string, useProModel: boolean): Promise<AnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your-gemini-api-key-here') throw new Error('GEMINI_API_KEY not configured');

  const model = useProModel ? 'gemini-3.1-pro-preview' : 'gemini-3.5-flash';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: VETERAN_EDUCATOR_PERSONA }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1500, responseMimeType: 'application/json' },
        }),
      }
    );

    if (!response.ok) {
      if (isRetryableError(response.status)) throw new Error(`Gemini HTTP ${response.status}`);
      throw new Error(`Gemini HTTP ${response.status}`);
    }

    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw new Error('Gemini returned empty content');
    return parseAnalysisJSON(raw);
  } finally {
    clearTimeout(timer);
  }
}

// ── Provider: Groq ───────────────────────────────────────────

async function tryGroq(userPrompt: string): Promise<AnalysisResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your-groq-api-key-here') throw new Error('GROQ_API_KEY not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: VETERAN_EDUCATOR_PERSONA },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) throw new Error(`Groq HTTP ${response.status}`);

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Groq returned empty content');
    return parseAnalysisJSON(raw);
  } finally {
    clearTimeout(timer);
  }
}

// ── Provider: Cohere ─────────────────────────────────────────

async function tryCohere(userPrompt: string): Promise<AnalysisResult> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey || apiKey === 'your-cohere-api-key-here') throw new Error('COHERE_API_KEY not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.cohere.com/v2/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'command-r-plus',
        messages: [
          { role: 'system', content: VETERAN_EDUCATOR_PERSONA },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) throw new Error(`Cohere HTTP ${response.status}`);

    const data = await response.json();
    const raw = data?.message?.content?.[0]?.text ?? data?.text ?? '';
    if (!raw) throw new Error('Cohere returned empty content');
    return parseAnalysisJSON(raw);
  } finally {
    clearTimeout(timer);
  }
}

// ── Provider: OpenRouter ─────────────────────────────────────

async function tryOpenRouter(userPrompt: string): Promise<AnalysisResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === 'your-openrouter-api-key-here') throw new Error('OPENROUTER_API_KEY not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://luminarsgu1587.builtwithrocket.new',
        'X-Title': 'Luminar Guide',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct',
        messages: [
          { role: 'system', content: VETERAN_EDUCATOR_PERSONA },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}`);

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) throw new Error('OpenRouter returned empty content');
    return parseAnalysisJSON(raw);
  } finally {
    clearTimeout(timer);
  }
}

// ── Provider: Hugging Face ───────────────────────────────────

async function tryHuggingFace(userPrompt: string): Promise<AnalysisResult> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey || apiKey === 'your-huggingface-api-key-here') throw new Error('HUGGINGFACE_API_KEY not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  const combinedPrompt = `${VETERAN_EDUCATOR_PERSONA}\n\n${userPrompt}\n\nRespond with ONLY valid JSON.`;

  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
        body: JSON.stringify({
          inputs: combinedPrompt,
          parameters: { max_new_tokens: 1500, temperature: 0.7, return_full_text: false },
        }),
      }
    );

    if (!response.ok) throw new Error(`HuggingFace HTTP ${response.status}`);

    const data = await response.json();
    const raw = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
    if (!raw) throw new Error('HuggingFace returned empty content');
    return parseAnalysisJSON(raw);
  } finally {
    clearTimeout(timer);
  }
}

// ── Waterfall Failover Engine ────────────────────────────────

async function runWaterfallAnalysis(body: AnalysisRequest): Promise<{ analysis: AnalysisResult; providerUsed: string }> {
  const isSensitive = SENSITIVE_PILLARS.includes(body.pillar);
  const totalObservationLength = Object.values(body.observations).join(' ').length;
  const useProModel = isSensitive || totalObservationLength > 500;
  const userPrompt = buildUserPrompt(body);

  const providers: Array<{ name: string; fn: () => Promise<AnalysisResult> }> = [
    { name: 'Gemini', fn: () => tryGemini(userPrompt, useProModel) },
    { name: 'Groq', fn: () => tryGroq(userPrompt) },
    { name: 'Cohere', fn: () => tryCohere(userPrompt) },
    { name: 'OpenRouter', fn: () => tryOpenRouter(userPrompt) },
    { name: 'HuggingFace', fn: () => tryHuggingFace(userPrompt) },
  ];

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      const analysis = await provider.fn();
      return { analysis, providerUsed: provider.name };
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError';
      const reason = isAbort ? 'timeout (8s)' : err?.message || 'unknown error';
      // Silent warning — never surfaces to the user
      console.warn(`[AI Failover] ${provider.name} failed (${reason}), trying next provider...`);
      lastError = err;
    }
  }

  throw lastError || new Error('All AI providers exhausted');
}

// ── Route Handler ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: AnalysisRequest = await req.json();

    const { analysis, providerUsed } = await runWaterfallAnalysis(body);

    return NextResponse.json({
      analysis,
      modelUsed: providerUsed,
      isSensitive: SENSITIVE_PILLARS.includes(body.pillar),
    });
  } catch (error: any) {
    console.error('[analyze-session] All providers failed:', error?.message);
    return NextResponse.json(
      { error: 'AI analysis is temporarily unavailable. Please try again in a moment.' },
      { status: 503 }
    );
  }
}
