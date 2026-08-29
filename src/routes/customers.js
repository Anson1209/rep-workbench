'use strict';
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const crypto = require('../crypto');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'data', 'uploads');

const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'doc', 'docx', 'xls', 'xlsx', 'pdf', 'ppt', 'pptx'];
const MAX_SIZE = 25 * 1024 * 1024; // 25MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 }
});

function extOf(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}
function isImage(mime, ext) {
  return ['png', 'jpg', 'jpeg'].includes(ext) || /image\//.test(mime || '');
}
function validatePhone(p) {
  return /^1[3-9]\d{9}$/.test(p || '');
}
function validateIdCard(id) {
  if (!/^\d{17}[\dXx]$/.test(id || '')) return false;
  // checksum
  const w = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const codes = '10X98765432';
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += parseInt(id[i], 10) * w[i];
  return codes[sum % 11] === id[17].toUpperCase();
}
function validateBank(v) {
  const d = (v || '').replace(/\s/g, '');
  return /^\d{12,19}$/.test(d);
}

function pubCustomer(c) {
  // masked view for lists
  return {
    id: c.id,
    hospital: c.hospital,
    name: c.name,
    idCardMask: crypto.maskIdCard(crypto.decrypt(c.idCardEnc)),
    bankCardMask: crypto.maskBankCard(crypto.decrypt(c.bankCardEnc)),
    phoneMask: crypto.maskPhone(c.phone),
    phone: c.phone,
    attachments: {
      profile: (c.attachments.profile || []).map(stripFile),
      identity: (c.attachments.identity || []).map(stripFile)
    },
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  };
}
function fullCustomer(c) {
  return {
    id: c.id,
    hospital: c.hospital,
    name: c.name,
    idCard: crypto.decrypt(c.idCardEnc),
    bankCard: crypto.decrypt(c.bankCardEnc),
    phone: c.phone,
    attachments: {
      profile: (c.attachments.profile || []).map(stripFile),
      identity: (c.attachments.identity || []).map(stripFile)
    },
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  };
}
function stripFile(f) {
  return {
    id: f.id, name: f.name, mimeType: f.mimeType,
    size: f.size, section: f.section, uploadedAt: f.uploadedAt, isImage: f.isImage
  };
}

// List / search
router.get('/', (req, res) => {
  const data = db.getCollection('customers');
  const q = (req.query.q || '').trim().toLowerCase();
  let list = data;
  if (q) {
    list = data.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q)
    );
  }
  res.json(list.map(pubCustomer));
});

// Create
router.post('/', (req, res) => {
  const { hospital, name, idCard, bankCard, phone } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: '姓名必填' });
  if (!validatePhone(phone)) return res.status(400).json({ error: '手机号格式不正确（应为 11 位，1 开头）' });
  if (!validateIdCard(idCard)) return res.status(400).json({ error: '身份证号格式不正确' });
  if (!validateBank(bankCard)) return res.status(400).json({ error: '银行卡号格式不正确（12-19 位数字）' });
  const now = new Date().toISOString();
  const c = {
    id: db.uid('c_'),
    hospital: (hospital || '').trim(),
    name: name.trim(),
    idCardEnc: crypto.encrypt(idCard.trim()),
    bankCardEnc: crypto.encrypt(bankCard.replace(/\s/g, '').trim()),
    phone: phone.trim(),
    attachments: { profile: [], identity: [] },
    createdAt: now,
    updatedAt: now
  };
  db.getCollection('customers').push(c);
  db.save().then(() => res.json(fullCustomer(c))).catch(e => res.status(500).json({ error: e.message }));
});

// Get one (full, decrypted) for editing
router.get('/:id', (req, res) => {
  const c = db.getCollection('customers').find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: '未找到客户' });
  res.json(fullCustomer(c));
});

// Reveal sensitive (explicit)
router.get('/:id/reveal', (req, res) => {
  const c = db.getCollection('customers').find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: '未找到客户' });
  res.json({ idCard: crypto.decrypt(c.idCardEnc), bankCard: crypto.decrypt(c.bankCardEnc), phone: c.phone });
});

// Update
router.put('/:id', (req, res) => {
  const c = db.getCollection('customers').find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: '未找到客户' });
  const { hospital, name, idCard, bankCard, phone } = req.body || {};
  if (phone !== undefined && !validatePhone(phone)) return res.status(400).json({ error: '手机号格式不正确' });
  if (idCard !== undefined && !validateIdCard(idCard)) return res.status(400).json({ error: '身份证号格式不正确' });
  if (bankCard !== undefined && !validateBank(bankCard)) return res.status(400).json({ error: '银行卡号格式不正确' });
  if (name !== undefined && !name.trim()) return res.status(400).json({ error: '姓名必填' });
  if (hospital !== undefined) c.hospital = hospital.trim();
  if (name !== undefined) c.name = name.trim();
  if (phone !== undefined) c.phone = phone.trim();
  if (idCard !== undefined) c.idCardEnc = crypto.encrypt(idCard.trim());
  if (bankCard !== undefined) c.bankCardEnc = crypto.encrypt(bankCard.replace(/\s/g, '').trim());
  c.updatedAt = new Date().toISOString();
  db.save().then(() => res.json(fullCustomer(c))).catch(e => res.status(500).json({ error: e.message }));
});

// Delete
router.delete('/:id', (req, res) => {
  const col = db.getCollection('customers');
  const idx = col.findIndex(x => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: '未找到客户' });
  const [removed] = col.splice(idx, 1);
  // remove upload folder
  const dir = path.join(UPLOAD_ROOT, removed.id);
  fs.rm(dir, { recursive: true, force: true }, () => {});
  db.save().then(() => res.json({ ok: true })).catch(e => res.status(500).json({ error: e.message }));
});

// Upload attachment
router.post('/:id/attachments', upload.single('file'), (req, res) => {
  const c = db.getCollection('customers').find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: '未找到客户' });
  const section = req.query.section === 'identity' ? 'identity' : 'profile';
  if (!req.file) return res.status(400).json({ error: '未收到文件' });
  const ext = extOf(req.file.originalname);
  if (!ALLOWED_EXT.includes(ext)) return res.status(400).json({ error: '不支持的文件类型' });
  // multer/busboy 默认按 latin1 解码上传文件名，中文会乱码；此处还原为 UTF-8
  let rawName = req.file.originalname;
  try { rawName = Buffer.from(rawName, 'latin1').toString('utf8'); } catch (e) {}
  const safeName = rawName.replace(/[^\w.\u4e00-\u9fa5-]/g, '_');
  const storedName = db.uid('f_') + '.' + ext;
  const dir = path.join(UPLOAD_ROOT, c.id, section);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, storedName), req.file.buffer);
  const meta = {
    id: db.uid('a_'),
    name: safeName,
    mimeType: req.file.mimetype || 'application/octet-stream',
    size: req.file.size,
    storedName,
    section,
    isImage: isImage(req.file.mimetype, ext),
    uploadedAt: new Date().toISOString()
  };
  c.attachments[section].push(meta);
  c.updatedAt = new Date().toISOString();
  db.save().then(() => res.json(stripFile(meta))).catch(e => res.status(500).json({ error: e.message }));
});

// Delete attachment
router.delete('/attachments/:fileId', (req, res) => {
  const col = db.getCollection('customers');
  for (const c of col) {
    for (const section of ['profile', 'identity']) {
      const arr = c.attachments[section] || [];
      const idx = arr.findIndex(f => f.id === req.params.fileId);
      if (idx >= 0) {
        const [f] = arr.splice(idx, 1);
        const fp = path.join(UPLOAD_ROOT, c.id, section, f.storedName);
        fs.rm(fp, { force: true }, () => {});
        db.save().then(() => res.json({ ok: true })).catch(e => res.status(500).json({ error: e.message }));
        return;
      }
    }
  }
  res.status(404).json({ error: '未找到附件' });
});

module.exports = router;
