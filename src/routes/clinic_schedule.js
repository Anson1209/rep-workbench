'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');

// 客户出门诊时间（长期固定）
// 顶层结构：
//   clinic_schedule: [
//     { id, weekday(1..7), period('AM'|'PM'), customerName, timeRange?, note?, order, createdAt, updatedAt }
//   ]
// 没有 hospitals 集合，没有 weekStart 概念 —— 长期固定，按 weekday × period 展示。
// 单元格 = (weekday, period)；一个单元格可容纳多条记录（多家医院客户）。

const PERIODS = ['AM', 'PM'];

function ensureShape() {
  const d = db.load();
  // 旧版本遗留的 hospitals 数组不再使用，丢弃
  if (Array.isArray(d.hospitals)) delete d.hospitals;
  if (!Array.isArray(d.clinic_schedule)) {
    d.clinic_schedule = [];
  } else {
    // 迁移旧数据：剥离 hospitalId / weekStart / dept，period 默认 AM，order 默认 0
    d.clinic_schedule = d.clinic_schedule.map(it => {
      const { hospitalId, weekStart, dept, ...rest } = it;
      return {
        ...rest,
        period: rest.period === 'PM' ? 'PM' : 'AM',
        order: typeof rest.order === 'number' ? rest.order : 0
      };
    });
  }
  if (!d.meta) d.meta = { version: 1, createdAt: new Date().toISOString() };
  return d;
}

function validWeekday(n) {
  return Number.isInteger(n) && n >= 1 && n <= 7;
}

// GET /api/clinic_schedule
router.get('/', (req, res) => {
  const d = ensureShape();
  const list = d.clinic_schedule.slice().sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    if (a.period !== b.period) return a.period === 'AM' ? -1 : 1;
    return (a.order || 0) - (b.order || 0);
  });
  res.json(list);
});

// POST /api/clinic_schedule
router.post('/', (req, res) => {
  const d = ensureShape();
  const b = req.body || {};
  if (!validWeekday(Number(b.weekday))) return res.status(400).json({ error: '星期需在 1-7 之间' });
  if (!PERIODS.includes(b.period)) return res.status(400).json({ error: '时段只能是 AM 或 PM' });
  if (!b.customerName || !String(b.customerName).trim()) return res.status(400).json({ error: '客户姓名必填' });
  const now = new Date().toISOString();
  const it = {
    id: db.uid('s_'),
    weekday: Number(b.weekday),
    period: b.period,
    customerName: String(b.customerName).trim().slice(0, 30),
    timeRange: (b.timeRange || '').trim().slice(0, 30),
    note: (b.note || '').trim().slice(0, 200),
    order: Number.isFinite(Number(b.order)) ? Number(b.order) : 0,
    createdAt: now,
    updatedAt: now
  };
  d.clinic_schedule.push(it);
  db.save().then(() => res.json(it)).catch(err => res.status(500).json({ error: err.message }));
});

// PUT /api/clinic_schedule/:id
router.put('/:id', (req, res) => {
  const d = ensureShape();
  const it = d.clinic_schedule.find(x => x.id === req.params.id);
  if (!it) return res.status(404).json({ error: '未找到记录' });
  const b = req.body || {};
  if (b.weekday !== undefined) {
    if (!validWeekday(Number(b.weekday))) return res.status(400).json({ error: '星期需在 1-7 之间' });
    it.weekday = Number(b.weekday);
  }
  if (b.period !== undefined) {
    if (!PERIODS.includes(b.period)) return res.status(400).json({ error: '时段只能是 AM 或 PM' });
    it.period = b.period;
  }
  if (b.customerName !== undefined) {
    if (!String(b.customerName).trim()) return res.status(400).json({ error: '客户姓名必填' });
    it.customerName = String(b.customerName).trim().slice(0, 30);
  }
  if (b.timeRange !== undefined) it.timeRange = String(b.timeRange).trim().slice(0, 30);
  if (b.note !== undefined) it.note = String(b.note).trim().slice(0, 200);
  if (b.order !== undefined) it.order = Number(b.order) || 0;
  it.updatedAt = new Date().toISOString();
  db.save().then(() => res.json(it)).catch(err => res.status(500).json({ error: err.message }));
});

// DELETE /api/clinic_schedule/:id
router.delete('/:id', (req, res) => {
  const d = ensureShape();
  const idx = d.clinic_schedule.findIndex(x => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: '未找到记录' });
  d.clinic_schedule.splice(idx, 1);
  db.save().then(() => res.json({ ok: true })).catch(err => res.status(500).json({ error: err.message }));
});

module.exports = router;