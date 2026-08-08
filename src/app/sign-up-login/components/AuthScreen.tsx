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
        setSupabaseError({
          message: error.message,
          code: error.status?.toString(),
        });
        setError('password', { message: error.message });
        setIsLoading(false);
        return;
      }

      // Fetch profile to determine role
      let profile: any = null;
      try {
        const result = await supabase
          .from('user_profiles')
          .select('role, full_name')
          .eq('id', authData.user.id)
          .single();
        profile = result.data;
      } catch (profileFetchErr: any) {
        console.error('[SignIn] user_profiles fetch exception:', profileFetchErr);
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
      document.cookie = `luminar_role=${role}; path=/; max-age=604800; SameSite=Lax; Secure`;

      toast.success(`Welcome back, ${fullName}!`);

      // Hard-redirect based on role
      if (role === 'student_parent' || role === 'student') {
        window.location.href = '/student-parent-dashboard';
      } else if (role === 'parent') {
        window.location.href = '/parents-hub';
      } else if (role === 'counselor') {
        window.location.href = '/counselor-dashboard';
      } else if (role === 'school') {
        window.location.href = '/school-dashboard';
      } else {
        window.location.href = '/student-dashboard';
      }
    } catch (err: any) {
      console.error('[SignIn] Unexpected exception:', err);
      setSupabaseError({ message: err?.message || 'Sign in failed. Please try again.' });
      setError('password', { message: 'Sign in failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

      {/* Visible Supabase Error Banner */}
      {supabaseError && (
        <SupabaseErrorBanner
          message={supabaseError.message}
          code={supabaseError.code}
          onDismiss={() => setSupabaseError(null)}
        />
      )}

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

// Invite code format: 3 uppercase letters, hyphen, 6 digits (e.g. ABC-123456)
const INVITE_CODE_REGEX = /^[A-Z]{3}-\d{6}$/;

function validateInviteCode(val: string): boolean {
  return INVITE_CODE_REGEX.test(val.trim().toUpperCase());
}

function SignupForm({ onSwitchTab }: { onSwitchTab: (tab: AuthTab) => void }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [supabaseError, setSupabaseError] = useState<{ message: string; code?: string } | null>(null);
  // Email confirmation OTP step
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
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
      // For student: validate mentor invite code (LLL-DDDDDD) and resolve mentor UUID
      let linkedStudentId: string | null = null;
      let linkedMentorId: string | null = null;

      if (data.role === 'student') {
        const code = data.inviteCode?.trim().toUpperCase() || '';
        if (!code || !validateInviteCode(code)) {
          setError('inviteCode', { message: 'Please enter a valid invite code in format ABC-123456' });
          setIsLoading(false);
          return;
        }
        try {
          const { data: mentorRow, error: mentorLookupErr } = await supabase
            .from('user_profiles')
            .select('id, role, mentor_code')
            .eq('mentor_code', code)
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

      // For parent: validate parent link code (LLL-DDDDDD) and resolve student UUID
      let parentLinkedStudentId: string | null = null;
      if (data.role === 'parent') {
        const code = data.parentLinkCode?.trim().toUpperCase() || '';
        if (!code || !validateInviteCode(code)) {
          setError('parentLinkCode', { message: 'Please enter a valid Parent Link Code in format ABC-123456' });
          setIsLoading(false);
          return;
        }
        try {
          const { data: studentRow, error: plcErr } = await supabase
            .from('students')
            .select('id, parent_link_code, mentor_id')
            .eq('parent_link_code', code)
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

      // For mentor with counselor invite code: validate (LLL-DDDDDD) and resolve counselor UUID
      let linkedCounselorId: string | null = null;
      if (data.role === 'mentor' && data.counselorInviteCode && data.counselorInviteCode.trim().length > 0) {
        const code = data.counselorInviteCode.trim().toUpperCase();
        if (!validateInviteCode(code)) {
          setError('counselorInviteCode', { message: 'Code must be in format ABC-123456 (3 letters, hyphen, 6 digits)' });
          setIsLoading(false);
          return;
        }
        try {
          const { data: codeRow, error: codeErr } = await supabase
            .from('counselor_mentor_invites')
            .select('id, counselor_id, used_by')
            .eq('invite_code', code)
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

      // For mentor/student with school invite code: validate (LLL-DDDDDD) and resolve school UUID
      let linkedSchoolId: string | null = null;
      const schoolCodeRoles: UserRole[] = ['mentor', 'student'];
      if (schoolCodeRoles.includes(data.role) && data.schoolInviteCode && data.schoolInviteCode.trim().length > 0) {
        const code = data.schoolInviteCode.trim().toUpperCase();
        if (!validateInviteCode(code)) {
          setError('schoolInviteCode', { message: 'Code must be in format ABC-123456 (3 letters, hyphen, 6 digits)' });
          setIsLoading(false);
          return;
        }
        try {
          const { data: schoolCodeRow, error: schoolCodeErr } = await supabase
            .from('school_invite_codes')
            .select('id, school_id, used_by')
            .eq('invite_code', code)
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

      // Generate mentor_code for mentors in LLL-DDDDDD format
      const generateMentorCode = (): string => {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const prefix = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * 26)]).join('');
        const digits = String(Math.floor(Math.random() * 900000) + 100000);
        return `${prefix}-${digits}`;
      };

      const mentorCode =
        data.role === 'mentor' ? generateMentorCode() : null;

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

      // ── Step 2: Explicit INSERT into user_profiles ────────────────────────────
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
          setSupabaseError({
            message: `Profile INSERT failed: ${profileInsertError.message} | Details: ${profileInsertError.details || 'none'} | Hint: ${profileInsertError.hint || 'none'}`,
            code: profileInsertError.code,
          });
          toast.error(`⚠️ Profile write error (${profileInsertError.code}): ${profileInsertError.message}`);
        } else {
          console.log('[SignUp] user_profiles INSERT/UPSERT succeeded for user:', authData.user.id);
        }
      } catch (profileEx: any) {
        console.error('[SignUp] user_profiles INSERT exception:', profileEx);
        setSupabaseError({ message: `Profile INSERT exception: ${profileEx?.message || String(profileEx)}` });
        toast.error(`⚠️ Profile write exception: ${profileEx?.message || String(profileEx)}`);
      }

      // ── Step 3: Redeem parent link code via SECURITY DEFINER RPC ────────────
      if (data.role === 'parent' && data.parentLinkCode && authData?.user?.id) {
        try {
          const { error: redeemErr } = await supabase.rpc('redeem_parent_link_code', {
            p_parent_id: authData.user.id,
            p_link_code: data.parentLinkCode.trim().toUpperCase(),
          });
          if (redeemErr) {
            console.error('[SignUp] redeem_parent_link_code error:', redeemErr);
            toast.error(`Parent link: ${redeemErr.message}`);
          } else {
            console.log('[SignUp] Parent link code redeemed successfully.');
          }
        } catch (redeemEx: any) {
          console.error('[SignUp] redeem_parent_link_code exception:', redeemEx);
        }
      }

      // ── Step 4: Mark invite codes as used ────────────────────────────────────
      if (data.role === 'mentor' && linkedCounselorId && data.counselorInviteCode) {
        try {
          const { error: cmiErr } = await supabase
            .from('counselor_mentor_invites')
            .update({ used_by: authData.user.id, used_at: new Date().toISOString() })
            .eq('invite_code', data.counselorInviteCode.trim().toUpperCase());
          if (cmiErr) {
            console.error('[SignUp] counselor_mentor_invites update error:', cmiErr);
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
            .eq('invite_code', data.schoolInviteCode.trim().toUpperCase());
          if (sciErr) {
            console.error('[SignUp] school_invite_codes update error:', sciErr);
          }
        } catch (sciEx: any) {
          console.error('[SignUp] school_invite_codes update exception:', sciEx);
        }
      }

      // ── Step 5: Auto sign-in and redirect to role-specific dashboard ──────────
      try {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (signInErr) {
          console.error('[SignUp] Auto sign-in failed:', signInErr);
          // Check if email confirmation is required (Supabase returns email_not_confirmed)
          if (
            signInErr.message?.toLowerCase().includes('email not confirmed') ||
            signInErr.message?.toLowerCase().includes('email_not_confirmed') ||
            (signInErr as any).code === 'email_not_confirmed'
          ) {
            setOtpEmail(data.email);
            setAwaitingOtp(true);
            setIsLoading(false);
            toast.info('Please check your email and enter the verification code below.');
            return;
          }
          // Auth succeeded but auto sign-in failed — fall back to manual sign-in
          toast.success('Account created! Please sign in to continue.');
          setIsLoading(false);
          onSwitchTab('login');
          return;
        }

        // Set role cookie
        document.cookie = `luminar_role=${roleValue}; path=/; max-age=604800; SameSite=None; Secure`;
        toast.success(`Welcome, ${data.fullName}! Your account is ready.`);

        // Redirect to role-specific dashboard
        if (roleValue === 'student_parent' || roleValue === 'student') {
          router.push('/student-parent-dashboard');
        } else if (roleValue === 'parent') {
          router.push('/parents-hub');
        } else if (roleValue === 'counselor') {
          router.push('/counselor-dashboard');
        } else if (roleValue === 'school') {
          router.push('/school-dashboard');
        } else {
          router.push('/student-dashboard');
        }
      } catch (signInEx: any) {
        console.error('[SignUp] Auto sign-in exception:', signInEx);
        toast.success('Account created! Please sign in to continue.');
        setIsLoading(false);
        onSwitchTab('login');
      }

    } catch (err: any) {
      console.error('[SignUp] Outer catch exception:', err);
      setSupabaseError({ message: err?.message || 'Sign up failed. Please try again.' });
      setError('email', { message: err?.message || 'Sign up failed. Please try again.' });
      setIsLoading(false);
    }
  };

  // ─── OTP Verification Handler ──────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) { setOtpError('Please enter the verification code.'); return; }
    setVerifyingOtp(true);
    setOtpError(null);
    try {
      const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
        email: otpEmail,
        token: otpCode.trim(),
        type: 'signup',
      });
      if (verifyErr) {
        console.error('[OTP] verifyOtp error:', verifyErr);
        setOtpError(verifyErr.message || 'Invalid or expired code. Please try again.');
        setVerifyingOtp(false);
        return;
      }
      // OTP verified — session is now active
      const role: string = verifyData?.user?.user_metadata?.role || 'mentor';
      document.cookie = `luminar_role=${role}; path=/; max-age=604800; SameSite=None; Secure`;
      toast.success('Email verified! Welcome to Luminar\'s Guide.');
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
      console.error('[OTP] exception:', err);
      setOtpError(err?.message || 'Verification failed. Please try again.');
    }
    setVerifyingOtp(false);
  };

  // ─── OTP Step UI ───────────────────────────────────────────────────────────
  if (awaitingOtp) {
    return (
      <div className="flex flex-col gap-5 animate-fade-in">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon name="EnvelopeIcon" size={32} className="text-primary" />
          </div>
          <h3 className="text-xl font-700 text-foreground text-center">Check Your Email</h3>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            We sent a verification code to <span className="font-600 text-foreground">{otpEmail}</span>. Enter it below to confirm your account.
          </p>
        </div>

        {otpError && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border-2 border-red-500/50 text-red-400 animate-fade-in">
            <Icon name="ExclamationTriangleIcon" size={18} className="flex-shrink-0 mt-0.5 text-red-400" />
            <p className="text-xs text-red-300 break-words leading-relaxed">{otpError}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-600 text-foreground mb-1.5">
            Verification Code <span className="text-negative">*</span>
          </label>
          <input
            className="input-mystic text-center font-mono tracking-[0.4em] text-lg"
            placeholder="Enter code"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyOtp(); }}
            autoFocus
          />
          <p className="text-xs text-muted-foreground mt-1.5">Enter the 6-digit code from your email.</p>
        </div>

        <button
          type="button"
          className="btn-primary w-full"
          onClick={handleVerifyOtp}
          disabled={verifyingOtp}
        >
          {verifyingOtp ? (
            <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> Verifying...</>
          ) : (
            <><Icon name="CheckCircleIcon" size={16} /> Verify & Continue</>
          )}
        </button>

        <button
          type="button"
          className="btn-ghost w-full text-sm"
          onClick={() => { setAwaitingOtp(false); setOtpCode(''); setOtpError(null); }}
        >
          <Icon name="ArrowLeftIcon" size={14} />
          Back to Sign Up
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
            Enter the code provided by your mentor (format: ABC-123456).
          </p>
          <div className="relative">
            <input
              className="input-mystic pr-10 font-mono tracking-widest uppercase"
              placeholder="e.g. ABC-123456"
              maxLength={10}
              {...register('inviteCode', {
                required: selectedRole === 'student' ? 'Invite code is required' : false,
                validate: (val) => {
                  if (selectedRole !== 'student') return true;
                  if (!val || !validateInviteCode(val.trim().toUpperCase())) {
                    return 'Code must be in format ABC-123456 (3 letters, hyphen, 6 digits)';
                  }
                  return true;
                },
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
            Enter the code generated by your child from their Student Dashboard → Network &amp; Links (format: ABC-123456).
          </p>
          <div className="relative">
            <input
              className="input-mystic pr-10 font-mono tracking-widest uppercase"
              placeholder="e.g. ABC-123456"
              maxLength={10}
              {...register('parentLinkCode', {
                required: selectedRole === 'parent' ? 'Parent Link Code is required' : false,
                validate: (val) => {
                  if (selectedRole !== 'parent') return true;
                  if (!val || !validateInviteCode(val.trim().toUpperCase())) {
                    return 'Code must be in format ABC-123456 (3 letters, hyphen, 6 digits)';
                  }
                  return true;
                },
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
            If your counselor provided a code, enter it here to link your account (format: ABC-123456).
          </p>
          <div className="relative">
            <input
              className="input-mystic pr-10 font-mono tracking-widest uppercase"
              placeholder="e.g. ABC-123456"
              maxLength={10}
              {...register('counselorInviteCode', {
                validate: (val) => {
                  if (!val || val.trim() === '') return true;
                  if (!validateInviteCode(val.trim().toUpperCase())) {
                    return 'Code must be in format ABC-123456 (3 letters, hyphen, 6 digits)';
                  }
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
            If your school provided a code, enter it here to link your account (format: ABC-123456).
          </p>
          <div className="relative">
            <input
              className="input-mystic pr-10 font-mono tracking-widest uppercase"
              placeholder="e.g. ABC-123456"
              maxLength={10}
              {...register('schoolInviteCode', {
                validate: (val) => {
                  if (!val || val.trim() === '') return true;
                  if (!validateInviteCode(val.trim().toUpperCase())) {
                    return 'Code must be in format ABC-123456 (3 letters, hyphen, 6 digits)';
                  }
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