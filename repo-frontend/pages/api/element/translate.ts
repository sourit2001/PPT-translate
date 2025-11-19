import type { NextApiRequest, NextApiResponse } from 'next'
import { data } from '../../../lib/data'

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') { res.status(405).end(); return }
  const { id, projectId } = req.body || {}
  if (!id) { res.status(400).json({ error: '缺少元素 id' }); return }
  if (!projectId) { res.status(400).json({ error: '缺少 projectId' }); return }
  if (!REPLICATE_TOKEN) { res.status(500).json({ error: 'REPLICATE_API_TOKEN 未配置' }); return }

  const project = data.projects.get(projectId)
  if (!project) { res.status(404).json({ error: '项目不存在' }); return }
  const element = project.elements[id]
  if (!project || !element) { res.status(404).json({ error: '元素不存在' }); return }

  const text = element.source_text
  const source_lang = project.source_lang === 'zh' ? 'Chinese' : 'English'
  const target_lang = project.target_lang === 'zh' ? 'Chinese' : 'English'

  try {
    // 使用 Replicate 上的 GPT-5，添加重试逻辑
    const prompt = `Translate the following text from ${source_lang} to ${target_lang}. Only output the translation, nothing else.\n\n${text}`
    
    let runRes
    let retries = 3
    while (retries > 0) {
      try {
        runRes = await fetch('https://api.replicate.com/v1/models/openai/gpt-5/predictions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${REPLICATE_TOKEN}`,
            'Content-Type': 'application/json',
            'Prefer': 'wait'
          },
          body: JSON.stringify({
            input: {
              prompt: prompt,
              max_tokens: 512,
              temperature: 0.3,
            }
          }),
          signal: AbortSignal.timeout(30000) // 30秒超时
        })
        break
      } catch (e: any) {
        retries--
        if (retries === 0) throw e
        console.log(`Replicate API 连接失败，重试... (剩余 ${retries} 次)`)
        await new Promise(r => setTimeout(r, 2000))
      }
    }
    
    if (!runRes) {
      throw new Error('无法连接到 Replicate API')
    }
    
    if (!runRes.ok) {
      const err = await runRes.text()
      console.error('Replicate API error:', runRes.status, err)
      res.status(runRes.status).json({ error: `翻译 API 错误 (${runRes.status})`, detail: err })
      return
    }
    
    const result = await runRes.json() as any
    
    if (result.status === 'succeeded') {
      const output = Array.isArray(result.output) ? result.output.join('') : (result.output ?? '')
      const translated = typeof output === 'string' ? output.trim() : String(output).trim()
      
      element.translated_text = translated
      console.log(`✓ 翻译: ${element.id} -> "${translated.substring(0, 30)}"`)
      
      data.saveProjects()
      res.status(200).json({ ok: true, translated_text: element.translated_text })
      return
    } else if (result.status === 'failed') {
      res.status(500).json({ error: `翻译失败: ${result.error}` })
      return
    } else {
      // 如果还在处理中，需要轮询
      const predId = result.id
      const started = Date.now()
      
      while (true) {
        await new Promise(r => setTimeout(r, 1500))
        
        const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predId}`, {
          headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` }
        })
        const pollData = await pollRes.json() as any
        
        if (pollData.status === 'succeeded') {
          const output = Array.isArray(pollData.output) ? pollData.output.join('') : (pollData.output ?? '')
          element.translated_text = typeof output === 'string' ? output.trim() : String(output).trim()
          data.saveProjects()
          res.status(200).json({ ok: true, translated_text: element.translated_text })
          return
        }
        
        if (pollData.status === 'failed' || pollData.status === 'canceled') {
          res.status(500).json({ error: `翻译失败: ${pollData.error || pollData.status}` })
          return
        }
        
        if (Date.now() - started > 60000) {
          res.status(504).json({ error: '翻译超时' })
          return
        }
      }
    }
  } catch (e: any) {
    console.error('翻译异常:', e)
    res.status(500).json({ error: e?.message || String(e) })
  }
}
