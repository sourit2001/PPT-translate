import { useEffect, useState } from 'react'

type Me = { ok: boolean; user?: { email: string } }

export default function Home() {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [src, setSrc] = useState<'zh'|'en'>('zh')
  const [tgt, setTgt] = useState<'zh'|'en'>('en')
  const [msg, setMsg] = useState<string>('')

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(setMe).finally(() => setLoading(false))
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    const max = 20 * 1024 * 1024
    if (file.size > max) {
      setMsg('文件超过 20MB 上限')
      return
    }
    if (src === tgt) {
      setMsg('源语言与目标语言不能相同')
      return
    }
    setMsg('上传并创建项目中...')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('source_lang', src)
    fd.append('target_lang', tgt)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok && data.projectId) {
      location.href = `/project/${data.projectId}`
    } else {
      setMsg(data.error || '创建失败')
    }
  }

  return (
    <main style={{padding: 24, fontFamily: 'ui-sans-serif', maxWidth: 920, margin: '0 auto'}}>
      <h1 style={{fontSize: 32, fontWeight: 800}}>PPT 翻译网站（MVP）</h1>
      <p style={{color:'#444'}}>上传 PPTX（≤20MB）、选择语言，预览与编辑将在后续完成。当前为演示流程。</p>

      {loading ? (
        <p>加载中...</p>
      ) : me?.user ? (
        <section style={{marginTop: 24}}>
          <p>已登录：{me.user.email} <a href="/api/auth/logout" style={{marginLeft:12}}>退出</a></p>
          <form onSubmit={onSubmit} style={{marginTop: 16, display:'grid', gap:12}}>
            <div>
              <label>选择 PPTX 文件：</label>
              <input type="file" accept=".pptx" onChange={e=>setFile(e.target.files?.[0]||null)} />
              <small style={{marginLeft:8,color:'#666'}}>最大 20MB</small>
            </div>
            <div style={{display:'flex', gap:12, alignItems:'center'}}>
              <label>源语言：</label>
              <select value={src} onChange={e=>setSrc(e.target.value as any)}>
                <option value="zh">中文</option>
                <option value="en">英文</option>
              </select>
              <span>→</span>
              <label>目标语言：</label>
              <select value={tgt} onChange={e=>setTgt(e.target.value as any)}>
                <option value="zh">中文</option>
                <option value="en">英文</option>
              </select>
            </div>
            <button type="submit" style={{padding:'8px 14px', background:'#111', color:'#fff', borderRadius:6}}>创建翻译任务（演示）</button>
            {msg && <p style={{color:'#0a7'}}>{msg}</p>}
          </form>
        </section>
      ) : (
        <section style={{marginTop: 24}}>
          <p>你尚未登录。</p>
          <div style={{display:'flex', gap:12}}>
            <a href="/login" style={{color:'#06f'}}>登录</a>
            <a href="/register" style={{color:'#06f'}}>注册</a>
          </div>
        </section>
      )}
    </main>
  )
}
