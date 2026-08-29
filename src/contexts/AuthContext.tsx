'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { createClient } from '../lib/supabase/client';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'mentor' | 'student' | 'counselor' | 'school';
  mentor_id: string | null;
  student_id: string | null;
  mentor_code: string | null;
  counselor_id: string | null;
  counselor_invite_code: string | null;
  school_id: string | null;
  approval_status: string;
}

interface AuthContextType {
  user: any;
  session: any;
  loading: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
  signUp: (email: string, password: string, metadata?: any) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  getCurrentUser: () => Promise<any>;
  isEmailVerified: () => boolean;
  getUserProfile: () => Promise<UserProfile | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Helper: set role cookie (client-side)
function setRoleCookie(role: string) {
  if (typeof document !== 'undefined') {
    document.cookie = `luminar_role=${role}; path=/; max-age=604800; SameSite=None; Secure`;
  }
}

function clearRoleCookie() {
  if (typeof document !== 'undefined') {
    document.cookie = 'luminar_role=; path=/; max-age=0; SameSite=None; Secure';
  }
}

// Roles that get authority over other people's data must be approved before
// they can use the app — see the "pending approval" check at the bottom of
// AuthProvider below.
const GATED_ROLES = ['mentor', 'counselor', 'school', 'student', 'parent', 'admin'];

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const fetchProfile = async (userId: string) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) {
        console.error(`[AuthContext] fetchProfile error for user ${userId} — Code: ${error.code} | Message: ${error.message} | Details: ${error.details || 'none'} | Hint: ${error.hint || 'none'}`);
      } else if (data) {
        setProfile(data as UserProfile);
        setRoleCookie((data as any).role);
      }
    } catch (err: any) {
      console.error('[AuthContext] fetchProfile exception:', err?.message || String(err));
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        clearRoleCookie();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, metadata = {}) => {
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '');

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('[AuthContext] NEXT_PUBLIC_SUPABASE_URL is not set. Sign-up will fail.');
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('[AuthContext] NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Sign-up will fail.');
    }

    const meta = metadata as Record<string, any>;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: meta?.full_name || meta?.fullName || '',
          role: meta?.role || 'mentor',
          mentor_code: meta?.mentor_code || null,
          // Pass all resolved UUID foreign keys so the SECURITY DEFINER trigger
          // can write them atomically to user_profiles, bypassing RLS session issues
          mentor_id: meta?.mentor_id || null,
          student_id: meta?.student_id || null,
          linked_student_id: meta?.linked_student_id || null,
          counselor_id: meta?.counselor_id || null,
          school_id: meta?.school_id || null,
          avatar_url: meta?.avatarUrl || '',
        },
        emailRedirectTo: `${siteUrl}/auth/callback`
      }
    });
    if (error) {
      console.error('[AuthContext] auth.signUp error:', error);
      throw error;
    }
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      console.error(`[AuthContext] signIn error — Code: ${(error as any).code || error.status} | Message: ${error.message}`);
      throw error;
    }
    if (data.user) {
      await fetchProfile(data.user.id);
    }
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
    clearRoleCookie();
  };

  const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  };

  const isEmailVerified = () => {
    return user?.email_confirmed_at !== null;
  };

  const getUserProfile = async (): Promise<UserProfile | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) {
      console.error(`[AuthContext] getUserProfile error — Code: ${error.code} | Message: ${error.message} | Details: ${error.details || 'none'}`);
      throw error;
    }
    return data as UserProfile;
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    profile,
    profileLoading,
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    isEmailVerified,
    getUserProfile,
    refreshProfile,
  };

  const isPending =
    !!profile &&
    (profile as any).approval_status === 'pending' &&
    GATED_ROLES.includes(profile.role);

  if (!loading && !profileLoading && isPending) {
    return (
      <AuthContext.Provider value={value}>
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="max-w-md w-full text-center card-mystic p-8">
            <h1 className="text-xl font-800 text-foreground mb-3">Your account is pending approval</h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Thanks for signing up, {profile?.full_name || 'there'}. An administrator needs to review and approve
              your account before you can access the dashboard. You'll be able to log in normally once that's done —
              no need to sign up again.
            </p>
            <button className="btn-primary" onClick={() => signOut()}>
              Log Out
            </button>
          </div>
        </div>
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
