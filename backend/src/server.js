require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { authRequired } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const trackingRoutes = require('./routes/tracking');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/tracking', trackingRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
