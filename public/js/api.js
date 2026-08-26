/* global window */
(function () {
  'use strict';
  const BASE = '';

  async function req(method, url, body, isForm) {
    const opt = { method, headers: {} };
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
      throw new Error(msg);
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
