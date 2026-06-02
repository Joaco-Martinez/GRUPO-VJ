// middleware.ts

import { NextRequest, NextResponse } from 'next/server';

type JwtPayload = {
  role?: string;
  user?: {
    role?: string;
  };
  exp?: number;
};

function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);

    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getUserRole(req: NextRequest) {
  const token = req.cookies.get('token')?.value;

  if (!token) return null;

  const payload = decodeJwt(token);

  if (!payload) return null;

  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    return null;
  }

  return payload.role || payload.user?.role || null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublicRoute =
    pathname === '/login' ||
    pathname.startsWith('/tienda');

  if (isPublicRoute) {
    const role = getUserRole(req);
    const isAdminOrEmployee = role === 'ADMIN' || role === 'EMPLEADO';

    if (pathname === '/login' && isAdminOrEmployee) {
      const dashboardUrl = req.nextUrl.clone();
      dashboardUrl.pathname = '/dashboard';
      return NextResponse.redirect(dashboardUrl);
    }

    return NextResponse.next();
  }

  const role = getUserRole(req);
  const isAdminOrEmployee = role === 'ADMIN' || role === 'EMPLEADO';

  if (!isAdminOrEmployee) {
    const redirectUrl = req.nextUrl.clone();

    if (role === 'CLIENTE') {
      redirectUrl.pathname = '/tienda';
      return NextResponse.redirect(redirectUrl);
    }

    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', pathname);

    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|txt|xml|webmanifest)$).*)',
  ],
};