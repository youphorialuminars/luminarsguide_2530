'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { mockMentors, SECURITY_QUESTIONS } from '@/lib/mockData';
import { toast } from 'sonner';
import { Toaster } from 'sonner';

type AuthTab = 'login' | 'signup' | 'reset';

interface LoginForm {
  mentorId: string;
  password: string;
  rememberMe: boolean;
}

interface SignupForm {
  fullName: string;
  mentorId: string;
  email: string;
  password: string;
  confirmPassword: string;
  securityQuestion: string;
  securityAnswer: string;
}

interface ResetForm {
  mentorId: string;
  securityQuestion: string;
  securityAnswer: string;
  newPassword: string;
  confirmNewPassword: string;
}

function CredentialsBox({ onUse }: { onUse: (id: string, pw: string) => void }) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <div className="mt-6 rounded-xl border border-border bg-secondary/60 p-4">
      <p className="section-label mb-3">Demo Credentials</p>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Mentor ID</p>
            <p className="text-sm font-600 text-foreground font-mono">mentor-101</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost text-xs py-1 px-2"
              onClick={() => copyToClipboard('mentor-101', 'id')}
            >
              <Icon name={copiedField === 'id' ? 'CheckIcon' : 'ClipboardIcon'} size={14} />
              {copiedField === 'id' ? 'Copied' : 'Copy'}
            </button>
            <button
              className="btn-primary text-xs py-1 px-3"
              onClick={() => onUse('mentor-101', 'Luminar@2026')}
            >
              Use
            </button>
          </div>
        </div>
        <div className="border-t border-border pt-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Password</p>
            <p className="text-sm font-600 text-foreground font-mono">Luminar@2026</p>
          </div>
          <button
            className="btn-ghost text-xs py-1 px-2"
            onClick={() => copyToClipboard('Luminar@2026', 'pw')}
          >
            <Icon name={copiedField === 'pw' ? 'CheckIcon' : 'ClipboardIcon'} size={14} />
            {copiedField === 'pw' ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoginForm({ onSwitchTab }: { onSwitchTab: (tab: AuthTab) => void }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    setError,
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    // BACKEND INTEGRATION: Replace with real authentication API call
    await new Promise((r) => setTimeout(r, 1200));

    const mentor = mockMentors.find(
      (m) => m.id === data.mentorId && m.password === data.password
    );

    if (!mentor) {
      setError('password', {
        message: "Invalid credentials — use the demo accounts below to sign in",
      });
      setIsLoading(false);
      return;
    }

    toast.success(`Welcome back, ${mentor.name}!`);
    router.push('/student-dashboard');
  };

  const handleUseDemoCredentials = (id: string, pw: string) => {
    setValue('mentorId', id);
    setValue('password', pw);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div>
        <label className="block text-sm font-600 text-foreground mb-1.5">
          Mentor ID <span className="text-negative">*</span>
        </label>
        <p className="text-xs text-muted-foreground mb-2">Your unique registration number</p>
        <input
          className="input-mystic"
          placeholder="e.g. mentor-101"
          {...register('mentorId', { required: 'Mentor ID is required' })}
        />
        {errors.mentorId && (
          <p className="text-xs text-negative mt-1.5 flex items-center gap-1">
            <Icon name="ExclamationCircleIcon" size={13} />
            {errors.mentorId.message}
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
            aria-label={showPassword ? 'Hide password' : 'Show password'}
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

      <CredentialsBox onUse={handleUseDemoCredentials} />
    </form>
  );
}

function SignupForm({ onSwitchTab }: { onSwitchTab: (tab: AuthTab) => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupForm>();

  const password = watch('password');

  const onSubmit = async (_data: SignupForm) => {
    setIsLoading(true);
    // BACKEND INTEGRATION: Replace with real mentor registration API call
    await new Promise((r) => setTimeout(r, 1500));
    setIsLoading(false);
    setSuccess(true);
    toast.success('Account created! You can now sign in.');
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-positive/10 flex items-center justify-center">
          <Icon name="CheckBadgeIcon" size={36} className="text-positive" />
        </div>
        <h3 className="text-xl font-700 text-foreground">Account Created!</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Your mentor account is ready. Sign in with your Mentor ID and password to get started.
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-600 text-foreground mb-1.5">
            Full Name <span className="text-negative">*</span>
          </label>
          <input
            className="input-mystic"
            placeholder="Dr. Kavita Rao"
            {...register('fullName', { required: 'Full name is required' })}
          />
          {errors.fullName && (
            <p className="text-xs text-negative mt-1">{errors.fullName.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-600 text-foreground mb-1.5">
            Mentor ID <span className="text-negative">*</span>
          </label>
          <p className="text-xs text-muted-foreground mb-1">Choose a unique registration number</p>
          <input
            className="input-mystic"
            placeholder="e.g. mentor-202"
            {...register('mentorId', { required: 'Mentor ID is required' })}
          />
          {errors.mentorId && (
            <p className="text-xs text-negative mt-1">{errors.mentorId.message}</p>
          )}
        </div>
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

      <div>
        <label className="block text-sm font-600 text-foreground mb-1.5">
          Security Question <span className="text-negative">*</span>
        </label>
        <p className="text-xs text-muted-foreground mb-2">Used to reset your password securely</p>
        <select
          className="input-mystic"
          {...register('securityQuestion', { required: 'Please choose a security question' })}
        >
          <option value="">Select a security question...</option>
          {SECURITY_QUESTIONS.map((q) => (
            <option key={`sq-${q.slice(0, 20)}`} value={q}>{q}</option>
          ))}
        </select>
        {errors.securityQuestion && (
          <p className="text-xs text-negative mt-1">{errors.securityQuestion.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-600 text-foreground mb-1.5">
          Security Answer <span className="text-negative">*</span>
        </label>
        <input
          className="input-mystic"
          placeholder="Your answer (case-insensitive)"
          {...register('securityAnswer', { required: 'Security answer is required' })}
        />
        {errors.securityAnswer && (
          <p className="text-xs text-negative mt-1">{errors.securityAnswer.message}</p>
        )}
      </div>

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
            Create Mentor Account
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
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [verifiedMentorId, setVerifiedMentorId] = useState('');

  const step1Form = useForm<{ mentorId: string; securityQuestion: string; securityAnswer: string }>();
  const step2Form = useForm<{ newPassword: string; confirmNewPassword: string }>();
  const watchNewPassword = step2Form.watch('newPassword');

  const onStep1Submit = async (data: { mentorId: string; securityQuestion: string; securityAnswer: string }) => {
    setIsLoading(true);
    // BACKEND INTEGRATION: Verify mentor ID + security answer
    await new Promise((r) => setTimeout(r, 1000));
    const mentor = mockMentors.find(
      (m) =>
        m.id === data.mentorId &&
        m.securityQuestion === data.securityQuestion &&
        m.securityAnswer.toLowerCase() === data.securityAnswer.toLowerCase()
    );
    setIsLoading(false);
    if (!mentor) {
      step1Form.setError('securityAnswer', { message: 'Verification failed. Check your Mentor ID and answer.' });
      return;
    }
    setVerifiedMentorId(data.mentorId);
    setStep(2);
  };

  const onStep2Submit = async (_data: { newPassword: string; confirmNewPassword: string }) => {
    setIsLoading(true);
    // BACKEND INTEGRATION: Update password for verifiedMentorId
    await new Promise((r) => setTimeout(r, 1000));
    setIsLoading(false);
    toast.success('Password reset successfully! Please sign in.');
    onSwitchTab('login');
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-warning/10 border border-warning/20">
        <Icon name="ShieldCheckIcon" size={18} className="text-warning flex-shrink-0" />
        <p className="text-sm text-foreground/80 leading-relaxed">
          {step === 1
            ? 'Verify your identity using your Mentor ID and security question.'
            : 'You have been verified. Set your new password below.'}
        </p>
      </div>

      <div className="flex items-center gap-2 mb-1">
        {[1, 2].map((s) => (
          <React.Fragment key={`reset-step-${s}`}>
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 transition-all ${
                step >= s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              {step > s ? <Icon name="CheckIcon" size={13} /> : s}
            </div>
            {s < 2 && <div className={`flex-1 h-0.5 rounded-full ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <form onSubmit={step1Form.handleSubmit(onStep1Submit)} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-600 text-foreground mb-1.5">Mentor ID</label>
            <input
              className="input-mystic"
              placeholder="Your unique registration number"
              {...step1Form.register('mentorId', { required: 'Mentor ID is required' })}
            />
            {step1Form.formState.errors.mentorId && (
              <p className="text-xs text-negative mt-1">{step1Form.formState.errors.mentorId.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-600 text-foreground mb-1.5">Security Question</label>
            <select
              className="input-mystic"
              {...step1Form.register('securityQuestion', { required: 'Please select your security question' })}
            >
              <option value="">Select the question you chose during sign-up...</option>
              {SECURITY_QUESTIONS.map((q) => (
                <option key={`reset-sq-${q.slice(0, 20)}`} value={q}>{q}</option>
              ))}
            </select>
            {step1Form.formState.errors.securityQuestion && (
              <p className="text-xs text-negative mt-1">{step1Form.formState.errors.securityQuestion.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-600 text-foreground mb-1.5">Your Answer</label>
            <input
              className="input-mystic"
              placeholder="Type your answer"
              {...step1Form.register('securityAnswer', { required: 'Security answer is required' })}
            />
            {step1Form.formState.errors.securityAnswer && (
              <p className="text-xs text-negative mt-1">{step1Form.formState.errors.securityAnswer.message}</p>
            )}
          </div>
          <button type="submit" className="btn-primary w-full" disabled={isLoading}>
            {isLoading ? (
              <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> Verifying...</>
            ) : (
              <><Icon name="ShieldCheckIcon" size={16} /> Verify Identity</>
            )}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={step2Form.handleSubmit(onStep2Submit)} className="flex flex-col gap-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-positive/10 border border-positive/20">
            <Icon name="CheckCircleIcon" size={15} className="text-positive" />
            <p className="text-xs text-positive font-600">Identity verified for {verifiedMentorId}</p>
          </div>
          <div>
            <label className="block text-sm font-600 text-foreground mb-1.5">New Password</label>
            <input
              className="input-mystic"
              type="password"
              placeholder="Min. 8 characters"
              {...step2Form.register('newPassword', {
                required: 'New password is required',
                minLength: { value: 8, message: 'Minimum 8 characters' },
              })}
            />
            {step2Form.formState.errors.newPassword && (
              <p className="text-xs text-negative mt-1">{step2Form.formState.errors.newPassword.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-600 text-foreground mb-1.5">Confirm New Password</label>
            <input
              className="input-mystic"
              type="password"
              placeholder="Repeat new password"
              {...step2Form.register('confirmNewPassword', {
                required: 'Please confirm your new password',
                validate: (val) => val === watchNewPassword || 'Passwords do not match',
              })}
            />
            {step2Form.formState.errors.confirmNewPassword && (
              <p className="text-xs text-negative mt-1">{step2Form.formState.errors.confirmNewPassword.message}</p>
            )}
          </div>
          <button type="submit" className="btn-primary w-full" disabled={isLoading}>
            {isLoading ? (
              <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> Resetting...</>
            ) : (
              <><Icon name="LockClosedIcon" size={16} /> Reset Password</>
            )}
          </button>
        </form>
      )}

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
        {/* Decorative blobs */}
        <div className="absolute top-10 right-10 w-64 h-64 blob-gold opacity-30 pointer-events-none" />
        <div className="absolute bottom-20 left-5 w-80 h-80 blob-lavender opacity-20 pointer-events-none" />

        {/* Top logo */}
        <div className="flex items-center gap-3 relative z-10">
          <AppLogo size={44} />
          <span className="text-white font-800 text-xl tracking-tight">
            Luminar&apos;s Guide
          </span>
        </div>

        {/* Center content */}
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

        {/* Bottom quote */}
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
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8 justify-center">
            <AppLogo size={38} />
            <span className="font-800 text-lg text-foreground">Luminar&apos;s Guide</span>
          </div>

          {/* Tab header */}
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
                Answer your security question to regain access
              </p>
            </div>
          )}

          {activeTab === 'login' && (
            <div className="animate-fade-in">
              <div className="mb-6">
                <h2 className="text-2xl font-700 text-foreground">Welcome Back</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Sign in to your mentor portal
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
                  Create your mentor account to get started
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