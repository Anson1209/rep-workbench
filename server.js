'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./src/db');
const crypto = require('./src/crypto');
const auth = require('./src/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));

// Seed initial password from APP_PASSWORD env (optional, set privately in
// Render dashboard) before serving anything.
auth.ensureInitial();

// ---- Public auth endpoints (no token required) ----
app.get('/api/auth/status', (req, res) => {
  res.json({ configured: auth.isConfigured() });
});

app.post('/api/auth/setup', (req, res) => {
  if (auth.isConfigured()) return res.status(409).json({ error: '密码已设置' });
  const pw = req.body && req.body.password;
  try {
    auth.setPassword(pw);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  res.json({ token: auth.issueToken() });
});

app.post('/api/login', (req, res) => {
  if (!auth.isConfigured()) return res.status(400).json({ error: '请先设置访问密码' });
  const pw = req.body && req.body.password;
  if (!auth.verifyPassword(pw)) return res.status(401).json({ error: '密码错误' });
  res.json({ token: auth.issueToken() });
});

app.post('/api/auth/change-password', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: '未授权', code: 'AUTH_REQUIRED' });
  const oldP = req.body && req.body.oldPassword;
  const newP = req.body && req.body.newPassword;
  if (!auth.verifyPassword(oldP)) return res.status(401).json({ error: '原密码错误' });
  try {
    auth.setPassword(newP);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  res.json({ token: auth.issueToken() });
});

// ---- Auth guard: everything under /api except the public list needs a token ----
const PUBLIC_PATHS = ['/auth/status', '/auth/setup', '/login', '/stats'];
function checkAuth(req) {
  const h = req.headers['authorization'] || '';
  const m = h.match(/^Bearer\s+(.+)$/);
  if (!m) return false;
  return auth.verifyToken(m[1]);
}
app.use('/api', (req, res, next) => {
  if (PUBLIC_PATHS.includes(req.path)) return next();
  if (checkAuth(req)) return next();
  return res.status(401).json({ error: '未授权，请先登录', code: 'AUTH_REQUIRED' });
});

// API routes
app.use('/api/customers', require('./src/routes/customers'));
app.use('/api/events', require('./src/routes/events'));
app.use('/api/surveys', require('./src/routes/surveys'));
app.use('/api/files', require('./src/routes/files'));

// Backup export (raw db, encrypted fields preserved)
app.get('/api/backup', (req, res) => {
  const data = db.load();
  res.setHeader('Content-Disposition', `attachment; filename="workbench-backup-${Date.now()}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.json(data);
});

// Backup import / restore
app.post('/api/backup', (req, res) => {
  const body = req.body;
  if (!body || !Array.isArray(body.customers)) return res.status(400).json({ error: '备份文件格式不正确' });
  const cache = db.load();
  cache.customers = body.customers || [];
  cache.events = body.events || [];
  cache.surveys = body.surveys || [];
  cache.meta = body.meta || { version: 1, createdAt: new Date().toISOString() };
  db.save().then(() => res.json({ ok: true })).catch(e => res.status(500).json({ error: e.message }));
});

// Stats for dashboard header (open, counts only — no PII)
app.get('/api/stats', (req, res) => {
  const d = db.load();
  res.json({
    customers: d.customers.length,
    events: d.events.length,
    surveys: d.surveys.length
  });
});

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`医药代表工作台已启动: http://localhost:${PORT}`);
});
