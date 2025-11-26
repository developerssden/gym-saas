import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/', '/sign-in', '/auth/sign-in', '/unauthorized', ];

type Role = 'SUPER_ADMIN' | 'GYM_OWNER' | 'MEMBER';

type RouteGate = {
  routes: string[];
  roles: Role[];
};

const ROUTE_GATES: RouteGate[] = [
  {
    routes: ['/dashboard'],
    roles: ['SUPER_ADMIN']
  },
  {
    routes: ['/dashboard'],
    roles: ['SUPER_ADMIN', 'GYM_OWNER']
  }
];

const matchesPath = (pathname: string, route: string) => {
  if (route === '/') return pathname === '/';
  return pathname === route || pathname.startsWith(`${route}/`);
};

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some(route => matchesPath(pathname, route));

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

    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = '/sign-in';
      return NextResponse.redirect(url);
    }

    const gate = findGate(pathname);
    if (gate && !gate.roles.includes(token.role as Role)) {
      const url = req.nextUrl.clone();
      url.pathname = '/unauthorized';
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        if (isPublic(pathname)) return true;
        return !!token;
      }
    }
  }
);

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets|.*\\.svg$).*)']
};

