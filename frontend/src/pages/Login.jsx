import { useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../store/auth'
import { useNavigate } from 'react-router-dom'
import '../styles/pages/Login.css'

export default function Login() {
  // No changes required in this file for palette update.
  const [email, setEmail] = useState('admin@local')
  const [password, setPassword] = useState('Admin@12345')
  const [error, setError] = useState('')
  const login = useAuth(state => state.login)
  const navigate = useNavigate()

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const { data } = await api.post('/auth/login', { email, password })
      login(data.token, data.user)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    }
  }

  return (
    <div className="login full-bleed">
      <div className="login-split">
        <div className="login-left">
          <img src="/login_image.png" alt="Login" className="login-img" />
        </div>
        <div className="login-right">
          <h2 className="page-title">Login</h2>
          <div className="card auth-card">
            {error && <p className="error">{error}</p>}
            <form onSubmit={onSubmit} className="stack">
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
              <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" />
              <button className="btn btn-primary" type="submit">Login</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
