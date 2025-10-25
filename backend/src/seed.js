require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@12345';

function ensureSuperAdmin() {
  const existing = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('super_admin');
  if (existing) {
    console.log('Super admin already exists');
    return existing.id;
  }
  let tenant = db.prepare('SELECT id FROM tenants WHERE name = ?').get('Global');
  if (!tenant) {
    const info = db.prepare('INSERT INTO tenants (name) VALUES (?)').run('Global');
    tenant = { id: info.lastInsertRowid };
  }
  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  const info = db.prepare('INSERT INTO users (tenant_id, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(tenant.id, ADMIN_EMAIL, hash, 'super_admin');
  console.log('Super admin created:', ADMIN_EMAIL);
  return info.lastInsertRowid;
}

ensureSuperAdmin();
console.log('Seeding complete');
