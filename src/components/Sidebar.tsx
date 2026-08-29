'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import GlobalSearch from '@/components/GlobalSearch';

interface SubItem {
  label: string;
  tab: string;
  icon: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: string[];
  children?: SubItem[];
}

const NAV_ITEMS: NavItem[] = [
  // Mentor-only
  {
    label: 'Mentor Dashboard', href: '/student-dashboard', icon: 'UserGroupIcon', roles: ['mentor'],
    children: [
      { label: 'Student Roster', tab: 'roster', icon: 'UserGroupIcon' },
      { label: 'Attendance', tab: 'attendance', icon: 'CalendarDaysIcon' },
      { label: 'Calendar', tab: 'calendar', icon: 'CalendarIcon' },
      { label: 'Reflections', tab: 'reflections', icon: 'PencilSquareIcon' },
      { label: 'Surveys', tab: 'surveys', icon: 'LinkIcon' },
      { label: 'Tasks', tab: 'tasks', icon: 'ClipboardDocumentListIcon' },
      { label: 'Parent Queries', tab: 'parent-queries', icon: 'ChatBubbleLeftRightIcon' },
      { label: 'Parent Activities', tab: 'parent-activities', icon: 'SparklesIcon' },
      { label: 'Programs & Events', tab: 'programs', icon: 'MegaphoneIcon' },
      { label: 'Suggestion Portal', tab: 'suggestions', icon: 'ChatBubbleLeftEllipsisIcon' },
    ],
  },
  { label: 'New Session', href: '/new-session', icon: 'PlusCircleIcon', roles: ['mentor'] },
  { label: 'Analysis', href: '/student-analysis-history', icon: 'ChartBarIcon', roles: ['mentor'] },
  // Student-only
  {
    label: 'Student Dashboard', href: '/student-parent-dashboard', icon: 'AcademicCapIcon', roles: ['student'],
    children: [
      { label: 'My Quest', tab: 'overview', icon: 'SparklesIcon' },
      { label: 'My Tasks', tab: 'tasks', icon: 'ClipboardDocumentListIcon' },
      { label: 'Surveys', tab: 'surveys', icon: 'LinkIcon' },
      { label: 'Calendar', tab: 'calendar', icon: 'CalendarDaysIcon' },
      { label: 'Report Card', tab: 'report', icon: 'DocumentTextIcon' },
      { label: 'Mentor Feedback', tab: 'feedback', icon: 'StarIcon' },
      { label: 'Programs & Events', tab: 'programs', icon: 'MegaphoneIcon' },
      { label: 'Suggestion Portal', tab: 'suggestions', icon: 'ChatBubbleLeftEllipsisIcon' },
    ],
  },
  // Counselor-only
  {
    label: 'Counselor Dashboard', href: '/counselor-dashboard', icon: 'ShieldCheckIcon', roles: ['counselor'],
    children: [
      { label: 'Overview', tab: 'overview', icon: 'ChartBarIcon' },
      { label: 'Mentor Directory', tab: 'mentors', icon: 'AcademicCapIcon' },
      { label: 'Student Directory', tab: 'students', icon: 'UserGroupIcon' },
      { label: 'Invite Codes', tab: 'invites', icon: 'KeyIcon' },
      { label: 'Programs & Events', tab: 'programs', icon: 'MegaphoneIcon' },
      { label: 'Suggestion Portal', tab: 'suggestions', icon: 'ChatBubbleLeftEllipsisIcon' },
    ],
  },
  // School-only
  {
    label: 'School Dashboard', href: '/school-dashboard', icon: 'BuildingLibraryIcon', roles: ['school'],
    children: [
      { label: 'Institutional Overview', tab: 'overview', icon: 'ChartBarIcon' },
      { label: 'Student Directory', tab: 'students', icon: 'UserGroupIcon' },
      { label: 'Mentor Directory', tab: 'mentors', icon: 'AcademicCapIcon' },
      { label: 'Invite Codes', tab: 'invites', icon: 'KeyIcon' },
      { label: 'School Calendar', tab: 'calendar', icon: 'CalendarDaysIcon' },
      { label: 'Programs & Events', tab: 'programs', icon: 'MegaphoneIcon' },
      { label: 'Suggestion Portal', tab: 'suggestions', icon: 'ChatBubbleLeftEllipsisIcon' },
    ],
  },
  // Parent-only
  {
    label: 'Parent Hub', href: '/parents-hub', icon: 'HomeIcon', roles: ['parent'],
    children: [
      { label: "Child's Overview", tab: 'overview', icon: 'HomeIcon' },
      { label: 'Mentor Overview', tab: 'mentor', icon: 'AcademicCapIcon' },
      { label: 'Action Center', tab: 'action', icon: 'ChatBubbleLeftRightIcon' },
      { label: 'Activities', tab: 'activities', icon: 'SparklesIcon' },
      { label: 'Programs & Events', tab: 'programs', icon: 'MegaphoneIcon' },
      { label: 'Suggestion Portal', tab: 'suggestions', icon: 'ChatBubbleLeftEllipsisIcon' },
      { label: 'Leaderboard', tab: 'leaderboard', icon: 'TrophyIcon' },
    ],
  },
  // Admin-only
  {
    label: 'Admin Dashboard', href: '/admin-dashboard', icon: 'ShieldExclamationIcon', roles: ['admin'],
    children: [
      { label: 'Overview', tab: 'overview', icon: 'ChartBarIcon' },
      { label: 'Schools', tab: 'schools', icon: 'BuildingLibraryIcon' },
      { label: 'All Mentors', tab: 'mentors', icon: 'AcademicCapIcon' },
      { label: 'All Students', tab: 'students', icon: 'UserGroupIcon' },
      { label: 'Link a School', tab: 'link', icon: 'LinkIcon' },
      { label: 'Programs & Events', tab: 'programs', icon: 'MegaphoneIcon' },
      { label: 'Suggestion Portal', tab: 'suggestions', icon: 'ChatBubbleLeftEllipsisIcon' },
    ],
  },
  // All roles
  { label: 'Network & Links', href: '/network-links', icon: 'LinkIcon', roles: ['mentor', 'student', 'counselor', 'school', 'parent', 'admin'] },
  { label: 'Settings', href: '/settings', icon: 'Cog6ToothIcon', roles: ['mentor', 'student', 'counselor', 'school', 'parent', 'admin'] },
];

const ROLE_LABELS: Record<string, string> = {
  mentor: 'Mentor Portal',
  student_parent: 'Student Portal',
  counselor: 'Counselor Portal',
  school: 'School Portal',
  parent: 'Parent Portal',
  admin: 'Admin Portal',
};

const ROLE_ICONS: Record<string, string> = {
  mentor: 'AcademicCapIcon',
  student_parent: 'UserGroupIcon',
  counselor: 'ShieldCheckIcon',
  school: 'BuildingLibraryIcon',
  parent: 'HomeIcon',
  admin: 'ShieldExclamationIcon',
};

const HELPLINES: { number: string; label: string; desc: string }[] = [
  { number: '100 / 112', label: 'Police', desc: "Call if there's any danger, crime, or emergency" },
  { number: '1930', label: 'Cybercrime', desc: 'Call if someone is bullying, threatening, or tricking you online' },
  { number: '1098', label: 'Child Helpline', desc: 'Call if a child needs help or is in danger' },
  { number: '14416', label: 'Mental Health (Tele-MANAS)', desc: "Free, private call if you're feeling stressed, sad, or just need to talk" },
  { number: '1800-599-0019', label: 'Mental Health (KIRAN)', desc: 'Another free helpline for mental health support' },
  { number: '181', label: "Women's Helpline", desc: 'Call if a woman is in an unsafe or difficult situation' },
  { number: '101', label: 'Fire', desc: "Call if there's a fire" },
  { number: '102', label: 'Ambulance', desc: 'Call if someone needs urgent medical help' },
];

// ─── Extracted as a top-level component to prevent setState-during-render ─────
interface SidebarContentProps {
  mobile?: boolean;
  collapsed: boolean;
  profile: any;
  role: string;
  visibleItems: NavItem[];
  pathname: string;
  signingOut: boolean;
  expandedHref: string | null;
  onToggleExpand: (href: string) => void;
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
  expandedHref,
  onToggleExpand,
  onCollapse,
  onMobileClose,
  onSignOut,
}: SidebarContentProps) {
  const [helplinesOpen, setHelplinesOpen] = useState(false);

  return (
    <div className={`flex flex-col h-full ${mobile ? 'p-4' : 'p-3'} overflow-y-auto`}>
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
          const isExpanded = expandedHref === item.href;
          const hasChildren = item.children && item.children.length > 0;

          return (
            <div key={item.href}>
              <div
                className={`flex items-center gap-1 rounded-xl text-sm font-600 transition-all duration-150 group relative ${
                  isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Link
                  href={item.href}
                  onClick={onMobileClose}
                  title={collapsed && !mobile ? item.label : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 flex-1 min-w-0 ${collapsed && !mobile ? 'justify-center' : ''}`}
                >
                  <Icon
                    name={item.icon as any}
                    size={18}
                    variant={isActive ? 'solid' : 'outline'}
                    className="flex-shrink-0"
                  />
                  {(!collapsed || mobile) && <span className="truncate">{item.label}</span>}
                </Link>
                {hasChildren && (!collapsed || mobile) && (
                  <button
                    onClick={() => onToggleExpand(item.href)}
                    className="p-2.5 flex-shrink-0"
                    aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
                  >
                    <Icon name="ChevronDownIcon" size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                )}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                )}
              </div>

              {hasChildren && isExpanded && (!collapsed || mobile) && (
                <div className="flex flex-col gap-0.5 ml-6 mt-1 mb-1 border-l border-border pl-3">
                  {item.children!.map((sub) => (
                    <Link
                      key={sub.tab}
                      href={`${item.href}?tab=${sub.tab}`}
                      onClick={onMobileClose}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-500 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    >
                      <Icon name={sub.icon as any} size={14} className="flex-shrink-0" />
                      <span className="truncate">{sub.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Helpline Numbers */}
      {(!collapsed || mobile) && (
        <div className="mt-2 pt-3 border-t border-border">
          <button
            onClick={() => setHelplinesOpen(!helplinesOpen)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-600 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
          >
            <Icon name="PhoneIcon" size={18} className="flex-shrink-0 text-negative" />
            <span className="flex-1 text-left">Helpline Numbers</span>
            <Icon name="ChevronDownIcon" size={14} className={`transition-transform ${helplinesOpen ? 'rotate-180' : ''}`} />
          </button>
          {helplinesOpen && (
            <div className="flex flex-col gap-2 ml-2 mt-1 mb-1 border-l border-border pl-3">
              {HELPLINES.map((h) => (
                <div key={h.number} className="py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-700 text-foreground">{h.number}</span>
                    <span className="text-xs font-600 text-primary">{h.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5">{h.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
  const [expandedHref, setExpandedHref] = useState<string | null>(null);

  const role = profile?.role || 'mentor';
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  // Auto-expand whichever dashboard section the user is currently on
  useEffect(() => {
    const current = visibleItems.find((item) => item.children && (pathname === item.href || pathname.startsWith(item.href + '/')));
    if (current) setExpandedHref(current.href);
  }, [pathname]);

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
    expandedHref,
    onToggleExpand: (href: string) => setExpandedHref((prev) => (prev === href ? null : href)),
    onCollapse: () => setCollapsed(!collapsed),
    onMobileClose: () => setMobileOpen(false),
    onSignOut: handleSignOut,
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col fixed left-0 top-0 h-screen bg-card border-r border-border z-40 transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-64'
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
          <div className="md:hidden fixed top-0 left-0 h-full w-72 z-50 bg-card border-r border-border shadow-xl animate-fade-in overflow-y-auto">
            <SidebarContent {...sharedProps} mobile />
          </div>
        </>
      )}
    </>
  );
}