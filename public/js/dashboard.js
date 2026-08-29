/* global window, document */
/**
 * 项目概览（首页）模块
 * - 顶部"重要事宜提醒"卡片：今日有提醒则红色高亮，否则提示"今日暂无"
 * - 4 张数据卡片：客户资料 / 关键事宜 / 问卷台账 / 添加板块
 * - 卡片点击跳转到对应模块
 */
(function () {
  'use strict';
  const { esc } = window.UI;

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function timeStr(d) {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return h + ':' + m;
  }

  function go(key) {
    if (window.App && typeof window.App.switchTo === 'function') {
      window.App.switchTo(key);
    }
  }

  async function render(view) {
    view.innerHTML =
      '<div class="dashboard">' +
        '<div class="dash-head">' +
          '<h1>项目概览</h1>' +
          '<div class="dash-sub">今日工作一览 · <span id="dashTime"></span></div>' +
        '</div>' +

        '<div class="alert-card" id="alertCard">' +
          '<div class="alert-icon" id="alertIcon">⚠</div>' +
          '<div class="alert-body">' +
            '<div class="alert-title">重要事宜提醒</div>' +
            '<div class="alert-text" id="alertText">加载中…</div>' +
            '<button class="alert-btn" id="alertBtn" type="button">' +
              '<span>📅</span><span>进入关键事宜</span>' +
            '</button>' +
          '</div>' +
        '</div>' +

        '<div class="stat-grid">' +
          '<button class="stat-card" data-go="customers" type="button">' +
            '<div class="stat-icon stat-icon-blue">' +
              '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>' +
            '</div>' +
            '<div class="stat-num" id="statCustomers">—</div>' +
            '<div class="stat-label">客户资料</div>' +
          '</button>' +
          '<button class="stat-card" data-go="calendar" type="button">' +
            '<div class="stat-icon stat-icon-orange">' +
              '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>' +
            '</div>' +
            '<div class="stat-num" id="statEvents">—</div>' +
            '<div class="stat-label">关键事宜</div>' +
          '</button>' +
          '<button class="stat-card" data-go="survey" type="button">' +
            '<div class="stat-icon stat-icon-purple">' +
              '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></svg>' +
            '</div>' +
            '<div class="stat-num" id="statSurveys">—</div>' +
            '<div class="stat-label">问卷台账</div>' +
          '</button>' +
          '<button class="stat-card stat-card-add" data-go="add" type="button">' +
            '<div class="stat-icon stat-icon-add">+</div>' +
            '<div class="stat-num">+</div>' +
            '<div class="stat-label">添加板块</div>' +
          '</button>' +
        '</div>' +
      '</div>';

    document.getElementById('dashTime').textContent = timeStr(new Date());

    // 卡片跳转
    view.querySelectorAll('[data-go]').forEach(function (btn) {
      btn.addEventListener('click', function () { go(btn.dataset.go); });
    });
    document.getElementById('alertBtn').addEventListener('click', function () { go('calendar'); });

    // 加载数据
    try {
      const today = todayStr();
      const [stats, events] = await Promise.all([
        window.API.stats(),
        window.API.listEvents()
      ]);

      document.getElementById('statCustomers').textContent = stats.customers;
      document.getElementById('statEvents').textContent = stats.events;
      document.getElementById('statSurveys').textContent = stats.surveys;

      const todayEvents = events.filter(function (e) { return e.date === today; });
      const alertText = document.getElementById('alertText');
      const alertCard = document.getElementById('alertCard');
      const alertIcon = document.getElementById('alertIcon');
      if (todayEvents.length > 0) {
        const titles = todayEvents.slice(0, 3).map(function (e) { return esc(e.title); }).join('、');
        alertText.innerHTML =
          '今日有 <b style="color:#b91c1c">' + todayEvents.length + '</b> 件待提醒的重要事宜：' +
          titles + (todayEvents.length > 3 ? '…' : '');
        alertCard.classList.add('alert-card-urgent');
        alertIcon.textContent = '🔔';
      } else {
        alertText.textContent = '今日暂无待提醒的重要事宜';
      }
    } catch (e) {
      document.getElementById('alertText').textContent = '数据加载失败：' + esc(e.message);
    }
  }

  window.Dashboard = { render: render };
})();
