import type { NextApiRequest, NextApiResponse } from 'next'
import { data } from '../../../lib/data'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') { res.status(405).end(); return }
  const { id, translated_text, projectId } = req.body || {}
  if (!id || typeof translated_text !== 'string' || !projectId) { res.status(400).json({ error: '缺少 id / translated_text / projectId' }); return }

  const project = data.projects.get(projectId)
  if (!project) { res.status(404).json({ error: '项目不存在' }); return }

  const el = project.elements[id]
  if (!el) { res.status(404).json({ error: '元素不存在' }); return }

  el.translated_text = translated_text
  data.saveProjects()
  res.status(200).json({ ok: true })
}
