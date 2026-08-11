-- Migration: school_events table + peer_appreciation column for student_reflections

-- 1. Create school_events table
CREATE TABLE IF NOT EXISTS public.school_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'holiday',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT school_events_type_check CHECK (event_type IN ('performance_schedule', 'holiday'))
);

CREATE INDEX IF NOT EXISTS idx_school_events_school_id ON public.school_events(school_id);
CREATE INDEX IF NOT EXISTS idx_school_events_event_date ON public.school_events(event_date);

ALTER TABLE public.school_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_manage_own_events" ON public.school_events;
CREATE POLICY "school_manage_own_events"
ON public.school_events
FOR ALL
TO authenticated
USING (school_id = auth.uid())
WITH CHECK (school_id = auth.uid());

-- 2. Add peer_appreciation column to student_reflections
ALTER TABLE public.student_reflections
ADD COLUMN IF NOT EXISTS peer_appreciation TEXT NOT NULL DEFAULT '';
