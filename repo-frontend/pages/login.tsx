import { useState } from 'react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    if (res.ok) {
      location.href = '/'
    } else {
      const data = await res.json()
      setMsg(data.error || '登录失败')
    }
  }

  return (
    <main style={{padding:24, fontFamily:'ui-sans-serif'}}>
      <h1>登录</h1>
      <form onSubmit={onSubmit} style={{display:'grid', gap:12, maxWidth:360}}>
        <input placeholder="邮箱" value={email} onChange={e=>setEmail(e.target.value)} />
        <input type="password" placeholder="密码" value={password} onChange={e=>setPassword(e.target.value)} />
        <button type="submit" style={{padding:'8px 14px', background:'#111', color:'#fff', borderRadius:6}}>登录</button>
        {msg && <p style={{color:'#c00'}}>{msg}</p>}
      </form>
      <p style={{marginTop:12}}><a href="/register" style={{color:'#06f'}}>去注册</a></p>
    </main>
  )
}
