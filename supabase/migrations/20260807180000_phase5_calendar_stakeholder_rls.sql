-- Phase 5: School Calendar stakeholder read access
-- Allows linked mentors, students (via their mentor's school), and parents to VIEW school events

-- Drop existing policy and recreate with separate SELECT/ALL policies
DROP POLICY IF EXISTS "school_manage_own_events" ON public.school_events;

-- School can manage (insert/update/delete) their own events
CREATE POLICY "school_manage_own_events"
ON public.school_events
FOR ALL
TO authenticated
USING (school_id = auth.uid())
WITH CHECK (school_id = auth.uid());

-- Linked mentors can view events for their school
CREATE POLICY "mentor_view_school_events"
ON public.school_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'mentor'
      AND up.school_id = school_events.school_id
  )
);

-- Students can view events for their school (via mentor's school)
CREATE POLICY "student_view_school_events"
ON public.school_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.students s ON s.mentor_id = up.id
    WHERE up.id = auth.uid()
      AND up.role = 'student'
      AND up.school_id = school_events.school_id
  )
  OR
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'student'
      AND up.school_id = school_events.school_id
  )
);

-- Parents can view events for their linked child's school
CREATE POLICY "parent_view_school_events"
ON public.school_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles parent_profile
    JOIN public.students s ON s.id::text = parent_profile.linked_student_id
    JOIN public.user_profiles mentor_profile ON mentor_profile.id = s.mentor_id
    WHERE parent_profile.id = auth.uid()
      AND parent_profile.role = 'parent'
      AND mentor_profile.school_id = school_events.school_id
  )
);

-- Counselors can view all school events
CREATE POLICY "counselor_view_school_events"
ON public.school_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'counselor'
  )
);
