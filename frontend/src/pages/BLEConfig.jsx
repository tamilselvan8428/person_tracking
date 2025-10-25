import { useState } from 'react'
import { useAuth } from '../store/auth'
import '../styles/pages/BLEConfig.css'

/*
This page uses Web Bluetooth to connect to an ESP32 that exposes a custom
GATT service with a writable characteristic to accept JSON config:
- Service UUID: 0000ff00-0000-1000-8000-00805f9b34fb
- Characteristic UUID: 0000ff01-0000-1000-8000-00805f9b34fb (Write)

Expected JSON payload (UTF-8):
{
  "device_uid": "ESP32-XXXX",
  "name": "Room 101",
  "type": "room" | "person"
}
Firmware should handle this by registering/updating the device via backend
and adjusting behavior (advertise vs scan).
*/

export default function BLEConfig() {
  const { user } = useAuth()
  const [status, setStatus] = useState('')
  const [device_uid, setUid] = useState('ESP32-XXXX')
  const [name, setName] = useState('')
  const [type, setType] = useState('room')

  if (!user) return <p>Please login.</p>

  const connectAndWrite = async () => {
    try {
      setStatus('Requesting device...')
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'ROOM:' }, { namePrefix: 'ESP32' }],
        optionalServices: ['0000ff00-0000-1000-8000-00805f9b34fb']
      })
      setStatus('Connecting GATT...')
      const server = await device.gatt.connect()
      const service = await server.getPrimaryService('0000ff00-0000-1000-8000-00805f9b34fb')
      const char = await service.getCharacteristic('0000ff01-0000-1000-8000-00805f9b34fb')

      const payload = JSON.stringify({ device_uid, name, type })
      const enc = new TextEncoder()
      const data = enc.encode(payload)
      await char.writeValue(data)
      setStatus('Configuration sent successfully.')
      await server.disconnect()
    } catch (e) {
      setStatus('Failed: ' + (e?.message || String(e)))
    }
  }

  return (
    <div className="ble-config">
      <h2 className="page-title">BLE Configuration</h2>
      <div className="card">
        <p className="ble-status">Write device configuration over Bluetooth LE to the ESP32.</p>
        {status && <p className="ble-status">{status}</p>}
        <div className="ble-form">
          <input value={device_uid} onChange={e=>setUid(e.target.value)} placeholder="Device UID" />
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" />
          <select value={type} onChange={e=>setType(e.target.value)}>
            <option value="room">room</option>
            <option value="person">person</option>
          </select>
          <div className="ble-actions">
            <button className="btn btn-primary" onClick={connectAndWrite}>Connect & Send</button>
          </div>
        </div>
        <p className="ble-status" style={{fontSize:12}}>Note: Ensure the ESP32 firmware exposes the FF00/FF01 config service and is in range.</p>
      </div>
    </div>
  )
}
