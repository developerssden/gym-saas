import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { firstAllowedPath, permissionsForPath } from '@/lib/staff-permissions';

const PUBLIC_PATHS = ['/', '/sign-in', '/auth/sign-in', '/unauthorized', '/onboarding', '/checkout-success'];

const PUBLIC_API_PATHS = ['/api/clients/complete-invite', '/api/webhooks/polar', '/api/registrations/create'];

const PWA_PUBLIC_PATHS = [
  '/manifest.webmanifest',
  '/sw.js',
  '/offline',
];

type Role = 'SUPER_ADMIN' | 'GYM_OWNER' | 'MEMBER' | 'STAFF';

type RouteGate = {
  routes: string[];
  roles: Role[];
};

// STAFF are additionally checked against their permissions (see below).
const ROUTE_GATES: RouteGate[] = [
  {
    routes: ['/dashboard'],
    roles: ['SUPER_ADMIN', 'GYM_OWNER', 'STAFF'],
  },
  {
    routes: ['/clients', '/subscriptions', '/plans', '/registrations'],
    roles: ['SUPER_ADMIN'],
  },
  {
    routes: ['/gyms', '/locations', '/announcements'],
    roles: ['SUPER_ADMIN', 'GYM_OWNER'],
  },
  {
    routes: ['/payments'],
    roles: ['SUPER_ADMIN', 'GYM_OWNER', 'STAFF'],
  },
  {
    routes: ['/staff', '/subscription', '/my-gym'],
    roles: ['GYM_OWNER'],
  },
  {
    routes: ['/members', '/membersubscriptions', '/equipment', '/todos', '/expenses', '/reports'],
    roles: ['GYM_OWNER', 'STAFF'],
  },
  {
    routes: ['/profile'],
    roles: ['GYM_OWNER', 'STAFF'],
  },
  {
    routes: ['/notifications'],
    roles: ['SUPER_ADMIN', 'GYM_OWNER', 'MEMBER', 'STAFF'],
  },
];

const matchesPath = (pathname: string, route: string) => {
  if (route === '/') return pathname === '/';
  return pathname === route || pathname.startsWith(`${route}/`);
};

const isPublicApi = (pathname: string) =>
  PUBLIC_API_PATHS.some(route => matchesPath(pathname, route));

const isPublic = (pathname: string) =>
  isPublicApi(pathname) ||
  PUBLIC_PATHS.some(route => matchesPath(pathname, route)) ||
  PWA_PUBLIC_PATHS.some(route => matchesPath(pathname, route)) ||
  pathname.startsWith('/icons/');

const findGate = (pathname: string) =>
  ROUTE_GATES.find(gate =>
    gate.routes.some(route => matchesPath(pathname, route))
  );

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    if (isPublic(pathname)) {
      return NextResponse.next();
    }

    const gate = findGate(pathname);
    // Only routes explicitly listed in ROUTE_GATES are protected.
    // Everything else should be accessible without authentication.
    if (!gate) {
      return NextResponse.next();
    }

    // Protected route: require auth
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = '/sign-in';
      return NextResponse.redirect(url);
    }

    if (gate && !gate.roles.includes(token.role as Role)) {
      const url = req.nextUrl.clone();
      url.pathname = '/unauthorized';
      return NextResponse.redirect(url);
    }

    // Staff: the page must be one their owner gave them.
    if (token.role === 'STAFF') {
      const needed = permissionsForPath(pathname, req.nextUrl.searchParams.get('action'));
      const granted = token.staff_permissions ?? [];
      if (needed && !needed.some(p => granted.includes(p))) {
        const url = req.nextUrl.clone();
        // Landing on a dashboard they can't see after sign-in: send them to
        // their first allowed page instead of an error.
        url.pathname = pathname === '/dashboard' ? firstAllowedPath(granted) : '/unauthorized';
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        if (isPublic(pathname)) return true;
        // Only require auth if the pathname matches a protected route.
        const gate = findGate(pathname);
        if (!gate) return true;
        return !!token;
      }
    }
  }
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets|icons|sw.js|manifest.webmanifest|.*\\.svg$).*)',
  ],
};

