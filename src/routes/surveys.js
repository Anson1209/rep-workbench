'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');

// List / filter
router.get('/', (req, res) => {
  const { start, end, status, q } = req.query;
  let list = db.getCollection('surveys').slice();
  if (start) list = list.filter(s => s.date >= start);
  if (end) list = list.filter(s => s.date <= end);
  if (status) list = list.filter(s => s.status === status);
  if (q && q.trim()) {
    const t = q.trim().toLowerCase();
    list = list.filter(s => (s.target || '').toLowerCase().includes(t));
  }
  list.sort((a, b) => (a.date < b.date ? 1 : -1));
  res.json(list);
});

// Create
router.post('/', (req, res) => {
  const { date, target, count, status, note } = req.body || {};
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: '调研日期格式不正确' });
  if (!target || !target.trim()) return res.status(400).json({ error: '调研对象必填' });
  const s = {
    id: db.uid('s_'),
    date,
    target: target.trim(),
    count: parseInt(count, 10) || 0,
    status: status || 'done',
    note: (note || '').trim(),
    createdAt: new Date().toISOString()
  };
  db.getCollection('surveys').push(s);
  db.save().then(() => res.json(s)).catch(err => res.status(500).json({ error: err.message }));
});

// Update
router.put('/:id', (req, res) => {
  const s = db.getCollection('surveys').find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: '未找到记录' });
  const { date, target, count, status, note } = req.body || {};
  if (date !== undefined) s.date = date;
  if (target !== undefined) s.target = target.trim();
  if (count !== undefined) s.count = parseInt(count, 10) || 0;
  if (status !== undefined) s.status = status;
  if (note !== undefined) s.note = note;
  db.save().then(() => res.json(s)).catch(err => res.status(500).json({ error: err.message }));
});

// Delete
router.delete('/:id', (req, res) => {
  const col = db.getCollection('surveys');
  const idx = col.findIndex(x => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: '未找到记录' });
  col.splice(idx, 1);
  db.save().then(() => res.json({ ok: true })).catch(err => res.status(500).json({ error: err.message }));
});

module.exports = router;
