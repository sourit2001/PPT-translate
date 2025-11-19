import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import { data, type Project, type Element, type Slide } from '../../../lib/data'
import { parsePptxToProject } from '../../../lib/parsePptx'

/**
 * 重新扫描项目的原始 PPTX，合并布局/母版中的文本为元素
 * - 保留已存在元素的译文（按 source_text 对齐）
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') { res.status(405).end(); return }
  const { projectId } = req.body || {}
  if (!projectId) { res.status(400).json({ error: '缺少 projectId' }); return }

  const project = data.projects.get(projectId)
  if (!project) { res.status(404).json({ error: '项目不存在' }); return }

  try {
    const origPath = path.join(process.cwd(), '.data', 'originals', `${projectId}.pptx`)
    if (!fs.existsSync(origPath)) { res.status(404).json({ error: '找不到原始 PPTX' }); return }

    const buf = await fs.promises.readFile(origPath)
    const parsed = parsePptxToProject(buf as any, project.filename)

    // 合并：已存在译文按原文对齐保留
    const prevBySrc = new Map<string, Element>()
    for (const el of Object.values(project.elements)) {
      prevBySrc.set(el.source_text, el)
    }

    const newElements: Record<string, Element> = {}
    const newSlides: Slide[] = []

    let auto = 1
    for (const s of parsed.slides) {
      const slide: Slide = { index: s.index, elementIds: [] }
      for (const eid of s.elementIds) {
        const src = parsed.elements[eid].source_text
        const existing = prevBySrc.get(src)
        const id = `e${auto++}`
        newElements[id] = existing ? { ...existing, id, slideIndex: s.index } : {
          id,
          slideIndex: s.index,
          source_text: src,
          translated_text: ''
        }
        slide.elementIds.push(id)
      }
      newSlides.push(slide)
    }

    project.slides = newSlides
    project.elements = newElements
    data.projects.set(projectId, project)
    data.saveProjects()

    res.status(200).json({ ok: true, counts: { slides: newSlides.length, elements: Object.keys(newElements).length } })
  } catch (e: any) {
    console.error('重新扫描失败:', e)
    res.status(500).json({ error: e?.message || '重扫失败' })
  }
}
