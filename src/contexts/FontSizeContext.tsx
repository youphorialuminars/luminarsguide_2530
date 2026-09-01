'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type FontSize = 'small' | 'medium' | 'large';
export type ThemeName = 'light' | 'dark';

interface FontSizeContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

const FontSizeContext = createContext<FontSizeContextType>({
  fontSize: 'medium',
  setFontSize: () => {},
  theme: 'light',
  setTheme: () => {},
});

export const useFontSize = () => useContext(FontSizeContext);
export const useTheme = () => useContext(FontSizeContext);

const FONT_SIZE_KEY = 'luminar_font_size';
const THEME_KEY = 'luminar_theme';

export const FAVICON_LIGHT = 'https://ldkwhimqenxkloibhwzt.supabase.co/storage/v1/object/public/Branding/faviconlight.png';
export const FAVICON_DARK = 'https://ldkwhimqenxkloibhwzt.supabase.co/storage/v1/object/public/Branding/favicondark.png';

const FONT_SIZE_VARS: Record<FontSize, { base: string; sm: string; xs: string; lg: string; xl: string; '2xl': string }> = {
  small: {
    base: '0.875rem',
    sm: '0.8125rem',
    xs: '0.6875rem',
    lg: '1rem',
    xl: '1.125rem',
    '2xl': '1.25rem',
  },
  medium: {
    base: '0.9375rem',
    sm: '0.875rem',
    xs: '0.75rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
  },
  large: {
    base: '1.0625rem',
    sm: '1rem',
    xs: '0.875rem',
    lg: '1.25rem',
    xl: '1.5rem',
    '2xl': '1.75rem',
  },
};

const ROOT_FONT_SIZE: Record<FontSize, string> = {
  small: '14px',
  medium: '15px',
  large: '17px',
};

const THEME_CLASS: Record<ThemeName, string | null> = {
  light: null,
  dark: 'theme-dark',
};

function applyFontSize(size: FontSize) {
  const vars = FONT_SIZE_VARS[size];
  const root = document.documentElement;
  root.style.setProperty('--fs-base', vars.base);
  root.style.setProperty('--fs-sm', vars.sm);
  root.style.setProperty('--fs-xs', vars.xs);
  root.style.setProperty('--fs-lg', vars.lg);
  root.style.setProperty('--fs-2xl', vars['2xl']);
  root.style.setProperty('--fs-xl', vars.xl);
  root.setAttribute('data-font-size', size);
  root.style.fontSize = ROOT_FONT_SIZE[size];
  document.body.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
  document.body.classList.add(`font-size-${size}`);
}

function applyTheme(theme: ThemeName) {
  const root = document.documentElement;
  root.classList.remove('theme-dark');
  const className = THEME_CLASS[theme];
  if (className) root.classList.add(className);
  root.setAttribute('data-theme', theme);

  const fav = document.getElementById('app-favicon') as HTMLLinkElement | null;
  if (fav) {
    fav.href = theme === 'dark' ? FAVICON_DARK : FAVICON_LIGHT;
  }
}

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>('medium');
  const [theme, setThemeState] = useState<ThemeName>('light');

  useEffect(() => {
    const storedSize = (typeof window !== 'undefined' ? localStorage.getItem(FONT_SIZE_KEY) : null) as FontSize | null;
    const initialSize: FontSize = storedSize && ['small', 'medium', 'large'].includes(storedSize) ? storedSize : 'medium';
    setFontSizeState(initialSize);
    applyFontSize(initialSize);

    const storedTheme = (typeof window !== 'undefined' ? localStorage.getItem(THEME_KEY) : null) as ThemeName | null;
    const initialTheme: ThemeName = storedTheme && ['light', 'dark'].includes(storedTheme) ? storedTheme : 'light';
    setThemeState(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem(FONT_SIZE_KEY, size);
    applyFontSize(size);
  };

  const setTheme = (theme: ThemeName) => {
    setThemeState(theme);
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
  };

  return (
    <FontSizeContext.Provider value={{ fontSize, setFontSize, theme, setTheme }}>
      {children}
    </FontSizeContext.Provider>
  );
}