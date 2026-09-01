'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useFontSize } from '@/contexts/FontSizeContext';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

type FontSize = 'small' | 'medium' | 'large';

const FONT_SIZE_OPTIONS: { value: FontSize; label: string; description: string; preview: string }[] = [
  {
    value: 'small',
    label: 'Small',
    description: 'Compact text — fits more content on screen',
    preview: 'Aa',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Default size — balanced readability',
    preview: 'Aa',
  },
  {
    value: 'large',
    label: 'Large',
    description: 'Larger text — high accessibility for mentors',
    preview: 'Aa',
  },
];

const previewSizes: Record<FontSize, string> = {
  small: 'text-sm',
  medium: 'text-base',
  large: 'text-lg',
};

export default function SettingsContent() {
  const { fontSize, setFontSize, theme, setTheme } = useFontSize();
  const { profile, refreshProfile } = useAuth();
  const supabase = createClient();

  const [fullName, setFullName] = useState('');
  const [codename, setCodename] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName((profile as any).full_name || '');
      setCodename((profile as any).codename || '');
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    setProfileError(null);
    if (!fullName.trim()) {
      setProfileError('Full name cannot be empty.');
      return;
    }
    if (!codename.trim()) {
      setProfileError('Codename cannot be empty.');
      return;
    }
    if (!profile?.id) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ full_name: fullName.trim(), codename: codename.trim() })
        .eq('id', profile.id);
      if (error) {
        setProfileError(error.message || 'Failed to save profile.');
      } else {
        toast.success('Profile updated!');
        await refreshProfile();
      }
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to save profile.');
    }
    setSavingProfile(false);
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon name="Cog6ToothIcon" size={22} className="text-primary" />
          </div>
          <h1 className="text-2xl font-700 text-foreground">Settings</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-13">
          Customise your Luminar&apos;s Guide experience for maximum comfort and accessibility.
        </p>
      </div>

      {/* My Profile Section */}
      <div className="card-elevated p-6 mb-5">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
            <Icon name="UserCircleIcon" size={18} className="text-accent-foreground" />
          </div>
          <div>
            <h2 className="font-700 text-foreground text-base">My Profile</h2>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Update your name and codename — these show up everywhere across the app, including on
              directory and roster sheets.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-600 text-foreground mb-1.5">Full Name</label>
            <input
              className="input-mystic"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-600 text-foreground mb-1.5">Codename</label>
            <input
              className="input-mystic"
              placeholder="A fun codename — a character, a favorite dish, anything!"
              value={codename}
              onChange={(e) => setCodename(e.target.value)}
            />
          </div>
          {profileError && <p className="text-xs text-negative">{profileError}</p>}
          <button
            className="btn-primary self-start"
            onClick={handleSaveProfile}
            disabled={savingProfile}
          >
            {savingProfile ? (
              <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> Saving...</>
            ) : (
              <><Icon name="CheckIcon" size={16} /> Save Profile</>
            )}
          </button>
        </div>
      </div>

      {/* Font Size Section */}
      <div className="card-elevated p-6 mb-5">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
            <Icon name="MagnifyingGlassPlusIcon" size={18} className="text-accent-foreground" />
          </div>
          <div>
            <h2 className="font-700 text-foreground text-base">Font Size Adjuster</h2>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Adjust the text size across all pages — Dashboard, New Session, Analysis History, and Settings.
              Changes apply instantly and are saved for your next visit.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {FONT_SIZE_OPTIONS.map((option) => {
            const isActive = fontSize === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setFontSize(option.value)}
                className={`relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-150 text-left ${
                  isActive
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-secondary/50'
                }`}
                aria-pressed={isActive}
                aria-label={`Set font size to ${option.label}`}
              >
                {isActive && (
                  <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Icon name="CheckIcon" size={11} className="text-white" />
                  </div>
                )}
                <div
                  className={`font-700 text-foreground leading-none ${previewSizes[option.value]}`}
                  style={{
                    fontSize: option.value === 'small' ? '1.25rem' : option.value === 'medium' ? '1.75rem' : '2.25rem',
                  }}
                >
                  {option.preview}
                </div>
                <div className="text-center">
                  <p className={`font-700 text-sm ${isActive ? 'text-primary' : 'text-foreground'}`}>
                    {option.label}
                    {option.value === 'medium' && (
                      <span className="ml-1.5 text-xs font-500 text-muted-foreground">(Default)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{option.description}</p>
                </div>
              </button>
            );
          })}
        </div>
        {/* Live preview */}
        <div className="mt-5 p-4 rounded-xl bg-secondary/60 border border-border">
          <p className="section-label mb-2">Live Preview</p>
          <p className="font-700 text-foreground" style={{ fontSize: 'var(--fs-lg, 1.125rem)' }}>
            Student Progress Report — Arjun Mehta
          </p>
          <p className="text-muted-foreground mt-1" style={{ fontSize: 'var(--fs-sm, 0.875rem)' }}>
            Grade 9 · Age 14 · 8 sessions completed · Average score: 74
          </p>
          <p className="text-foreground/70 mt-2 leading-relaxed" style={{ fontSize: 'var(--fs-base, 0.9375rem)' }}>
            This student demonstrates strong conceptual understanding and is showing consistent improvement
            across all five observation areas.
          </p>
        </div>
      </div>

      {/* Theme Section */}
      <div className="card-elevated p-6 mb-5">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
            <Icon name="SwatchIcon" size={18} className="text-accent-foreground" />
          </div>
          <div>
            <h2 className="font-700 text-foreground text-base">App Theme</h2>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Choose the color theme for the whole app. Changes apply instantly and are saved for your next visit.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { value: 'light' as const, label: 'Light', description: 'Bright, clean — ink & slate', swatch: ['#16212C', '#5C798E'] },
            { value: 'dark' as const, label: 'Dark', description: 'Deep charcoal with a teal accent', swatch: ['#F3F1EC', '#2DD4BF'] },
          ]).map((option) => {
            const isActive = theme === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={`relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-150 text-left ${
                  isActive
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-secondary/50'
                }`}
                aria-pressed={isActive}
                aria-label={`Set theme to ${option.label}`}
              >
                {isActive && (
                  <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Icon name="CheckIcon" size={11} className="text-white" />
                  </div>
                )}
                <div className="flex -space-x-2">
                  <div className="w-7 h-7 rounded-full border-2 border-card" style={{ backgroundColor: option.swatch[0] }} />
                  <div className="w-7 h-7 rounded-full border-2 border-card" style={{ backgroundColor: option.swatch[1] }} />
                </div>
                <div className="text-center">
                  <p className={`font-700 text-sm ${isActive ? 'text-primary' : 'text-foreground'}`}>
                    {option.label}
                    {option.value === 'light' && (
                      <span className="ml-1.5 text-xs font-500 text-muted-foreground">(Default)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{option.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}