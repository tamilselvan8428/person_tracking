import { useAuth } from '../store/auth'
import { useState } from 'react'
import { api } from '../api/client'
import '../styles/pages/Dashboard.css'

export default function Dashboard() {
  const { user } = useAuth()
  const [email, setEmail] = useState('subadmin@org.local')
  const [password, setPassword] = useState('SubAdmin@123')
  const [tenantName, setTenantName] = useState('Org-1')
  const [msg, setMsg] = useState('')
  const [tEmail, setTEmail] = useState('viewer@org.local')
  const [tPassword, setTPassword] = useState('Viewer@123')
  const [scTracking, setScTracking] = useState(true)
  const [scConfig, setScConfig] = useState(false)

  if (!user) return <p>Please login.</p>

  const createSubAdmin = async (e) => {
    e.preventDefault()
    setMsg('')
    try {
      const { data } = await api.post('/auth/subadmins', { email, password, tenantName })
      setMsg(`Created sub-admin userId=${data.userId} tenantId=${data.tenantId}`)
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed')
    }
  }

  const createTenantUser = async (e) => {
    e.preventDefault()
    setMsg('')
    try {
      const scopes = [scTracking && 'tracking', scConfig && 'config'].filter(Boolean)
      const { data } = await api.post('/auth/tenant-users', { email: tEmail, password: tPassword, scopes })
      setMsg(`Created tenant user id=${data.id} scopes=${scopes.join(',')}`)
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to create tenant user')
    }
  }

  return (
    <div>
      <h2>Dashboard</h2>

      {user.role === 'super_admin' && (
        <div className="section">
          <h3>Create Sub Admin</h3>
          {msg && <p>{msg}</p>}
          <form onSubmit={createSubAdmin} className="stack form">
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Sub-admin Email" />
            <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" />
            <input value={tenantName} onChange={e=>setTenantName(e.target.value)} placeholder="Tenant/Org Name" />
            <button type="submit">Create</button>
          </form>
        </div>
      )}

      {user.role === 'sub_admin' && (
        <div className="section">
          <h3>Create Tenant User</h3>
          {msg && <p>{msg}</p>}
          <form onSubmit={createTenantUser} className="stack form">
            <input value={tEmail} onChange={e=>setTEmail(e.target.value)} placeholder="User Email" />
            <input value={tPassword} onChange={e=>setTPassword(e.target.value)} placeholder="Password" type="password" />
            <label><input type="checkbox" checked={scTracking} onChange={e=>setScTracking(e.target.checked)} /> tracking</label>
            <label><input type="checkbox" checked={scConfig} onChange={e=>setScConfig(e.target.checked)} /> config</label>
            <button type="submit">Create User</button>
          </form>
        </div>
      )}
    </div>
  )
}
