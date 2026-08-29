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

let cache = null;
let writeChain = Promise.resolve();

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function load() {
  if (cache) return cache;
  ensureDirs();
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      cache = Object.assign({}, EMPTY, parsed);
      if (!cache.customers) cache.customers = [];
      if (!cache.events) cache.events = [];
      if (!cache.surveys) cache.surveys = [];
      if (!cache.meta) cache.meta = EMPTY.meta;
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

// Synchronous save (used during init before async chain exists)
function saveSync() {
  ensureDirs();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

// Async, serialized save to avoid interleaved writes
function save() {
  writeChain = writeChain.then(() => {
    return new Promise((resolve, reject) => {
      try {
        ensureDirs();
        const tmp = DB_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
        fs.renameSync(tmp, DB_FILE);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
  return writeChain;
}

function getCollection(name) {
  const d = load();
  return d[name];
}

function uid(prefix) {
  return (prefix || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

module.exports = { load, save, getCollection, uid, BACKUP_DIR, DB_FILE };
