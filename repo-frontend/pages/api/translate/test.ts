import type { NextApiRequest, NextApiResponse } from 'next'

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN
const MODEL_VERSION = process.env.TRANSLATION_MODEL || ''

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') { res.status(405).end(); return }
  if (!REPLICATE_TOKEN) { res.status(500).json({ error: 'REPLICATE_API_TOKEN 未配置' }); return }
  if (!MODEL_VERSION) { res.status(400).json({ error: 'TRANSLATION_MODEL 未配置（应为 Replicate 模型 version）' }); return }

  const { text, source_lang = 'zh', target_lang = 'en', timeout_ms = 60000 } = req.body || {}
  if (!text || typeof text !== 'string') { res.status(400).json({ error: '缺少 text' }); return }
  if (source_lang === target_lang) { res.status(400).json({ error: '源语言与目标语言不能相同' }); return }

  try {
    const create = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input: {
          // 针对指令模型：提供明确系统提示，仅翻译不改意；对 NLLB 这类模型请按其 input 结构调整
          prompt: `Translate the following text from ${source_lang} to ${target_lang}. Only return the translation.\n\nText:\n${text}`,
          text: text,
          source_lang,
          target_lang,
        }
      })
    })

    if (!create.ok) {
      const err = await create.text()
      res.status(create.status).json({ error: `Replicate create failed: ${err}` })
      return
    }
    const created = await create.json() as any
    const id = created.id

    const started = Date.now()
    while (true) {
      const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
        headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` }
      })
      const data = await r.json() as any
      if (data.status === 'succeeded') {
        res.status(200).json({ ok: true, id, output: data.output })
        return
      }
      if (data.status === 'failed' || data.status === 'canceled') {
        res.status(500).json({ error: `Replicate status=${data.status}`, logs: data.logs })
        return
      }
      if (Date.now() - started > timeout_ms) {
        res.status(504).json({ error: 'Replicate 超时', id })
        return
      }
      await new Promise(r => setTimeout(r, 1500))
    }
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) })
  }
}
