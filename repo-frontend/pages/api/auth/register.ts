import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import { db, User } from '../../../lib/store'
import { setSessionForEmail } from '../../../lib/session'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }
  const { email, password } = req.body || {}
  if (!email || !password) {
    res.status(400).json({ error: '缺少 email 或 password' })
    return
  }
  const exists = db.findUserByEmail(email)
  if (exists) {
    res.status(409).json({ error: '邮箱已存在' })
    return
  }
  const passwordHash = bcrypt.hashSync(password, 10)
  const user: User = { email, passwordHash, createdAt: Date.now() }
  db.createUser(user)
  setSessionForEmail(res, email)
  res.status(200).json({ ok: true })
}
