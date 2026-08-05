-- Migration: RLS Policies for surveys and student_tasks
-- Timestamp: 20260805200000

-- ============================================================
-- RLS Policies for surveys
-- ============================================================
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentors_manage_own_surveys" ON public.surveys;
CREATE POLICY "mentors_manage_own_surveys"
ON public.surveys
FOR ALL
TO authenticated
USING (mentor_id = auth.uid())
WITH CHECK (mentor_id = auth.uid());

DROP POLICY IF EXISTS "students_read_linked_surveys" ON public.surveys;
CREATE POLICY "students_read_linked_surveys"
ON public.surveys
FOR SELECT
TO authenticated
USING (
  mentor_id IN (
    SELECT s.mentor_id FROM public.students s WHERE s.student_user_id = auth.uid()
  )
);

-- ============================================================
-- RLS Policies for student_tasks (ensure correct policies)
-- ============================================================
ALTER TABLE public.student_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentors_manage_student_tasks" ON public.student_tasks;
CREATE POLICY "mentors_manage_student_tasks"
ON public.student_tasks
FOR ALL
TO authenticated
USING (mentor_id = auth.uid())
WITH CHECK (mentor_id = auth.uid());

DROP POLICY IF EXISTS "students_read_own_tasks" ON public.student_tasks;
CREATE POLICY "students_read_own_tasks"
ON public.student_tasks
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM public.students WHERE student_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "students_update_own_task_status" ON public.student_tasks;
CREATE POLICY "students_update_own_task_status"
ON public.student_tasks
FOR UPDATE
TO authenticated
USING (
  student_id IN (
    SELECT id FROM public.students WHERE student_user_id = auth.uid()
  )
)
WITH CHECK (
  student_id IN (
    SELECT id FROM public.students WHERE student_user_id = auth.uid()
  )
);
