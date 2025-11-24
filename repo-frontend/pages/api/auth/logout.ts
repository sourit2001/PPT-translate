import type { NextApiRequest, NextApiResponse } from 'next'
import { clearSessionCookie } from '../../../lib/session'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  clearSessionCookie(res)
  res.status(302).setHeader('Location', '/').end()
}
