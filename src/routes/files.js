'use strict';
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../db');

const UPLOAD_ROOT = path.join(process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', '..', 'data'), 'uploads');

function findFile(fileId) {
  for (const c of db.getCollection('customers')) {
    for (const section of ['profile', 'identity']) {
      const f = (c.attachments[section] || []).find(x => x.id === fileId);
      if (f) return { customerId: c.id, section, f };
    }
  }
  return null;
}

router.get('/:fileId', async (req, res) => {
  const found = findFile(req.params.fileId);
  if (!found) return res.status(404).json({ error: '文件不存在' });
  let buf = null;
  const mime = found.f.mimeType || 'application/octet-stream';
  if (db.isPg()) {
    // PG 模式：字节在 Neon BYTEA，冷启动/重启/deploy 都不丢
    const rec = await db.getFileBytes(found.f.id);
    if (!rec) return res.status(404).json({ error: '文件已丢失' });
    buf = rec.data; // Buffer
    if (rec.mimeType) res.setHeader('Content-Type', rec.mimeType);
    else res.setHeader('Content-Type', mime);
  } else {
    const fp = path.join(UPLOAD_ROOT, found.customerId, found.section, found.f.storedName);
    if (!fs.existsSync(fp)) return res.status(404).json({ error: '文件已丢失' });
    buf = fs.readFileSync(fp);
    res.setHeader('Content-Type', mime);
  }
  const download = req.query.download === '1';
  const disp = download ? 'attachment' : 'inline';
  res.setHeader('Content-Disposition', `${disp}; filename*=UTF-8''${encodeURIComponent(found.f.name)}`);
  res.send(buf);
});

module.exports = router;
