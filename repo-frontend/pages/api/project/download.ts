import type { NextApiRequest, NextApiResponse } from 'next'
import path from 'path'
import fs from 'fs'
import type { Project } from '../../../lib/data'
import { data } from '../../../lib/data'
import { updatePptxWithTranslations } from '../../../lib/updatePptx'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') { res.status(405).end(); return }
  const { projectId } = req.query as { projectId?: string }
  if (!projectId) { res.status(400).json({ error: '缺少 projectId' }); return }

  // 从文件重新加载最新项目数据，避免热重载导致的不同步
  const dataFile = path.join(process.cwd(), '.data', 'projects.json')
  let project: Project | undefined
  try {
    const raw = await fs.promises.readFile(dataFile, 'utf-8')
    const projects = JSON.parse(raw) as Project[]
    project = projects.find(p => p.id === projectId)
    if (project) data.projects.set(projectId, project)
  } catch (e) {
    // ignore
  }

  if (!project) { res.status(404).json({ error: '项目不存在' }); return }

  try {
    // 生成最新的翻译后 PPTX（幂等）
    const translatedPptxPath = await updatePptxWithTranslations(projectId, project.elements)

    // 校验文件
    await fs.promises.access(translatedPptxPath, fs.constants.R_OK)

    const filenameBase = path.parse(project.filename).name
    const downloadName = `${filenameBase}.translated.pptx`

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`)

    const stream = fs.createReadStream(translatedPptxPath)
    stream.on('error', (err) => {
      console.error('下载流错误:', err)
      if (!res.headersSent) res.status(500).end('下载失败')
    })
    stream.pipe(res)
  } catch (e: any) {
    console.error('生成或读取翻译 PPTX 失败:', e)
    res.status(500).json({ error: e?.message || '生成失败' })
  }
}
