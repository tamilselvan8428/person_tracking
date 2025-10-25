const express = require('express');
const db = require('../db');
const { authRequired, requireRole, requireScope } = require('../middleware/auth');

const router = express.Router();

// Person device posts nearest room (no auth to simplify firmware; relies on device_uid ownership)
router.post('/update', (req, res) => {
  const { person_device_uid, room_device_uid, rssi, ts } = req.body;
  if (!person_device_uid || !room_device_uid) return res.status(400).json({ error: 'Missing device uids' });
  const person = db.prepare('SELECT id, tenant_id FROM devices WHERE device_uid = ? AND type = ?').get(person_device_uid, 'person');
  const room = db.prepare('SELECT id, tenant_id FROM devices WHERE device_uid = ? AND type = ?').get(room_device_uid, 'room');
  if (!person || !room) return res.status(404).json({ error: 'Device not found or wrong type' });
  if (person.tenant_id !== room.tenant_id) return res.status(400).json({ error: 'Cross-tenant not allowed' });
  const now = ts ? Math.floor(ts/1000) : Math.floor(Date.now()/1000);

  const tx = db.transaction(() => {
    db.prepare('INSERT INTO tracking (tenant_id, person_device_id, room_device_id, rssi, ts) VALUES (?,?,?,?,?)')
      .run(person.tenant_id, person.id, room.id, rssi || 0, now);
    db.prepare('UPDATE devices SET last_seen = ?, online = 1 WHERE id = ?').run(now, person.id);
  });

  try {
    tx();
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// List tracking for tenant (sub-admin)
router.get('/list', authRequired, (req, res, next) => {
  if (req.user.role === 'tenant_user') return requireScope('tracking')(req, res, next);
  return requireRole('sub_admin','super_admin')(req, res, next);
}, (req, res) => {
  const tenantId = req.user.role === 'super_admin' && req.query.tenant_id ? Number(req.query.tenant_id) : req.user.tenant_id;
  const cutoff = Math.floor(Date.now()/1000) - Number(process.env.TRACKING_STALE_SEC || 360);

  const rows = db.prepare(`
    SELECT p.id as person_id, p.name as person_name, p.device_uid as person_uid,
           r.id as room_id, r.name as room_name, r.device_uid as room_uid,
           t.rssi as rssi, t.ts as ts
    FROM tracking t
    JOIN devices p ON p.id = t.person_device_id
    LEFT JOIN devices r ON r.id = t.room_device_id
    WHERE t.tenant_id = ? AND t.ts >= ?
    ORDER BY t.ts DESC
  `).all(tenantId, cutoff);

  // Deduplicate by person (latest first)
  const latestByPerson = new Map();
  for (const row of rows) {
    if (!latestByPerson.has(row.person_id)) latestByPerson.set(row.person_id, row);
  }

  // Determine offline status
  const offlineAfterSec = Number(process.env.OFFLINE_AFTER_SEC || 360);
  const now = Math.floor(Date.now()/1000);

  const list = Array.from(latestByPerson.values()).map(x => {
    const person = db.prepare('SELECT last_seen FROM devices WHERE id = ?').get(x.person_id);
    const isOffline = !person?.last_seen || (now - person.last_seen) > offlineAfterSec;
    return {
      person: { id: x.person_id, name: x.person_name, device_uid: x.person_uid },
      room: x.room_id ? { id: x.room_id, name: x.room_name, device_uid: x.room_uid } : null,
      rssi: x.rssi,
      ts: x.ts,
      online: isOffline ? 0 : 1
    };
  });

  res.json({ items: list });
});

module.exports = router;
