/* global window, document */
(function () {
  'use strict';
  const { esc, toast, modal, confirm, fmtDate } = window.UI;

  const STATUS = {
    done: { label: '已完成', cls: 'pill-done' },
    pending: { label: '进行中', cls: 'pill-pending' },
    cancel: { label: '已取消', cls: 'pill-cancel' }
  };

  const state = { filters: { start: '', end: '', status: '', q: '' }, list: [] };

  function shellHTML() {
    return '<div class="card">' +
      '<div class="section-head"><h2>问卷调研台账</h2>' +
        '<span class="sub">记录每次调研的日期、对象与完成情况</span>' +
        '<span class="spacer"></span><button class="btn btn-primary" id="addSurveyBtn">+ 新增记录</button></div>' +
      '<div class="filters">' +
        '<div class="field"><label>开始日期</label><input class="input" type="date" id="f_start" value="' + esc(state.filters.start) + '"></div>' +
        '<div class="field"><label>结束日期</label><input class="input" type="date" id="f_end" value="' + esc(state.filters.end) + '"></div>' +
        '<div class="field"><label>完成状态</label><select class="select" id="f_status">' +
          '<option value="">全部</option>' +
          Object.entries(STATUS).map(([k, v]) => '<option value="' + k + '"' + (state.filters.status === k ? ' selected' : '') + '>' + v.label + '</option>').join('') +
        '</select></div>' +
        '<div class="field"><label>对象模糊搜索</label><input class="input" id="f_q" value="' + esc(state.filters.q) + '" placeholder="按调研对象姓名"></div>' +
        '<button class="btn" id="applyFilter">筛选</button>' +
        '<button class="btn btn-ghost" id="clearFilter">重置</button>' +
      '</div>' +
      '<div class="table-wrap"><table class="tbl" id="surveyTbl">' +
        '<thead><tr><th>调研日期</th><th>调研对象</th><th>完成次数</th><th>状态</th><th>备注</th><th>操作</th></tr></thead>' +
        '<tbody id="surveyBody"></tbody>' +
      '</table></div>' +
    '</div>';
  }

  function bodyHTML() {
    if (!state.list.length) return '<tr><td colspan="6"><div class="empty-state" style="padding:30px">📋 暂无调研记录，点击右上角「新增记录」</div></td></tr>';
    return state.list.map(s => {
      const st = STATUS[s.status] || STATUS.done;
      return '<tr>' +
        '<td>' + esc(s.date) + '</td>' +
        '<td>' + esc(s.target) + '</td>' +
        '<td>' + esc(s.count) + '</td>' +
        '<td><span class="pill ' + st.cls + '">' + st.label + '</span></td>' +
        '<td>' + esc(s.note || '—') + '</td>' +
        '<td><div class="row-actions">' +
          '<button class="btn btn-sm" data-sact="edit" data-id="' + s.id + '">编辑</button>' +
          '<button class="btn btn-sm btn-danger" data-sact="del" data-id="' + s.id + '">删除</button>' +
        '</div></td></tr>';
    }).join('');
  }

  function formHTML(s) {
    s = s || {};
    return '' +
      '<div class="form-row">' +
        '<div class="field"><label>调研日期 <span class="req">*</span></label><input class="input" type="date" id="s_date" value="' + esc(s.date || fmtDate(new Date())) + '"></div>' +
        '<div class="field"><label>调研对象 <span class="req">*</span></label><input class="input" id="s_target" value="' + esc(s.target || '') + '" placeholder="如：李医生 / 心内科"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="field"><label>完成次数</label><input class="input" type="number" min="0" id="s_count" value="' + esc(s.count != null ? s.count : 1) + '"></div>' +
        '<div class="field"><label>完成状态</label><select class="select" id="s_status">' +
          Object.entries(STATUS).map(([k, v]) => '<option value="' + k + '"' + ((s.status || 'done') === k ? ' selected' : '') + '>' + v.label + '</option>').join('') +
        '</select></div>' +
      '</div>' +
      '<div class="field"><label>备注</label><textarea class="textarea" id="s_note" placeholder="调研要点、反馈…">' + esc(s.note || '') + '</textarea></div>' +
      '<div class="field-err" id="s_err"></div>';
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
            date: document.getElementById('s_date').value,
            target: document.getElementById('s_target').value.trim(),
            count: parseInt(document.getElementById('s_count').value, 10) || 0,
            status: document.getElementById('s_status').value,
            note: document.getElementById('s_note').value
          };
          const err = document.getElementById('s_err');
          if (!data.date) { err.textContent = '请选择调研日期'; err.parentElement.classList.add('invalid'); return; }
          if (!data.target) { err.textContent = '调研对象必填'; err.parentElement.classList.add('invalid'); return; }
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
      body.innerHTML = '<tr><td colspan="6"><div class="empty-state" style="padding:20px">⚠️ ' + esc(e.message) + '</div></td></tr>';
      return;
    }
    body.innerHTML = bodyHTML();
  }

  const Survey = {
    async render(view) {
      view.innerHTML = shellHTML();
      document.getElementById('addSurveyBtn').onclick = () => openForm(null);
      document.getElementById('applyFilter').onclick = () => {
        state.filters.start = document.getElementById('f_start').value;
        state.filters.end = document.getElementById('f_end').value;
        state.filters.status = document.getElementById('f_status').value;
        state.filters.q = document.getElementById('f_q').value.trim();
        load();
      };
      document.getElementById('clearFilter').onclick = () => {
        state.filters = { start: '', end: '', status: '', q: '' };
        view.innerHTML = shellHTML();
        this.render(view); // re-bind (simpler than re-wiring)
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
      load();
    }
  };

  window.Survey = Survey;
})();
