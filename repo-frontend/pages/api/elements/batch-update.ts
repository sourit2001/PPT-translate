import type { NextApiRequest, NextApiResponse } from 'next'
import { data } from '../../../lib/data'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') { res.status(405).end(); return }
  const { projectId, items } = req.body || {}
  if (!projectId || !Array.isArray(items)) { res.status(400).json({ error: '缺少 projectId 或 items' }); return }

  const project = data.projects.get(projectId)
  if (!project) { res.status(404).json({ error: '项目不存在' }); return }

  let updated = 0
  for (const it of items) {
    if (!it || typeof it.id !== 'string' || typeof it.translated_text !== 'string') continue
    const el = project.elements[it.id]
    if (el) {
      el.translated_text = it.translated_text
      updated++
    }
  }

  if (updated > 0) data.saveProjects()
  res.status(200).json({ ok: true, updated })
}
