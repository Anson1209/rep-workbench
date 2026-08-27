/* global window, document */
(function () {
  'use strict';
  const { esc, toast } = window.UI;

  const ICON = {
    customers: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm13 8v-1a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    survey: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    add: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    settings: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
  };

  const NAV = [
    { key: 'customers', label: '客户资料', icon: ICON.customers, title: '客户资料', module: 'Customers' },
    { key: 'calendar', label: '关键提醒', icon: ICON.calendar, title: '关键事宜提醒', module: 'Calendar' },
    { key: 'survey', label: '调研台账', icon: ICON.survey, title: '问卷调研台账', module: 'Survey' },
    { key: 'add', label: '添加板块', icon: ICON.add, title: '添加新板块', placeholder: true },
    { key: 'settings', label: '设置', icon: ICON.settings, title: '设置', module: 'Settings' }
  ];

  let current = 'customers';

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

  async function updateStats() {
    try {
      const s = await window.API.stats();
      document.getElementById('topbarStats').innerHTML =
        '客户 <b>' + s.customers + '</b> · 提醒 <b>' + s.events + '</b> · 台账 <b>' + s.surveys + '</b>';
    } catch (e) { /* ignore */ }
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
        view.innerHTML = '<div class="empty-state"><div class="big">⚠️</div>' + esc(e.message) + '</div>';
      }
    }
    updateStats();
  }

  function openDrawer() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarBackdrop').classList.add('show');
  }
  function closeDrawer() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarBackdrop').classList.remove('show');
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('menuBtn').onclick = openDrawer;
    document.getElementById('sidebarBackdrop').onclick = closeDrawer;
    renderNav();
    switchTo('customers');
  });
})();
