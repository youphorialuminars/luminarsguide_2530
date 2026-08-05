import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Route → allowed roles mapping
const ROLE_ROUTES: Record<string, string[]> = {
  '/student-dashboard': ['mentor'],
  '/new-session': ['mentor'],
  '/student-analysis-history': ['mentor'],
  '/student-parent-dashboard': ['student_parent'],
  '/counselor-dashboard': ['counselor'],
  '/counselor-student-view': ['counselor'],
  '/school-dashboard': ['school'],
  '/school-student-view': ['school'],
  '/school-mentor-view': ['school'],
};

const ROLE_HOME: Record<string, string> = {
  mentor: '/student-dashboard',
  student_parent: '/student-parent-dashboard',
  counselor: '/counselor-dashboard',
  school: '/school-dashboard',
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/student-dashboard/:path*',
    '/new-session/:path*',
    '/student-analysis-history/:path*',
    '/student-parent-dashboard/:path*',
    '/counselor-dashboard/:path*',
    '/counselor-student-view/:path*',
    '/school-dashboard/:path*',
    '/school-student-view/:path*',
    '/school-mentor-view/:path*',
    '/network-links/:path*',
    '/settings/:path*',
  ],
};
