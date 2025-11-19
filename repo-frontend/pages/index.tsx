import { useEffect, useState } from 'react'

type Me = { ok: boolean; user?: { email: string } }

export default function Home() {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [src, setSrc] = useState<'zh' | 'en'>('zh')
  const [tgt, setTgt] = useState<'zh' | 'en'>('en')
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
    <div className="landing-container">
      <div className="landing-card">
        <h1 className="landing-title">📊 PPT 翻译工具</h1>
        <p className="landing-subtitle">
          上传您的 PowerPoint 文件，轻松实现中英文互译。支持在线预览、编辑和导出。
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
            加载中...
          </div>
        ) : me?.user ? (
          <>
            <div className="user-info">
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                👤 {me.user.email}
              </span>
              <a href="/api/auth/logout" className="logout-link">退出登录</a>
            </div>

            <form onSubmit={onSubmit} className="upload-form">
              <div className="form-group">
                <label className="form-label">📎 选择 PPTX 文件</label>
                <input
                  type="file"
                  accept=".pptx"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="file-input"
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  支持最大 20MB 的文件
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">🌐 语言设置</label>
                <div className="lang-selector-row">
                  <select value={src} onChange={e => setSrc(e.target.value as any)} className="lang-select">
                    <option value="zh">🇨🇳 中文</option>
                    <option value="en">🇺🇸 英文</option>
                  </select>
                  <span className="lang-arrow">→</span>
                  <select value={tgt} onChange={e => setTgt(e.target.value as any)} className="lang-select">
                    <option value="zh">🇨🇳 中文</option>
                    <option value="en">🇺🇸 英文</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={!file}>
                {file ? '🚀 开始翻译' : '请先选择文件'}
              </button>

              {msg && <div className="status-message">{msg}</div>}
            </form>
          </>
        ) : (
          <div className="auth-section">
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              请先登录以使用翻译服务
            </p>
            <div className="auth-links">
              <a href="/login" className="auth-link">🔑 登录</a>
              <a href="/register" className="auth-link">✨ 注册</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
