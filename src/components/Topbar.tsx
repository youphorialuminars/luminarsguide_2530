'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

const navItems = [
  { label: 'Dashboard', href: '/student-dashboard', icon: 'UserGroupIcon' },
  { label: 'New Session', href: '/new-session', icon: 'PlusCircleIcon' },
  { label: 'Analysis', href: '/student-analysis-history', icon: 'ChartBarIcon' },
  { label: 'Student Portal', href: '/student-parent-dashboard', icon: 'AcademicCapIcon' },
  { label: 'Counselor', href: '/counselor-dashboard', icon: 'ShieldCheckIcon' },
  { label: 'School', href: '/school-dashboard', icon: 'BuildingLibraryIcon' },
  { label: 'Settings', href: '/settings', icon: 'Cog6ToothIcon' },
] as const;

export default function Topbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/80 backdrop-blur-md">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-16 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/student-dashboard" className="flex items-center gap-2.5 group">
          <AppLogo size={36} />
          <span className="font-display font-700 text-lg text-foreground tracking-tight hidden sm:block">
            Luminar&apos;s Guide
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={`nav-${item.href}`}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-600 transition-all duration-150 ${
                  isActive
                    ? 'bg-primary/10 text-primary' :'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon name={item.icon} size={17} variant={isActive ? 'solid' : 'outline'} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary border border-border">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
              <Icon name="UserIcon" size={14} className="text-primary" />
            </div>
            <span className="text-sm font-600 text-foreground">Mentor Portal</span>
          </div>

          <Link
            href="/sign-up-login"
            className="hidden md:flex btn-ghost text-sm"
          >
            <Icon name="ArrowRightOnRectangleIcon" size={16} />
            Sign Out
          </Link>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle mobile menu"
          >
            <Icon name={mobileOpen ? 'XMarkIcon' : 'Bars3Icon'} size={22} />
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-card/95 backdrop-blur-md animate-fade-in">
          <nav className="flex flex-col gap-1 p-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={`mobile-nav-${item.href}`}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-600 transition-all ${
                    isActive
                      ? 'bg-primary/10 text-primary' :'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <Icon name={item.icon} size={18} variant={isActive ? 'solid' : 'outline'} />
                  {item.label}
                </Link>
              );
            })}
            <div className="pt-2 border-t border-border mt-2">
              <Link
                href="/sign-up-login"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-500 text-muted-foreground hover:bg-secondary"
              >
                <Icon name="ArrowRightOnRectangleIcon" size={18} />
                Sign Out
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}