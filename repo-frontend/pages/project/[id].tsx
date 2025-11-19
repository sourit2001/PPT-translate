import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

type ElementT = { id: string; slideIndex: number; source_text: string; translated_text: string }
interface Project {
  id: string
  filename: string
  source_lang: 'zh'|'en'
  target_lang: 'zh'|'en'
  slides: { index: number; elementIds: string[] }[]
  elements: Record<string, ElementT>
}

export default function ProjectPage() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const [project, setProject] = useState<Project | null>(null)
  const [activeSlide, setActiveSlide] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [translating, setTranslating] = useState<Set<string>>(new Set())
  const [batchTranslating, setBatchTranslating] = useState(false)
  const [batchAllTranslating, setBatchAllTranslating] = useState(false)
  const [batchAllProgress, setBatchAllProgress] = useState({ done: 0, total: 0 })
  const [regeneratingPreview, setRegeneratingPreview] = useState(false)
  const [translatedPreviewKey, setTranslatedPreviewKey] = useState(0)
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())
  const [confirmUpdating, setConfirmUpdating] = useState(false)
  const [rescanning, setRescanning] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/project?id=${id}`).then(r=>r.json()).then(d=>{
      if (d.project) {
        setProject(d.project)
        setActiveSlide(d.project.slides?.[0]?.index || 1)
      } else {
        setMsg(d.error || '项目加载失败')
      }

  const translateAll = async () => {
    if (!project) return
    const all = project.slides.flatMap(s => s.elementIds.map(id => project.elements[id]))
    const pending = all.filter(el => !el.translated_text)
    if (pending.length === 0) { setMsg('没有需要翻译的内容'); return }
    setBatchAllTranslating(true)
    setBatchAllProgress({ done: 0, total: pending.length })
    setMsg(`正在翻译整本：0/${pending.length} ...`)
    for (let i = 0; i < pending.length; i++) {
      const el = pending[i]
      try {
        const res = await fetch('/api/element/translate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: el.id, projectId: project.id }) })
        const d = await res.json()
        if (res.ok) {
          setProject(p=>{
            if (!p) return p
            const copy = { ...p, elements: { ...p.elements } }
            copy.elements[el.id] = { ...copy.elements[el.id], translated_text: d.translated_text }
            return copy
          })
        }
      } catch {}
      setBatchAllProgress({ done: i+1, total: pending.length })
      setMsg(`正在翻译整本：${i+1}/${pending.length} ...`)
    }
    await regeneratePreview()
    setBatchAllTranslating(false)
    setMsg('整本翻译完成')
    setTimeout(()=>setMsg(''), 2000)
  }
    }).finally(()=>setLoading(false))
  }, [id])

  const slideElements = project ? project.slides.find(s=>s.index===activeSlide)?.elementIds?.map(eid=>project.elements[eid]) || [] : []

  const saveElement = async (el: ElementT) => {
    const res = await fetch('/api/element/update', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: el.id, translated_text: el.translated_text, projectId: project?.id }) })
    if (!res.ok) {
      const d = await res.json(); setMsg(d.error || '保存失败')
    } else {
      setMsg('已保存')
      setTimeout(()=>setMsg(''), 1000)
      setDirtyIds(prev=>{ const n = new Set(prev); n.delete(el.id); return n })
    }
  }

  const confirmUpdateAll = async () => {
    if (!project) return
    const items = Array.from(dirtyIds).map(id => ({ id, translated_text: project.elements[id]?.translated_text || '' }))
    if (items.length === 0) { setMsg('没有修改需要提交'); setTimeout(()=>setMsg(''), 1500); return }
    setConfirmUpdating(true)
    setMsg(`正在提交 ${items.length} 处修改并更新预览...`)
    try {
      const r = await fetch('/api/elements/batch-update', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ projectId: project.id, items }) })
      const d = await r.json()
      if (!r.ok) { setMsg(d.error || '提交失败'); return }
      // 批量保存成功后清空脏标记并生成预览
      setDirtyIds(new Set())
      await regeneratePreview()
      setMsg('✅ 已提交并生成最新预览')
      setTimeout(()=>setMsg(''), 2500)
    } catch (e:any) {
      setMsg('提交失败: ' + e.message)
    } finally {
      setConfirmUpdating(false)
    }
  }

  const translateElement = async (el: ElementT) => {
    setTranslating(prev => new Set(prev).add(el.id))
    try {
      const res = await fetch('/api/element/translate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: el.id, projectId: project?.id }) })
      const d = await res.json()
      if (res.ok) {
        setProject(p=>{
          if (!p) return p
          const copy = { ...p, elements: { ...p.elements } }
          copy.elements[el.id] = { ...copy.elements[el.id], translated_text: d.translated_text }
          return copy
        })
      } else {
        setMsg(d.error || '翻译失败')
      }
    } finally {
      setTranslating(prev => {
        const next = new Set(prev)
        next.delete(el.id)
        return next
      })
    }
  }

  const translateSlide = async () => {
    if (slideElements.length === 0) return
    setBatchTranslating(true)
    setMsg(`正在翻译第 ${activeSlide} 页（共 ${slideElements.length} 段）...`)
    
    let success = 0
    let failed = 0
    
    for (let i = 0; i < slideElements.length; i++) {
      const el = slideElements[i]
      setMsg(`正在翻译第 ${activeSlide} 页：${i + 1}/${slideElements.length}...`)
      try {
        await translateElement(el)
        success++
      } catch (e) {
        failed++
      }
    }
    
    setBatchTranslating(false)
    setMsg(`翻译完成！成功 ${success} 段${failed > 0 ? `，失败 ${failed} 段` : ''}`)
    
    // 翻译完成后自动重新生成预览图
    await regeneratePreview()
    
    setTimeout(() => setMsg(''), 3000)
  }

  const rescanProject = async () => {
    if (!project) return
    setRescanning(true)
    setMsg('正在重新扫描 PPTX 文件，提取所有段落...')
    try {
      const res = await fetch('/api/project/rescan', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ projectId: project.id }) })
      const d = await res.json()
      if (res.ok) {
        // 重新加载项目数据
        const r2 = await fetch(`/api/project?id=${project.id}`)
        const d2 = await r2.json()
        if (d2.project) {
          setProject(d2.project)
          setMsg(`✅ 重新扫描完成！识别到 ${d.counts.elements} 个元素（${d.counts.slides} 页）`)
          setTimeout(()=>setMsg(''), 3000)
        }
      } else {
        setMsg('重新扫描失败: ' + (d.error || '未知错误'))
      }
    } catch (e: any) {
      setMsg('重新扫描失败: ' + e.message)
    } finally {
      setRescanning(false)
    }
  }

  const regeneratePreview = async () => {
    if (!project) return
    setRegeneratingPreview(true)
    setMsg('正在写回译文并生成预览图...')
    try {
      const res = await fetch('/api/project/regenerate-preview', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ projectId: project.id }) })
      const d = await res.json()
      if (res.ok) {
        setTranslatedPreviewKey(Date.now())
        setMsg('✅ 预览图已更新')
        setTimeout(()=>setMsg(''), 2000)
      } else {
        setMsg('生成预览图失败: ' + (d.error || '未知错误'))
      }
    } catch (e: any) {
      setMsg('生成预览图失败: ' + e.message)
    } finally {
      setRegeneratingPreview(false)
      setTimeout(() => setMsg(''), 3000)
    }
  }

  return (
    <main style={{padding:0, fontFamily:'ui-sans-serif', height:'100vh', display:'flex', flexDirection:'column'}}>
      {loading ? <p style={{padding:24}}>加载中...</p> : project ? (
        <>
          {/* 顶部工具栏 */}
          <header style={{padding:'16px 24px', borderBottom:'1px solid #e0e0e0', background:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <h1 style={{fontSize:20, fontWeight:700, margin:0}}>{project.filename}</h1>
              <p style={{color:'#666', fontSize:13, margin:'4px 0 0 0'}}>{project.source_lang} → {project.target_lang} · {project.slides.length} 页</p>
            </div>
            <div style={{display:'flex', gap:12}}>
              <button 
                onClick={rescanProject} 
                disabled={rescanning}
                style={{
                  padding:'10px 20px', 
                  background: rescanning ? '#999' : '#9c27b0', 
                  color:'#fff', 
                  borderRadius:6, 
                  border:'none', 
                  cursor: rescanning ? 'not-allowed' : 'pointer',
                  fontWeight:600,
                  fontSize:14
                }}
                title="重新解析 PPTX，提取所有段落（保留已有译文）"
              >
                {rescanning ? '⏳ 扫描中...' : '🔍 重新扫描'}
              </button>
              <button 
                onClick={translateSlide} 
                disabled={batchTranslating || slideElements.length === 0}
                style={{
                  padding:'10px 20px', 
                  background: batchTranslating ? '#999' : '#0066cc', 
                  color:'#fff', 
                  borderRadius:6, 
                  border:'none', 
                  cursor: batchTranslating ? 'not-allowed' : 'pointer',
                  fontWeight:600,
                  fontSize:14
                }}
              >
                {batchTranslating ? '⏳ 翻译中...' : '🚀 翻译当前页'}
              </button>
              <button 
                onClick={regeneratePreview} 
                disabled={regeneratingPreview || batchTranslating}
                style={{
                  padding:'10px 20px', 
                  background: regeneratingPreview ? '#999' : '#28a745', 
                  color:'#fff', 
                  borderRadius:6, 
                  border:'none', 
                  cursor: regeneratingPreview ? 'not-allowed' : 'pointer',
                  fontWeight:600,
                  fontSize:14
                }}
              >
                {regeneratingPreview ? '⏳ 生成中...' : '🔄 更新预览'}
              </button>
              <button 
                onClick={confirmUpdateAll}
                disabled={confirmUpdating || dirtyIds.size === 0 || batchTranslating || regeneratingPreview}
                style={{
                  padding:'10px 20px', 
                  background: confirmUpdating ? '#999' : '#ff7a00', 
                  color:'#fff', 
                  borderRadius:6, 
                  border:'none', 
                  cursor: (confirmUpdating || dirtyIds.size===0 || batchTranslating || regeneratingPreview) ? 'not-allowed' : 'pointer',
                  fontWeight:600,
                  fontSize:14
                }}
              >
                {confirmUpdating ? '⏳ 提交中...' : `✅ 确认更新${dirtyIds.size > 0 ? `(${dirtyIds.size})` : ''}`}
              </button>
              <a 
                href={`/api/project/download?projectId=${project.id}`}
                download
                style={{
                  padding:'10px 20px', 
                  background:'#6c757d', 
                  color:'#fff', 
                  borderRadius:6, 
                  border:'none', 
                  fontWeight:600,
                  fontSize:14,
                  textDecoration:'none',
                  display:'inline-block',
                  cursor:'pointer'
                }}
              >
                📥 下载
              </a>
            </div>
          </header>

          {/* 主体区域：左侧缩略图 + 右侧大图 */}
          <div style={{display:'flex', flex:1, overflow:'hidden'}}>
            {/* 左侧：缩略图列表 */}
            <aside style={{width:180, borderRight:'1px solid #e0e0e0', overflowY:'auto', background:'#fafafa', padding:'12px 8px'}}>
              {project.slides.map(s=> (
                <div 
                  key={s.index}
                  onClick={()=>setActiveSlide(s.index)}
                  style={{
                    marginBottom:12,
                    cursor:'pointer',
                    border: activeSlide===s.index ? '3px solid #0066cc' : '2px solid #ddd',
                    borderRadius:8,
                    overflow:'hidden',
                    background:'#fff',
                    boxShadow: activeSlide===s.index ? '0 4px 12px rgba(0,102,204,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
                    transition:'all 0.2s',
                    position:'relative'
                  }}
                >
                  <img 
                    src={`/api/preview/${project.id}/${s.index-1}`}
                    alt={`第 ${s.index} 页`}
                    style={{width:'100%', display:'block'}}
                    onError={(e)=>{ 
                      const target = e.target as HTMLImageElement
                      target.style.display='none'
                      const parent = target.parentElement
                      if (parent && !parent.querySelector('.placeholder')) {
                        const placeholder = document.createElement('div')
                        placeholder.className = 'placeholder'
                        placeholder.style.cssText = 'width:100%;aspect-ratio:16/9;display:flex;alignItems:center;justifyContent:center;background:#f0f0f0;color:#999;fontSize:12px'
                        placeholder.textContent = `第 ${s.index} 页`
                        parent.appendChild(placeholder)
                      }
                    }}
                  />
                  <div style={{padding:'6px 8px', borderTop:'1px solid #eee', fontSize:11, color:'#666', display:'flex', justifyContent:'space-between'}}>
                    <span style={{fontWeight:600}}>P{s.index}</span>
                    <span>{s.elementIds.length}段</span>
                  </div>
                </div>
              ))}
            </aside>

            {/* 右侧：大图预览 */}
            <section style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0}}>
              {/* 预览图区域 */}
              <div style={{flex:1, overflowY:'auto', padding:24, minHeight:0}}>
                <div style={{display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:24, width:'100%'}}>
                  <div style={{minWidth:0}}>
                    <h3 style={{fontWeight:600, marginBottom:12, fontSize:16, color:'#333'}}>📝 原文</h3>
                    <img 
                      src={`/api/preview/${project.id}/${activeSlide-1}`} 
                      alt={`原文第 ${activeSlide} 页`}
                      style={{width:'100%', height:'auto', display:'block', border:'2px solid #ddd', borderRadius:8, boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}}
                      onError={(e)=>{ (e.target as any).style.display='none' }}
                    />
                  </div>
                  <div style={{minWidth:0}}>
                    <h3 style={{fontWeight:600, marginBottom:12, fontSize:16, color:'#0066cc'}}>✨ 译文</h3>
                    <img 
                      key={translatedPreviewKey}
                      src={`/api/preview-translated/${project.id}/${activeSlide-1}?t=${translatedPreviewKey}`} 
                      alt={`翻译后第 ${activeSlide} 页`}
                      style={{width:'100%', height:'auto', display:'block', border:'2px solid #0066cc', borderRadius:8, boxShadow:'0 2px 8px rgba(0,102,204,0.2)'}}
                      onError={(e)=>{ 
                        const target = e.target as HTMLImageElement
                        target.style.display='none'
                        const parent = target.parentElement
                        if (parent && !parent.querySelector('.placeholder')) {
                          const placeholder = document.createElement('div')
                          placeholder.className = 'placeholder'
                          placeholder.style.cssText = 'width:100%;aspect-ratio:16/9;border:2px dashed #ccc;borderRadius:8px;display:flex;alignItems:center;justifyContent:center;background:#f5f5f5;color:#999;fontSize:14px'
                          placeholder.textContent = '点击"翻译当前页"后生成预览'
                          parent.appendChild(placeholder)
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
              
              {/* 译文编辑区域 */}
              <details style={{borderTop:'1px solid #e0e0e0', background:'#fafafa'}}>
                <summary style={{cursor:'pointer', fontWeight:600, fontSize:14, padding:'12px 24px', background:'#f5f5f5'}}>📝 查看/编辑译文文本（第 {activeSlide} 页）</summary>
                <div style={{padding:24, maxHeight:400, overflowY:'auto'}}>
                  {slideElements.map(el=> (
                    <div key={el.id} style={{marginBottom:16, padding:16, background:'#fff', borderRadius:8, border:'1px solid #e0e0e0'}}>
                      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:8}}>
                        <div>
                          <div style={{display:'block', fontSize:12, fontWeight:600, marginBottom:4, color:'#666'}}>原文</div>
                          <div style={{padding:8, background:'#fff', borderRadius:4, border:'1px solid #eee', minHeight:60, fontSize:13, whiteSpace:'pre-wrap'}}>
                            {el.source_text || <i>空</i>}
                          </div>
                        </div>
                        <div>
                          <label htmlFor={`tgt-${el.id}`} style={{display:'block', fontSize:12, fontWeight:600, marginBottom:4, color:'#666'}}>译文</label>
                          <textarea 
                            id={`tgt-${el.id}`}
                            name={`translation-${el.id}`}
                            value={el.translated_text} 
                            onChange={e=>{
                              const v = e.target.value
                              setProject(p=>{
                                if (!p) return p
                                const copy = { ...p, elements: { ...p.elements } }
                                copy.elements[el.id] = { ...copy.elements[el.id], translated_text: v }
                                return copy
                              })
                              setDirtyIds(prev=>{ const n = new Set(prev); n.add(el.id); return n })
                            }} 
                            style={{width:'100%', minHeight:60, padding:8, borderRadius:4, border:'1px solid #ccc', fontFamily:'inherit', fontSize:13}} 
                          />
                        </div>
                      </div>
                      <div style={{display:'flex', gap:8}}>
                        <button 
                          onClick={()=>translateElement(el)} 
                          disabled={translating.has(el.id) || batchTranslating}
                          style={{
                            padding:'6px 12px', 
                            background: translating.has(el.id) ? '#999' : '#111', 
                            color:'#fff', 
                            borderRadius:4, 
                            border:'none', 
                            cursor: translating.has(el.id) || batchTranslating ? 'not-allowed' : 'pointer', 
                            fontSize:12
                          }}
                        >
                          {translating.has(el.id) ? '⏳ 翻译中...' : '🤖 翻译'}
                        </button>
                        <button 
                          onClick={()=>saveElement(el)} 
                          disabled={batchTranslating}
                          style={{
                            padding:'6px 12px', 
                            border:'1px solid #111', 
                            borderRadius:4, 
                            background:'#fff', 
                            cursor: batchTranslating ? 'not-allowed' : 'pointer', 
                            fontSize:12
                          }}
                        >
                          💾 保存
                        </button>
                        {dirtyIds.has(el.id) && <span style={{fontSize:12, color:'#d9534f', lineHeight:'28px'}}>未提交修改</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
              
              {/* 状态消息 */}
              {msg && (
                <div style={{padding:'12px 24px', background:'#e8f5e9', borderTop:'1px solid #c8e6c9', color:'#2e7d32', fontWeight:600, fontSize:14}}>
                  {msg}
                </div>
              )}
            </section>
          </div>
        </>
      ) : (
        <p>{msg || '项目不存在'}</p>
      )}
    </main>
  )
}
