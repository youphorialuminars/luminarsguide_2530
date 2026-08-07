'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import GlobalSearch from '@/components/GlobalSearch';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  // Mentor-only
  { label: 'Mentor Dashboard', href: '/student-dashboard', icon: 'UserGroupIcon', roles: ['mentor'] },
  { label: 'New Session', href: '/new-session', icon: 'PlusCircleIcon', roles: ['mentor'] },
  { label: 'Analysis', href: '/student-analysis-history', icon: 'ChartBarIcon', roles: ['mentor'] },
  // Student-only
  { label: 'Student Dashboard', href: '/student-parent-dashboard', icon: 'AcademicCapIcon', roles: ['student_parent'] },
  // Counselor-only
  { label: 'Counselor Dashboard', href: '/counselor-dashboard', icon: 'ShieldCheckIcon', roles: ['counselor'] },
  // School-only
  { label: 'School Dashboard', href: '/school-dashboard', icon: 'BuildingLibraryIcon', roles: ['school'] },
  // All roles
  { label: 'Network & Links', href: '/network-links', icon: 'LinkIcon', roles: ['mentor', 'student_parent', 'counselor', 'school'] },
  { label: 'Settings', href: '/settings', icon: 'Cog6ToothIcon', roles: ['mentor', 'student_parent', 'counselor', 'school'] },
];

const ROLE_LABELS: Record<string, string> = {
  mentor: 'Mentor Portal',
  student_parent: 'Student Portal',
  counselor: 'Counselor Portal',
  school: 'School Portal',
};

const ROLE_ICONS: Record<string, string> = {
  mentor: 'AcademicCapIcon',
  student_parent: 'UserGroupIcon',
  counselor: 'ShieldCheckIcon',
  school: 'BuildingLibraryIcon',
};

// ─── Extracted as a top-level component to prevent setState-during-render ─────
interface SidebarContentProps {
  mobile?: boolean;
  collapsed: boolean;
  profile: any;
  role: string;
  visibleItems: NavItem[];
  pathname: string;
  signingOut: boolean;
  onCollapse: () => void;
  onMobileClose: () => void;
  onSignOut: () => void;
}

function SidebarContent({
  mobile = false,
  collapsed,
  profile,
  role,
  visibleItems,
  pathname,
  signingOut,
  onCollapse,
  onMobileClose,
  onSignOut,
}: SidebarContentProps) {
  return (
    <div className={`flex flex-col h-full ${mobile ? 'p-4' : 'p-3'}`}>
      {/* Logo + Collapse */}
      <div className="flex items-center justify-between mb-6 px-1">
        <Link href="/" className="flex items-center gap-2.5 group min-w-0">
          <AppLogo size={34} />
          {(!collapsed || mobile) && (
            <span className="font-display font-700 text-base text-foreground tracking-tight truncate">
              Luminar&apos;s Guide
            </span>
          )}
        </Link>
        {!mobile && (
          <button
            onClick={onCollapse}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground flex-shrink-0"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon name={collapsed ? 'ChevronRightIcon' : 'ChevronLeftIcon'} size={16} />
          </button>
        )}
      </div>

      {/* Global Search — only when expanded */}
      {(!collapsed || mobile) && profile && (
        <div className="mb-4 px-1">
          <GlobalSearch />
        </div>
      )}

      {/* Role Badge */}
      {(!collapsed || mobile) && profile && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 mb-4">
          <Icon name={ROLE_ICONS[role] as any} size={14} className="text-primary flex-shrink-0" />
          <span className="text-xs font-600 text-primary truncate">{ROLE_LABELS[role]}</span>
        </div>
      )}

      {/* Nav Items */}
      <nav className="flex flex-col gap-1 flex-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              title={collapsed && !mobile ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-600 transition-all duration-150 group relative ${
                isActive
                  ? 'bg-primary/10 text-primary' :'text-muted-foreground hover:bg-secondary hover:text-foreground'
              } ${collapsed && !mobile ? 'justify-center' : ''}`}
            >
              <Icon
                name={item.icon as any}
                size={18}
                variant={isActive ? 'solid' : 'outline'}
                className="flex-shrink-0"
              />
              {(!collapsed || mobile) && (
                <span className="truncate">{item.label}</span>
              )}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: User info + Sign Out */}
      <div className="mt-4 pt-4 border-t border-border">
        {(!collapsed || mobile) && profile && (
          <div className="flex items-center gap-2.5 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Icon name="UserIcon" size={14} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-600 text-foreground truncate">{profile.full_name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={onSignOut}
          disabled={signingOut}
          title={collapsed && !mobile ? 'Sign Out' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-500 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all ${
            collapsed && !mobile ? 'justify-center' : ''
          }`}
        >
          <Icon name="ArrowRightOnRectangleIcon" size={18} className="flex-shrink-0" />
          {(!collapsed || mobile) && <span>{signingOut ? 'Signing out…' : 'Sign Out'}</span>}
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const role = profile?.role || 'mentor';
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.push('/sign-up-login');
    } catch {
      toast.error('Sign out failed');
    } finally {
      setSigningOut(false);
    }
  };

  const sharedProps = {
    collapsed,
    profile,
    role,
    visibleItems,
    pathname,
    signingOut,
    onCollapse: () => setCollapsed(!collapsed),
    onMobileClose: () => setMobileOpen(false),
    onSignOut: handleSignOut,
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col fixed left-0 top-0 h-screen bg-card border-r border-border z-40 transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <SidebarContent {...sharedProps} />
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-14 px-4 bg-card/90 backdrop-blur-md border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <AppLogo size={30} />
          <span className="font-display font-700 text-sm text-foreground">Luminar&apos;s Guide</span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
          aria-label="Toggle menu"
        >
          <Icon name={mobileOpen ? 'XMarkIcon' : 'Bars3Icon'} size={22} />
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="md:hidden fixed top-0 left-0 h-full w-72 z-50 bg-card border-r border-border shadow-xl animate-fade-in">
            <SidebarContent {...sharedProps} mobile />
          </div>
        </>
      )}
    </>
  );
}
