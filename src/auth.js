'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', 'data');
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');
const SECRET_FILE = path.join(DATA_DIR, '.authsecret');

// Stable secret for signing tokens (persisted per deploy). If it changes,
// existing tokens become invalid (user just re-logs in).
function loadSecret() {
  // 固定密钥通过环境变量注入：Render 免费档每次冷启动都会清空磁盘，
  // 若密钥只存在磁盘上，冷启动后会变化、导致所有已登录会话失效。
  // 设了 AUTH_SECRET 后，冷启动后旧 token 依旧有效，用户无需重新登录。
  const envSecret = process.env.AUTH_SECRET;
  if (envSecret && envSecret.length >= 16) return envSecret;
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const s = fs.readFileSync(SECRET_FILE, 'utf8').trim();
      if (s) return s;
    }
  } catch (e) { /* fall through */ }
  const s = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SECRET_FILE, s, { mode: 0o600 });
  } catch (e) { /* best effort */ }
  return s;
}
const SECRET = loadSecret();

function sha256(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function loadAuth() {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const a = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
      if (a && a.hash && a.salt) return a;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function saveAuth(a) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify(a, null, 2), { mode: 0o600 });
}

function isConfigured() {
  return !!loadAuth();
}

// 冷启动自愈：auth.json 缺失（Render 免费档清盘）时，自动初始化访问密码。
// 优先用 APP_PASSWORD 环境变量；未设置则回退到约定密码 891209，
// 保证公开站永远可登录、不再卡在"未授权"。
function ensureInitial() {
  if (isConfigured()) return;
  const envPw = process.env.APP_PASSWORD || '891209';
  if (envPw && envPw.length >= 6) {
    try { setPassword(envPw); } catch (e) { /* ignore */ }
  }
}

function setPassword(password) {
  if (!password || password.length < 6) throw new Error('密码至少需要 6 位');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = sha256(salt + '|' + password);
  saveAuth({ salt, hash, updatedAt: new Date().toISOString() });
}

function verifyPassword(password) {
  const a = loadAuth();
  if (!a) return false;
  const candidate = sha256(a.salt + '|' + (password || ''));
  try {
    return crypto.timingSafeEqual(Buffer.from(a.hash, 'hex'), Buffer.from(candidate, 'hex'));
  } catch (e) { return false; }
}

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function issueToken() {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { iat: Date.now(), exp: Date.now() + 1000 * 60 * 60 * 24 * 30 };
  const data = b64url(header) + '.' + b64url(payload);
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return data + '.' + sig;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const data = parts[0] + '.' + parts[1];
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  let ok = sig.length === parts[2].length;
  if (ok) {
    for (let i = 0; i < sig.length; i++) ok = ok && sig[i] === parts[2][i];
  }
  if (!ok) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return false;
    return true;
  } catch (e) { return false; }
}

module.exports = {
  isConfigured, ensureInitial, setPassword, verifyPassword,
  issueToken, verifyToken
};
