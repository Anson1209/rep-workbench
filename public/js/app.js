/* global window, document */
(function () {
  'use strict';
  // Build fingerprint — 在浏览器 F12 控制台里看，用来判断线上是不是最新代码
  console.log('%c[rep-workbench] build 8e3c1a7 · 2026-08-30 22:30 · 干掉"打开"按钮(被弹窗拦截)，下载按钮加loading反馈', 'background:#0a7;color:#fff;padding:2px 6px;border-radius:4px');

  const { esc, toast } = window.UI;

  const ICON = {
    dashboard: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 L12 3 L21 11 V20 a1 1 0 0 1 -1 1 H15 V14 H9 V21 H4 a1 1 0 0 1 -1 -1 Z"/></svg>',
    customers: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm13 8v-1a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    survey: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    add: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    settings: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
  };

  const NAV = [
    { key: 'dashboard', label: '项目', icon: ICON.dashboard, title: '项目概览', module: 'Dashboard' },
    { key: 'customers', label: '客户资料', icon: ICON.customers, title: '客户资料', module: 'Customers' },
    { key: 'calendar', label: '关键事宜', icon: ICON.calendar, title: '关键事宜提醒', module: 'Calendar' },
    { key: 'survey', label: '问卷台账', icon: ICON.survey, title: '问卷调研台账', module: 'Survey' },
    { key: 'add', label: '添加模块', icon: ICON.add, title: '添加新板块', placeholder: true },
    { key: 'settings', label: '设置', icon: ICON.settings, title: '设置', module: 'Settings' }
  ];

  let current = 'dashboard';

  function renderNav() {
    const nav = document.getElementById('nav');
    nav.innerHTML = NAV.map(n =>
      '<button class="nav-item ' + (n.placeholder ? 'placeholder ' : '') + (n.key === current ? 'active' : '') + '" data-key="' + n.key + '">' +
        n.icon + '<span>' + esc(n.label) + '</span></button>'
    ).join('');

    const bn = document.getElementById('bottomnav');
    bn.innerHTML = NAV.map(n =>
      '<button class="bn-item ' + (n.placeholder ? 'placeholder ' : '') + (n.key === current ? 'active' : '') + '" data-key="' + n.key + '">' +
        n.icon + '<span>' + esc(n.label) + '</span></button>'
    ).join('');

    nav.querySelectorAll('[data-key]').forEach(b => b.onclick = () => switchTo(b.dataset.key));
    bn.querySelectorAll('[data-key]').forEach(b => b.onclick = () => switchTo(b.dataset.key));
  }

  function placeholderHTML() {
    return '<div class="card placeholder-module">' +
      '<div class="plus">+</div>' +
      '<h2>添加新板块</h2>' +
      '<p class="muted">这里是预留的扩展入口。日后可在此灵活接入新的功能模块' +
      '（如：拜访计划、学术会议、销量看板等），风格与现有板块保持一致。</p>' +
    '</div>';
  }

  async function switchTo(key) {
    const item = NAV.find(n => n.key === key);
    if (!item) return;
    current = key;
    document.getElementById('topbarTitle').textContent = item.title;
    renderNav();
    closeDrawer();
    const view = document.getElementById('view');
    view.scrollTop = 0;
    if (item.placeholder) {
      view.innerHTML = placeholderHTML();
    } else {
      view.innerHTML = '<div class="empty-state"><div class="big">⏳</div>加载中…</div>';
      try {
        await window[item.module].render(view);
      } catch (e) {
        if (e && (e.code === 'AUTH_REQUIRED' || e.status === 401)) {
          window.Auth.clearToken();
          view.innerHTML = '';
          window.Auth.showAuthUI(() => switchTo(current));
          return;
        }
        view.innerHTML = '<div class="empty-state"><div class="big">⚠️</div>' + esc(e.message) + '</div>';
      }
    }
  }

  function openDrawer() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarBackdrop').classList.add('show');
  }
  function closeDrawer() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarBackdrop').classList.remove('show');
  }

  // ----- 同步指示器（顶栏右上角，双端同步状态） -----
  const SYNC_KEY = 'qthub_sync_interval';
  const SYNC_OPTIONS = [1, 10, 30];
  let syncTimer = null;

  function getSyncInterval() {
    const v = parseInt(localStorage.getItem(SYNC_KEY), 10);
    return SYNC_OPTIONS.indexOf(v) >= 0 ? v : 1; // 默认 1 分钟
  }
  function setSyncInterval(min) {
    localStorage.setItem(SYNC_KEY, String(min));
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(() => tickSync(true), min * 60 * 1000);
  }

  function setSyncState(state, text) {
    const el = document.getElementById('syncIndicator');
    if (!el) return;
    el.classList.remove('synced', 'syncing', 'error');
    el.classList.add(state);
    document.getElementById('syncText').textContent = text;
  }

  async function tickSync(silent) {
    if (!silent) setSyncState('syncing', '同步中…');
    try {
      await window.API.stats();
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setSyncState('synced', '已同步 ' + hh + ':' + mm);
    } catch (e) {
      if (e && (e.code === 'AUTH_REQUIRED' || e.status === 401)) {
        setSyncState('error', '未登录');
      } else {
        setSyncState('error', '同步失败');
      }
    }
  }

  function markActiveInterval() {
    const cur = getSyncInterval();
    document.querySelectorAll('#syncMenu .sync-opt[data-min]').forEach(function (b) {
      b.classList.toggle('active', parseInt(b.dataset.min, 10) === cur);
    });
  }

  function openSyncMenu() {
    const menu = document.getElementById('syncMenu');
    const btn = document.getElementById('syncIndicator');
    markActiveInterval();
    menu.style.display = 'block';
    menu.setAttribute('aria-hidden', 'false');
    btn.setAttribute('aria-expanded', 'true');
  }
  function closeSyncMenu() {
    const menu = document.getElementById('syncMenu');
    const btn = document.getElementById('syncIndicator');
    menu.style.display = 'none';
    menu.setAttribute('aria-hidden', 'true');
    btn.setAttribute('aria-expanded', 'false');
  }

  function initSync() {
    const el = document.getElementById('syncIndicator');
    if (!el) return;

    el.addEventListener('click', function (ev) {
      ev.stopPropagation();
      const menu = document.getElementById('syncMenu');
      if (menu.style.display === 'block') {
        closeSyncMenu();
      } else {
        openSyncMenu();
      }
    });

    document.getElementById('syncMenu').addEventListener('click', function (ev) {
      ev.stopPropagation();
      const opt = ev.target.closest('.sync-opt');
      if (!opt) return;
      if (opt.dataset.min) {
        const min = parseInt(opt.dataset.min, 10);
        setSyncInterval(min);
        markActiveInterval();
        closeSyncMenu();
        tickSync(false);
        toast('同步间隔已设为 ' + min + ' 分钟', 'ok');
      } else if (opt.id === 'syncNowBtn') {
        closeSyncMenu();
        tickSync(false);
        toast('已触发同步', 'ok');
      }
    });

    // 点击空白处关闭菜单
    document.addEventListener('click', function () {
      const menu = document.getElementById('syncMenu');
      if (menu && menu.style.display === 'block') closeSyncMenu();
    });

    tickSync(true);
    setSyncInterval(getSyncInterval());
  }

  // Expose switchTo for cross-module navigation (e.g. dashboard cards)
  window.App = { switchTo: switchTo };

  // Verify login before showing the app. If no/invalid token, show the
  // login (or first-time setup) overlay and resolve only after success.
  async function ensureAuth() {
    const token = window.Auth.getToken();
    if (token) {
      try {
        await window.API.stats(); // protected; 401 => invalid token
        return true;
      } catch (e) {
        if (e && (e.code === 'AUTH_REQUIRED' || e.status === 401)) {
          window.Auth.clearToken();
        } else {
          return true; // network blip etc. — let the app try anyway
        }
      }
    }
    return await new Promise(resolve => {
      window.Auth.showAuthUI(() => resolve(true));
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('menuBtn').onclick = openDrawer;
    document.getElementById('sidebarBackdrop').onclick = closeDrawer;
    renderNav();
    ensureAuth().then(ok => {
      if (ok) {
        initSync();
        switchTo('dashboard');
      }
    });
  });
})();
