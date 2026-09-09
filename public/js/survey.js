/* global window, document */
(function () {
  'use strict';
  // 问卷调研台账 —— 大区(额度500) / BU(额度800) 两类项目
  // 每位专家最多 3 次；相邻两次间隔不足 30 天 → 提醒违规
  const { esc, toast, modal, confirm, fmtDate } = window.UI;

  const PROJECT_TYPES = [
    { key: '大区', amount: 500, label: '大区项目（额度 ¥500）' },
    { key: 'BU',  amount: 800, label: 'BU 项目（额度 ¥800）' }
  ];

  const REMINDER = {
    normal:    { label: '正常',     cls: 'pill-normal' },
    warning:   { label: '提醒',     cls: 'pill-violation' },
    violation: { label: '⚠ 违规',   cls: 'pill-violation' }
  };

  const state = { filters: { date: '', projectType: '', reminder: '', q: '' }, list: [], expanded: new Set() };

  function projectChip(t) {
    if (!t) return '<span class="type-chip type-empty">未分类</span>';
    return '<span class="type-chip type-' + esc(t) + '">' + esc(t) + '</span>';
  }

  function shellHTML() {
    return '<div class="card">' +
      '<div class="section-head"><h2>问卷调研台账</h2>' +
        '<span class="sub">按项目分额度（大区 ¥500 / BU ¥800），每位专家 ≤3 次，相邻两次 ≥30 天</span>' +
        '<span class="spacer"></span><button class="btn btn-primary" id="addSurveyBtn">+ 新增记录</button></div>' +
      // 总计区：根据当前列表实时统计大区 / BU / 合计条数。点击可作为项目类型快捷筛选。
      '<div class="survey-totals" id="surveyTotals">' +
        '<button type="button" class="total-chip total-region" data-filter-type="大区" title="点击只看大区项目">大区 <strong id="total_region">0</strong> 条</button>' +
        '<button type="button" class="total-chip total-bu" data-filter-type="BU" title="点击只看 BU 项目">BU <strong id="total_bu">0</strong> 条</button>' +
        '<button type="button" class="total-chip total-grand" data-filter-type="" title="点击查看全部">合计 <strong id="total_all">0</strong> 条</button>' +
      '</div>' +
      '<div class="filters">' +
        '<div class="field"><label>调研时间</label><input class="input" type="date" id="f_date" value="' + esc(state.filters.date) + '"></div>' +
        '<div class="field"><label>项目类型</label><select class="select" id="f_projectType">' +
          '<option value="">全部</option>' +
          PROJECT_TYPES.map(p => '<option value="' + esc(p.key) + '"' + (state.filters.projectType === p.key ? ' selected' : '') + '>' + esc(p.key) + '（¥' + p.amount + '）</option>').join('') +
        '</select></div>' +
        '<div class="field"><label>提醒状态</label><select class="select" id="f_reminder">' +
          '<option value="">全部</option>' +
          Object.entries(REMINDER).map(([k, v]) => '<option value="' + k + '"' + (state.filters.reminder === k ? ' selected' : '') + '>' + v.label + '</option>').join('') +
        '</select></div>' +
        '<div class="field"><label>对象模糊搜索</label><input class="input" id="f_q" value="' + esc(state.filters.q) + '" placeholder="按专家姓名"></div>' +
        '<button class="btn" id="applyFilter">筛选</button>' +
        '<button class="btn btn-ghost" id="clearFilter">重置</button>' +
      '</div>' +
      '<div class="table-wrap"><table class="tbl" id="surveyTbl">' +
        '<thead><tr>' +
          '<th>专家姓名</th>' +
          '<th class="col-type">项目类型</th>' +
          '<th class="col-date">调研日期</th>' +
          '<th class="col-count">使用次数</th>' +
          '<th>额度</th>' +
          '<th>备注</th>' +
          '<th>提醒</th>' +
          '<th>操作</th>' +
        '</tr></thead>' +
        '<tbody id="surveyBody"></tbody>' +
      '</table></div>' +
    '</div>';
  }

  // 把扁平记录按 (专家姓名, 项目类型) 聚合：同一客户只显示一行，
  // 调研日期/备注分别列在一行里，使用次数=合计，额度=项目金额×次数。
  function groupRecords(list) {
    const map = new Map();
    for (const s of list) {
      const key = (s.expertName || s.target || '') + '||' + (s.projectType || '');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    const groups = [];
    for (const [key, recs] of map.entries()) {
      recs.sort((a, b) => (a.usageDate || a.date || '').localeCompare(b.usageDate || b.date || ''));
      const first = recs[0];
      const amount = first.amount || PROJECT_TYPES[first.projectType] || 0;
      const dates = recs.map(r => r.usageDate || r.date || '');
      const notes = recs.map(r => (r.note || '').trim());
      const datesJoined = dates.filter(Boolean).join('、');
      const notesJoined = notes.filter(Boolean).join('、');
      const datesHTML = dates.map(d => '<span class="multi-item">' + esc(d) + '</span>').join('');
      const notesHTML = notes.length
        ? notes.map(n => '<span class="multi-item">' + esc(n) + '</span>').join('')
        : '<span class="multi-item muted">—</span>';
      const hasViolation = recs.some(r => r.reminderStatus === 'violation');
      const lastDate = recs[recs.length - 1].usageDate || recs[recs.length - 1].date || '';
      groups.push({
        key,
        expertName: first.expertName || first.target || '',
        projectType: first.projectType || '',
        amount,
        records: recs,
        totalCount: recs.length,
        totalAmount: amount * recs.length,
        datesJoined,
        notesJoined,
        datesHTML,
        notesHTML,
        reminderStatus: hasViolation ? 'violation' : 'normal',
        lastDate
      });
    }
    groups.sort((a, b) => (a.lastDate < b.lastDate ? 1 : (a.lastDate > b.lastDate ? -1 : 0)));
    return groups;
  }

  function recordsOfKey(key) {
    const i = key.indexOf('||');
    const name = key.slice(0, i);
    const type = key.slice(i + 2);
    return state.list.filter(s => (s.expertName || s.target || '') === name && (s.projectType || '') === type);
  }

  function bodyHTML() {
    let groups = groupRecords(state.list);
    if (state.filters.reminder) {
      groups = groups.filter(g => g.reminderStatus === state.filters.reminder);
    }
    if (!groups.length) {
      return '<tr><td colspan="8"><div class="empty-state" style="padding:30px">📋 暂无调研记录，点击右上角「新增记录」</div></td></tr>';
    }
    return groups.map(g => {
      const rem = REMINDER[g.reminderStatus] || REMINDER.normal;
      const expanded = state.expanded.has(g.key);
      const rows = [
        '<tr class="group-row" data-gkey="' + esc(g.key) + '">' +
          '<td class="grp-name">' + esc(g.expertName) + '</td>' +
          '<td class="col-type">' + projectChip(g.projectType) + '</td>' +
          '<td class="col-date" title="' + esc(g.datesJoined) + '"><div class="multi-val">' + g.datesHTML + '</div></td>' +
          '<td class="col-count">' + g.totalCount + '</td>' +
          '<td>¥' + g.totalAmount + '</td>' +
          '<td title="' + esc(g.notesJoined) + '"><div class="multi-val">' + g.notesHTML + '</div></td>' +
          '<td><span class="pill ' + rem.cls + '">' + esc(rem.label) + '</span></td>' +
          '<td><div class="row-actions">' +
            '<button class="btn btn-sm" data-sact="toggle" data-key="' + esc(g.key) + '">' + (expanded ? '收起' : '明细') + '</button>' +
            '<button class="btn btn-sm btn-danger" data-sact="delall" data-key="' + esc(g.key) + '">删除全部</button>' +
          '</div></td>' +
        '</tr>'
      ];
      if (expanded) {
        for (const r of g.records) {
          const rrem = REMINDER[r.reminderStatus] || REMINDER.normal;
          const reason = r.reminderReason ? ' <span class="reminder-reason">' + esc(r.reminderReason) + '</span>' : '';
          rows.push(
            '<tr class="sub-row">' +
              '<td class="sub-indent">↳</td>' +
              '<td></td>' +
              '<td class="col-date">' + esc(r.usageDate || r.date || '') + reason + '</td>' +
              '<td class="col-count">' + (r.count != null ? r.count : '—') + '</td>' +
              '<td>¥' + (r.amount || '') + '</td>' +
              '<td>' + esc(r.note || '—') + '</td>' +
              '<td><span class="pill ' + rrem.cls + '">' + esc(rrem.label) + '</span></td>' +
              '<td><div class="row-actions">' +
                '<button class="btn btn-sm" data-sact="edit" data-id="' + esc(r.id) + '">编辑</button>' +
                '<button class="btn btn-sm btn-danger" data-sact="del" data-id="' + esc(r.id) + '">删除</button>' +
              '</div></td>' +
            '</tr>'
          );
        }
      }
      return rows.join('');
    }).join('');
  }

  function formHTML(s) {
    s = s || {};
    const curType = s.projectType || '';
    return '' +
      '<div class="form-row">' +
        '<div class="field"><label>项目类型 <span class="req">*</span></label>' +
          '<select class="select" id="s_projectType">' +
            '<option value="">请选择</option>' +
            PROJECT_TYPES.map(p => '<option value="' + esc(p.key) + '"' + (curType === p.key ? ' selected' : '') + '>' + esc(p.label) + '</option>').join('') +
          '</select>' +
        '</div>' +
        '<div class="field"><label>专家姓名 <span class="req">*</span></label>' +
          '<input class="input" id="s_expertName" value="' + esc(s.expertName || s.target || '') + '" placeholder="如：张教授">' +
        '</div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="field"><label>调研日期 <span class="req">*</span></label>' +
          '<input class="input" type="date" id="s_usageDate" value="' + esc(s.usageDate || s.date || fmtDate(new Date())) + '">' +
        '</div>' +
        '<div class="field"><label>使用次数 <span class="muted tiny">（系统自动计算）</span></label>' +
          '<input class="input" type="text" id="s_count_hint" value="' + esc(s.count != null ? ('第 ' + s.count + ' 次') : '保存后自动计算') + '" disabled>' +
        '</div>' +
      '</div>' +
      '<div class="field"><label>备注</label><textarea class="textarea" id="s_note" placeholder="调研要点、反馈…">' + esc(s.note || '') + '</textarea></div>' +
      '<div class="field-err" id="s_err"></div>' +
      '<div class="tiny muted" style="margin-top:8px">' +
        '📌 业务规则：每专家同项目 ≤3 次；相邻两次使用 ≥30 天，否则系统标记「⚠ 违规」。2026年6月之前的记录豁免间隔限制。' +
      '</div>';
  }

  function openForm(s) {
    const isNew = !s;
    modal({
      title: isNew ? '新增调研记录' : '编辑调研记录',
      body: formHTML(s),
      footer: [
        { label: '取消', cls: '', onClick: (c) => c() },
        { label: isNew ? '创建' : '保存', cls: 'btn-primary', onClick: async (c) => {
          const data = {
            projectType: document.getElementById('s_projectType').value,
            expertName: document.getElementById('s_expertName').value.trim(),
            usageDate: document.getElementById('s_usageDate').value,
            note: document.getElementById('s_note').value
          };
          const err = document.getElementById('s_err');
          err.textContent = ''; err.parentElement.classList.remove('invalid');
          try {
            if (isNew) await window.API.createSurvey(data);
            else await window.API.updateSurvey(s.id, data);
            toast(isNew ? '记录已创建' : '已保存', 'ok');
            c(); load();
          } catch (e) { err.textContent = e.message; err.parentElement.classList.add('invalid'); }
        } }
      ]
    });
  }

  function updateTotals() {
    const r = document.getElementById('total_region');
    const b = document.getElementById('total_bu');
    const a = document.getElementById('total_all');
    if (!r || !b || !a) return;
    const region = state.list.filter(s => (s.projectType || '') === '大区').length;
    const bu     = state.list.filter(s => (s.projectType || '') === 'BU').length;
    r.textContent = region;
    b.textContent = bu;
    a.textContent = region + bu;
    // 同步 chip 激活态：当前筛选的 projectType 决定高亮哪一个
    const cur = state.filters.projectType || '';
    const chips = document.querySelectorAll('#surveyTotals .total-chip');
    chips.forEach(c => {
      const t = c.getAttribute('data-filter-type') || '';
      c.classList.toggle('is-active', t === cur);
    });
  }

  // 绑定总计 chip 的点击 → 设为项目类型筛选（''=全部）
  function bindTotalChips() {
    const root = document.getElementById('surveyTotals');
    if (!root) return;
    root.addEventListener('click', (ev) => {
      const chip = ev.target.closest('.total-chip');
      if (!chip) return;
      const t = chip.getAttribute('data-filter-type') || '';
      if (state.filters.projectType === t) return; // 已激活则不重复加载
      state.filters.projectType = t;
      // 同步下拉框显示。sel.value = t 会触发 onchange 事件 → 走统一的 load 流程
      // （避免直接调 load 又被 onchange 再调一次造成重复请求）
      const sel = document.getElementById('f_projectType');
      if (sel) sel.value = t;
    });
  }

  function renderBody() {
    const body = document.getElementById('surveyBody');
    if (body) body.innerHTML = bodyHTML();
    updateTotals();
  }

  async function load() {
    const body = document.getElementById('surveyBody');
    if (!body) return;
    try {
      // reminder 在分组后再按组过滤（组内有任一违规即显示违规），故不传给后端
      const apiFilters = Object.assign({}, state.filters);
      delete apiFilters.reminder;
      state.list = await window.API.listSurveys(apiFilters);
    } catch (e) {
      body.innerHTML = '<tr><td colspan="8"><div class="empty-state" style="padding:20px">⚠️ ' + esc(e.message) + '</div></td></tr>';
      return;
    }
    renderBody();
  }

  function wireFilters(view) {
    document.getElementById('addSurveyBtn').onclick = () => openForm(null);

    // 单字段实时筛选：选完立即生效，不用再点「筛选」按钮
    // 模糊搜索（f_q）保留回车键 + 失焦触发，避免逐字输入时频繁请求
    const fDate = document.getElementById('f_date');
    const fType = document.getElementById('f_projectType');
    const fRem  = document.getElementById('f_reminder');
    const fQ    = document.getElementById('f_q');
    if (fDate) fDate.onchange = () => { state.filters.date = fDate.value; load(); };
    if (fType) fType.onchange = () => { state.filters.projectType = fType.value; load(); };
    if (fRem)  fRem.onchange  = () => { state.filters.reminder  = fRem.value;  load(); };
    if (fQ) {
      fQ.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); state.filters.q = fQ.value.trim(); load(); } };
      fQ.onblur    = () => { state.filters.q = fQ.value.trim(); load(); };
    }

    // 「筛选」按钮仍保留：等价于「回车」触发，会读取所有字段
    document.getElementById('applyFilter').onclick = () => {
      state.filters.date        = fDate ? fDate.value : '';
      state.filters.projectType = fType ? fType.value : '';
      state.filters.reminder    = fRem  ? fRem.value  : '';
      state.filters.q           = fQ    ? fQ.value.trim() : '';
      load();
    };
    document.getElementById('clearFilter').onclick = () => {
      state.filters = { date: '', projectType: '', reminder: '', q: '' };
      view.innerHTML = shellHTML();
      wireFilters(view);
      bindTotalChips();
      load();
    };
    document.getElementById('surveyBody').addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-sact]');
      if (!b) return;
      const act = b.dataset.sact;
      if (act === 'toggle') {
        const k = b.dataset.key;
        if (state.expanded.has(k)) state.expanded.delete(k); else state.expanded.add(k);
        renderBody();
        return;
      }
      if (act === 'delall') {
        const k = b.dataset.key;
        const recs = recordsOfKey(k);
        const name = recs[0] ? (recs[0].expertName || recs[0].target || '') : '';
        if (await confirm('确定删除【' + name + '】的全部 ' + recs.length + ' 条调研记录？', true)) {
          try {
            for (const r of recs) await window.API.deleteSurvey(r.id);
            state.expanded.delete(k);
            toast('已删除全部记录', 'ok'); load();
          } catch (e) { toast(e.message, 'err'); }
        }
        return;
      }
      const id = b.dataset.id; const s = state.list.find(x => x.id === id);
      if (act === 'edit') openForm(s);
      else if (act === 'del') {
        if (await confirm('确定删除该调研记录？', true)) {
          try { await window.API.deleteSurvey(id); toast('已删除', 'ok'); load(); }
          catch (e) { toast(e.message, 'err'); }
        }
      }
    });
  }

  const Survey = {
    async render(view) {
      view.innerHTML = shellHTML();
      wireFilters(view);
      bindTotalChips();
      load();
    }
  };

  window.Survey = Survey;
})();