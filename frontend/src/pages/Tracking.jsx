import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../store/auth'
import '../styles/pages/Tracking.css'

export default function Tracking() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [msg, setMsg] = useState('')

  const load = async () => {
    try {
      const { data } = await api.get('/tracking/list')
      setItems(data.items)
    } catch (e) {
      setMsg(e.response?.data?.error || 'Failed to load tracking')
    }
  }

  useEffect(() => {
    if (!user) return
    load()
    const id = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [user])

  if (!user) return <p>Please login.</p>

  return (
    <div className="tracking">
      <h2 className="page-title">Tracking</h2>
      {msg && <p style={{color:'#b91c1c'}}>{msg}</p>}
      <div className="person-list">
        {items.map((x, idx) => {
          const name = x.person?.name || x.person?.device_uid
          const room = x.room?.name || x.room?.device_uid || '-'
          const ts = x.ts ? new Date(x.ts*1000).toLocaleString() : '-'
          const online = !!x.online
          return (
            <div className="card person-card" key={idx}>
              <div className="pc-header">
                <div className="pc-name">{name}</div>
                <div className="pc-room">{room}</div>
              </div>
              <div className="pc-meta">
                <div className="pc-updated">Updated: {ts}</div>
                <div className="pc-status">
                  <span className={online ? 'dot dot-green' : 'dot dot-red'} />
                  <span className={online ? 'label-active' : 'label-inactive'}>{online ? 'active' : 'deactivate'}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
