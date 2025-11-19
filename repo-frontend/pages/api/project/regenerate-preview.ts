import type { NextApiRequest, NextApiResponse } from 'next'
import { data } from '../../../lib/data'
import { updatePptxWithTranslations } from '../../../lib/updatePptx'
import { generatePreviews } from '../../../lib/generatePreviews'
import path from 'path'
import fs from 'fs'
import type { Project } from '../../../lib/data'

/**
 * 重新生成翻译后的预览图
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }

  const { projectId } = req.body || {}
  if (!projectId) {
    res.status(400).json({ error: '缺少 projectId' })
    return
  }

  // 重要：从文件重新加载最新数据，避免 Next.js 热重载导致的数据不同步
  const dataFile = path.join(process.cwd(), '.data', 'projects.json')
  let project: Project | undefined
  
  try {
    const raw = await fs.promises.readFile(dataFile, 'utf-8')
    const projects = JSON.parse(raw) as Project[]
    project = projects.find(p => p.id === projectId)
    
    if (project) {
      // 同步到内存
      data.projects.set(projectId, project)
    }
  } catch (e) {
    console.error('读取项目文件失败:', e)
  }
  
  if (!project) {
    res.status(404).json({ error: '项目不存在' })
    return
  }

  // 调试：检查翻译数据
  const translatedCount = Object.values(project.elements).filter(el => el.translated_text).length
  console.log(`项目 ${projectId} 有 ${translatedCount} 个已翻译元素`)
  
  if (translatedCount > 0) {
    const sample = Object.values(project.elements).find(el => el.translated_text)
    console.log(`示例: "${sample?.source_text?.substring(0, 15)}" -> "${sample?.translated_text?.substring(0, 30)}"`)
  }

  try {
    // 1. 将译文写回 PPTX
    const translatedPptxPath = await updatePptxWithTranslations(projectId, project.elements)

    // 2. 生成翻译后的预览图
    const translatedPreviewDir = path.join(process.cwd(), '.data', 'previews-translated', projectId)
    const count = await generatePreviews(translatedPptxPath, translatedPreviewDir)

    res.status(200).json({ ok: true, count })
  } catch (e: any) {
    console.error('生成翻译预览失败:', e)
    res.status(500).json({ error: e?.message || '生成失败' })
  }
}
