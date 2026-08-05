import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(req: NextRequest) {
  try {
    const body: AnalysisRequest = await req.json();
    const { studentName, studentGrade, studentAge, studentGender, pillar, testScore, observations, previousSessions } = body;

    const isSensitive = SENSITIVE_PILLARS.includes(pillar);
    const totalObservationLength = Object.values(observations).join(' ').length;
    const useProModel = isSensitive || totalObservationLength > 500;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      return NextResponse.json(
        { error: 'Gemini API key not configured. Please add GEMINI_API_KEY to your environment variables.' },
        { status: 503 }
      );
    }

    const model = useProModel ? 'gemini-1.5-pro' : 'gemini-1.5-flash';

    const studentContext = [
      `Student Name: ${studentName}`,
      `Grade: ${studentGrade}`,
      studentAge ? `Age: ${studentAge}` : null,
      studentGender ? `Gender: ${studentGender}` : null,
    ].filter(Boolean).join('\n');

    const previousContext = previousSessions && previousSessions.length > 0
      ? `\nPREVIOUS SESSION HISTORY (for context and progression tracking):\n${previousSessions.map(s => `- ${s.date}: ${s.topic}, Score: ${s.score}`).join('\n')}`
      : '';

    const userPrompt = `Please analyse the following student session data and generate a comprehensive four-part educational guidance report.

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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: VETERAN_EDUCATOR_PERSONA }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1500,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', errText);
      return NextResponse.json({ error: 'AI generation failed', details: errText }, { status: 502 });
    }

    const geminiData = await response.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return NextResponse.json({ error: 'No content returned from AI' }, { status: 502 });
    }

    let analysis;
    try {
      analysis = JSON.parse(rawText);
    } catch {
      // Try to extract JSON from the text
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        return NextResponse.json({ error: 'Failed to parse AI response as JSON' }, { status: 502 });
      }
    }

    return NextResponse.json({
      analysis,
      modelUsed: useProModel ? 'Gemini Pro' : 'Gemini Flash',
      isSensitive,
    });
  } catch (error) {
    console.error('Session analysis error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
