'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', 'data'), '.key');
const ALGO = 'aes-256-gcm';

function loadKey() {
  // 1) 显式 CRYPTO_KEY（64 hex = 32 字节），最稳，独立于登录密码。
  const ck = process.env.CRYPTO_KEY;
  if (ck && /^[0-9a-fA-F]{64}$/.test(ck)) return Buffer.from(ck, 'hex');
  // 2) 由 AUTH_SECRET 派生（≥32 位）。设了它，冷启动密钥不变，
  //    存在 Postgres 里的加密身份证/银行卡字段依旧可解密。
  const sec = process.env.AUTH_SECRET;
  if (sec && sec.length >= 32) return crypto.createHash('sha256').update(sec, 'utf8').digest();
  // 3) 兜底：临时磁盘文件（本地开发 / 非 Render 环境）。
  //    Render 免费档清盘后会重新随机生成，导致旧密文无法解密——故优先用上面环境变量。
  try {
    if (fs.existsSync(KEY_FILE)) {
      const k = fs.readFileSync(KEY_FILE, 'utf8').trim();
      if (k.length === 64) return Buffer.from(k, 'hex');
    }
  } catch (e) { /* fall through to regenerate */ }
  const k = crypto.randomBytes(32);
  try {
    fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
    fs.writeFileSync(KEY_FILE, k.toString('hex'), { mode: 0o600 });
  } catch (e) { /* non-fatal in some envs */ }
  return k;
}

const KEY = loadKey();

// Encrypt a UTF-8 string -> base64 "iv:tag:ct"
function encrypt(plain) {
  if (plain === null || plain === undefined || plain === '') return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

// Decrypt base64 "iv:tag:ct" -> UTF-8 string
function decrypt(payload) {
  if (!payload) return '';
  try {
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch (e) {
    return '';
  }
}

// Mask helpers (display safety)
function maskIdCard(v) {
  if (!v) return '';
  if (v.length <= 7) return v[0] + '****' + v.slice(-1);
  return v.slice(0, 3) + '*'.repeat(v.length - 7) + v.slice(-4);
}
function maskBankCard(v) {
  if (!v) return '';
  const digits = v.replace(/\s/g, '');
  if (digits.length <= 4) return '****';
  return '**** **** **** ' + digits.slice(-4);
}
function maskPhone(v) {
  if (!v || v.length < 7) return v || '';
  return v.slice(0, 3) + '****' + v.slice(-4);
}

module.exports = { encrypt, decrypt, maskIdCard, maskBankCard, maskPhone };
