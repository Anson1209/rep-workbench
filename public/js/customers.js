/* global window, document */
(function () {
  'use strict';
  const { esc, toast, modal, confirm, validPhone, validIdCard, validBank, initials, fileIcon, fmtSize } = window.UI;

  const state = { q: '', list: [], reveal: {} };

  function metaRow(k, v, sensitive) {
    return '<div class="row"><span class="k">' + esc(k) + '</span>' +
      '<span class="' + (sensitive ? 'sensitive' : '') + '">' + esc(v || '—') + '</span></div>';
  }

  function attachZoneHTML(c, section, title) {
    const items = c.attachments[section] || [];
    let inner = '';
    if (!items.length) {
      inner = '<div class="attach-empty">暂无附件</div>';
    } else {
      inner = items.map(f => attachItemHTML(c, f)).join('');
    }
    return '' +
      '<div class="attach-zone">' +
        '<h4><span class="tag">' + esc(title) + '</span> 附件区</h4>' +
        '<div class="attach-list">' + inner + '</div>' +
        '<label class="btn btn-sm upload-btn" style="margin-top:8px">' +
          '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> 上传' +
          '<input type="file" data-cust="' + c.id + '" data-sec="' + section + '" accept=".png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.pdf">' +
        '</label>' +
      '</div>';
  }

  function attachItemHTML(c, f) {
    const thumb = f.isImage
      ? '<img class="attach-thumb" src="' + window.API.fileUrl(f.id) + '" alt="">'
      : '<span class="attach-thumb">' + fileIcon(f.name.split('.').pop(), false) + '</span>';
    const previewOp = f.isImage
      ? '<button class="btn btn-sm" data-act="prev" data-id="' + f.id + '">预览</button>'
      : '<button class="btn btn-sm" data-act="open" data-id="' + f.id + '">打开</button>';
    return '' +
      '<div class="attach-item">' +
        thumb +
        '<div class="attach-info"><div class="n">' + esc(f.name) + '</div>' +
          '<div class="s">' + fmtSize(f.size) + '</div></div>' +
        '<div class="attach-ops">' +
          previewOp +
          '<button class="btn btn-sm" data-act="dl" data-id="' + f.id + '">下载</button>' +
          '<button class="btn btn-sm btn-danger" data-act="del" data-id="' + f.id + '">删除</button>' +
        '</div>' +
      '</div>';
  }

  function cardHTML(c) {
    const revealed = state.reveal[c.id];
    const idv = revealed ? (revealed.idCard || '—') : c.idCardMask;
    const bv = revealed ? (revealed.bankCard || '—') : c.bankCardMask;
    const pv = revealed ? c.phone : c.phoneMask;
    const revealBtn = revealed
      ? '<button class="btn btn-sm btn-ghost" data-act="hide" data-id="' + c.id + '">隐藏</button>'
      : '<button class="btn btn-sm btn-ghost" data-act="reveal" data-id="' + c.id + '">显示敏感信息</button>';
    return '' +
      '<div class="card cust-card" data-cust="' + c.id + '">' +
        '<div class="c-head">' +
          '<div class="avatar">' + esc(initials(c.name)) + '</div>' +
          '<div><div class="c-name">' + esc(c.name) + '</div>' +
          '<div class="c-hosp">' + esc(c.hospital || '未填写医院') + '</div></div>' +
        '</div>' +
        '<div class="c-meta">' +
          metaRow('手机号', pv, true) +
          metaRow('身份证', idv, true) +
          metaRow('银行卡', bv, true) +
        '</div>' +
        '<div class="flex" style="margin-top:10px;gap:8px;flex-wrap:wrap">' + revealBtn +
          '<button class="btn btn-sm" data-act="edit" data-id="' + c.id + '">编辑</button>' +
          '<button class="btn btn-sm btn-danger" data-act="delc" data-id="' + c.id + '">删除</button>' +
        '</div>' +
        attachZoneHTML(c, 'profile', '个人简介') +
        attachZoneHTML(c, 'identity', '身份信息') +
      '</div>';
  }

  function shellHTML() {
    return '' +
      '<div class="card">' +
        '<div class="section-head"><h2>客户资料管理</h2>' +
          '<span class="sub">KOL 客户信息 · 敏感数据加密存储</span><span class="spacer"></span>' +
          '<button class="btn btn-primary" id="addCustBtn">+ 新增客户</button></div>' +
        '<div class="search-bar">' +
          '<input class="input" id="custSearch" placeholder="按姓名或手机号模糊搜索" value="' + esc(state.q) + '">' +
          '<button class="btn" id="custSearchBtn">搜索</button>' +
          '<button class="btn btn-ghost" id="custClearBtn">清除</button>' +
        '</div>' +
        '<div id="custGrid" class="grid"></div>' +
      '</div>';
  }

  async function loadGrid() {
    const grid = document.getElementById('custGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="attach-empty">加载中…</div>';
    try {
      state.list = await window.API.listCustomers(state.q);
    } catch (e) {
      grid.innerHTML = '<div class="empty-state"><div class="big">⚠️</div>' + esc(e.message) + '</div>';
      return;
    }
    if (!state.list.length) {
      grid.innerHTML = '<div class="empty-state"><div class="big">👥</div>还没有客户记录，点击右上角「新增客户」开始</div>';
      return;
    }
    grid.innerHTML = state.list.map(cardHTML).join('');
  }

  function formHTML(c) {
    c = c || {};
    return '' +
      '<div class="field"><label>医院名称</label><input class="input" id="f_hospital" value="' + esc(c.hospital || '') + '" placeholder="如：市第一人民医院"></div>' +
      '<div class="form-row">' +
        '<div class="field"><label>姓名 <span class="req">*</span></label><input class="input" id="f_name" value="' + esc(c.name || '') + '"></div>' +
        '<div class="field"><label>手机号</label><input class="input" id="f_phone" value="' + esc(c.phone || '') + '" inputmode="numeric" placeholder="选填"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="field"><label>身份证号</label><input class="input" id="f_id" value="' + esc(c.idCard || '') + '" placeholder="选填"></div>' +
        '<div class="field"><label>银行卡号</label><input class="input" id="f_bank" value="' + esc(c.bankCard || '') + '" placeholder="选填"></div>' +
      '</div>' +
      '<div class="field-err" id="f_err"></div>';
  }

  function openEdit(c) {
    const isNew = !c;
    modal({
      title: isNew ? '新增客户' : '编辑客户',
      body: formHTML(c),
      footer: [
        { label: '取消', cls: '', onClick: (cl) => cl() },
        { label: isNew ? '创建' : '保存', cls: 'btn-primary', onClick: async (cl) => {
          const data = {
            hospital: document.getElementById('f_hospital').value,
            name: document.getElementById('f_name').value.trim(),
            phone: document.getElementById('f_phone').value.trim(),
            idCard: document.getElementById('f_id').value.trim(),
            bankCard: document.getElementById('f_bank').value.trim()
          };
          const err = document.getElementById('f_err');
          if (!data.name) { err.textContent = '姓名必填'; err.parentElement.classList.add('invalid'); return; }
          if (data.phone && !validPhone(data.phone)) { err.textContent = '手机号格式不正确（11 位，1 开头）'; err.parentElement.classList.add('invalid'); return; }
          if (data.idCard && !validIdCard(data.idCard)) { err.textContent = '身份证号格式不正确（18 位）'; err.parentElement.classList.add('invalid'); return; }
          if (data.bankCard && !validBank(data.bankCard)) { err.textContent = '银行卡号格式不正确（12-19 位数字）'; err.parentElement.classList.add('invalid'); return; }
          try {
            if (isNew) await window.API.createCustomer(data);
            else await window.API.updateCustomer(c.id, data);
            toast(isNew ? '客户已创建' : '已保存', 'ok');
            cl(); loadGrid();
          } catch (e) { err.textContent = e.message; err.parentElement.classList.add('invalid'); }
        } }
      ]
    });
  }

  function previewImage(fileId) {
    const url = window.API.fileUrl(fileId);
    modal({
      title: '图片预览', center: true,
      body: '<div style="text-align:center"><img src="' + url + '" style="max-width:100%;max-height:70vh;border-radius:10px"></div>',
      footer: [{ label: '关闭', cls: 'btn-primary', onClick: (c) => c() }]
    });
  }

  async function handleClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    const id = t.dataset.id;
    if (act === 'edit') {
      const c = state.list.find(x => x.id === id);
      const full = await window.API.getCustomer(id).catch(() => c);
      openEdit(full);
    } else if (act === 'delc') {
      if (await confirm('确定删除该客户及其所有附件？此操作不可恢复。', true)) {
        try { await window.API.deleteCustomer(id); toast('已删除', 'ok'); loadGrid(); }
        catch (e) { toast(e.message, 'err'); }
      }
    } else if (act === 'reveal') {
      try {
        const full = await window.API.getCustomer(id);
        state.reveal[id] = { idCard: full.idCard, bankCard: full.bankCard };
        loadGrid();
      } catch (e) { toast(e.message, 'err'); }
    } else if (act === 'hide') {
      delete state.reveal[id]; loadGrid();
    } else if (act === 'prev') {
      previewImage(id);
    } else if (act === 'open') {
      window.open(window.API.fileUrl(id), '_blank');
    } else if (act === 'dl') {
      window.location.href = window.API.fileUrl(id, true);
    } else if (act === 'del') {
      if (await confirm('确定删除该附件？', true)) {
        try { await window.API.deleteAttachment(id); toast('附件已删除', 'ok'); loadGrid(); }
        catch (e) { toast(e.message, 'err'); }
      }
    }
  }

  async function handleUpload(e) {
    const inp = e.target;
    if (inp.tagName !== 'INPUT' || inp.type !== 'file') return;
    const file = inp.files && inp.files[0];
    if (!file) return;
    const custId = inp.dataset.cust, sec = inp.dataset.sec;
    try {
      await window.API.uploadAttachment(custId, sec, file);
      toast('附件已上传', 'ok');
      loadGrid();
    } catch (err) { toast(err.message, 'err'); }
    inp.value = '';
  }

  const Customers = {
    async render(view) {
      view.innerHTML = shellHTML();
      document.getElementById('addCustBtn').onclick = () => openEdit(null);
      const searchInput = document.getElementById('custSearch');
      document.getElementById('custSearchBtn').onclick = () => { state.q = searchInput.value.trim(); loadGrid(); };
      document.getElementById('custClearBtn').onclick = () => { state.q = ''; searchInput.value = ''; loadGrid(); };
      searchInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { state.q = searchInput.value.trim(); loadGrid(); } });
      view.querySelector('#custGrid').addEventListener('click', handleClick);
      view.addEventListener('change', handleUpload);
      loadGrid();
    }
  };

  window.Customers = Customers;
})();
