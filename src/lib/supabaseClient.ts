/**
 * supabaseClient.ts
 * Canonical Supabase client initializer using NEXT_PUBLIC_SUPABASE_URL
 * and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.
 *
 * Re-exports the browser client from the existing SSR-aware client module
 * so all parts of the app can import from a single, predictable path.
 */

export { createClient } from './supabase/client';

/**
 * Typed helper — call this anywhere you need a ready-to-use Supabase client.
 *
 * Usage:
 *   import { getSupabaseClient } from '@/lib/supabaseClient';
 *   const supabase = getSupabaseClient();
 *   const { data, error } = await supabase.from('user_profiles').select('*');
 */
import { createClient as _createClient } from './supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

let _instance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_instance) {
    _instance = _createClient();
  }
  return _instance;
}

// ── Type definitions for all 5 roles ──────────────────────────────────────────

export type UserRole = 'mentor' | 'student' | 'student_parent' | 'parent' | 'counselor' | 'school';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  // Mentor fields
  mentor_code: string | null;
  mentor_pillars: string[];
  // Relational foreign keys
  mentor_id: string | null;       // UUID of linked mentor (for student/student_parent)
  student_id: string | null;      // UUID of linked students row (for student/student_parent)
  linked_student_id: string | null; // UUID of linked student (for parent)
  counselor_id: string | null;    // UUID of supervising counselor (for mentor)
  counselor_invite_code: string | null;
  school_id: string | null;       // UUID of linked school (for mentor/student)
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  mentor_id: string;
  name: string;
  student_code: string;
  grade: string;
  primary_topic: string;
  notes: string | null;
  avatar: string;
  avg_score: number;
  sessions: number;
  topics: string[];
  trend: string;
  alert_level: string | null;
  last_session: string | null;
  age: number | null;
  gender: string | null;
  parent_name: string | null;
  parent_email: string | null;
  student_email: string | null;
  student_user_id: string | null;
  invite_code: string | null;
  invite_used: boolean;
  parent_link_code: string | null;
  // Extended relational fields
  school_id: string | null;       // UUID of linked school
  counselor_id: string | null;    // UUID of supervising counselor
  parent_ids: string[];           // Array of parent user UUIDs
  created_at: string;
  updated_at: string;
}

// Role → home dashboard route mapping (mirrors middleware.ts)
export const ROLE_HOME_ROUTES: Record<UserRole, string> = {
  mentor: '/student-dashboard',
  student_parent: '/student-parent-dashboard',
  student: '/student-parent-dashboard',
  parent: '/parents-hub',
  counselor: '/counselor-dashboard',
  school: '/school-dashboard',
};
