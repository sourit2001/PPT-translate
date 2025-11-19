import type { NextApiRequest, NextApiResponse } from 'next'
import { getEmailFromSession } from '../../../lib/session'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const email = getEmailFromSession(req)
  if (!email) { res.status(200).json({ ok: true }); return }
  res.status(200).json({ ok: true, user: { email } })
}
