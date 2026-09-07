'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');

// 问卷调研台账 —— 项目类型（大区/BU）、额度（500/800）、≤3 次上限、≥30 天间隔校验。
// 同 projectType + expertName 的所有记录共享一个额度池。
const PROJECT_TYPES = { '大区': 500, 'BU': 800 };
const MAX_USAGE_PER_EXPERT = 3;
const MIN_INTERVAL_DAYS = 30;
// 2026-06-01 之前的调研不受 30 天间隔约束；仅 6 月及之后录入的才校验间隔。
const EXEMPT_BEFORE = '2026-06-01';
const VALID_REMINDER = ['normal', 'warning', 'violation'];

// 按 (projectType, expertName) 维度从全表过滤；忽略大小写差异。
function sameExpertKey(rec, projectType, expertName) {
  if (!rec) return false;
  if ((rec.projectType || '') !== projectType) return false;
  if ((rec.expertName || rec.target || '').trim() !== expertName.trim()) return false;
  return true;
}

// 把 ISO 日期差按"自然天"算（避免跨月天数坑），返回正整数天数或 null
function daysBetween(prevISO, nextISO) {
  if (!prevISO || !nextISO) return null;
  const a = new Date(prevISO + 'T00:00:00Z');
  const b = new Date(nextISO + 'T00:00:00Z');
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

// 计算提醒状态：与该专家本次之前最近一条记录比较，间隔不足 30 天则违规。
// isUpdate 时排除自身；returnReason=true 时返回字符串原因，否则返回 null。
function computeReminder(col, expertName, projectType, usageDate, excludeId) {
  // 2026-06-01 之前录入的调研不受 30 天间隔约束，直接视为正常。
  if (usageDate && usageDate < EXEMPT_BEFORE) {
    return { status: 'normal', reason: '', prevUsageDate: null, daysSincePrev: null, exempt: true };
  }
  let prev = null;
  for (const r of col) {
    if (excludeId && r.id === excludeId) continue;
    if (!sameExpertKey(r, projectType, expertName)) continue;
    if (!r.usageDate) continue;
    if (usageDate && r.usageDate > usageDate) continue; // 只看更早的
    if (!prev || r.usageDate > prev.usageDate) prev = r;
  }
  if (!prev) return { status: 'normal', reason: '', prevUsageDate: null, daysSincePrev: null };
  const d = daysBetween(prev.usageDate, usageDate);
  if (d === null) return { status: 'normal', reason: '', prevUsageDate: prev.usageDate, daysSincePrev: null };
  if (d < MIN_INTERVAL_DAYS) {
    return {
      status: 'violation',
      reason: '距上次使用仅 ' + d + ' 天，间隔不足 ' + MIN_INTERVAL_DAYS + ' 天',
      prevUsageDate: prev.usageDate,
      daysSincePrev: d
    };
  }
  return {
    status: 'normal',
    reason: '',
    prevUsageDate: prev.usageDate,
    daysSincePrev: d
  };
}

// 统计该专家在同 projectType 下已登记的次数
function usageCountOf(col, expertName, projectType, excludeId) {
  let n = 0;
  for (const r of col) {
    if (excludeId && r.id === excludeId) continue;
    if (sameExpertKey(r, projectType, expertName)) n++;
  }
  return n;
}

// List / filter —— 同时支持老字段（target/count/status/note）以防旧数据混用
router.get('/', (req, res) => {
  const { start, end, date, status, projectType, reminder, q } = req.query;
  let list = db.getCollection('surveys').slice();
  if (start) list = list.filter(s => (s.usageDate || s.date) >= start);
  if (end) list = list.filter(s => (s.usageDate || s.date) <= end);
  if (date) list = list.filter(s => (s.usageDate || s.date) === date);
  if (status) list = list.filter(s => (s.status || 'done') === status);
  if (projectType) list = list.filter(s => (s.projectType || '') === projectType);
  if (reminder) list = list.filter(s => (s.reminderStatus || 'normal') === reminder);
  if (q && q.trim()) {
    const t = q.trim().toLowerCase();
    list = list.filter(s => {
      const name = (s.expertName || s.target || '').toLowerCase();
      return name.includes(t);
    });
  }
  list.sort((a, b) => {
    const ad = a.usageDate || a.date || '';
    const bd = b.usageDate || b.date || '';
    if (ad !== bd) return ad < bd ? 1 : -1;
    return (a.createdAt || '') < (b.createdAt || '') ? 1 : -1;
  });
  // 回包前补一次 reminderStatus 计算（防止历史脏数据或后端迁移遗漏）
  list = list.map(s => {
    if (!s.expertName || !s.projectType) return s;
    const r = computeReminder(db.getCollection('surveys'), s.expertName, s.projectType, s.usageDate, s.id);
    return Object.assign({}, s, { reminderStatus: r.status, reminderReason: r.reason });
  });
  res.json(list);
});

// Create
router.post('/', (req, res) => {
  const { usageDate, expertName, projectType, note } = req.body || {};
  if (!projectType || !PROJECT_TYPES[projectType]) {
    return res.status(400).json({ error: '请选择项目类型（大区/BU）' });
  }
  if (!expertName || !expertName.trim()) return res.status(400).json({ error: '专家姓名必填' });
  if (!usageDate || !/^\d{4}-\d{2}-\d{2}$/.test(usageDate)) {
    return res.status(400).json({ error: '调研日期格式不正确' });
  }
  const col = db.getCollection('surveys');
  const expert = expertName.trim();

  // 3 次上限校验
  const used = usageCountOf(col, expert, projectType);
  if (used >= MAX_USAGE_PER_EXPERT) {
    return res.status(400).json({
      error: '该专家在【' + projectType + '】项目下已使用 ' + used + ' 次，达到上限 ' + MAX_USAGE_PER_EXPERT + ' 次，不能再登记'
    });
  }

  // 间隔校验（不阻止创建，但打上状态）
  const rem = computeReminder(col, expert, projectType, usageDate, null);

  const s = {
    id: db.uid('s_'),
    usageDate,
    expertName: expert,
    projectType,
    amount: PROJECT_TYPES[projectType],
    reminderStatus: rem.status,
    reminderReason: rem.reason,
    note: (note || '').trim(),
    // 兼容字段（旧前端可能还在用，PUT/GET 不影响）
    date: usageDate,
    target: expert,
    count: used + 1,
    status: 'done',
    createdAt: new Date().toISOString()
  };
  col.push(s);
  db.save().then(() => res.json(s)).catch(err => res.status(500).json({ error: err.message }));
});

// Update
router.put('/:id', (req, res) => {
  const col = db.getCollection('surveys');
  const s = col.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: '未找到记录' });
  const { usageDate, expertName, projectType, note } = req.body || {};
  // 字段更新
  if (projectType !== undefined) {
    if (!PROJECT_TYPES[projectType]) return res.status(400).json({ error: '项目类型必须是大区/BU' });
    s.projectType = projectType;
    s.amount = PROJECT_TYPES[projectType];
  }
  if (expertName !== undefined) {
    if (!expertName.trim()) return res.status(400).json({ error: '专家姓名不能为空' });
    s.expertName = expertName.trim();
  }
  if (usageDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(usageDate)) return res.status(400).json({ error: '调研日期格式不正确' });
    s.usageDate = usageDate;
    s.date = usageDate;
  }
  if (note !== undefined) s.note = note;

  // 校验：若变更后该专家同项目下次数 > 3
  const used = usageCountOf(col, s.expertName, s.projectType, s.id);
  if (used > MAX_USAGE_PER_EXPERT) {
    return res.status(400).json({
      error: '该专家在【' + s.projectType + '】项目下使用次数已达 ' + used + '，超过上限 ' + MAX_USAGE_PER_EXPERT
    });
  }

  // 重算 reminder
  const rem = computeReminder(col, s.expertName, s.projectType, s.usageDate, s.id);
  s.reminderStatus = rem.status;
  s.reminderReason = rem.reason;
  // 同步兼容字段
  s.target = s.expertName;
  s.count = used + 1;
  s.status = 'done';

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