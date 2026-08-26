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
        '<div class="section-head"><h2>关于与扩展</h2></div>' +
        '<p class="muted tiny" style="line-height:1.8">' +
          '· 本工作台为模块化结构，左侧「添加新板块」为预留扩展入口，后续可灵活接入新功能模块。<br>' +
          '· 敏感信息（身份证号、银行卡）采用 AES-256-GCM 加密存储，列表中默认脱敏显示，需手动「显示」方可查看明文。<br>' +
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
    }
  };

  window.Settings = Settings;
})();
