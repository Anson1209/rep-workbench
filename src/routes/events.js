'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');

// List all events (frontend groups by date)
router.get('/', (req, res) => {
  const list = db.getCollection('events').slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  res.json(list);
});

// Create
router.post('/', (req, res) => {
  const { date, title, description, reminderTime } = req.body || {};
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: '日期格式不正确' });
  if (!title || !title.trim()) return res.status(400).json({ error: '标题必填' });
  const e = {
    id: db.uid('e_'),
    date,
    title: title.trim(),
    description: (description || '').trim(),
    reminderTime: (reminderTime || '').trim(),
    createdAt: new Date().toISOString()
  };
  db.getCollection('events').push(e);
  db.save().then(() => res.json(e)).catch(err => res.status(500).json({ error: err.message }));
});

// Update
router.put('/:id', (req, res) => {
  const e = db.getCollection('events').find(x => x.id === req.params.id);
  if (!e) return res.status(404).json({ error: '未找到事务' });
  const { date, title, description, reminderTime } = req.body || {};
  if (date !== undefined) e.date = date;
  if (title !== undefined) e.title = title.trim();
  if (description !== undefined) e.description = description;
  if (reminderTime !== undefined) e.reminderTime = reminderTime;
  db.save().then(() => res.json(e)).catch(err => res.status(500).json({ error: err.message }));
});

// Delete
router.delete('/:id', (req, res) => {
  const col = db.getCollection('events');
  const idx = col.findIndex(x => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: '未找到事务' });
  col.splice(idx, 1);
  db.save().then(() => res.json({ ok: true })).catch(err => res.status(500).json({ error: err.message }));
});

module.exports = router;
