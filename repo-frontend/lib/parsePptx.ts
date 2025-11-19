import AdmZip from 'adm-zip'
import { XMLParser } from 'fast-xml-parser'
import type { Slide, Element } from './data'

export function parsePptxToProject(buffer: Buffer, filename: string): { filename: string; slides: Slide[]; elements: Record<string, Element> } {
  const zip = new AdmZip(buffer)
  const entries = zip.getEntries()
  const entryTextMap = new Map<string, string>()
  for (const e of entries) entryTextMap.set(e.entryName, e.getData().toString('utf8'))

  const slideXmls: { index: number; xml: string }[] = []
  for (const e of entries) {
    // slide paths like ppt/slides/slide1.xml
    if (/^ppt\/slides\/slide(\d+)\.xml$/.test(e.entryName)) {
      const m = e.entryName.match(/slide(\d+)\.xml$/)
      const idx = m ? parseInt(m[1], 10) : 0
      slideXmls.push({ index: idx, xml: entryTextMap.get(e.entryName) || '' })
    }
  }
  slideXmls.sort((a,b)=>a.index-b.index)
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text' })

  const slides: Slide[] = []
  const elements: Record<string, Element> = {}
  let elementAutoId = 1

  for (const s of slideXmls) {
    const json = parser.parse(s.xml)
    // 我们优先按段落 (a:p) 聚合该段落内所有 a:t，避免拆成碎片
    const texts: string[] = []
    const bulletRegex = /[•●▪■◆◦·\-–—➤▶→]/g
    const punctRegex = /^[\p{P}\p{S}]+$/u
    function pushIfMeaningful(txt: string) {
      const trimmed = String(txt).replace(/[\r\n\t]+/g, ' ').trim()
      if (!trimmed) return
      const removedBullets = trimmed.replace(bulletRegex, '').trim()
      if (!removedBullets) return
      if (punctRegex.test(removedBullets)) return
      texts.push(trimmed)
    }

    // 通用：收集任意节点下的所有 a:t 文本（用于兜底和引用部件）
    function collectAT(node: any) {
      if (!node || typeof node !== 'object') return
      for (const k of Object.keys(node)) {
        const v = (node as any)[k]
        if (k.endsWith(':t') || k === 'a:t') {
          if (typeof v === 'string') pushIfMeaningful(v)
          else if (v && typeof (v as any)['#text'] === 'string') pushIfMeaningful((v as any)['#text'])
        } else if (Array.isArray(v)) {
          for (const it of v) collectAT(it)
        } else if (typeof v === 'object') {
          collectAT(v)
        }
      }
    }

    function collectParagraphs(node: any) {
      if (!node || typeof node !== 'object') return
      for (const k of Object.keys(node)) {
        const v = (node as any)[k]
        // 段落节点
        if (k.endsWith(':p') || k === 'a:p') {
          // 如果 v 是数组，说明有多个段落，分别处理
          const paragraphs = Array.isArray(v) ? v : [v]
          for (const para of paragraphs) {
            const tNodes: string[] = []
            // 递归搜集该段落下的所有 a:t 文本
            function collectT(n: any) {
              if (!n || typeof n !== 'object') return
              for (const kk of Object.keys(n)) {
                const vv = (n as any)[kk]
                if (kk.endsWith(':t') || kk === 'a:t') {
                  if (typeof vv === 'string') tNodes.push(vv)
                  else if (vv && typeof vv['#text'] === 'string') tNodes.push(vv['#text'])
                } else if (Array.isArray(vv)) {
                  for (const it of vv) collectT(it)
                } else if (typeof vv === 'object') {
                  collectT(vv)
                }
              }
            }
            collectT(para)
            if (tNodes.length) pushIfMeaningful(tNodes.join(''))
          }
        }
        // 继续遍历子节点（但跳过已处理的段落）
        else if (Array.isArray(v)) {
          for (const it of v) collectParagraphs(it)
        } else if (typeof v === 'object') {
          collectParagraphs(v)
        }
      }
    }

    collectParagraphs(json)
    // 兜底：如果没有段落被采集，退回到所有 a:t 扫描
    if (texts.length === 0) collectAT(json)

    // Also collect texts from slide layout referenced by this slide (ppt/slides/_rels/slideN.xml.rels -> ../slideLayouts/slideLayoutX.xml)
    try {
      const relsPath = `ppt/slides/_rels/slide${s.index}.xml.rels`
      const relsXml = entryTextMap.get(relsPath)
      if (relsXml) {
        const relsJson = parser.parse(relsXml)
        const rels = relsJson?.Relationships?.Relationship
        const relArr = Array.isArray(rels) ? rels : (rels ? [rels] : [])
        const layoutRel = relArr.find((r: any)=> String(r['@Type']||'').includes('/slideLayout'))
        if (layoutRel?.['@Target']) {
          // Normalize target path like '../slideLayouts/slideLayout1.xml'
          let target = String(layoutRel['@Target'])
          if (target.startsWith('../')) target = target.replace('../', 'ppt/')
          if (!target.startsWith('ppt/')) target = 'ppt/' + target.replace(/^\//,'')
          const layoutXml = entryTextMap.get(target)
          if (layoutXml) {
            const layoutJson = parser.parse(layoutXml)
            collectAT(layoutJson)
          }
        }

        // Collect texts from SmartArt/diagram and charts linked in slide rels
        for (const r of relArr) {
          const t = String(r['@Type'] || '')
          const tgt0 = String(r['@Target'] || '')
          if (!tgt0) continue
          if (
            t.includes('/diagram') ||
            t.includes('/chart') ||
            /diagrams\/.+\.xml$/i.test(tgt0) ||
            /charts\/.+\.xml$/i.test(tgt0)
          ) {
            let target = tgt0
            if (target.startsWith('../')) target = target.replace('../', 'ppt/')
            if (!target.startsWith('ppt/')) target = 'ppt/' + target.replace(/^\//,'')
            const xml = entryTextMap.get(target)
            if (xml) {
              const j = parser.parse(xml)
              collectAT(j)
            }
          }
        }
      }
    } catch {}

    const merged = Array.from(new Set(
      texts.map(t => String(t).trim()).filter(Boolean)
    ))

    const slide: Slide = { index: s.index, elementIds: [] }
    for (const t of merged) {
      const id = `e${elementAutoId++}`
      elements[id] = { id, slideIndex: s.index, source_text: t, translated_text: '' }
      slide.elementIds.push(id)
    }
    slides.push(slide)
  }

  return { filename, slides, elements }
}
