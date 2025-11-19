import { useState } from 'react'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    if (res.ok) {
      location.href = '/'
    } else {
      const data = await res.json()
      setMsg(data.error || '注册失败')
    }
  }

  return (
    <main style={{padding:24, fontFamily:'ui-sans-serif'}}>
      <h1>注册</h1>
      <form onSubmit={onSubmit} style={{display:'grid', gap:12, maxWidth:360}}>
        <input placeholder="邮箱" value={email} onChange={e=>setEmail(e.target.value)} />
        <input type="password" placeholder="密码" value={password} onChange={e=>setPassword(e.target.value)} />
        <button type="submit" style={{padding:'8px 14px', background:'#111', color:'#fff', borderRadius:6}}>注册</button>
        {msg && <p style={{color:'#c00'}}>{msg}</p>}
      </form>
      <p style={{marginTop:12}}><a href="/login" style={{color:'#06f'}}>去登录</a></p>
    </main>
  )
}
