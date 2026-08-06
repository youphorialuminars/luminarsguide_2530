'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

import { toast } from 'sonner';
import { Toaster } from 'sonner';
import { createClient } from '@/lib/supabase/client';

type AuthTab = 'login' | 'signup' | 'reset';
type UserRole = 'mentor' | 'student' | 'parent' | 'counselor' | 'school';

// Demo credentials for each role
const DEMO_CREDENTIALS = [
  {
    role: 'Mentor',
    email: 'demo.mentor@luminarsguide.com',
    password: 'Demo@Mentor2025',
    icon: 'AcademicCapIcon',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20 hover:border-violet-500/50',
    activeBg: 'bg-violet-500/15 border-violet-500/50',
  },
  {
    role: 'Student',
    email: 'demo.student@luminarsguide.com',
    password: 'Demo@Student2025',
    icon: 'UserIcon',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20 hover:border-sky-500/50',
    activeBg: 'bg-sky-500/15 border-sky-500/50',
  },
  {
    role: 'Counselor',
    email: 'demo.counselor@luminarsguide.com',
    password: 'Demo@Counselor2025',
    icon: 'ShieldCheckIcon',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/50',
    activeBg: 'bg-emerald-500/15 border-emerald-500/50',
  },
  {
    role: 'School',
    email: 'demo.school@luminarsguide.com',
    password: 'Demo@School2025',
    icon: 'BuildingLibraryIcon',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20 hover:border-amber-500/50',
    activeBg: 'bg-amber-500/15 border-amber-500/50',
  },
];

// ─── Visible Error Banner ──────────────────────────────────────────────────────
interface SupabaseErrorBannerProps {
  message: string;
  code?: string;
  onDismiss: () => void;
}

function SupabaseErrorBanner({ message, code, onDismiss }: SupabaseErrorBannerProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border-2 border-red-500/50 text-red-400 animate-fade-in">
      <Icon name="ExclamationTriangleIcon" size={18} className="flex-shrink-0 mt-0.5 text-red-400" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-700 text-red-400 mb-0.5">
          {code ? `Supabase Error ${code}` : 'Supabase Error'}
        </p>
        <p className="text-xs text-red-300 break-words leading-relaxed">{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="flex-shrink-0 text-red-400/60 hover:text-red-400 transition-colors"
      >
        <Icon name="XMarkIcon" size={14} />
      </button>
    </div>
  );
}

// ─── System Health Check ───────────────────────────────────────────────────────
function SystemHealthCheck() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [detail, setDetail] = useState<string>('');

  const runCheck = async () => {
    setStatus('checking');
    setDetail('');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      setStatus('error');
      setDetail('NEXT_PUBLIC_SUPABASE_URL is undefined. The environment variable is not set.');
      return;
    }
    if (!supabaseKey) {
      setStatus('error');
      setDetail('NEXT_PUBLIC_SUPABASE_ANON_KEY is undefined. The environment variable is not set.');
      return;
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1);

      if (error) {
        setStatus('error');
        setDetail(`Code: ${error.code || 'N/A'} | Message: ${error.message} | Hint: ${error.hint || 'none'} | Details: ${error.details || 'none'}`);
        console.error('[HealthCheck] Supabase ping failed:', error);
      } else {
        setStatus('ok');
        setDetail(`Connected to ${supabaseUrl} — query returned ${data?.length ?? 0} row(s).`);
      }
    } catch (err: any) {
      setStatus('error');
      setDetail(err?.message || String(err));
      console.error('[HealthCheck] Exception during ping:', err);
    }
  };

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={runCheck}
        disabled={status === 'checking'}
        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border-2 border-dashed border-amber-500/40 bg-amber-500/5 text-amber-400 text-xs font-600 hover:border-amber-500/70 hover:bg-amber-500/10 transition-all disabled:opacity-60"
      >
        {status === 'checking' ? (
          <>
            <Icon name="ArrowPathIcon" size={13} className="animate-spin" />
            Checking Connection...
          </>
        ) : (
          <>
            <Icon name="SignalIcon" size={13} />
            🔧 System Health Check
          </>
        )}
      </button>

      {status === 'ok' && (
        <div className="mt-2 flex items-start gap-2 p-2.5 rounded-xl bg-green-500/10 border border-green-500/30 animate-fade-in">
          <Icon name="CheckCircleIcon" size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-green-300 break-words leading-relaxed">✅ Database Connected — {detail}</p>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-2 flex items-start gap-2 p-2.5 rounded-xl bg-red-500/10 border-2 border-red-500/40 animate-fade-in">
          <Icon name="XCircleIcon" size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-700 text-red-400 mb-0.5">❌ Connection Failed</p>
            <p className="text-xs text-red-300 break-words leading-relaxed font-mono">{detail}</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface DemoCredentialsProps {
  onSelect: (email: string, password: string) => void;
}

function DemoCredentials({ onSelect }: DemoCredentialsProps) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const handleSelect = (cred: typeof DEMO_CREDENTIALS[0]) => {
    setSelected(cred.email);
    onSelect(cred.email, cred.password);
    toast.success(`Demo credentials filled for ${cred.role}`);
  };

  const handleCopy = (e: React.MouseEvent, text: string, key: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-600 text-muted-foreground px-2 flex items-center gap-1.5">
          <Icon name="BeakerIcon" size={12} />
          Try a Demo Account
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {DEMO_CREDENTIALS.map((cred) => (
          <button
            key={cred.email}
            type="button"
            onClick={() => handleSelect(cred)}
            className={`group flex flex-col gap-1.5 p-2.5 rounded-xl border-2 transition-all text-left ${
              selected === cred.email ? cred.activeBg : cred.bg
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Icon name={cred.icon as any} size={13} className={cred.color} />
                <span className="text-xs font-700 text-foreground">{cred.role}</span>
              </div>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => handleCopy(e, `${cred.email}\n${cred.password}`, cred.role)}
                onKeyDown={(e) => e.key === 'Enter' && handleCopy(e as any, `${cred.email}\n${cred.password}`, cred.role)}
                className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Copy credentials"
              >
                <Icon
                  name={copied === cred.role ? 'CheckIcon' : 'ClipboardDocumentIcon'}
                  size={12}
                  className={copied === cred.role ? 'text-positive' : 'text-muted-foreground'}
                />
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono truncate leading-tight">
              {cred.email}
            </p>
            {selected === cred.email && (
              <span className="text-[10px] font-600 text-positive flex items-center gap-1">
                <Icon name="CheckCircleIcon" size={10} />
                Filled
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-2 leading-relaxed">
        Click any role to auto-fill credentials · For exploration only
      </p>
    </div>
  );
}

interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface SignupForm {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  inviteCode: string;
  parentLinkCode: string;
  counselorInviteCode: string;
  schoolInviteCode: string;
}

interface ResetForm {
  email: string;
  newPassword: string;
  confirmNewPassword: string;
}

function LoginForm({ onSwitchTab }: { onSwitchTab: (tab: AuthTab) => void }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [supabaseError, setSupabaseError] = useState<{ message: string; code?: string } | null>(null);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    setValue,
  } = useForm<LoginForm>();

  const handleDemoSelect = (email: string, password: string) => {
    setValue('email', email);
    setValue('password', password);
  };

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setSupabaseError(null);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) {
        console.error('[SignIn] auth.signInWithPassword error:', error);
        setSupabaseError({ message: error.message, code: error.status?.toString() || (error as any).code });
        setError('password', { message: error.message });
        setIsLoading(false);
        return;
      }

      // Fetch profile to determine role
      let profile: any = null;
      let profileError: any = null;
      try {
        const result = await supabase
          .from('user_profiles')
          .select('role, full_name')
          .eq('id', authData.user.id)
          .single();
        profile = result.data;
        profileError = result.error;
        if (profileError) {
          console.error('[SignIn] user_profiles fetch error:', profileError);
          setSupabaseError({
            message: `Profile fetch failed: ${profileError.message}`,
            code: profileError.code,
          });
        }
      } catch (profileFetchErr: any) {
        console.error('[SignIn] user_profiles fetch exception:', profileFetchErr);
        setSupabaseError({ message: `Profile fetch exception: ${profileFetchErr?.message || String(profileFetchErr)}` });
      }

      // Fallback: use user_metadata if profile fetch fails
      const role: string =
        profile?.role ||
        authData.user.user_metadata?.role ||
        'mentor';

      const fullName: string =
        profile?.full_name ||
        authData.user.user_metadata?.full_name ||
        authData.user.email ||
        'User';

      // Set role cookie for middleware route guarding
      document.cookie = `luminar_role=${role}; path=/; max-age=604800; SameSite=None; Secure`;

      toast.success(`Welcome back, ${fullName}!`);

      if (role === 'student_parent' || role === 'student') {
        router.push('/student-parent-dashboard');
      } else if (role === 'parent') {
        router.push('/parents-hub');
      } else if (role === 'counselor') {
        router.push('/counselor-dashboard');
      } else if (role === 'school') {
        router.push('/school-dashboard');
      } else {
        router.push('/student-dashboard');
      }
    } catch (err: any) {
      console.error('[SignIn] Unexpected exception:', err);
      setSupabaseError({ message: err?.message || 'Sign in failed. Please try again.' });
      setError('password', { message: 'Sign in failed. Please try again.' });
    }
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {/* System Health Check — temporary diagnostic tool */}
      <SystemHealthCheck />

      {/* Visible Supabase Error Banner */}
      {supabaseError && (
        <SupabaseErrorBanner
          message={supabaseError.message}
          code={supabaseError.code}
          onDismiss={() => setSupabaseError(null)}
        />
      )}

      <DemoCredentials onSelect={handleDemoSelect} />
      <div>
        <label className="block text-sm font-600 text-foreground mb-1.5">
          Email Address <span className="text-negative">*</span>
        </label>
        <input
          className="input-mystic"
          type="email"
          placeholder="your.name@school.edu"
          {...register('email', {
            required: 'Email is required',
            pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
          })}
        />
        {errors.email && (
          <p className="text-xs text-negative mt-1.5 flex items-center gap-1">
            <Icon name="ExclamationCircleIcon" size={13} />
            {errors.email.message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-600 text-foreground mb-1.5">
          Password <span className="text-negative">*</span>
        </label>
        <div className="relative">
          <input
            className="input-mystic pr-10"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            {...register('password', { required: 'Password is required' })}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowPassword(!showPassword)}
          >
            <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={17} />
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-negative mt-1.5 flex items-center gap-1">
            <Icon name="ExclamationCircleIcon" size={13} />
            {errors.password.message}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-border accent-primary"
            {...register('rememberMe')}
          />
          <span className="text-sm text-muted-foreground">Remember me</span>
        </label>
        <button
          type="button"
          className="text-sm text-primary font-600 hover:underline"
          onClick={() => onSwitchTab('reset')}
        >
          Forgot password?
        </button>
      </div>

      <button type="submit" className="btn-primary w-full mt-1" disabled={isLoading}>
        {isLoading ? (
          <>
            <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
            Signing In...
          </>
        ) : (
          <>
            <Icon name="ArrowRightOnRectangleIcon" size={16} />
            Sign In to Portal
          </>
        )}
      </button>

      <p className="text-sm text-center text-muted-foreground">
        New to Luminar&apos;s Guide?{' '}
        <button
          type="button"
          className="text-primary font-600 hover:underline"
          onClick={() => onSwitchTab('signup')}
        >
          Create account
        </button>
      </p>
    </form>
  );
}

function SignupForm({ onSwitchTab }: { onSwitchTab: (tab: AuthTab) => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [supabaseError, setSupabaseError] = useState<{ message: string; code?: string } | null>(null);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setError,
  } = useForm<SignupForm>({ defaultValues: { role: 'mentor' } });

  const password = watch('password');
  const selectedRole = watch('role');

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true);
    setSupabaseError(null);
    try {
      // For student: validate mentor invite code and resolve mentor UUID
      let linkedStudentId: string | null = null;
      let linkedMentorId: string | null = null;

      if (data.role === 'student') {
        if (!data.inviteCode || data.inviteCode.trim().length !== 8) {
          setError('inviteCode', { message: 'Please enter a valid 8-character invite code' });
          setIsLoading(false);
          return;
        }
        try {
          const { data: mentorRow, error: mentorLookupErr } = await supabase
            .from('user_profiles')
            .select('id, role, mentor_code')
            .eq('mentor_code', data.inviteCode.trim().toUpperCase())
            .eq('role', 'mentor')
            .maybeSingle();

          if (mentorLookupErr) {
            console.error('[SignUp] mentor lookup error:', mentorLookupErr);
            setSupabaseError({ message: `Mentor code lookup failed: ${mentorLookupErr.message}`, code: mentorLookupErr.code });
            setError('inviteCode', { message: `Lookup failed: ${mentorLookupErr.message}` });
            setIsLoading(false);
            return;
          }
          if (!mentorRow) {
            setError('inviteCode', { message: 'Invalid invite code. Please check with your mentor.' });
            setIsLoading(false);
            return;
          }
          linkedMentorId = mentorRow.id;
        } catch (mentorErr: any) {
          console.error('[SignUp] mentor lookup exception:', mentorErr);
          setSupabaseError({ message: `Mentor lookup exception: ${mentorErr?.message || String(mentorErr)}` });
          setIsLoading(false);
          return;
        }
      }

      // For parent: validate parent link code and resolve student UUID
      let parentLinkedStudentId: string | null = null;
      if (data.role === 'parent') {
        if (!data.parentLinkCode || data.parentLinkCode.trim().length !== 6) {
          setError('parentLinkCode', { message: 'Please enter the 6-digit Parent Link Code from your child.' });
          setIsLoading(false);
          return;
        }
        try {
          const { data: studentRow, error: plcErr } = await supabase
            .from('students')
            .select('id, parent_link_code, mentor_id')
            .eq('parent_link_code', data.parentLinkCode.trim())
            .maybeSingle();

          if (plcErr) {
            console.error('[SignUp] parent link code lookup error:', plcErr);
            setSupabaseError({ message: `Parent link code lookup failed: ${plcErr.message}`, code: plcErr.code });
            setError('parentLinkCode', { message: `Lookup failed: ${plcErr.message}` });
            setIsLoading(false);
            return;
          }
          if (!studentRow) {
            setError('parentLinkCode', { message: 'Invalid Parent Link Code. Ask your child to generate one from their dashboard.' });
            setIsLoading(false);
            return;
          }
          parentLinkedStudentId = studentRow.id;
        } catch (plcEx: any) {
          console.error('[SignUp] parent link code exception:', plcEx);
          setSupabaseError({ message: `Parent link code exception: ${plcEx?.message || String(plcEx)}` });
          setIsLoading(false);
          return;
        }
      }

      // For mentor with counselor invite code: validate it and resolve counselor UUID
      let linkedCounselorId: string | null = null;
      if (data.role === 'mentor' && data.counselorInviteCode && data.counselorInviteCode.trim().length === 6) {
        try {
          const { data: codeRow, error: codeErr } = await supabase
            .from('counselor_mentor_invites')
            .select('id, counselor_id, used_by')
            .eq('invite_code', data.counselorInviteCode.trim())
            .maybeSingle();

          if (codeErr) {
            console.error('[SignUp] counselor invite lookup error:', codeErr);
            setSupabaseError({ message: `Counselor code lookup failed: ${codeErr.message}`, code: codeErr.code });
            setError('counselorInviteCode', { message: `Lookup failed: ${codeErr.message}` });
            setIsLoading(false);
            return;
          }
          if (!codeRow) {
            setError('counselorInviteCode', { message: 'Invalid counselor code. Please check with your counselor.' });
            setIsLoading(false);
            return;
          }
          if (codeRow.used_by) {
            setError('counselorInviteCode', { message: 'This counselor code has already been used.' });
            setIsLoading(false);
            return;
          }
          linkedCounselorId = codeRow.counselor_id;
        } catch (cEx: any) {
          console.error('[SignUp] counselor invite exception:', cEx);
          setSupabaseError({ message: `Counselor invite exception: ${cEx?.message || String(cEx)}` });
          setIsLoading(false);
          return;
        }
      }

      // For mentor/student with school invite code: validate it and resolve school UUID
      let linkedSchoolId: string | null = null;
      const schoolCodeRoles: UserRole[] = ['mentor', 'student'];
      if (schoolCodeRoles.includes(data.role) && data.schoolInviteCode && data.schoolInviteCode.trim().length === 6) {
        try {
          const { data: schoolCodeRow, error: schoolCodeErr } = await supabase
            .from('school_invite_codes')
            .select('id, school_id, used_by')
            .eq('invite_code', data.schoolInviteCode.trim())
            .maybeSingle();

          if (schoolCodeErr) {
            console.error('[SignUp] school invite lookup error:', schoolCodeErr);
            setSupabaseError({ message: `School code lookup failed: ${schoolCodeErr.message}`, code: schoolCodeErr.code });
            setError('schoolInviteCode', { message: `Lookup failed: ${schoolCodeErr.message}` });
            setIsLoading(false);
            return;
          }
          if (!schoolCodeRow) {
            setError('schoolInviteCode', { message: 'Invalid school code. Please check with your school.' });
            setIsLoading(false);
            return;
          }
          if (schoolCodeRow.used_by) {
            setError('schoolInviteCode', { message: 'This school code has already been used.' });
            setIsLoading(false);
            return;
          }
          linkedSchoolId = schoolCodeRow.school_id;
        } catch (sEx: any) {
          console.error('[SignUp] school invite exception:', sEx);
          setSupabaseError({ message: `School invite exception: ${sEx?.message || String(sEx)}` });
          setIsLoading(false);
          return;
        }
      }

      // Generate mentor_code for mentors (8-char alphanumeric, uppercase)
      const mentorCode =
        data.role === 'mentor'
          ? Math.random().toString(36).substring(2, 10).toUpperCase()
          : null;

      const roleValue = data.role;

      // ── Step 1: Create auth user ──────────────────────────────────────────────
      let authData: any = null;
      try {
        const result = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              full_name: data.fullName,
              role: roleValue,
              mentor_code: mentorCode,
              mentor_id: linkedMentorId || null,
              student_id: linkedStudentId || null,
              linked_student_id: parentLinkedStudentId || null,
              counselor_id: linkedCounselorId || null,
              school_id: linkedSchoolId || null,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (result.error) {
          console.error('[SignUp] auth.signUp error:', result.error);
          const signUpError = result.error;
          setSupabaseError({
            message: signUpError.message,
            code: signUpError.status?.toString() || (signUpError as any).code,
          });
          if (
            signUpError.message?.toLowerCase().includes('user already registered') ||
            signUpError.message?.toLowerCase().includes('already registered') ||
            signUpError.status === 422
          ) {
            setError('email', {
              message: 'An account with this email already exists. Please sign in instead.',
            });
          } else {
            setError('email', { message: signUpError.message });
          }
          setIsLoading(false);
          return;
        }

        if (!result.data?.user) {
          setSupabaseError({ message: 'Sign up returned no user object. Please try again.' });
          setError('email', { message: 'Sign up failed: no user returned. Please try again.' });
          setIsLoading(false);
          return;
        }

        authData = result.data;
      } catch (authEx: any) {
        console.error('[SignUp] auth.signUp exception:', authEx);
        setSupabaseError({ message: `Auth exception: ${authEx?.message || String(authEx)}` });
        setError('email', { message: authEx?.message || 'Sign up failed. Please try again.' });
        setIsLoading(false);
        return;
      }

      // ── Step 2: Explicit INSERT into user_profiles (fallback trigger) ─────────
      // This runs immediately after auth.signUp to guarantee the profile row exists,
      // even if the DB trigger is missing or hasn't fired yet.
      const profilePayload: Record<string, any> = {
        id: authData.user.id,
        email: data.email,
        full_name: data.fullName,
        role: roleValue,
        mentor_code: mentorCode,
        mentor_id: linkedMentorId || null,
        student_id: linkedStudentId || null,
        linked_student_id: parentLinkedStudentId || null,
        counselor_id: linkedCounselorId || null,
        school_id: linkedSchoolId || null,
      };

      try {
        const { error: profileInsertError } = await supabase
          .from('user_profiles')
          .upsert(profilePayload, { onConflict: 'id' });

        if (profileInsertError) {
          console.error('[SignUp] user_profiles INSERT/UPSERT error:', profileInsertError);
          // Surface the exact error — this is the most critical diagnostic
          setSupabaseError({
            message: `Profile INSERT failed: ${profileInsertError.message} | Details: ${profileInsertError.details || 'none'} | Hint: ${profileInsertError.hint || 'none'}`,
            code: profileInsertError.code,
          });
          // Don't block the user — auth succeeded, profile may still be created by trigger
          toast.error(`⚠️ Profile write error (${profileInsertError.code}): ${profileInsertError.message}`);
        } else {
          console.log('[SignUp] user_profiles INSERT/UPSERT succeeded for user:', authData.user.id);
        }
      } catch (profileEx: any) {
        console.error('[SignUp] user_profiles INSERT exception:', profileEx);
        setSupabaseError({ message: `Profile INSERT exception: ${profileEx?.message || String(profileEx)}` });
        toast.error(`⚠️ Profile write exception: ${profileEx?.message || String(profileEx)}`);
      }

      // ── Step 3: Mark invite codes as used ────────────────────────────────────
      if (data.role === 'mentor' && linkedCounselorId && data.counselorInviteCode) {
        try {
          const { error: cmiErr } = await supabase
            .from('counselor_mentor_invites')
            .update({ used_by: authData.user.id, used_at: new Date().toISOString() })
            .eq('invite_code', data.counselorInviteCode.trim());
          if (cmiErr) {
            console.error('[SignUp] counselor_mentor_invites update error:', cmiErr);
            setSupabaseError({ message: `Counselor invite mark-used failed: ${cmiErr.message}`, code: cmiErr.code });
          }
        } catch (cmiEx: any) {
          console.error('[SignUp] counselor_mentor_invites update exception:', cmiEx);
        }
      }

      if (linkedSchoolId && data.schoolInviteCode) {
        try {
          const { error: sciErr } = await supabase
            .from('school_invite_codes')
            .update({ used_by: authData.user.id, used_at: new Date().toISOString() })
            .eq('invite_code', data.schoolInviteCode.trim());
          if (sciErr) {
            console.error('[SignUp] school_invite_codes update error:', sciErr);
            setSupabaseError({ message: `School invite mark-used failed: ${sciErr.message}`, code: sciErr.code });
          }
        } catch (sciEx: any) {
          console.error('[SignUp] school_invite_codes update exception:', sciEx);
        }
      }

      setIsLoading(false);
      setSuccess(true);
      toast.success('Account created! You can now sign in.');
    } catch (err: any) {
      console.error('[SignUp] Outer catch exception:', err);
      setSupabaseError({ message: err?.message || 'Sign up failed. Please try again.' });
      setError('email', { message: err?.message || 'Sign up failed. Please try again.' });
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-positive/10 flex items-center justify-center">
          <Icon name="CheckBadgeIcon" size={36} className="text-positive" />
        </div>
        <h3 className="text-xl font-700 text-foreground">Account Created!</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Your account is ready. Sign in to get started.
        </p>
        <button className="btn-primary mt-2" onClick={() => onSwitchTab('login')}>
          <Icon name="ArrowRightOnRectangleIcon" size={16} />
          Go to Sign In
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {/* Visible Supabase Error Banner */}
      {supabaseError && (
        <SupabaseErrorBanner
          message={supabaseError.message}
          code={supabaseError.code}
          onDismiss={() => setSupabaseError(null)}
        />
      )}

      {/* Role Selection */}
      <div>
        <label className="block text-sm font-600 text-foreground mb-2">
          I am joining as <span className="text-negative">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'mentor', label: 'Mentor', icon: 'AcademicCapIcon', desc: 'I guide students' },
            { value: 'student', label: 'Student', icon: 'UserIcon', desc: 'I have a mentor invite code' },
            { value: 'parent', label: 'Parent', icon: 'HomeIcon', desc: 'I have a parent link code' },
            { value: 'counselor', label: 'Counselor', icon: 'ShieldCheckIcon', desc: 'I supervise mentors' },
            { value: 'school', label: 'School', icon: 'BuildingLibraryIcon', desc: 'Institutional account' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex flex-col gap-1.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                selectedRole === opt.value
                  ? 'border-primary bg-primary/5' : 'border-border bg-secondary/40 hover:border-primary/40'
              }`}
            >
              <input
                type="radio"
                value={opt.value}
                className="sr-only"
                {...register('role', { required: true })}
              />
              <div className="flex items-center gap-2">
                <Icon
                  name={opt.icon as any}
                  size={15}
                  className={selectedRole === opt.value ? 'text-primary' : 'text-muted-foreground'}
                />
                <span className="text-xs font-600 text-foreground">{opt.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-600 text-foreground mb-1.5">
          Full Name <span className="text-negative">*</span>
        </label>
        <input
          className="input-mystic"
          placeholder="Your full name"
          {...register('fullName', { required: 'Full name is required' })}
        />
        {errors.fullName && (
          <p className="text-xs text-negative mt-1">{errors.fullName.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-600 text-foreground mb-1.5">
          Email Address <span className="text-negative">*</span>
        </label>
        <input
          className="input-mystic"
          type="email"
          placeholder="your.name@school.edu"
          {...register('email', {
            required: 'Email is required',
            pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' },
          })}
        />
        {errors.email && (
          <p className="text-xs text-negative mt-1">{errors.email.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-600 text-foreground mb-1.5">
            Password <span className="text-negative">*</span>
          </label>
          <div className="relative">
            <input
              className="input-mystic pr-10"
              type={showPassword ? 'text' : 'password'}
              placeholder="Min. 8 characters"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Minimum 8 characters' },
              })}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
            >
              <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={17} />
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-negative mt-1">{errors.password.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-600 text-foreground mb-1.5">
            Confirm Password <span className="text-negative">*</span>
          </label>
          <input
            className="input-mystic"
            type="password"
            placeholder="Repeat password"
            {...register('confirmPassword', {
              required: 'Please confirm password',
              validate: (val) => val === password || 'Passwords do not match',
            })}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-negative mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>
      </div>

      {/* Invite Code — only for student */}
      {selectedRole === 'student' && (
        <div className="animate-fade-in">
          <label className="block text-sm font-600 text-foreground mb-1.5">
            Mentor Invite Code <span className="text-negative">*</span>
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Enter the 8-character code provided by your mentor to link your account.
          </p>
          <div className="relative">
            <input
              className="input-mystic pr-10 font-mono tracking-widest uppercase"
              placeholder="e.g. AB12CD34"
              maxLength={8}
              {...register('inviteCode', {
                required: selectedRole === 'student' ? 'Invite code is required' : false,
                minLength: { value: 8, message: 'Code must be 8 characters' },
                maxLength: { value: 8, message: 'Code must be 8 characters' },
              })}
            />
            <Icon
              name="KeyIcon"
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </div>
          {errors.inviteCode && (
            <p className="text-xs text-negative mt-1">{errors.inviteCode.message}</p>
          )}
        </div>
      )}

      {/* Parent Link Code — only for parent */}
      {selectedRole === 'parent' && (
        <div className="animate-fade-in">
          <label className="block text-sm font-600 text-foreground mb-1.5">
            Parent Link Code <span className="text-negative">*</span>
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Enter the 6-digit code generated by your child from their Student Dashboard → Network &amp; Links.
          </p>
          <div className="relative">
            <input
              className="input-mystic pr-10 font-mono tracking-widest"
              placeholder="e.g. 123456"
              maxLength={6}
              {...register('parentLinkCode', {
                required: selectedRole === 'parent' ? 'Parent Link Code is required' : false,
                minLength: { value: 6, message: 'Code must be 6 digits' },
                maxLength: { value: 6, message: 'Code must be 6 digits' },
              })}
            />
            <Icon
              name="HomeIcon"
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </div>
          {errors.parentLinkCode && (
            <p className="text-xs text-negative mt-1">{errors.parentLinkCode.message}</p>
          )}
        </div>
      )}

      {/* Counselor Invite Code — optional for mentors */}
      {selectedRole === 'mentor' && (
        <div className="animate-fade-in">
          <label className="block text-sm font-600 text-foreground mb-1.5">
            Counselor Invite Code <span className="text-muted-foreground font-400">(optional)</span>
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            If your counselor provided a 6-digit code, enter it here to link your account to them.
          </p>
          <div className="relative">
            <input
              className="input-mystic pr-10 font-mono tracking-widest"
              placeholder="e.g. 123456"
              maxLength={6}
              {...register('counselorInviteCode', {
                validate: (val) => {
                  if (!val || val.trim() === '') return true;
                  if (val.trim().length !== 6) return 'Code must be exactly 6 digits';
                  return true;
                },
              })}
            />
            <Icon
              name="ShieldCheckIcon"
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </div>
          {errors.counselorInviteCode && (
            <p className="text-xs text-negative mt-1">{errors.counselorInviteCode.message}</p>
          )}
        </div>
      )}

      {/* School Invite Code — optional for mentors and students */}
      {(selectedRole === 'mentor' || selectedRole === 'student') && (
        <div className="animate-fade-in">
          <label className="block text-sm font-600 text-foreground mb-1.5">
            School Invite Code <span className="text-muted-foreground font-400">(optional)</span>
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            If your school provided a 6-digit code, enter it here to link your account to the school.
          </p>
          <div className="relative">
            <input
              className="input-mystic pr-10 font-mono tracking-widest"
              placeholder="e.g. 789012"
              maxLength={6}
              {...register('schoolInviteCode', {
                validate: (val) => {
                  if (!val || val.trim() === '') return true;
                  if (val.trim().length !== 6) return 'Code must be exactly 6 digits';
                  return true;
                },
              })}
            />
            <Icon
              name="BuildingLibraryIcon"
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </div>
          {errors.schoolInviteCode && (
            <p className="text-xs text-negative mt-1">{errors.schoolInviteCode.message}</p>
          )}
        </div>
      )}

      <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/60 border border-border">
        <Icon name="InformationCircleIcon" size={16} className="text-info mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          By creating an account, you agree to our{' '}
          <span className="text-primary font-600 cursor-pointer hover:underline">Terms of Service</span>{' '}
          and{' '}
          <span className="text-primary font-600 cursor-pointer hover:underline">Privacy Policy</span>.
          Student data is encrypted and never shared.
        </p>
      </div>

      <button type="submit" className="btn-primary w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
            Creating Account...
          </>
        ) : (
          <>
            <Icon name="UserPlusIcon" size={16} />
            Create Account
          </>
        )}
      </button>

      <p className="text-sm text-center text-muted-foreground">
        Already have an account?{' '}
        <button
          type="button"
          className="text-primary font-600 hover:underline"
          onClick={() => onSwitchTab('login')}
        >
          Sign in
        </button>
      </p>
    </form>
  );
}

function ResetPasswordForm({ onSwitchTab }: { onSwitchTab: (tab: AuthTab) => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [supabaseError, setSupabaseError] = useState<{ message: string; code?: string } | null>(null);
  const supabase = createClient();

  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>();

  const onSubmit = async (data: { email: string }) => {
    setIsLoading(true);
    setSupabaseError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (error) {
        console.error('[ResetPassword] resetPasswordForEmail error:', error);
        setSupabaseError({ message: error.message, code: error.status?.toString() || (error as any).code });
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
      setSent(true);
      toast.success('Password reset email sent!');
    } catch (err: any) {
      console.error('[ResetPassword] exception:', err);
      setSupabaseError({ message: err?.message || 'Reset failed. Please try again.' });
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-info/10 flex items-center justify-center">
          <Icon name="EnvelopeIcon" size={32} className="text-info" />
        </div>
        <h3 className="text-xl font-700 text-foreground">Check Your Email</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          We sent a password reset link to your email address.
        </p>
        <button className="btn-ghost mt-2" onClick={() => onSwitchTab('login')}>
          <Icon name="ArrowLeftIcon" size={14} />
          Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {supabaseError && (
        <SupabaseErrorBanner
          message={supabaseError.message}
          code={supabaseError.code}
          onDismiss={() => setSupabaseError(null)}
        />
      )}

      <div className="flex items-center gap-3 p-3 rounded-xl bg-warning/10 border border-warning/20">
        <Icon name="ShieldCheckIcon" size={18} className="text-warning flex-shrink-0" />
        <p className="text-sm text-foreground/80 leading-relaxed">
          Enter your email address and we will send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-600 text-foreground mb-1.5">Email Address</label>
          <input
            className="input-mystic"
            type="email"
            placeholder="your.name@school.edu"
            {...register('email', { required: 'Email is required' })}
          />
          {errors.email && (
            <p className="text-xs text-negative mt-1">{errors.email.message}</p>
          )}
        </div>
        <button type="submit" className="btn-primary w-full" disabled={isLoading}>
          {isLoading ? (
            <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> Sending...</>
          ) : (
            <><Icon name="EnvelopeIcon" size={16} /> Send Reset Link</>
          )}
        </button>
      </form>

      <button
        type="button"
        className="btn-ghost self-center"
        onClick={() => onSwitchTab('login')}
      >
        <Icon name="ArrowLeftIcon" size={14} />
        Back to Sign In
      </button>
    </div>
  );
}

export default function AuthScreen() {
  const [activeTab, setActiveTab] = useState<AuthTab>('login');

  const tabConfig = {
    login: { label: 'Sign In', icon: 'ArrowRightOnRectangleIcon' },
    signup: { label: 'Create Account', icon: 'UserPlusIcon' },
    reset: { label: 'Reset Password', icon: 'LockClosedIcon' },
  };

  return (
    <div className="min-h-screen flex">
      <Toaster position="top-right" />

      {/* Left Brand Panel */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[42%] mystic-gradient-panel flex-col justify-between p-10 relative overflow-hidden">
        <div className="absolute top-10 right-10 w-64 h-64 blob-gold opacity-30 pointer-events-none" />
        <div className="absolute bottom-20 left-5 w-80 h-80 blob-lavender opacity-20 pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10">
          <AppLogo size={44} />
          <span className="text-white font-800 text-xl tracking-tight">
            Luminar&apos;s Guide
          </span>
        </div>

        <div className="relative z-10 flex flex-col gap-6 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm border border-white/20">
            <Icon name="AcademicCapIcon" size={32} className="text-white" />
          </div>
          <h1 className="text-display text-white leading-tight">
            Guiding Every Student Toward Their Best Self
          </h1>
          <p className="text-white/75 text-base leading-relaxed">
            An AI-powered mentorship platform designed for educators who believe that every student
            has unique strengths waiting to be uncovered.
          </p>

          <div className="flex flex-col gap-3 mt-2">
            {[
              { icon: 'SparklesIcon', text: 'AI-generated personalized guidance' },
              { icon: 'ChartBarIcon', text: 'Longitudinal progress tracking' },
              { icon: 'BookOpenIcon', text: 'Session memory & smart caching' },
              { icon: 'HeartIcon', text: 'Holistic well-being focus' },
            ].map((f) => (
              <div key={`feature-${f.icon}`} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Icon name={f.icon as any} size={15} className="text-white" />
                </div>
                <p className="text-white/85 text-sm font-500">{f.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 p-4 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm">
          <p className="text-white/80 text-sm italic leading-relaxed">
            &ldquo;The art of teaching is the art of assisting discovery.&rdquo;
          </p>
          <p className="text-white/50 text-xs mt-1.5">— Mark Van Doren</p>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-10 bg-background overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="flex lg:hidden items-center gap-2.5 mb-8 justify-center">
            <AppLogo size={38} />
            <span className="font-800 text-lg text-foreground">Luminar&apos;s Guide</span>
          </div>

          {activeTab !== 'reset' && (
            <div className="flex gap-1 p-1 rounded-xl bg-secondary mb-6 border border-border">
              {(['login', 'signup'] as const).map((tab) => (
                <button
                  key={`auth-tab-${tab}`}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-600 transition-all duration-150 ${
                    activeTab === tab
                      ? 'bg-card text-foreground shadow-sm border border-border'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon name={tabConfig[tab].icon as any} size={15} />
                  {tabConfig[tab].label}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'reset' && (
            <div className="mb-6">
              <h2 className="text-2xl font-700 text-foreground">Reset Password</h2>
              <p className="text-sm text-muted-foreground mt-1">
                We will send a reset link to your email
              </p>
            </div>
          )}

          {activeTab === 'login' && (
            <div className="animate-fade-in">
              <div className="mb-6">
                <h2 className="text-2xl font-700 text-foreground">Welcome Back</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Sign in to your portal
                </p>
              </div>
              <LoginForm onSwitchTab={setActiveTab} />
            </div>
          )}

          {activeTab === 'signup' && (
            <div className="animate-fade-in">
              <div className="mb-6">
                <h2 className="text-2xl font-700 text-foreground">Join Luminar&apos;s Guide</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your account to get started
                </p>
              </div>
              <SignupForm onSwitchTab={setActiveTab} />
            </div>
          )}

          {activeTab === 'reset' && (
            <div className="animate-fade-in">
              <ResetPasswordForm onSwitchTab={setActiveTab} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}