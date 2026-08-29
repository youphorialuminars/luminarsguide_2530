import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Route → allowed roles mapping
const ROLE_ROUTES: Record<string, string[]> = {
  '/student-dashboard': ['mentor'],
  '/new-session': ['mentor'],
  '/student-analysis-history': ['mentor'],
  '/student-parent-dashboard': ['student_parent', 'student'],
  '/parents-hub': ['parent'],
  '/counselor-dashboard': ['counselor'],
  '/counselor-student-view': ['counselor'],
  '/school-dashboard': ['school'],
  '/school-student-view': ['school'],
  '/school-mentor-view': ['school'],
  '/admin-dashboard': ['admin'],
};

const ROLE_HOME: Record<string, string> = {
  mentor: '/student-dashboard',
  student_parent: '/student-parent-dashboard',
  student: '/student-parent-dashboard',
  parent: '/parents-hub',
  counselor: '/counselor-dashboard',
  school: '/school-dashboard',
  admin: '/admin-dashboard',
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth pages, API routes, static files
  if (
    pathname.startsWith('/sign-up-login') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/assets') ||
    pathname === '/'
  ) {
    return NextResponse.next();
  }

  // Confirm a real, server-verified login session exists — not just the
  // app's own cookie stating a role, which anyone can edit in their browser.
  let response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/sign-up-login', request.url));
  }

  // Read role from cookie set at login
  const roleCookie = request.cookies.get('luminar_role')?.value;

  // If no role cookie, redirect to login
  if (!roleCookie) {
    const loginUrl = new URL('/sign-up-login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Check if this route has role restrictions
  const matchedRoute = Object.keys(ROLE_ROUTES).find((route) =>
    pathname.startsWith(route)
  );

  if (matchedRoute) {
    const allowedRoles = ROLE_ROUTES[matchedRoute];
    if (!allowedRoles.includes(roleCookie)) {
      // Redirect to their home dashboard
      const homeRoute = ROLE_HOME[roleCookie] || '/sign-up-login';
      return NextResponse.redirect(new URL(homeRoute, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/student-dashboard/:path*',
    '/new-session/:path*',
    '/student-analysis-history/:path*',
    '/student-parent-dashboard/:path*',
    '/parents-hub/:path*',
    '/counselor-dashboard/:path*',
    '/counselor-student-view/:path*',
    '/school-dashboard/:path*',
    '/school-student-view/:path*',
    '/school-mentor-view/:path*',
    '/admin-dashboard/:path*',
    '/network-links/:path*',
    '/settings/:path*',
  ],
};