import type { NextApiRequest, NextApiResponse } from 'next'
import { getEmailFromSession } from '../../lib/session'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'
import { data } from '../../lib/data'
import { parsePptxToProject } from '../../lib/parsePptx'
import { generatePreviews } from '../../lib/generatePreviews'

export const config = { api: { bodyParser: false } }

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') { res.status(405).end(); return }
  const email = getEmailFromSession(req)
  if (!email) { res.status(401).json({ error: '未登录' }); return }

  const maxMb = Number(process.env.MAX_UPLOAD_MB || 20)
  const form = formidable({ multiples: false, maxFileSize: maxMb * 1024 * 1024 })
  form.parse(req, async (err: any, fields: any, files: any) => {
    if (err) { res.status(400).json({ error: `解析上传失败: ${err?.message || err}` }); return }
    let file: any = (files as any).file
    if (Array.isArray(file)) file = file[0]
    if (!file) {
      // 尝试取第一个字段作为文件
      const keys = Object.keys(files || {})
      if (keys.length > 0) {
        const v: any = (files as any)[keys[0]]
        file = Array.isArray(v) ? v[0] : v
      }
    }
    const source_lang = String(fields?.source_lang ?? '')
    const target_lang = String(fields?.target_lang ?? '')
    if (!file) { res.status(400).json({ error: '缺少文件字段，表单键名应为 file' }); return }
    if (!['zh','en'].includes(source_lang) || !['zh','en'].includes(target_lang) || source_lang === target_lang) {
      res.status(400).json({ error: '语言设置不正确' }); return
    }
    const name = String(file.originalFilename || '')
    const mime = String((file as any).mimetype || '')
    const extOk = /\.pptx$/i.test(name)
    const mimeOk = /presentationml\.presentation/i.test(mime)
    if (!extOk && !mimeOk) { res.status(400).json({ error: `仅支持 .pptx 文件（收到: name=${name} mime=${mime||'未知'}）` }); return }
    const size = Number((file as any).size || 0)
    if (size > maxMb * 1024 * 1024) { res.status(400).json({ error: `文件超过上限 ${maxMb}MB（收到 ${(size/1024/1024).toFixed(2)}MB）` }); return }
    const buf = await fs.promises.readFile(file.filepath)
    let projBare
    try {
      projBare = parsePptxToProject(buf as any, name || 'upload.pptx')
    } catch (e: any) {
      res.status(400).json({ error: '无法解析为 PPTX，请确认文件未损坏或格式正确' });
      return
    }
    const id = `p_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const project = { id, filename: projBare.filename, source_lang: source_lang as any, target_lang: target_lang as any, slides: projBare.slides, elements: projBare.elements, createdAt: Date.now() }
    data.projects.set(id, project)
    data.saveProjects()
    const dir = path.join(process.cwd(), '.data', 'originals')
    await fs.promises.mkdir(dir, { recursive: true })
    const pptxPath = path.join(dir, `${id}.pptx`)
    await fs.promises.writeFile(pptxPath, buf as any)
    
    // 生成原文预览图（同步等待，确保用户跳转时预览已就绪）
    const previewDir = path.join(process.cwd(), '.data', 'previews', id)
    try {
      const count = await generatePreviews(pptxPath, previewDir)
      console.log(`✓ 项目 ${id} 已生成 ${count} 张原文预览图`)
    } catch (e) {
      console.error(`生成预览图失败 (project ${id}):`, e)
      // 预览生成失败不影响上传成功，继续返回
    }
    
    res.status(200).json({ ok: true, projectId: id })
  })
}
