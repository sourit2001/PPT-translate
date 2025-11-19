import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import { db } from '../../../lib/store'
import { setSessionForEmail } from '../../../lib/session'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') { res.status(405).end(); return }
  const { email, password } = req.body || {}
  const user = db.users.find(u => u.email === email)
  if (!user) { res.status(401).json({ error: '邮箱或密码错误' }); return }
  const ok = bcrypt.compareSync(password || '', user.passwordHash)
  if (!ok) { res.status(401).json({ error: '邮箱或密码错误' }); return }
  setSessionForEmail(res, user.email)
  res.status(200).json({ ok: true })
}
