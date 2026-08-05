'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type FontSize = 'small' | 'medium' | 'large';

interface FontSizeContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

const FontSizeContext = createContext<FontSizeContextType>({
  fontSize: 'medium',
  setFontSize: () => {},
});

export const useFontSize = () => useContext(FontSizeContext);

const FONT_SIZE_KEY = 'luminar_font_size';

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

function applyFontSize(size: FontSize) {
  const vars = FONT_SIZE_VARS[size];
  const root = document.documentElement;
  root.style.setProperty('--fs-base', vars.base);
  root.style.setProperty('--fs-sm', vars.sm);
  root.style.setProperty('--fs-xs', vars.xs);
  root.style.setProperty('--fs-lg', vars.lg);
  root.style.setProperty('--fs-xl', vars.xl);
  root.style.setProperty('--fs-2xl', vars['2xl']);
  root.setAttribute('data-font-size', size);
}

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>('medium');

  useEffect(() => {
    const stored = (typeof window !== 'undefined' ? localStorage.getItem(FONT_SIZE_KEY) : null) as FontSize | null;
    const initial: FontSize = stored && ['small', 'medium', 'large'].includes(stored) ? stored : 'medium';
    setFontSizeState(initial);
    applyFontSize(initial);
  }, []);

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem(FONT_SIZE_KEY, size);
    applyFontSize(size);
  };

  return (
    <FontSizeContext.Provider value={{ fontSize, setFontSize }}>
      {children}
    </FontSizeContext.Provider>
  );
}
