/* global window, document */
(function () {
  'use strict';
  const { esc, toast, modal, confirm, fmtDate } = window.UI;

  const state = { y: 0, m: 0, events: [], byDate: {}, selected: null };

  function group() {
    state.byDate = {};
    state.events.forEach(e => {
      (state.byDate[e.date] = state.byDate[e.date] || []).push(e);
    });
  }

  const DOW = ['日', '一', '二', '三', '四', '五', '六'];

  function buildGrid() {
    const first = new Date(state.y, state.m, 1);
    const startDow = first.getDay();
    const days = new Date(state.y, state.m + 1, 0).getDate();
    const cells = [];
    const today = new Date();
    const todayStr = fmtDate(today);
    // leading
    const lead = new Date(state.y, state.m, 1 - startDow);
    for (let i = 0; i < startDow; i++) {
      const d = new Date(lead); lead.setDate(lead.getDate() + 1);
      cells.push({ out: true, d });
    }
    for (let i = 1; i <= days; i++) cells.push({ out: false, d: new Date(state.y, state.m, i) });
    // trailing to complete weeks
    while (cells.length % 7 !== 0) cells.push({ out: true, d: new Date(cells[cells.length - 1].d.getTime() + 86400000) });

    return cells.map(c => {
      const ds = fmtDate(c.d);
      const isToday = ds === todayStr;
      const evs = state.byDate[ds] || [];
      const dots = evs.slice(0, 4).map(() => '<span class="dot"></span>').join('');
      const badge = evs.length > 1 ? '<span class="badge">' + evs.length + '</span>' : '';
      return '<div class="cal-cell ' + (c.out ? 'out' : '') + (isToday ? ' today' : '') + '" data-date="' + ds + '">' +
        '<span class="dnum">' + c.d.getDate() + '</span>' +
        badge + '<div class="dots">' + dots + '</div></div>';
    }).join('');
  }

  function dayPanelHTML() {
    if (!state.selected) return '';
    const evs = (state.byDate[state.selected] || []).slice().sort((a, b) => (a.reminderTime || '').localeCompare(b.reminderTime || ''));
    let list = '';
    if (!evs.length) list = '<div class="attach-empty">当日暂无事务，点击下方按钮新建。</div>';
    else list = evs.map(e => eventItemHTML(e)).join('');
    return '<div class="card" style="margin-top:16px">' +
      '<div class="section-head"><h2>' + esc(state.selected) + ' 关键事宜</h2>' +
        '<span class="spacer"></span><button class="btn btn-primary btn-sm" id="addEventBtn">+ 新建事务</button></div>' +
      '<div class="event-list">' + list + '</div></div>';
  }

  function eventItemHTML(e) {
    return '<div class="event-item">' +
      '<div class="ev-time">' + (e.reminderTime ? esc(e.reminderTime) : '全天') + '</div>' +
      '<div style="flex:1"><div class="ev-title">' + esc(e.title) + '</div>' +
        (e.description ? '<div class="ev-desc">' + esc(e.description) + '</div>' : '') + '</div>' +
      '<div class="row-actions">' +
        '<button class="btn btn-sm" data-eact="edit" data-id="' + e.id + '">编辑</button>' +
        '<button class="btn btn-sm btn-danger" data-eact="del" data-id="' + e.id + '">删除</button>' +
      '</div></div>';
  }

  function shellHTML() {
    return '<div class="card">' +
      '<div class="cal-head">' +
        '<button class="btn btn-sm" id="prevM">‹</button>' +
        '<div class="cal-title" id="calTitle"></div>' +
        '<button class="btn btn-sm" id="nextM">›</button>' +
        '<span class="spacer"></span>' +
        '<button class="btn btn-sm" id="todayBtn">今天</button>' +
      '</div>' +
      '<div class="cal-grid" id="calGrid"></div>' +
      '<div id="dayPanel"></div>' +
    '</div>';
  }

  function renderGrid(view) {
    document.getElementById('calTitle').textContent = state.y + '年' + (state.m + 1) + '月';
    document.getElementById('calGrid').innerHTML = DOW.map(d => '<div class="cal-dow">' + d + '</div>').join('') + buildGrid();
    const dp = document.getElementById('dayPanel');
    if (dp) dp.innerHTML = dayPanelHTML();
  }

  function eventForm(e, date) {
    e = e || {};
    const d = e.date || date || fmtDate(new Date());
    return '' +
      '<div class="field"><label>日期</label><input class="input" id="e_date" type="date" value="' + esc(d) + '"></div>' +
      '<div class="field"><label>标题 <span class="req">*</span></label><input class="input" id="e_title" value="' + esc(e.title || '') + '" placeholder="如：拜访张主任"></div>' +
      '<div class="field"><label>提醒时间</label><input class="input" id="e_time" type="time" value="' + esc(e.reminderTime || '') + '"></div>' +
      '<div class="field"><label>详细描述</label><textarea class="textarea" id="e_desc" placeholder="事务详情、注意事项…">' + esc(e.description || '') + '</textarea></div>' +
      '<div class="field-err" id="e_err"></div>';
  }

  function openEvent(e, date) {
    const isNew = !e;
    modal({
      title: isNew ? '新建事务' : '编辑事务',
      body: eventForm(e, date),
      footer: [
        { label: '取消', cls: '', onClick: (c) => c() },
        { label: isNew ? '创建' : '保存', cls: 'btn-primary', onClick: async (c) => {
          const data = {
            date: document.getElementById('e_date').value,
            title: document.getElementById('e_title').value.trim(),
            reminderTime: document.getElementById('e_time').value,
            description: document.getElementById('e_desc').value
          };
          const err = document.getElementById('e_err');
          if (!data.date) { err.textContent = '请选择日期'; err.parentElement.classList.add('invalid'); return; }
          if (!data.title) { err.textContent = '标题必填'; err.parentElement.classList.add('invalid'); return; }
          try {
            if (isNew) await window.API.createEvent(data);
            else await window.API.updateEvent(e.id, data);
            toast(isNew ? '事务已创建' : '已保存', 'ok');
            c(); await reload();
          } catch (er) { err.textContent = er.message; err.parentElement.classList.add('invalid'); }
        } }
      ]
    });
  }

  async function reload() {
    state.events = await window.API.listEvents();
    group();
    const view = document.getElementById('view');
    renderGrid(view);
  }

  const Calendar = {
    async render(view) {
      const now = new Date();
      state.y = now.getFullYear(); state.m = now.getMonth();
      view.innerHTML = shellHTML();
      state.events = await window.API.listEvents().catch(() => []);
      group();
      renderGrid(view);

      document.getElementById('prevM').onclick = () => { state.m--; if (state.m < 0) { state.m = 11; state.y--; } renderGrid(view); };
      document.getElementById('nextM').onclick = () => { state.m++; if (state.m > 11) { state.m = 0; state.y++; } renderGrid(view); };
      document.getElementById('todayBtn').onclick = () => { const n = new Date(); state.y = n.getFullYear(); state.m = n.getMonth(); renderGrid(view); };

      document.getElementById('calGrid').addEventListener('click', (ev) => {
        const cell = ev.target.closest('.cal-cell');
        if (!cell) return;
        state.selected = cell.dataset.date;
        const dp = document.getElementById('dayPanel');
        if (dp) dp.innerHTML = dayPanelHTML();
        const ab = document.getElementById('addEventBtn');
        if (ab) ab.onclick = () => openEvent(null, state.selected);
      });

      document.getElementById('dayPanel').addEventListener('click', async (ev) => {
        const b = ev.target.closest('[data-eact]');
        if (!b) return;
        const id = b.dataset.id; const act = b.dataset.eact;
        if (act === 'add') { openEvent(null, state.selected); return; }
        const e = state.events.find(x => x.id === id);
        if (act === 'edit') openEvent(e);
        else if (act === 'del') {
          if (await confirm('确定删除该事务？', true)) {
            try { await window.API.deleteEvent(id); toast('已删除', 'ok'); await reload(); }
            catch (er) { toast(er.message, 'err'); }
          }
        }
      });
      const ab = document.getElementById('addEventBtn');
      if (ab) ab.onclick = () => openEvent(null, state.selected);
    }
  };

  window.Calendar = Calendar;
})();
