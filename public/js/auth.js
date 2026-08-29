/* global window, document, localStorage */
(function () {
  'use strict';
  const TOKEN_KEY = 'rep_token';

  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t) {
    window.localStorage.setItem(TOKEN_KEY, t);
    // Reset the api.js 401-storm guard so a fresh login can re-trigger
    // the overlay if the server-side session is invalidated again.
    window.__authOverlayShown = false;
  }
  function clearToken() { window.localStorage.removeItem(TOKEN_KEY); }

  async function authStatus() {
    const r = await fetch('/api/auth/status');
    return r.json();
  }

  async function login(pw) {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || '登录失败');
    }
    const d = await r.json();
    setToken(d.token);
    return d.token;
  }

  async function setup(pw) {
    const r = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || '设置失败');
    }
    const d = await r.json();
    setToken(d.token);
    return d.token;
  }

  async function changePassword(oldP, newP) {
    const r = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken()
      },
      body: JSON.stringify({ oldPassword: oldP, newPassword: newP })
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || '修改失败');
    }
    const d = await r.json();
    setToken(d.token);
    return true;
  }

  // Show the login / first-time-setup overlay. Resolves true on success.
  // onEnter: callback to run after successful auth (re-render the app).
  function showAuthUI(onEnter) {
    const overlay = document.getElementById('auth-overlay');
    const titleEl = document.getElementById('auth-title');
    const subEl = document.getElementById('auth-sub');
    const pwEl = document.getElementById('auth-pw');
    const btn = document.getElementById('auth-btn');
    const msg = document.getElementById('auth-msg');
    const pw2Wrap = document.getElementById('auth-pw2-wrap');
    const pw2El = document.getElementById('auth-pw2');

    let mode = 'login'; // 'login' | 'setup'

    overlay.style.display = 'flex';

    function setMode(m) {
      mode = m;
      msg.textContent = '';
      if (m === 'setup') {
        titleEl.textContent = '设置访问密码';
        subEl.textContent = '首次使用，请设置一个访问密码（至少 6 位），手机和电脑都用它登录。';
        pwEl.placeholder = '设置密码';
        pwEl.autocomplete = 'new-password';
        pw2Wrap.style.display = 'block';
        btn.textContent = '设置并进入';
      } else {
        titleEl.textContent = '访问验证';
        subEl.textContent = '请输入访问密码';
        pwEl.placeholder = '访问密码';
        pwEl.autocomplete = 'current-password';
        pw2Wrap.style.display = 'none';
        btn.textContent = '进入';
      }
      pwEl.value = '';
      if (pw2El) pw2El.value = '';
      pwEl.focus();
    }

    authStatus().then(st => {
      setMode(st.configured ? 'login' : 'setup');
    }).catch(() => setMode('login'));

    function submit() {
      const pw = pwEl.value;
      const pw2 = pw2El ? pw2El.value : '';
      msg.textContent = '';
      msg.className = 'auth-msg';
      if (!pw || pw.length < 6) {
        msg.textContent = '密码至少 6 位';
        msg.className = 'auth-msg err';
        return;
      }
      if (mode === 'setup' && pw !== pw2) {
        msg.textContent = '两次输入的密码不一致';
        msg.className = 'auth-msg err';
        return;
      }
      btn.disabled = true;
      btn.textContent = '请稍候…';
      const action = mode === 'setup' ? setup(pw) : login(pw);
      action.then(() => {
        overlay.style.display = 'none';
        if (typeof onEnter === 'function') onEnter();
      }).catch(err => {
        btn.disabled = false;
        msg.textContent = err.message || '操作失败';
        msg.className = 'auth-msg err';
        setMode('login');
      });
    }

    btn.onclick = submit;
    pwEl.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    if (pw2El) pw2El.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
  }

  window.Auth = {
    getToken, setToken, clearToken,
    authStatus, login, setup, changePassword, showAuthUI
  };
})();
