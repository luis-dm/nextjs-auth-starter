import { NextRequest, NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { HttpError } from '@/backend/lib/error'

// NOTE: this implementation is akin to `@early-reflections/next-csrf`
const CSRF = {
  COOKIE_NAME: '__Host-psifi.x-csrf-token',
  HEADER_NAME: 'x-csrf-token',
  API_PATH: '/api/csrf',
  COOKIE: {
    httpOnly: false,
    secure: true,
    sameSite: 'strict',
    path: '/',
  },
}

const verifyCsrfToken = async () => {
  const cookieStore = await cookies()
  const headerStore = await headers()

  const cookieToken = cookieStore.get(CSRF.COOKIE_NAME)?.value
  const headerToken = headerStore.get(CSRF.HEADER_NAME)

  return !!cookieToken && cookieToken === headerToken
}

export async function csrfMiddleware(req: NextRequest): Promise<NextResponse> {
  const res = NextResponse.next()

  if (req.method === 'GET' || req.method === 'OPTIONS' || req.method === 'HEAD')
    return res

  const isTokenValid = await verifyCsrfToken()
  if (!isTokenValid) throw new HttpError('Invalid CSRF token', 403)

  return res
}
