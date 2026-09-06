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

  const state = { filters: { start: '', end: '', projectType: '', reminder: '', q: '' }, list: [] };

  function projectChip(t) {
    if (!t) return '<span class="type-chip type-empty">未分类</span>';
    return '<span class="type-chip type-' + esc(t) + '">' + esc(t) + '</span>';
  }

  function shellHTML() {
    return '<div class="card">' +
      '<div class="section-head"><h2>问卷调研台账</h2>' +
        '<span class="sub">按项目分额度（大区 ¥500 / BU ¥800），每位专家 ≤3 次，相邻两次 ≥30 天</span>' +
        '<span class="spacer"></span><button class="btn btn-primary" id="addSurveyBtn">+ 新增记录</button></div>' +
      '<div class="filters">' +
        '<div class="field"><label>开始日期</label><input class="input" type="date" id="f_start" value="' + esc(state.filters.start) + '"></div>' +
        '<div class="field"><label>结束日期</label><input class="input" type="date" id="f_end" value="' + esc(state.filters.end) + '"></div>' +
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
          '<th class="col-date">调研日期</th>' +
          '<th class="col-type">项目类型</th>' +
          '<th>专家姓名</th>' +
          '<th class="col-count">使用次数</th>' +
          '<th>额度</th>' +
          '<th>提醒</th>' +
          '<th>备注</th>' +
          '<th>操作</th>' +
        '</tr></thead>' +
        '<tbody id="surveyBody"></tbody>' +
      '</table></div>' +
    '</div>';
  }

  function bodyHTML() {
    if (!state.list.length) {
      return '<tr><td colspan="8"><div class="empty-state" style="padding:30px">📋 暂无调研记录，点击右上角「新增记录」</div></td></tr>';
    }
    return state.list.map(s => {
      const rem = REMINDER[s.reminderStatus] || REMINDER.normal;
      const usageCount = s.count != null ? s.count : '—';
      const usageTotal = s.amount ? '¥' + s.amount : '—';
      const reason = s.reminderReason ? '<div class="reminder-reason">' + esc(s.reminderReason) + '</div>' : '';
      return '<tr>' +
        '<td class="col-date">' + esc(s.usageDate || s.date || '') + '</td>' +
        '<td class="col-type">' + projectChip(s.projectType) + '</td>' +
        '<td>' + esc(s.expertName || s.target || '') + '</td>' +
        '<td class="col-count">' + esc(usageCount) + '</td>' +
        '<td>' + esc(usageTotal) + '</td>' +
        '<td><span class="pill ' + rem.cls + '">' + esc(rem.label) + '</span>' + reason + '</td>' +
        '<td>' + esc(s.note || '—') + '</td>' +
        '<td><div class="row-actions">' +
          '<button class="btn btn-sm" data-sact="edit" data-id="' + esc(s.id) + '">编辑</button>' +
          '<button class="btn btn-sm btn-danger" data-sact="del" data-id="' + esc(s.id) + '">删除</button>' +
        '</div></td></tr>';
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
        '📌 业务规则：每专家同项目 ≤3 次；相邻两次使用 ≥30 天，否则系统标记「⚠ 违规」' +
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

  async function load() {
    const body = document.getElementById('surveyBody');
    if (!body) return;
    try {
      state.list = await window.API.listSurveys(state.filters);
    } catch (e) {
      body.innerHTML = '<tr><td colspan="8"><div class="empty-state" style="padding:20px">⚠️ ' + esc(e.message) + '</div></td></tr>';
      return;
    }
    body.innerHTML = bodyHTML();
  }

  function wireFilters(view) {
    document.getElementById('addSurveyBtn').onclick = () => openForm(null);
    document.getElementById('applyFilter').onclick = () => {
      state.filters.start = document.getElementById('f_start').value;
      state.filters.end = document.getElementById('f_end').value;
      state.filters.projectType = document.getElementById('f_projectType').value;
      state.filters.reminder = document.getElementById('f_reminder').value;
      state.filters.q = document.getElementById('f_q').value.trim();
      load();
    };
    document.getElementById('clearFilter').onclick = () => {
      state.filters = { start: '', end: '', projectType: '', reminder: '', q: '' };
      view.innerHTML = shellHTML();
      wireFilters(view);
      load();
    };
    document.getElementById('surveyBody').addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-sact]');
      if (!b) return;
      const id = b.dataset.id; const act = b.dataset.sact;
      const s = state.list.find(x => x.id === id);
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
      load();
    }
  };

  window.Survey = Survey;
})();