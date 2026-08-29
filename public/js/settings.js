/* global window, document */
(function () {
  'use strict';
  const { esc, toast, modal, confirm } = window.UI;

  function shellHTML() {
    return '' +
      '<div class="card">' +
        '<div class="section-head"><h2>数据备份与恢复</h2>' +
          '<span class="sub">数据集中保存在服务器，电脑端与手机端实时同步</span></div>' +
        '<p class="muted tiny">所有数据（含加密后的敏感信息）会随服务端持久化保存，刷新或重启均不丢失。建议定期导出备份。</p>' +
        '<div class="flex" style="margin-top:12px;flex-wrap:wrap;gap:10px">' +
          '<a class="btn btn-primary" href="' + window.API.exportBackup() + '">导出备份</a>' +
          '<label class="btn upload-btn">导入备份 (恢复)' +
            '<input type="file" id="importFile" accept="application/json">' +
          '</label>' +
        '</div>' +
        '<div id="importMsg" class="tiny muted" style="margin-top:10px"></div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="section-head"><h2>访问密码</h2>' +
          '<span class="sub">手机与电脑使用同一密码登录</span></div>' +
        '<p class="muted tiny">修改后，所有已登录设备需使用新密码重新登录。</p>' +
        '<div class="field" style="margin-top:12px">' +
          '<label>原密码</label>' +
          '<input type="password" id="pwOld" class="input" autocomplete="current-password">' +
        '</div>' +
        '<div class="field">' +
          '<label>新密码（至少 6 位）</label>' +
          '<input type="password" id="pwNew" class="input" autocomplete="new-password">' +
        '</div>' +
        '<div class="field">' +
          '<label>确认新密码</label>' +
          '<input type="password" id="pwNew2" class="input" autocomplete="new-password">' +
        '</div>' +
        '<button id="pwChangeBtn" class="btn btn-primary">修改密码</button>' +
        '<div id="pwMsg" class="tiny muted" style="margin-top:10px"></div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="section-head"><h2>关于与扩展</h2></div>' +
        '<p class="muted tiny" style="line-height:1.8">' +
          '· 本工作台为模块化结构，左侧「添加新板块」为预留扩展入口，后续可灵活接入新功能模块。<br>' +
          '· 敏感信息（身份证号、银行卡）采用 AES-256-GCM 加密存储，列表中默认脱敏显示，需手动「显示」方可查看明文。<br>' +
          '· 公网访问受访问密码保护，未登录无法查看任何数据。<br>' +
          '· 由 不一书个人工作台生成器 生成。' +
        '</p>' +
      '</div>';
  }

  const Settings = {
    async render(view) {
      view.innerHTML = shellHTML();
      const fileInput = document.getElementById('importFile');
      const msg = document.getElementById('importMsg');
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (!(await confirm('导入将覆盖当前所有数据，确定继续？', true))) { fileInput.value = ''; return; }
        msg.textContent = '导入中…';
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          await window.API.importBackup(data);
          msg.textContent = '导入成功，已恢复数据。';
          toast('备份已恢复', 'ok');
        } catch (e) {
          msg.textContent = '导入失败：' + e.message;
          toast('导入失败', 'err');
        }
        fileInput.value = '';
      });

      const pwOld = document.getElementById('pwOld');
      const pwNew = document.getElementById('pwNew');
      const pwNew2 = document.getElementById('pwNew2');
      const pwBtn = document.getElementById('pwChangeBtn');
      const pwMsg = document.getElementById('pwMsg');
      pwBtn.addEventListener('click', async () => {
        pwMsg.textContent = '';
        pwMsg.className = 'tiny muted';
        const o = pwOld.value, n = pwNew.value, n2 = pwNew2.value;
        if (!o || !n) { pwMsg.textContent = '请填写原密码和新密码'; pwMsg.className = 'tiny err'; return; }
        if (n.length < 6) { pwMsg.textContent = '新密码至少 6 位'; pwMsg.className = 'tiny err'; return; }
        if (n !== n2) { pwMsg.textContent = '两次新密码不一致'; pwMsg.className = 'tiny err'; return; }
        pwBtn.disabled = true;
        try {
          await window.Auth.changePassword(o, n);
          pwMsg.textContent = '密码已修改，请在各设备用新密码重新登录。';
          pwMsg.className = 'tiny ok';
          pwOld.value = ''; pwNew.value = ''; pwNew2.value = '';
          toast('密码已修改', 'ok');
        } catch (e) {
          pwMsg.textContent = e.message;
          pwMsg.className = 'tiny err';
        }
        pwBtn.disabled = false;
      });
    }
  };

  window.Settings = Settings;
})();
