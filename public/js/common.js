/* global window */
(function () {
  'use strict';
  const root = document.getElementById('modal-root');
  const toastRoot = document.getElementById('toast-root');

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    toastRoot.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2200);
    setTimeout(() => el.remove(), 2600);
  }

  // modal({ title, body, footer, center })
  // body: string HTML or DOM node
  // footer: [{ label, cls, onClick(close) }]
  function modal(opts) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask' + (opts.center ? ' center' : '');
    const m = document.createElement('div');
    m.className = 'modal';
    const head = document.createElement('div');
    head.className = 'modal-head';
    const h = document.createElement('h3');
    h.textContent = opts.title || '';
    const x = document.createElement('button');
    x.className = 'icon-btn';
    x.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    head.appendChild(h); head.appendChild(x);
    const body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    m.appendChild(head); m.appendChild(body);
    let foot = null;
    if (opts.footer && opts.footer.length) {
      foot = document.createElement('div');
      foot.className = 'modal-foot';
      opts.footer.forEach(b => {
        const btn = document.createElement('button');
        btn.className = 'btn ' + (b.cls || '');
        btn.textContent = b.label;
        btn.onclick = () => b.onClick && b.onClick(close);
        foot.appendChild(btn);
      });
      m.appendChild(foot);
    }
    mask.appendChild(m);
    root.appendChild(mask);
    function close() { mask.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    x.onclick = close;
    mask.onclick = (e) => { if (e.target === mask) close(); };
    document.addEventListener('keydown', onKey);
    return { close, body, el: m };
  }

  function confirm(msg, danger) {
    return new Promise(resolve => {
      modal({
        title: '请确认',
        body: '<p style="margin:0">' + esc(msg) + '</p>',
        footer: [
          { label: '取消', cls: '', onClick: (c) => { c(); resolve(false); } },
          { label: '确定', cls: danger ? 'btn-danger' : 'btn-primary', onClick: (c) => { c(); resolve(true); } }
        ]
      });
    });
  }

  function fileIcon(ext, isImage) {
    const e = (ext || '').toLowerCase();
    if (isImage) return '🖼️';
    if (['doc', 'docx'].includes(e)) return '📄';
    if (['xls', 'xlsx'].includes(e)) return '📊';
    if (e === 'pdf') return '📕';
    return '📎';
  }

  function fmtSize(bytes) {
    if (!bytes) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + u[i];
  }

  function fmtDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt)) return String(d);
    const p = n => (n < 10 ? '0' + n : n);
    return dt.getFullYear() + '-' + p(dt.getMonth() + 1) + '-' + p(dt.getDate());
  }

  // client-side validators (mirror backend)
  function validPhone(p) { return /^1[3-9]\d{9}$/.test(p || ''); }
  function validIdCard(id) {
    if (!/^\d{17}[\dXx]$/.test(id || '')) return false;
    const w = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const codes = '10X98765432';
    let sum = 0;
    for (let i = 0; i < 17; i++) sum += parseInt(id[i], 10) * w[i];
    return codes[sum % 11] === id[17].toUpperCase();
  }
  function validBank(v) { const d = (v || '').replace(/\s/g, ''); return /^\d{12,19}$/.test(d); }

  function initials(name) {
    if (!name) return '?';
    return name.trim().slice(0, 1);
  }

  window.UI = {
    esc, toast, modal, confirm, fileIcon, fmtSize, fmtDate,
    validPhone, validIdCard, validBank, initials
  };
})();
