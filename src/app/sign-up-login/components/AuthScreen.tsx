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
type UserRole = 'mentor' | 'student_parent' | 'counselor' | 'school';

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
    role: 'Student / Parent',
    email: 'demo.student@luminarsguide.com',
    password: 'Demo@Student2025',
    icon: 'UserGroupIcon',
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
              <button
                type="button"
                onClick={(e) => handleCopy(e, `${cred.email}\n${cred.password}`, cred.role)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy credentials"
              >
                <Icon
                  name={copied === cred.role ? 'CheckIcon' : 'ClipboardDocumentIcon'}
                  size={12}
                  className={copied === cred.role ? 'text-positive' : 'text-muted-foreground'}
                />
              </button>
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
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) {
        setError('password', { message: error.message });
        setIsLoading(false);
        return;
      }
      // Fetch profile to determine role
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, full_name')
        .eq('id', authData.user.id)
        .single();

      toast.success(`Welcome back, ${profile?.full_name || 'User'}!`);
      if (profile?.role === 'student' || profile?.role === 'parent') {
        router.push('/student-parent-dashboard');
      } else if (profile?.role === 'counselor') {
        router.push('/counselor-dashboard');
      } else if (profile?.role === 'school') {
        router.push('/school-dashboard');
      } else {
        router.push('/student-dashboard');
      }
    } catch {
      setError('password', { message: 'Sign in failed. Please try again.' });
    }
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
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
    try {
      // For student/parent: validate invite code first
      let linkedStudentId: string | null = null;
      let linkedMentorId: string | null = null;

      if (data.role === 'student_parent') {
        if (!data.inviteCode || data.inviteCode.trim().length !== 8) {
          setError('inviteCode', { message: 'Please enter a valid 8-digit invite code' });
          setIsLoading(false);
          return;
        }
        // Look up the student by invite code
        const { data: studentRow, error: inviteErr } = await supabase
          .from('students')
          .select('id, mentor_id, invite_used')
          .eq('invite_code', data.inviteCode.trim())
          .maybeSingle();

        if (inviteErr || !studentRow) {
          setError('inviteCode', { message: 'Invalid invite code. Please check with your mentor.' });
          setIsLoading(false);
          return;
        }
        if (studentRow.invite_used) {
          setError('inviteCode', { message: 'This invite code has already been used.' });
          setIsLoading(false);
          return;
        }
        linkedStudentId = studentRow.id;
        linkedMentorId = studentRow.mentor_id;
      }

      // For mentor with counselor invite code: validate it
      let linkedCounselorId: string | null = null;
      if (data.role === 'mentor' && data.counselorInviteCode && data.counselorInviteCode.trim().length === 6) {
        const { data: codeRow, error: codeErr } = await supabase
          .from('counselor_mentor_invites')
          .select('id, counselor_id, used_by')
          .eq('invite_code', data.counselorInviteCode.trim())
          .maybeSingle();

        if (codeErr || !codeRow) {
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
      }

      // For mentor/student with school invite code: validate it
      let linkedSchoolId: string | null = null;
      const schoolCodeRoles: UserRole[] = ['mentor', 'student_parent'];
      if (schoolCodeRoles.includes(data.role) && data.schoolInviteCode && data.schoolInviteCode.trim().length === 6) {
        const { data: schoolCodeRow, error: schoolCodeErr } = await supabase
          .from('school_invite_codes')
          .select('id, school_id, used_by')
          .eq('invite_code', data.schoolInviteCode.trim())
          .maybeSingle();

        if (schoolCodeErr || !schoolCodeRow) {
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
      }

      // Generate mentor_code for mentors
      const mentorCode =
        data.role === 'mentor'
          ? Math.random().toString(36).substring(2, 10).toUpperCase()
          : null;

      const roleValue = data.role === 'student_parent' ? 'student' : data.role;

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            role: roleValue,
            mentor_code: mentorCode,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError('email', { message: signUpError.message });
        setIsLoading(false);
        return;
      }

      // If student/parent: link their user_id to the student row
      if (data.role === 'student_parent' && linkedStudentId && authData.user) {
        await supabase
          .from('students')
          .update({
            student_user_id: authData.user.id,
            invite_used: true,
          })
          .eq('id', linkedStudentId);

        // Also update user_profiles with mentor_id and student_id
        await supabase
          .from('user_profiles')
          .update({
            mentor_id: linkedMentorId,
            student_id: linkedStudentId,
          })
          .eq('id', authData.user.id);
      }

      // If mentor with counselor code: link to counselor
      if (data.role === 'mentor' && linkedCounselorId && authData.user) {
        await supabase
          .from('user_profiles')
          .update({ counselor_id: linkedCounselorId })
          .eq('id', authData.user.id);

        await supabase
          .from('counselor_mentor_invites')
          .update({ used_by: authData.user.id, used_at: new Date().toISOString() })
          .eq('invite_code', data.counselorInviteCode.trim());
      }

      // If mentor or student with school code: link to school
      if (linkedSchoolId && authData.user) {
        await supabase
          .from('user_profiles')
          .update({ school_id: linkedSchoolId })
          .eq('id', authData.user.id);

        await supabase
          .from('school_invite_codes')
          .update({ used_by: authData.user.id, used_at: new Date().toISOString() })
          .eq('invite_code', data.schoolInviteCode.trim());
      }

      setIsLoading(false);
      setSuccess(true);
      toast.success('Account created! You can now sign in.');
    } catch (err: any) {
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
      {/* Role Selection */}
      <div>
        <label className="block text-sm font-600 text-foreground mb-2">
          I am joining as <span className="text-negative">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'mentor', label: 'Mentor', icon: 'AcademicCapIcon', desc: 'I guide students' },
            { value: 'student_parent', label: 'Student / Parent', icon: 'UserGroupIcon', desc: 'I have an invite code' },
            { value: 'counselor', label: 'Counselor', icon: 'ShieldCheckIcon', desc: 'I supervise mentors' },
            { value: 'school', label: 'School', icon: 'BuildingLibraryIcon', desc: 'Institutional account' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex flex-col gap-1.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                selectedRole === opt.value
                  ? 'border-primary bg-primary/5' :'border-border bg-secondary/40 hover:border-primary/40'
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

      {/* Invite Code — only for student/parent */}
      {selectedRole === 'student_parent' && (
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
                required: selectedRole === 'student_parent' ? 'Invite code is required' : false,
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
      {(selectedRole === 'mentor' || selectedRole === 'student_parent') && (
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
  const supabase = createClient();

  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>();

  const onSubmit = async (data: { email: string }) => {
    setIsLoading(true);
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setIsLoading(false);
    setSent(true);
    toast.success('Password reset email sent!');
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