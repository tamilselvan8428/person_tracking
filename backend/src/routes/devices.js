const express = require('express');
const db = require('../db');
const { authRequired, requireRole, requireScope } = require('../middleware/auth');

const router = express.Router();

// Register or update a device (sub-admin only, within tenant)
router.post('/register', authRequired, (req, res, next) => {
  // Allow sub/super admins, or tenant_user with config scope
  if (req.user.role === 'tenant_user') return requireScope('config')(req, res, next);
  return requireRole('sub_admin','super_admin')(req, res, next);
}, (req, res) => {
  const { device_uid, name, type } = req.body;
  if (!device_uid || !type || !['room','person'].includes(type)) return res.status(400).json({ error: 'Invalid payload' });

  // Tenant scoping
  let tenantId = req.user.tenant_id;
  if (req.user.role === 'super_admin' && req.body.tenant_id) tenantId = req.body.tenant_id;

  const tx = db.transaction(() => {
    const existing = db.prepare('SELECT id FROM devices WHERE device_uid = ?').get(device_uid);
    if (existing) {
      db.prepare('UPDATE devices SET name = COALESCE(?, name), type = ?, tenant_id = ? WHERE device_uid = ?')
        .run(name || null, type, tenantId, device_uid);
      return { id: existing.id };
    } else {
      const info = db.prepare('INSERT INTO devices (tenant_id, device_uid, name, type, last_seen, online) VALUES (?,?,?,?,?,?)')
        .run(tenantId, device_uid, name || null, type, 0, 0);
      return { id: info.lastInsertRowid };
    }
  });

  try {
    const { id } = tx();
    res.json({ ok: true, id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Firmware fetch config by device UID
router.get('/config', (req, res) => {
  const { deviceId } = req.query; // device_uid from ESP32 (chip id)
  if (!deviceId) return res.status(400).json({ error: 'Missing deviceId' });
  const row = db.prepare('SELECT id, tenant_id, device_uid, name, type FROM devices WHERE device_uid = ?').get(deviceId);
  if (!row) return res.status(404).json({ error: 'Not registered' });
  res.json({ id: row.id, tenant_id: row.tenant_id, device_uid: row.device_uid, name: row.name, type: row.type, heartbeat_interval_sec: 60, tracking_interval_sec: 300 });
});

// Heartbeat from any device
router.post('/heartbeat', (req, res) => {
  const { device_uid } = req.body;
  if (!device_uid) return res.status(400).json({ error: 'Missing device_uid' });
  const now = Math.floor(Date.now()/1000);
  const result = db.prepare('UPDATE devices SET last_seen = ?, online = 1 WHERE device_uid = ?').run(now, device_uid);
  if (result.changes === 0) return res.status(404).json({ error: 'Device not found' });
  res.json({ ok: true, ts: now });
});

// List devices for current tenant (sub-admin)
router.get('/', authRequired, (req, res, next) => {
  if (req.user.role === 'tenant_user') return requireScope('config')(req, res, next);
  return requireRole('sub_admin','super_admin')(req, res, next);
}, (req, res) => {
  const tenantId = req.user.role === 'super_admin' && req.query.tenant_id ? Number(req.query.tenant_id) : req.user.tenant_id;
  const offlineAfterSec = Number(process.env.OFFLINE_AFTER_SEC || 360);
  const now = Math.floor(Date.now()/1000);

  const list = db.prepare('SELECT id, device_uid, name, type, last_seen, online FROM devices WHERE tenant_id = ?').all(tenantId).map(d => {
    const isOffline = !d.last_seen || (now - d.last_seen) > offlineAfterSec;
    return { ...d, online: isOffline ? 0 : 1 };
  });
  res.json({ devices: list });
});

module.exports = router;
