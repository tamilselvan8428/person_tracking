const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireRole, JWT_SECRET, authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

// Sub-admin creates tenant-scoped users with scopes (tracking, config)
router.post('/tenant-users', authRequired, requireRole('sub_admin'), (req, res) => {
  const { email, password, scopes } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  const scopesStr = Array.isArray(scopes) ? scopes.join(',') : (scopes || '');
  if (!scopesStr) return res.status(400).json({ error: 'Missing scopes' });
  const tenantId = req.user.tenant_id;
  try {
    const exists = db.prepare('SELECT id FROM tenant_users WHERE email = ?').get(email);
    if (exists) return res.status(400).json({ error: 'Email already exists' });
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare('INSERT INTO tenant_users (tenant_id, email, password_hash, scopes) VALUES (?,?,?,?)')
      .run(tenantId, email, hash, scopesStr);
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

  // Try platform users (super_admin/sub_admin)
  const row = db.prepare('SELECT id, email, password_hash, role, tenant_id FROM users WHERE email = ?').get(email);
  if (row && bcrypt.compareSync(password, row.password_hash)) {
    const token = jwt.sign({ id: row.id, email: row.email, role: row.role, tenant_id: row.tenant_id }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { id: row.id, email: row.email, role: row.role, tenant_id: row.tenant_id } });
  }
  // Try tenant_users (role tenant_user with scopes)
  const tuser = db.prepare('SELECT id, tenant_id, email, password_hash, scopes FROM tenant_users WHERE email = ?').get(email);
  if (tuser && bcrypt.compareSync(password, tuser.password_hash)) {
    const payload = { id: tuser.id, email: tuser.email, role: 'tenant_user', tenant_id: tuser.tenant_id, scopes: tuser.scopes };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: payload });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

// Super admin creates sub-admin and tenant if needed
router.post('/subadmins', authRequired, requireRole('super_admin'), (req, res) => {
  const { email, password, tenantName } = req.body;
  if (!email || !password || !tenantName) return res.status(400).json({ error: 'Missing email, password, or tenantName' });

  const tx = db.transaction(() => {
    let tenant = db.prepare('SELECT id FROM tenants WHERE name = ?').get(tenantName);
    if (!tenant) {
      const info = db.prepare('INSERT INTO tenants (name) VALUES (?)').run(tenantName);
      tenant = { id: info.lastInsertRowid };
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) throw new Error('Email already exists');
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare('INSERT INTO users (tenant_id, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(tenant.id, email, hash, 'sub_admin');
    return { userId: info.lastInsertRowid, tenantId: tenant.id };
  });

  try {
    const { userId, tenantId } = tx();
    res.json({ ok: true, userId, tenantId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Sub-admin creates tenant-scoped users with scopes (tracking, config)
router.post('/tenant-users', authRequired, requireRole('sub_admin'), (req, res) => {
  const { email, password, scopes } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  const scopesStr = Array.isArray(scopes) ? scopes.join(',') : (scopes || '');
  if (!scopesStr) return res.status(400).json({ error: 'Missing scopes' });
  const tenantId = req.user.tenant_id;
  try {
    const exists = db.prepare('SELECT id FROM tenant_users WHERE email = ?').get(email);
    if (exists) return res.status(400).json({ error: 'Email already exists' });
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare('INSERT INTO tenant_users (tenant_id, email, password_hash, scopes) VALUES (?,?,?,?)')
      .run(tenantId, email, hash, scopesStr);
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
