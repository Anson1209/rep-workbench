/* global window, document */
(function () {
  'use strict';
  const { esc, toast, modal, confirm, fmtDate } = window.UI;

  // 7 列：周一~周日
  const WEEKDAYS = [
    { dow: 1, label: '一', date: null },
    { dow: 2, label: '二', date: null },
    { dow: 3, label: '三', date: null },
    { dow: 4, label: '四', date: null },
    { dow: 5, label: '五', date: null },
    { dow: 6, label: '六', date: null },
    { dow: 7, label: '日', date: null }
  ];

  const state = {
    weekStart: '',       // YYYY-MM-DD (本周一)
    hospitals: [],       // [{id,name,color,order}]  1..4 个
    items: []            // 当前周的安排
  };

  // ---------- 日期工具 ----------
  function startOfWeek(d) {
    // 周一作为一周开始：getDay() 周日=0, 周一=1...周六=6
    const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dow = dt.getDay(); // 0=日, 1=一, ...
    const diff = dow === 0 ? -6 : 1 - dow;
    dt.setDate(dt.getDate() + diff);
    return dt;
  }
  function addDays(d, n) {
    const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    dt.setDate(dt.getDate() + n);
    return dt;
  }
  function fmtDay(d) {
    const p = n => (n < 10 ? '0' + n : n);
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function fmtMd(d) { return (d.getMonth() + 1) + '/' + d.getDate(); }
  function fmtWeekTitle(ws) {
    const start = new Date(ws + 'T00:00:00');
    const end = addDays(start, 6);
    return fmtMd(start) + ' - ' + fmtMd(end) + ' (' + start.getFullYear() + ')';
  }

  // 视图用的当天信息：基于 state.weekStart 算出 7 列对应的实际日期
  function buildWeek() {
    const base = new Date(state.weekStart + 'T00:00:00');
    return WEEKDAYS.map(w => ({ ...w, date: fmtDay(addDays(base, w.dow - 1)) }));
  }
  function todayIs() { return fmtDay(new Date()); }

  // ---------- 数据加载 ----------
  async function loadHospitals() {
    let list = await window.API.listHospitals();
    if (!list || !list.length) {
      // 自动建 4 个默认槽位
      list = [
        { id: '', name: '医院一', color: '#3b82f6', order: 0 },
        { id: '', name: '医院二', color: '#10b981', order: 1 },
        { id: '', name: '医院三', color: '#f59e0b', order: 2 },
        { id: '', name: '医院四', color: '#ef4444', order: 3 }
      ];
      list = await window.API.saveHospitals(list);
    }
    state.hospitals = list.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async function loadItems() {
    state.items = await window.API.listSchedule(state.weekStart);
  }

  // ---------- 渲染 ----------
  function shellHTML() {
    return '<div class="card">' +
      '<div class="cs-head">' +
        '<button class="btn btn-sm" id="csPrev">‹ 上一周</button>' +
        '<div class="cs-title" id="csTitle"></div>' +
        '<button class="btn btn-sm" id="csNext">下一周 ›</button>' +
        '<button class="btn btn-sm" id="csToday">本周</button>' +
        '<span class="spacer"></span>' +
        '<button class="btn btn-sm" id="csManage">⚙ 医院配置</button>' +
        '<button class="btn btn-primary btn-sm" id="csAdd">+ 新增安排</button>' +
      '</div>' +
      '<div class="cs-table-wrap"><div id="csTable" class="cs-table"></div></div>' +
      '<div class="muted small" id="csHint" style="margin-top:8px"></div>' +
    '</div>';
  }

  function renderGrid() {
    document.getElementById('csTitle').textContent = fmtWeekTitle(state.weekStart);
    const week = buildWeek();
    const today = todayIs();
    const byCell = {};
    state.items.forEach(it => {
      const k = it.hospitalId + '|' + it.weekday;
      (byCell[k] = byCell[k] || []).push(it);
    });
    // 表头
    const head = '<div class="cs-row cs-head-row">' +
      '<div class="cs-cell cs-cell-h">医院</div>' +
      week.map(w => {
        const isToday = w.date === today;
        return '<div class="cs-cell cs-cell-dow ' + (isToday ? 'today' : '') + '">' +
          '<div class="dow-label">周' + w.label + '</div>' +
          '<div class="dow-date">' + esc(w.date.slice(5)) + '</div>' +
        '</div>';
      }).join('') +
    '</div>';

    // 4 行医院（不足 4 行填充空槽提示）
    const rows = [];
    const maxRows = Math.max(4, state.hospitals.length);
    for (let r = 0; r < maxRows; r++) {
      const h = state.hospitals[r];
      const isEmpty = !h;
      const hospName = h ? h.name : '<span class="placeholder">未配置</span>';
      const colorBar = h ? `<span class="cs-bar" style="background:${esc(h.color)}"></span>` : '';
      const hospCell = '<div class="cs-cell cs-cell-h">' +
        colorBar +
        '<span class="hosp-name">' + hospName + '</span>' +
        (h ? '<span class="hosp-meta">' + (byCellCount(h.id) || 0) + ' 条</span>' : '') +
      '</div>';

      const cells = week.map(w => {
        const k = (h ? h.id : '__none__') + '|' + w.dow;
        const list = byCell[k] || [];
        const isTodayCol = w.date === today;
        const cellClass = 'cs-cell cs-cell-body' +
          (isEmpty ? ' disabled' : '') +
          (isTodayCol ? ' today' : '');
        let inner;
        if (isEmpty) {
          inner = '<div class="cell-empty">—</div>';
        } else if (!list.length) {
          inner = '<div class="cell-add">＋</div>';
        } else {
          inner = '<div class="cell-list">' + list.map(itemCellHTML).join('') + '</div>';
        }
        return '<div class="' + cellClass + '" data-h="' + (h ? h.id : '') + '" data-d="' + w.dow + '">' + inner + '</div>';
      }).join('');

      rows.push('<div class="cs-row">' + hospCell + cells + '</div>');
    }

    document.getElementById('csTable').innerHTML = head + rows.join('');

    // 总数提示
    const total = state.items.length;
    const hint = document.getElementById('csHint');
    if (hint) hint.textContent = '本周共 ' + total + ' 条出门诊安排';
  }

  function byCellCount(hospitalId) {
    return state.items.filter(it => it.hospitalId === hospitalId).length;
  }

  function itemCellHTML(it) {
    const period = it.period === 'AM' ? '上午' : it.period === 'PM' ? '下午' : '';
    const sub = [period, it.timeRange].filter(Boolean).join(' ');
    const dept = it.dept ? '<span class="item-dept">' + esc(it.dept) + '</span>' : '';
    return '<div class="cell-item" data-id="' + esc(it.id) + '">' +
      '<div class="item-name">' + esc(it.customerName) + '</div>' +
      (sub ? '<div class="item-time">' + esc(sub) + '</div>' : '') +
      dept +
    '</div>';
  }

  // ---------- 弹窗：录入/编辑 ----------
  function scheduleForm(it, weekStart) {
    const e = it || {};
    const wd = e.weekday != null ? e.weekday : 1;
    const hospOptions = state.hospitals.map(h =>
      '<option value="' + esc(h.id) + '"' + (e.hospitalId === h.id ? ' selected' : '') + '>' + esc(h.name) + '</option>'
    ).join('');
    const wdOptions = WEEKDAYS.map(w =>
      '<option value="' + w.dow + '"' + (wd === w.dow ? ' selected' : '') + '>周' + w.label + '</option>'
    ).join('');
    return '' +
      '<div class="field"><label>医院</label>' +
        '<select class="input" id="cs_hospital">' + hospOptions + '</select></div>' +
      '<div class="field"><label>星期</label>' +
        '<select class="input" id="cs_weekday">' + wdOptions + '</select></div>' +
      '<div class="field-row">' +
        '<div class="field" style="flex:1"><label>时段</label>' +
          '<select class="input" id="cs_period">' +
            '<option value="">不限</option>' +
            '<option value="AM"' + (e.period === 'AM' ? ' selected' : '') + '>上午</option>' +
            '<option value="PM"' + (e.period === 'PM' ? ' selected' : '') + '>下午</option>' +
          '</select></div>' +
        '<div class="field" style="flex:1"><label>时间</label>' +
          '<input class="input" id="cs_time" placeholder="如 09:00-11:30" value="' + esc(e.timeRange || '') + '"></div>' +
      '</div>' +
      '<div class="field"><label>客户姓名 <span class="req">*</span></label>' +
        '<input class="input" id="cs_name" value="' + esc(e.customerName || '') + '" placeholder="如 张主任"></div>' +
      '<div class="field"><label>科室</label>' +
        '<input class="input" id="cs_dept" value="' + esc(e.dept || '') + '" placeholder="如 泌尿外科（选填）"></div>' +
      '<div class="field"><label>所属周（周一）</label>' +
        '<input class="input" id="cs_week" type="date" value="' + esc(weekStart) + '"></div>' +
      '<div class="field"><label>备注</label>' +
        '<textarea class="textarea" id="cs_note" placeholder="选填">' + esc(e.note || '') + '</textarea></div>' +
      '<div class="field-err" id="cs_err"></div>';
  }

  function openScheduleForm(it) {
    const isNew = !it;
    modal({
      title: isNew ? '新增出门诊安排' : '编辑出门诊安排',
      body: scheduleForm(it, state.weekStart),
      footer: [
        ...(isNew ? [] : [{ label: '删除', cls: 'btn-danger', onClick: async (c) => {
          if (!await confirm('确定删除这条安排？', true)) return;
          try { await window.API.deleteSchedule(it.id); toast('已删除', 'ok'); c(); await reload(); }
          catch (e) { toast(e.message, 'err'); }
        } }]),
        { label: '取消', cls: '', onClick: (c) => c() },
        { label: isNew ? '创建' : '保存', cls: 'btn-primary', onClick: async (c) => {
          const data = {
            hospitalId: document.getElementById('cs_hospital').value,
            weekday: Number(document.getElementById('cs_weekday').value),
            period: document.getElementById('cs_period').value,
            timeRange: document.getElementById('cs_time').value,
            customerName: document.getElementById('cs_name').value,
            dept: document.getElementById('cs_dept').value,
            weekStart: document.getElementById('cs_week').value,
            note: document.getElementById('cs_note').value
          };
          const err = document.getElementById('cs_err');
          if (!data.hospitalId) { err.textContent = '请选择医院'; err.parentElement.classList.add('invalid'); return; }
          if (!data.weekStart) { err.textContent = '请选择所属周'; err.parentElement.classList.add('invalid'); return; }
          if (!data.customerName.trim()) { err.textContent = '客户姓名必填'; err.parentElement.classList.add('invalid'); return; }
          try {
            if (isNew) await window.API.createSchedule(data);
            else await window.API.updateSchedule(it.id, data);
            toast(isNew ? '已创建' : '已保存', 'ok');
            c();
            // 切到所选周并刷新
            state.weekStart = data.weekStart;
            await reload();
          } catch (e) { err.textContent = e.message; err.parentElement.classList.add('invalid'); }
        } }
      ]
    });
  }

  // ---------- 弹窗：医院配置 ----------
  function openHospitals() {
    const list = state.hospitals.map(h => ({
      id: h.id, name: h.name, color: h.color, order: h.order
    }));
    // 保证有 4 行
    while (list.length < 4) {
      list.push({ id: '', name: '', color: '#3b82f6', order: list.length });
    }
    openHospitalsForm(list);
  }
  function openHospitalsForm(list) {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    const body =
      '<p class="muted" style="margin-top:0">最多 4 个医院槽位；保存后会清理被丢弃医院的所有安排项。</p>' +
      '<div id="hospList">' + list.map((h, i) => (
        '<div class="hosp-row" data-i="' + i + '">' +
          '<span class="hosp-color" style="background:' + esc(h.color || colors[i % colors.length]) + '"></span>' +
          '<input class="input hosp-name-input" placeholder="医院名称（必填）" value="' + esc(h.name || '') + '">' +
          '<button class="btn btn-sm hosp-clear" type="button">清空</button>' +
        '</div>'
      )).join('') + '</div>' +
      '<div class="field-err" id="hosp_err"></div>';
    modal({
      title: '医院配置',
      body,
      footer: [
        { label: '取消', cls: '', onClick: (c) => c() },
        { label: '保存', cls: 'btn-primary', onClick: async (c) => {
          const rows = document.querySelectorAll('#hospList .hosp-row');
          const next = [];
          rows.forEach((row) => {
            const name = row.querySelector('.hosp-name-input').value.trim();
            const color = row.querySelector('.hosp-color').style.backgroundColor || '';
            const hex = rgbToHex(color) || colors[next.length % colors.length];
            const orig = list[parseInt(row.dataset.i, 10)];
            if (name) next.push({ id: orig.id, name, color: hex });
          });
          const err = document.getElementById('hosp_err');
          if (next.length > 4) { err.textContent = '最多 4 个医院'; err.parentElement.classList.add('invalid'); return; }
          if (next.length === 0) { err.textContent = '至少保留 1 个医院'; err.parentElement.classList.add('invalid'); return; }
          try {
            await window.API.saveHospitals(next);
            toast('已保存', 'ok');
            c();
            await reload(true);
          } catch (e) { err.textContent = e.message; err.parentElement.classList.add('invalid'); }
        } }
      ]
    });
    // 行内事件
    document.querySelectorAll('#hospList .hosp-clear').forEach(btn => {
      btn.onclick = () => { btn.parentElement.querySelector('.hosp-name-input').value = ''; };
    });
  }
  function rgbToHex(rgb) {
    const m = (rgb || '').match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map(n => parseInt(n, 10).toString(16).padStart(2, '0')).join('');
  }

  // ---------- 顶部导航 ----------
  async function reload(refreshHospitals) {
    if (refreshHospitals) await loadHospitals();
    await loadItems();
    renderGrid();
  }

  function shiftWeek(delta) {
    const d = new Date(state.weekStart + 'T00:00:00');
    d.setDate(d.getDate() + delta * 7);
    state.weekStart = fmtDay(d);
    loadItems().then(renderGrid);
  }
  function goToday() {
    const now = new Date();
    state.weekStart = fmtDay(startOfWeek(now));
    loadItems().then(renderGrid);
  }

  const Clinic = {
    async render(view) {
      view.innerHTML = shellHTML();
      // 默认本周
      if (!state.weekStart) {
        state.weekStart = fmtDay(startOfWeek(new Date()));
      }
      await loadHospitals();
      await loadItems();
      renderGrid();

      document.getElementById('csPrev').onclick = () => shiftWeek(-1);
      document.getElementById('csNext').onclick = () => shiftWeek(1);
      document.getElementById('csToday').onclick = goToday;
      document.getElementById('csManage').onclick = openHospitals;
      document.getElementById('csAdd').onclick = () => openScheduleForm(null);

      // 单元格点击：空白 → 新增；已有内容 → 展开/编辑
      document.getElementById('csTable').addEventListener('click', (ev) => {
        const item = ev.target.closest('.cell-item');
        if (item) {
          const id = item.dataset.id;
          const it = state.items.find(x => x.id === id);
          if (it) openScheduleForm(it);
          return;
        }
        const cell = ev.target.closest('.cs-cell-body');
        if (cell && !cell.classList.contains('disabled')) {
          const h = cell.dataset.h;
          const d = Number(cell.dataset.d);
          if (!h || !d) return;
          openScheduleForm({ hospitalId: h, weekday: d });
        }
      });
    }
  };

  window.ClinicSchedule = Clinic;
})();