// src/middleware.ts
import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { env } from './env';

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // Define public (unauthenticated) routes
  const publicRoutes = ['/login', '/api/auth'];

  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // If user is authenticated and tries to access login, redirect to dashboard
  if (token && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // If request is for a public route, allow through
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // If unauthenticated and not accessing a public route, redirect to login
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Otherwise, allow through
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};