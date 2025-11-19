import { serialize, parse } from 'cookie'
import crypto from 'crypto'

const COOKIE_NAME = 'sess'
const ONE_DAY = 60 * 60 * 24

type SessionData = { email: string; iat: number }

function base64url(input: string) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function sign(data: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex')
}

function getSecret() {
  return process.env.SESSION_SECRET || 'dev-secret'
}

export function setSessionForEmail(res: any, email: string) {
  const payload: SessionData = { email, iat: Math.floor(Date.now() / 1000) }
  const body = base64url(JSON.stringify(payload))
  const sig = sign(body, getSecret())
  const token = `${body}.${sig}`
  const cookie = serialize(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: ONE_DAY * 7,
  })
  res.setHeader('Set-Cookie', cookie)
}

export function clearSessionCookie(res: any) {
  const cookie = serialize(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 0,
  })
  res.setHeader('Set-Cookie', cookie)
}

export function getEmailFromSession(req: any): string | null {
  const header = req.headers.cookie
  if (!header) return null
  const cookies = parse(header)
  const token = cookies[COOKIE_NAME]
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = sign(body, getSecret())
  if (sig !== expected) return null
  try {
    const json = Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    const data = JSON.parse(json) as SessionData
    return data.email || null
  } catch {
    return null
  }
}
