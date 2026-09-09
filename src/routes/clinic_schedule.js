'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');

// 4 个医院槽位 + 一周（周一~周日）的出门诊安排
// 顶层结构：
//   hospitals: [{ id, name, color, order }]  // 最多 4 个槽位，由用户配置
//   clinic_schedule: [{ id, hospitalId, weekday(1..7), period, timeRange, customerName, dept, weekStart, note, createdAt, updatedAt }]
//
// weekStart 形如 'YYYY-MM-DD'，是 ISO 周的周一。列表 GET 按 weekStart 过滤。

function ensureShape() {
  const d = db.load();
  if (!Array.isArray(d.hospitals)) d.hospitals = [];
  if (!Array.isArray(d.clinic_schedule)) d.clinic_schedule = [];
  if (!d.meta) d.meta = { version: 1, createdAt: new Date().toISOString() };
  return d;
}

function validWeekday(n) {
  return Number.isInteger(n) && n >= 1 && n <= 7;
}
function validPeriod(p) {
  return ['AM', 'PM', ''].includes(p);
}

// ---- Hospitals ----
// GET /api/clinic_schedule/meta/hospitals
router.get('/meta/hospitals', (req, res) => {
  const d = ensureShape();
  const list = d.hospitals.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json(list);
});

// PUT /api/clinic_schedule/meta/hospitals  body: [{ id?, name, color?, order? }]
// 整体替换医院槽位（最多 4 个），保留 id 以稳定引用历史数据
router.put('/meta/hospitals', (req, res) => {
  const d = ensureShape();
  const incoming = Array.isArray(req.body) ? req.body : null;
  if (!incoming) return res.status(400).json({ error: '参数必须是数组' });
  if (incoming.length > 4) return res.status(400).json({ error: '最多 4 个医院槽位' });
  for (const h of incoming) {
    if (!h.name || !String(h.name).trim()) return res.status(400).json({ error: '医院名称必填' });
  }
  // 保留旧 id，按传入顺序重新分配 order
  const next = incoming.map((h, idx) => ({
    id: h.id || ('h_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
    name: String(h.name).trim().slice(0, 30),
    color: /^#[0-9a-fA-F]{6}$/.test(h.color || '') ? h.color : '#3b82f6',
    order: idx
  }));
  // 删除那些已被丢弃的医院下的安排项
  const aliveIds = new Set(next.map(h => h.id));
  d.clinic_schedule = d.clinic_schedule.filter(it => aliveIds.has(it.hospitalId));
  d.hospitals = next;
  db.save().then(() => res.json(next)).catch(err => res.status(500).json({ error: err.message }));
});

// ---- Items ----
// GET /api/clinic_schedule?weekStart=YYYY-MM-DD
router.get('/', (req, res) => {
  const d = ensureShape();
  const ws = req.query.weekStart;
  let list = d.clinic_schedule;
  if (ws) list = list.filter(it => it.weekStart === ws);
  list = list.slice().sort((a, b) => {
    if (a.weekStart !== b.weekStart) return a.weekStart < b.weekStart ? -1 : 1;
    if (a.hospitalId !== b.hospitalId) return a.hospitalId < b.hospitalId ? -1 : 1;
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    return (a.timeRange || '').localeCompare(b.timeRange || '');
  });
  res.json(list);
});

// POST /api/clinic_schedule
router.post('/', (req, res) => {
  const d = ensureShape();
  const b = req.body || {};
  if (!b.hospitalId) return res.status(400).json({ error: '请选择医院' });
  if (!d.hospitals.some(h => h.id === b.hospitalId)) return res.status(400).json({ error: '医院不存在' });
  if (!validWeekday(Number(b.weekday))) return res.status(400).json({ error: '星期需在 1-7 之间' });
  if (!validPeriod(b.period)) return res.status(400).json({ error: '时段只能是 AM/PM/空' });
  if (!b.customerName || !String(b.customerName).trim()) return res.status(400).json({ error: '客户姓名必填' });
  if (!b.weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(b.weekStart)) return res.status(400).json({ error: '周起始日期格式不正确' });
  const now = new Date().toISOString();
  const it = {
    id: db.uid('s_'),
    hospitalId: b.hospitalId,
    weekday: Number(b.weekday),
    period: b.period || '',
    timeRange: (b.timeRange || '').trim().slice(0, 30),
    customerName: String(b.customerName).trim().slice(0, 30),
    dept: (b.dept || '').trim().slice(0, 30),
    weekStart: b.weekStart,
    note: (b.note || '').trim().slice(0, 200),
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
  if (b.hospitalId !== undefined) {
    if (!d.hospitals.some(h => h.id === b.hospitalId)) return res.status(400).json({ error: '医院不存在' });
    it.hospitalId = b.hospitalId;
  }
  if (b.weekday !== undefined) {
    if (!validWeekday(Number(b.weekday))) return res.status(400).json({ error: '星期需在 1-7 之间' });
    it.weekday = Number(b.weekday);
  }
  if (b.period !== undefined) {
    if (!validPeriod(b.period)) return res.status(400).json({ error: '时段只能是 AM/PM/空' });
    it.period = b.period;
  }
  if (b.timeRange !== undefined) it.timeRange = String(b.timeRange).trim().slice(0, 30);
  if (b.customerName !== undefined) {
    if (!String(b.customerName).trim()) return res.status(400).json({ error: '客户姓名必填' });
    it.customerName = String(b.customerName).trim().slice(0, 30);
  }
  if (b.dept !== undefined) it.dept = String(b.dept).trim().slice(0, 30);
  if (b.weekStart !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.weekStart)) return res.status(400).json({ error: '周起始日期格式不正确' });
    it.weekStart = b.weekStart;
  }
  if (b.note !== undefined) it.note = String(b.note).trim().slice(0, 200);
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