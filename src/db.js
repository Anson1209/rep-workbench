'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

const EMPTY = {
  customers: [],
  events: [],
  surveys: [],
  meta: { version: 1, createdAt: new Date().toISOString() }
};

const KEYS = ['customers', 'events', 'surveys', 'meta'];

let cache = null;
let writeChain = Promise.resolve();

// ---- Postgres (optional, env-gated by DATABASE_URL) ----
// Render 免费档磁盘临时：客户资料冷启动会清空。设了 DATABASE_URL 就把数据
// 存到外部 Postgres(如 Neon 免费库)，冷启动也不丢。不设则完全走本地 JSON 文件。
const USE_PG = !!process.env.DATABASE_URL;
let pgPool = null;
let pgAvailable = false;

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function normalize(d) {
  if (!d) d = {};
  if (!Array.isArray(d.customers)) d.customers = [];
  if (!Array.isArray(d.events)) d.events = [];
  if (!Array.isArray(d.surveys)) d.surveys = [];
  if (!d.meta) d.meta = JSON.parse(JSON.stringify(EMPTY.meta));
  return d;
}

// ================= JSON file mode (default / local / fallback) =================
function loadFromJson() {
  ensureDirs();
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      cache = normalize(Object.assign({}, EMPTY, parsed));
    } else {
      cache = JSON.parse(JSON.stringify(EMPTY));
      saveSync();
    }
  } catch (e) {
    console.error('[db] load failed, starting fresh:', e.message);
    cache = JSON.parse(JSON.stringify(EMPTY));
  }
  return cache;
}

function saveSync() {
  ensureDirs();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function saveJson() {
  ensureDirs();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

// ================= Postgres mode =================
async function initPgPool() {
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    const c = await pgPool.connect();
    try { await c.query('SELECT 1'); } finally { c.release(); }
    pgAvailable = true;
    console.log('[db] Postgres 已连接，数据将持久化到外部数据库');
  } catch (e) {
    console.error('[db] Postgres 不可用，回退到本地 JSON 文件:', e.message);
    pgAvailable = false;
  }
}

async function ensurePgSchema() {
  const c = await pgPool.connect();
  try {
    await c.query(
      'CREATE TABLE IF NOT EXISTS wb_store (key TEXT PRIMARY KEY, data JSONB, updated_at TIMESTAMPTZ DEFAULT now())'
    );
  } finally { c.release(); }
}

async function loadFromPg() {
  await ensurePgSchema();
  const c = await pgPool.connect();
  try {
    const r = await c.query('SELECT key, data FROM wb_store');
    const map = {};
    for (const row of r.rows) map[row.key] = row.data;
    cache = normalize(Object.assign({}, EMPTY, map));
  } finally { c.release(); }
}

async function savePg() {
  await ensurePgSchema();
  const c = await pgPool.connect();
  try {
    for (const key of KEYS) {
      const val = cache[key] !== undefined ? cache[key] : (key === 'meta' ? EMPTY.meta : []);
      await c.query(
        'INSERT INTO wb_store(key, data, updated_at) VALUES($1, $2::jsonb, now()) ' +
        'ON CONFLICT(key) DO UPDATE SET data = $2::jsonb, updated_at = now()',
        [key, JSON.stringify(val)]
      );
    }
  } finally { c.release(); }
}

// ================= Public API =================
async function init() {
  if (USE_PG) {
    await initPgPool();
    if (pgAvailable) {
      try { await loadFromPg(); return; }
      catch (e) { console.error('[db] Postgres 读取失败，改用本地 JSON:', e.message); }
    }
    // 回退：PG 启用但不可用
    loadFromJson();
  } else {
    loadFromJson();
  }
}

function load() {
  if (cache) return cache;
  if (!USE_PG) return loadFromJson();
  // PG 模式但 init 尚未完成（理论上不会发生，因为 listen 前已 await init）
  return (cache = JSON.parse(JSON.stringify(EMPTY)));
}

function save() {
  writeChain = writeChain.then(async () => {
    if (USE_PG && pgAvailable && pgPool) {
      try { await savePg(); return; }
      catch (e) { console.error('[db] Postgres 写入失败，回退本地 JSON:', e.message); }
    }
    saveJson();
  });
  return writeChain;
}

function getCollection(name) {
  return load()[name];
}

function uid(prefix) {
  return (prefix || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

module.exports = {
  init, load, save, getCollection, uid,
  BACKUP_DIR, DB_FILE,
  isPg: () => USE_PG && pgAvailable
};
