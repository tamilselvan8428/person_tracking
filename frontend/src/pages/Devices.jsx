import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../store/auth'

export default function Devices() {
  const { user } = useAuth()
  const [devices, setDevices] = useState([])
  const [device_uid, setUid] = useState('ESP32-XXXX')
  const [name, setName] = useState('')
  const [type, setType] = useState('room')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  const load = async () => {
    try {
      const { data } = await api.get('/devices')
      setDevices(data.devices)
    } catch (e) {
      setMsg(e.response?.data?.error || 'Failed to load devices')
    }
  }

  const registerDevice = async (e) => {
    e.preventDefault()
    setMsg('')
    try {
      await api.post('/devices/register', { device_uid, name, type })
      setUid('')
      setName('')
      load()
    } catch (e) {
      setMsg(e.response?.data?.error || 'Register failed')
    }
  }

  if (!user) return <p>Please login.</p>

  return (
    <div>
      <h2>Devices</h2>
      {msg && <p style={{color:'red'}}>{msg}</p>}

      <form onSubmit={registerDevice} style={{display:'grid', gap:8, maxWidth:420}}>
        <input value={device_uid} onChange={e=>setUid(e.target.value)} placeholder="Device UID (ESP32 chip id)" />
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" />
        <select value={type} onChange={e=>setType(e.target.value)}>
          <option value="room">room</option>
          <option value="person">person</option>
        </select>
        <button type="submit">Save</button>
      </form>

      <div style={{marginTop:16}}>
        <h3>Device List</h3>
        <table border="1" cellPadding="6">
          <thead>
            <tr>
              <th>UID</th>
              <th>Name</th>
              <th>Type</th>
              <th>Online</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {devices.map(d => (
              <tr key={d.id}>
                <td>{d.device_uid}</td>
                <td>{d.name}</td>
                <td>{d.type}</td>
                <td style={{color: d.online ? 'green' : 'crimson'}}>{d.online ? 'online' : 'offline'}</td>
                <td>{d.last_seen ? new Date(d.last_seen*1000).toLocaleString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
