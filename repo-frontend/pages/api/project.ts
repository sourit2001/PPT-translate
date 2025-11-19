import type { NextApiRequest, NextApiResponse } from 'next'
import { data } from '../../lib/data'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id || '')
  const p = data.projects.get(id)
  if (!p) { res.status(404).json({ error: '项目不存在' }); return }
  res.status(200).json({ ok: true, project: p })
}
