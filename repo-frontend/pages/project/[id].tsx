import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

type ElementT = { id: string; slideIndex: number; source_text: string; translated_text: string }
interface Project {
  id: string
  filename: string
  source_lang: 'zh' | 'en'
  target_lang: 'zh' | 'en'
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
    fetch(`/api/project?id=${id}`).then(r => r.json()).then(d => {
      if (d.project) {
        setProject(d.project)
        setActiveSlide(d.project.slides?.[0]?.index || 1)
      } else {
        setMsg(d.error || '项目加载失败')
      }
    }).finally(() => setLoading(false))
  }, [id])

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
        const res = await fetch('/api/element/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: el.id, projectId: project.id }) })
        const d = await res.json()
        if (res.ok) {
          setProject(p => {
            if (!p) return p
            const copy = { ...p, elements: { ...p.elements } }
            copy.elements[el.id] = { ...copy.elements[el.id], translated_text: d.translated_text }
            return copy
          })
        }
      } catch { }
      setBatchAllProgress({ done: i + 1, total: pending.length })
      setMsg(`正在翻译整本：${i + 1}/${pending.length} ...`)
    }
    await regeneratePreview()
    setBatchAllTranslating(false)
    setMsg('整本翻译完成')
    setTimeout(() => setMsg(''), 2000)
  }

  const slideElements = project ? project.slides.find(s => s.index === activeSlide)?.elementIds?.map(eid => project.elements[eid]) || [] : []

  const saveElement = async (el: ElementT) => {
    const res = await fetch('/api/element/update', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: el.id, translated_text: el.translated_text, projectId: project?.id }) })
    if (!res.ok) {
      const d = await res.json(); setMsg(d.error || '保存失败')
    } else {
      setMsg('已保存')
      setTimeout(() => setMsg(''), 1000)
      setDirtyIds(prev => { const n = new Set(prev); n.delete(el.id); return n })
    }
  }

  const confirmUpdateAll = async () => {
    if (!project) return
    const items = Array.from(dirtyIds).map(id => ({ id, translated_text: project.elements[id]?.translated_text || '' }))
    if (items.length === 0) { setMsg('没有修改需要提交'); setTimeout(() => setMsg(''), 1500); return }
    setConfirmUpdating(true)
    setMsg(`正在提交 ${items.length} 处修改并更新预览...`)
    try {
      const r = await fetch('/api/elements/batch-update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id, items }) })
      const d = await r.json()
      if (!r.ok) { setMsg(d.error || '提交失败'); return }
      setDirtyIds(new Set())
      await regeneratePreview()
      setMsg('✅ 已提交并生成最新预览')
      setTimeout(() => setMsg(''), 2500)
    } catch (e: any) {
      setMsg('提交失败: ' + e.message)
    } finally {
      setConfirmUpdating(false)
    }
  }

  const translateElement = async (el: ElementT) => {
    setTranslating(prev => new Set(prev).add(el.id))
    try {
      const res = await fetch('/api/element/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: el.id, projectId: project?.id }) })
      const d = await res.json()
      if (res.ok) {
        setProject(p => {
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
    await regeneratePreview()
    setTimeout(() => setMsg(''), 3000)
  }

  const rescanProject = async () => {
    if (!project) return
    setRescanning(true)
    setMsg('正在重新扫描 PPTX 文件，提取所有段落...')
    try {
      const res = await fetch('/api/project/rescan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id }) })
      const d = await res.json()
      if (res.ok) {
        const r2 = await fetch(`/api/project?id=${project.id}`)
        const d2 = await r2.json()
        if (d2.project) {
          setProject(d2.project)
          setMsg(`✅ 重新扫描完成！识别到 ${d.counts.elements} 个元素（${d.counts.slides} 页）`)
          setTimeout(() => setMsg(''), 3000)
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
      const res = await fetch('/api/project/regenerate-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id }) })
      const d = await res.json()
      if (res.ok) {
        setTranslatedPreviewKey(Date.now())
        setMsg('✅ 预览图已更新')
        setTimeout(() => setMsg(''), 2000)
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
    <main className="app-shell">
      {loading ? <p style={{ padding: '2rem' }}>加载中...</p> : project ? (
        <>
          {/* Header */}
          <header className="app-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                onClick={() => router.push('/')}
                className="btn btn-ghost"
                title="返回首页"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem' }}
              >
                <span style={{ fontSize: '1.2rem' }}>🏠</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>返回首页</span>
              </button>
              <div className="header-title">
                <h1>{project.filename}</h1>
                <p>{project.source_lang} → {project.target_lang} · {project.slides.length} 页</p>
              </div>
            </div>

            <div className="header-actions">
              {/* Navigation & View Actions */}
              <div className="action-group">
                <button
                  onClick={rescanProject}
                  disabled={rescanning}
                  className="btn btn-ghost"
                  title="重新解析 PPTX"
                >
                  {rescanning ? '⏳' : '🔍 重新扫描'}
                </button>
                <button
                  onClick={regeneratePreview}
                  disabled={regeneratingPreview || batchTranslating}
                  className="btn btn-ghost"
                  title="刷新预览图"
                >
                  {regeneratingPreview ? '⏳' : '🔄 刷新预览'}
                </button>
              </div>

              <div className="separator"></div>

              {/* Translation Actions */}
              <div className="action-group">
                <button
                  onClick={translateSlide}
                  disabled={batchTranslating || slideElements.length === 0}
                  className="btn btn-secondary"
                >
                  {batchTranslating ? '⏳ 翻译中...' : '翻译当前页'}
                </button>
                <button
                  onClick={translateAll}
                  disabled={batchAllTranslating || batchTranslating}
                  className="btn btn-primary"
                >
                  {batchAllTranslating ? `⏳ 翻译中 ${batchAllProgress.done}/${batchAllProgress.total}` : '🚀 翻译整本'}
                </button>
              </div>

              <div className="separator"></div>

              {/* Save & Export */}
              <div className="action-group">
                <button
                  onClick={confirmUpdateAll}
                  disabled={confirmUpdating || dirtyIds.size === 0 || batchTranslating || regeneratingPreview}
                  className={`btn ${dirtyIds.size > 0 ? 'btn-warning' : 'btn-secondary'}`}
                >
                  {confirmUpdating ? '⏳ 提交中...' : `✅ 提交修改${dirtyIds.size > 0 ? ` (${dirtyIds.size})` : ''}`}
                </button>
                <a
                  href={`/api/project/download?projectId=${project.id}`}
                  download
                  className="btn btn-secondary"
                  style={{ textDecoration: 'none' }}
                >
                  📥 导出 PPTX
                </a>
              </div>
            </div>
          </header>

          {/* Main Content - 3 Column Layout */}
          <div className="app-body">

            {/* 1. Left Sidebar: Thumbnails */}
            <aside className="col-thumbnails">
              {project.slides.map(s => (
                <div
                  key={s.index}
                  onClick={() => setActiveSlide(s.index)}
                  className={`thumb-item ${activeSlide === s.index ? 'active' : ''}`}
                >
                  <img
                    src={`/api/preview/${project.id}/${s.index - 1}`}
                    alt={`第 ${s.index} 页`}
                    className="thumb-image"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      const parent = target.parentElement
                      if (parent && !parent.querySelector('.placeholder')) {
                        const placeholder = document.createElement('div')
                        placeholder.className = 'placeholder'
                        placeholder.style.cssText = 'width:100%;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;font-size:12px;color:#999;'
                        placeholder.textContent = `P${s.index}`
                        parent.appendChild(placeholder)
                      }
                    }}
                  />
                  <div className="thumb-meta">
                    <span className="page-badge">{s.index}</span>
                    <span>{s.elementIds.length} 段文本</span>
                  </div>
                </div>
              ))}
            </aside>

            {/* 2. Center Stage: Previews */}
            <section className="col-preview">
              <div className="preview-scroll-container">
                <div className="preview-content">

                  {/* Original Slide */}
                  <div className="preview-card">
                    <div className="preview-header">
                      <span className="dot original"></span> 原文 (Original)
                    </div>
                    <div className="image-frame">
                      <img
                        src={`/api/preview/${project.id}/${activeSlide - 1}`}
                        alt={`原文第 ${activeSlide} 页`}
                        className="preview-img"
                      />
                    </div>
                  </div>

                  {/* Translated Slide */}
                  <div className="preview-card">
                    <div className="preview-header" style={{ color: 'var(--primary)' }}>
                      <span className="dot translated"></span> 译文 (Translated)
                    </div>
                    <div className="image-frame translated">
                      <img
                        key={translatedPreviewKey}
                        src={`/api/preview-translated/${project.id}/${activeSlide - 1}?t=${translatedPreviewKey}`}
                        alt={`翻译后第 ${activeSlide} 页`}
                        className="preview-img"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          const parent = target.parentElement
                          if (parent && !parent.querySelector('.placeholder')) {
                            const placeholder = document.createElement('div')
                            placeholder.className = 'placeholder'
                            placeholder.style.cssText = 'width:100%;aspect-ratio:16/9;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);border:2px dashed var(--border);border-radius:8px;gap:0.5rem;'
                            placeholder.innerHTML = '<div style="font-size:2rem;">📄</div><div style="color:var(--text-secondary);font-size:14px;font-weight:500;">点击"翻译当前页"生成译文预览</div>'
                            parent.appendChild(placeholder)
                          }
                        }}
                      />
                    </div>
                  </div>

                </div>
              </div>
            </section>

            {/* 3. Right Sidebar: Editor */}
            <aside className="col-editor">
              <div className="editor-header">
                <div className="editor-title">
                  <span>📝</span>
                  <span>编辑译文</span>
                  <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-secondary)', background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: '4px' }}>P{activeSlide}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {slideElements.length} 个段落
                </div>
              </div>

              <div className="editor-list">
                {slideElements.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    此页面没有检测到可编辑文本
                  </div>
                ) : slideElements.map(el => (
                  <div key={el.id} className={`editor-item ${dirtyIds.has(el.id) ? 'dirty' : ''}`}>
                    {/* Source Text */}
                    <div className="source-text">
                      {el.source_text || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>空文本</span>}
                    </div>

                    {/* Translation Input */}
                    <div>
                      <textarea
                        id={`tgt-${el.id}`}
                        value={el.translated_text}
                        onChange={e => {
                          const v = e.target.value
                          setProject(p => {
                            if (!p) return p
                            const copy = { ...p, elements: { ...p.elements } }
                            copy.elements[el.id] = { ...copy.elements[el.id], translated_text: v }
                            return copy
                          })
                          setDirtyIds(prev => { const n = new Set(prev); n.add(el.id); return n })
                        }}
                        className="editor-textarea"
                        placeholder="输入译文..."
                      />

                      {/* Quick Actions */}
                      <div className="item-actions">
                        <button
                          onClick={() => translateElement(el)}
                          disabled={translating.has(el.id) || batchTranslating}
                          className="icon-btn"
                          title="重新翻译这段"
                        >
                          <span style={{ fontSize: '12px' }}>🔄</span>
                        </button>
                        <button
                          onClick={() => saveElement(el)}
                          disabled={batchTranslating}
                          className="icon-btn"
                          title="保存修改"
                          style={dirtyIds.has(el.id) ? { borderColor: 'var(--warning)', color: 'var(--warning)' } : {}}
                        >
                          <span style={{ fontSize: '12px' }}>💾</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </aside>

          </div>

          {/* Global Status Toast */}
          {msg && (
            <div className="toast">
              <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
              {msg}
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '1rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem' }}>📁</div>
          <p>{msg || '项目不存在'}</p>
        </div>
      )}
    </main>
  )
}
