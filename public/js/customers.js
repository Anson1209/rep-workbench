/* global window, document */
(function () {
  'use strict';
  const { esc, toast, modal, confirm, validPhone, validIdCard, validBank, initials, fileIcon, fmtSize } = window.UI;

  const state = { q: '', list: [], reveal: {}, blobCache: {} };

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
    const ext = (f.name || '').split('.').pop().toLowerCase();
    const thumb = f.isImage
      ? '<img class="attach-thumb" data-thumb-for="' + f.id + '" alt="" src="">'
      : '<span class="attach-thumb">' + fileIcon(ext, false) + '</span>';
    // 纯前端可信可达：图片给"预览"(modal，不依赖弹窗拦截)，所有文件都给"下载"。
    // 之前"打开"按钮调 window.open，浏览器默认拦截 → 用户体验是"按了没反应"。
    const previewBtn = f.isImage
      ? '<button class="btn btn-sm" data-act="prev" data-id="' + f.id + '">预览</button>'
      : '';
    return '' +
      '<div class="attach-item">' +
        thumb +
        '<div class="attach-info"><div class="n">' + esc(f.name) + '</div>' +
          '<div class="s">' + fmtSize(f.size) + '</div></div>' +
        '<div class="attach-ops">' +
          previewBtn +
          '<button class="btn btn-sm" data-act="dl" data-id="' + f.id + '">下载</button>' +
          '<button class="btn btn-sm btn-danger" data-act="del" data-id="' + f.id + '">删除</button>' +
        '</div>' +
      '</div>';
  }

  function cardHTML(c) {
    const revealed = state.reveal[c.id];
    const idv = revealed ? (revealed.idCard || '—') : c.idCardMask;
    const bv = revealed ? (revealed.bankCard || '—') : c.bankCardMask;
    // 开户行：revealed 用真值，否则用列表脱敏（前 2 字 + …），未填写显示 —
    const bnv = revealed
      ? (revealed.bankName || '—')
      : (c.bankNameMask || '—');
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
          metaRow('开户行', bnv, true) +
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
    await hydrateThumbs(grid);
  }

  // 异步给缩略图 <img data-thumb-for> 注入 Object URL。
  // 走带 Authorization 头的 fetch，避免触发 /api 全局守卫的 401。
  async function hydrateThumbs(root) {
    if (!root) return;
    const imgs = root.querySelectorAll('img[data-thumb-for]');
    imgs.forEach(im => {
      const fid = im.getAttribute('data-thumb-for');
      if (!fid || im.dataset.loaded === '1') return;
      const cached = state.blobCache[fid];
      if (cached) { im.src = cached.url; im.dataset.loaded = '1'; return; }
      window.API.fetchFileBlob(fid).then(({ url }) => {
        state.blobCache[fid] = { url };
        im.src = url;
        im.dataset.loaded = '1';
      }).catch(() => {
        im.dataset.loaded = '1';
        im.alt = '加载失败';
      });
    });
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
      '<div class="form-row">' +
        '<div class="field"><label>开户行</label>' +
          '<input class="input" id="f_bankname" value="' + esc(c.bankName || '') + '" placeholder="选填，如：中国工商银行淮安分行" list="bankNameList">' +
          '<datalist id="bankNameList">' +
            '<option value="中国工商银行"><option value="中国农业银行"><option value="中国银行"><option value="中国建设银行">' +
            '<option value="交通银行"><option value="中国邮政储蓄银行"><option value="招商银行"><option value="浦发银行">' +
            '<option value="中信银行"><option value="中国民生银行"><option value="兴业银行"><option value="光大银行">' +
            '<option value="华夏银行"><option value="广发银行"><option value="平安银行"><option value="江苏银行">' +
            '<option value="南京银行"><option value="上海银行"><option value="北京银行"><option value="农村商业银行">' +
          '</datalist>' +
        '</div>' +
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
            bankCard: document.getElementById('f_bank').value.trim(),
            bankName: document.getElementById('f_bankname').value.trim()
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

  function previewImage(url, name) {
    modal({
      title: '图片预览 — ' + (name || ''), center: true,
      body: '<div style="text-align:center"><img src="' + url + '" style="max-width:100%;max-height:70vh;border-radius:10px"></div>',
      footer: [{ label: '关闭', cls: 'btn-primary', onClick: (c) => c() }]
    });
  }

  // 释放在预览/打开/下载后已用的 Object URL，避免长会话泄漏内存
  function _revokeLater(url, ms) { setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, ms || 30000); }

  // 仅负责 fetch + 按钮 loading 反馈；**绝不在此 revoke URL**，
  // 否则调用方（下载/预览）拿到的是已失效的 blob，会下载到 0 字节。
  async function _fetchFileWithBtn(btn, fileId) {
    const oldText = btn ? btn.textContent : '';
    const oldDisabled = btn ? btn.disabled : false;
    if (btn) { btn.disabled = true; btn.textContent = '加载中…'; }
    try {
      const r = await window.API.fetchFileBlob(fileId);
      return r;
    } catch (e) {
      if (btn) { btn.textContent = oldText; btn.disabled = oldDisabled; }
      throw e;
    }
  }

  function _btnDone(btn, doneText, oldText) {
    if (!btn) return;
    btn.textContent = doneText;
    setTimeout(() => { btn.textContent = oldText || '下载'; btn.disabled = false; }, 1500);
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
        state.reveal[id] = { idCard: full.idCard, bankCard: full.bankCard, bankName: full.bankName };
        loadGrid();
      } catch (e) { toast(e.message, 'err'); }
    } else if (act === 'hide') {
      delete state.reveal[id]; loadGrid();
    } else if (act === 'prev') {
      try {
        const { url, name } = await _fetchFileWithBtn(t, id);
        previewImage(url, name);
        toast('已加载 ' + name, 'ok');
        // 预览用：图片要持续显示，长延迟回收（用户关掉 modal 前不会失效）
        _revokeLater(url, 60000);
      } catch (e) { toast(e.message || '预览失败', 'err'); }
    } else if (act === 'dl') {
      // 用原生 <a download> 触发——浏览器不会拦截（区别于 window.open）。
      // 按钮立刻给"加载中…"反馈，下载后变"已下载 ✓"，让用户明确知道已被点中。
      try {
        const oldText = t.textContent;
        const { url, name } = await _fetchFileWithBtn(t, id);
        const a = document.createElement('a');
        a.href = url; a.download = name; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
        _btnDone(t, '已下载 ✓', oldText);
        toast('已下载 ' + name, 'ok');
        // 必须等 click 触发下载之后再回收，否则浏览器拿到的是已失效的 blob
        _revokeLater(url, 2000);
      } catch (e) { toast(e.message || '下载失败', 'err'); }
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
