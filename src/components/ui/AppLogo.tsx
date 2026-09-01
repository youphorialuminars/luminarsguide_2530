'use client';

import React, { memo, useMemo } from 'react';
import AppIcon from './AppIcon';
import AppImage from './AppImage';
import { useTheme } from '@/contexts/FontSizeContext';

interface AppLogoProps {
  src?: string; // Image source (optional) — overrides the theme-based default
  iconName?: string; // Icon name when no image
  size?: number; // Size for icon/image
  className?: string; // Additional classes
  onClick?: () => void; // Click handler
}

const LOGO_LIGHT = 'https://ldkwhimqenxkloibhwzt.supabase.co/storage/v1/object/public/Branding/logofulllight%20(1).svg';
const LOGO_DARK = 'https://ldkwhimqenxkloibhwzt.supabase.co/storage/v1/object/public/Branding/logofulldark.svg';

const AppLogo = memo(function AppLogo({
  src,
  iconName = 'SparklesIcon',
  size = 64,
  className = '',
  onClick,
}: AppLogoProps) {
  const { theme } = useTheme();

  // Use the logo that matches the active theme unless a specific src was passed in.
  const resolvedSrc = src || (theme === 'dark' ? LOGO_DARK : LOGO_LIGHT);

  const containerClassName = useMemo(() => {
    const classes = ['flex items-center'];
    if (onClick) classes.push('cursor-pointer hover:opacity-80 transition-opacity');
    if (className) classes.push(className);
    return classes.join(' ');
  }, [onClick, className]);

  return (
    <div className={containerClassName} onClick={onClick}>
      {resolvedSrc ? (
        <AppImage
          src={resolvedSrc}
          alt="Logo"
          width={Math.round(size * 3.87)}
          height={size}
          className="flex-shrink-0 object-contain"
          priority={true}
          unoptimized={resolvedSrc.endsWith('.svg')}
        />
      ) : (
        <AppIcon name={iconName} size={size} className="flex-shrink-0" />
      )}
    </div>
  );
});

export default AppLogo;