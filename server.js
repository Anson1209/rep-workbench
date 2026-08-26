'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./src/db');
const crypto = require('./src/crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));

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

// Stats for dashboard header
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
