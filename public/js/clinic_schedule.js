/* global window, document */
(function () {
  'use strict';
  const { esc, toast, modal, confirm } = window.UI;

  // 7 列：周一~周日；2 行：上午 / 下午 → 共 14 格
  const WEEKDAYS = [
    { dow: 1, label: '一' },
    { dow: 2, label: '二' },
    { dow: 3, label: '三' },
    { dow: 4, label: '四' },
    { dow: 5, label: '五' },
    { dow: 6, label: '六' },
    { dow: 7, label: '日' }
  ];
  const PERIODS = [
    { code: 'AM', label: '上午' },
    { code: 'PM', label: '下午' }
  ];

  const state = {
    items: []            // 全部记录，按 (weekday, period, order) 排序
  };

  // ---------- 数据 ----------
  async function loadItems() {
    state.items = await window.API.listSchedule();
  }

  // ---------- 渲染 ----------
  function shellHTML() {
    return '<div class="card">' +
      '<div class="cs-head">' +
        '<div class="cs-titles">' +
          '<div class="cs-title">门诊时间</div>' +
          '<div class="cs-sub">长期固定安排 · 每个时段可容纳多家医院客户</div>' +
        '</div>' +
        '<span class="spacer"></span>' +
        '<button class="btn btn-primary btn-sm" id="csAdd">+ 新增安排</button>' +
      '</div>' +
      '<div class="cs-table-wrap"><div id="csTable" class="cs-table"></div></div>' +
      '<div class="muted small" id="csHint" style="margin-top:10px"></div>' +
    '</div>';
  }

  function renderGrid() {
    // 按 (weekday, period) 分组
    const byCell = {};
    state.items.forEach(it => {
      const k = it.weekday + '|' + it.period;
      (byCell[k] = byCell[k] || []).push(it);
    });

    // 表头
    const head = '<div class="cs-row cs-head-row">' +
      '<div class="cs-cell cs-cell-h cs-cell-corner">时段</div>' +
      WEEKDAYS.map(w =>
        '<div class="cs-cell cs-cell-h cs-cell-dow">' +
          '<div class="dow-cn">周' + w.label + '</div>' +
        '</div>'
      ).join('') +
    '</div>';

    // 上午 / 下午两行
    const rows = PERIODS.map(p => {
      const labelCell = '<div class="cs-cell cs-cell-h cs-cell-period">' +
        '<span class="period-label">' + p.label + '</span>' +
      '</div>';
      const cells = WEEKDAYS.map(w => {
        const k = w.dow + '|' + p.code;
        const list = byCell[k] || [];
        const inner = list.length
          ? '<div class="cell-list">' + list.map(itemCellHTML).join('') + '</div>'
          : '<div class="cell-add">+</div>';
        return '<div class="cs-cell cs-cell-body" data-w="' + w.dow + '" data-p="' + p.code + '">' + inner + '</div>';
      }).join('');
      return '<div class="cs-row">' + labelCell + cells + '</div>';
    }).join('');

    document.getElementById('csTable').innerHTML = head + rows;

    const total = state.items.length;
    document.getElementById('csHint').textContent = '共 ' + total + ' 条门诊安排';
  }

  function itemCellHTML(it) {
    // 底部一行：胶囊在左、科室在右（右下角）
    const hospSpan = it.hospitalName ? '<span class="hosp-tag">' + esc(it.hospitalName) + '</span>' : '';
    const deptSpan = it.department ? '<span class="item-dept">' + esc(it.department) + '</span>' : '';
    const bottom = (hospSpan || deptSpan) ? '<div class="item-bottom">' + hospSpan + deptSpan + '</div>' : '';
    return '<div class="cell-item" data-id="' + esc(it.id) + '">' +
      '<div class="item-name">' + esc(it.customerName) + '</div>' +
      bottom +
    '</div>';
  }

  // ---------- 表单 ----------
  function scheduleForm(it, preset) {
    const e = it || {};
    const wd = e.weekday != null ? e.weekday : (preset ? preset.weekday : 1);
    const period = e.period != null ? e.period : (preset ? preset.period : 'AM');

    const wdOptions = WEEKDAYS.map(w =>
      '<option value="' + w.dow + '"' + (wd === w.dow ? ' selected' : '') + '>周' + w.label + '</option>'
    ).join('');
    const periodOptions = PERIODS.map(p =>
      '<option value="' + p.code + '"' + (period === p.code ? ' selected' : '') + '>' + p.label + '</option>'
    ).join('');

    return '' +
      '<div class="field-row">' +
        '<div class="field" style="flex:1"><label>星期</label>' +
          '<select class="input" id="cs_weekday">' + wdOptions + '</select></div>' +
        '<div class="field" style="flex:1"><label>时段</label>' +
          '<select class="input" id="cs_period">' + periodOptions + '</select></div>' +
      '</div>' +
      '<div class="field"><label>客户姓名 <span class="req">*</span></label>' +
        '<input class="input" id="cs_name" value="' + esc(e.customerName || '') + '" placeholder="如 张主任"></div>' +
      '<div class="field"><label>科室</label>' +
        '<input class="input" id="cs_dept" placeholder="如 泌尿外科（选填）" value="' + esc(e.department || '') + '"></div>' +
      '<div class="field"><label>医院名称</label>' +
        '<input class="input" id="cs_hosp" placeholder="如 协和医院（选填）" value="' + esc(e.hospitalName || '') + '"></div>' +
      '<div class="field"><label>备注</label>' +
        '<textarea class="textarea" id="cs_note" placeholder="选填">' + esc(e.note || '') + '</textarea></div>' +
      '<div class="field-err" id="cs_err"></div>';
  }

  function openScheduleForm(it, preset) {
    const isNew = !it;
    modal({
      title: isNew ? '新增门诊安排' : '编辑门诊安排',
      body: scheduleForm(it, preset),
      footer: [
        ...(isNew ? [] : [{ label: '删除', cls: 'btn-danger', onClick: async (c) => {
          if (!await confirm('确定删除这条安排？', true)) return;
          try { await window.API.deleteSchedule(it.id); toast('已删除', 'ok'); c(); await reload(); }
          catch (e) { toast(e.message, 'err'); }
        } }]),
        { label: '取消', cls: '', onClick: (c) => c() },
        { label: isNew ? '创建' : '保存', cls: 'btn-primary', onClick: async (c) => {
          const data = {
            weekday: Number(document.getElementById('cs_weekday').value),
            period: document.getElementById('cs_period').value,
            customerName: document.getElementById('cs_name').value,
            department: document.getElementById('cs_dept').value,
            hospitalName: document.getElementById('cs_hosp').value,
            note: document.getElementById('cs_note').value
          };
          const err = document.getElementById('cs_err');
          if (!data.customerName.trim()) { err.textContent = '客户姓名必填'; err.parentElement.classList.add('invalid'); return; }
          try {
            if (isNew) await window.API.createSchedule(data);
            else await window.API.updateSchedule(it.id, data);
            toast(isNew ? '已创建' : '已保存', 'ok');
            c();
            await reload();
          } catch (e) { err.textContent = e.message; err.parentElement.classList.add('invalid'); }
        } }
      ]
    });
  }

  async function reload() {
    await loadItems();
    renderGrid();
  }

  const Clinic = {
    async render(view) {
      view.innerHTML = shellHTML();
      await reload();

      document.getElementById('csAdd').onclick = () => openScheduleForm(null, null);

      document.getElementById('csTable').addEventListener('click', (ev) => {
        const item = ev.target.closest('.cell-item');
        if (item) {
          const id = item.dataset.id;
          const it = state.items.find(x => x.id === id);
          if (it) openScheduleForm(it);
          return;
        }
        const cell = ev.target.closest('.cs-cell-body');
        if (cell) {
          const w = Number(cell.dataset.w);
          const p = cell.dataset.p;
          openScheduleForm(null, { weekday: w, period: p });
        }
      });
    }
  };

  window.ClinicSchedule = Clinic;
})();