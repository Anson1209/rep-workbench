/* global window */
(function () {
  'use strict';
  const BASE = '';
  // Guard so a 401 storm (e.g. while overlay is open) doesn't queue the
  // overlay multiple times. Reset by Auth.setToken() after a fresh login.
  function _authGuard() { return !!window.__authOverlayShown; }
  function _setAuthGuard(v) { window.__authOverlayShown = !!v; }
  function _maybeReauth() {
    if (_authGuard()) return;
    if (!window.Auth || !window.Auth.showAuthUI) return;
    _setAuthGuard(true);
    try {
      window.Auth.clearToken && window.Auth.clearToken();
      window.Auth.showAuthUI(() => {
        _setAuthGuard(false);
        // Reload the current page so all module state is re-fetched with
        // the fresh token instead of leaving stale "data load failed"
        // banners behind.
        try { window.location.reload(); } catch (e) {}
      });
    } catch (e) {
      _setAuthGuard(false);
    }
  }

  async function req(method, url, body, isForm) {
    const opt = { method, headers: {} };
    const token = window.Auth && window.Auth.getToken();
    if (token) opt.headers['Authorization'] = 'Bearer ' + token;
    if (body !== undefined) {
      if (isForm) {
        opt.body = body; // FormData
      } else {
        opt.headers['Content-Type'] = 'application/json';
        opt.body = JSON.stringify(body);
      }
    }
    const res = await fetch(BASE + url, opt);
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      const msg = (data && data.error) ? data.error : ('请求失败 (' + res.status + ')');
      const err = new Error(msg);
      err.status = res.status;
      if (data && data.code) err.code = data.code;
      // Mid-session 401 (e.g. Render was redeployed and the JWT is now
      // invalid) — surface the auth overlay instead of leaving the user
      // stuck on a "data load failed" banner. Endpoints under /api/auth/*
      // are the only legitimate sources of 401 from the login flow itself.
      if (res.status === 401 && window.Auth && url.indexOf('/api/auth/') !== 0) {
        _maybeReauth();
      }
      throw err;
    }
    return data;
  }

  const API = {
    // Customers
    listCustomers: (q) => req('GET', '/api/customers' + (q ? '?q=' + encodeURIComponent(q) : '')),
    getCustomer: (id) => req('GET', '/api/customers/' + id),
    createCustomer: (d) => req('POST', '/api/customers', d),
    updateCustomer: (id, d) => req('PUT', '/api/customers/' + id, d),
    deleteCustomer: (id) => req('DELETE', '/api/customers/' + id),
    uploadAttachment: (id, section, file) => {
      const fd = new FormData();
      fd.append('file', file);
      return req('POST', '/api/customers/' + id + '/attachments?section=' + section, fd, true);
    },
    deleteAttachment: (fileId) => req('DELETE', '/api/attachments/' + fileId),
    fileUrl: (fileId, download) => '/api/files/' + fileId + (download ? '?download=1' : ''),

    // Authenticated file fetch — required because the global /api guard
    // denies any /api/files/* request without an Authorization header.
    // Returns a Blob + an Object URL we can hand to <img>/<a>/window.open().
    async fetchFileBlob(fileId) {
      const token = window.Auth && window.Auth.getToken();
      const headers = {};
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const res = await fetch('/api/files/' + fileId, { headers });
      if (!res.ok) {
        if (res.status === 401) {
          _maybeReauth();
          throw new Error('未授权，请先登录');
        }
        let msg = '文件加载失败';
        try { const d = await res.json(); if (d && d.error) msg = d.error; } catch (e) {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const disp = res.headers.get('Content-Disposition') || '';
      const m = disp.match(/filename\*=UTF-8''([^;]+)/);
      const name = m ? decodeURIComponent(m[1]) : 'file';
      return { blob, url: URL.createObjectURL(blob), name };
    },

    // Events
    listEvents: () => req('GET', '/api/events'),
    createEvent: (d) => req('POST', '/api/events', d),
    updateEvent: (id, d) => req('PUT', '/api/events/' + id, d),
    deleteEvent: (id) => req('DELETE', '/api/events/' + id),

    // Surveys
    listSurveys: (params) => {
      const usp = new URLSearchParams();
      Object.entries(params || {}).forEach(([k, v]) => { if (v) usp.set(k, v); });
      const s = usp.toString();
      return req('GET', '/api/surveys' + (s ? '?' + s : ''));
    },
    createSurvey: (d) => req('POST', '/api/surveys', d),
    updateSurvey: (id, d) => req('PUT', '/api/surveys/' + id, d),
    deleteSurvey: (id) => req('DELETE', '/api/surveys/' + id),

    // Backup / stats
    stats: () => req('GET', '/api/stats'),
    exportBackup: () => '/api/backup',
    importBackup: (data) => req('POST', '/api/backup', data)
  };

  window.API = API;
})();
