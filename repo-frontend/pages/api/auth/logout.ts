import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '../../../lib/store'
import { getSessionId, clearSessionCookie } from '../../../lib/session'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const sid = getSessionId(req)
  if (sid) {
    db.sessions.delete(sid)
    clearSessionCookie(res)
  }
  res.status(302).setHeader('Location', '/').end()
}
