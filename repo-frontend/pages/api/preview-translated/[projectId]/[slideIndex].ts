import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { projectId, slideIndex } = req.query
  
  if (!projectId || !slideIndex) {
    res.status(400).json({ error: '缺少参数' })
    return
  }

  const previewPath = path.join(
    process.cwd(),
    '.data',
    'previews-translated',
    String(projectId),
    `slide-${slideIndex}.png`
  )

  if (!fs.existsSync(previewPath)) {
    res.status(404).json({ error: '翻译预览图不存在' })
    return
  }

  const image = await fs.promises.readFile(previewPath)
  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.send(image)
}
