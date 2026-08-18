/* ==========================================================================
 * views/profile.js — 我的：档案编辑 + 设置声音/通知 + 导出导入 + 免责声明
 * ========================================================================== */
(function (root) {
  'use strict';
  const UI = root.XNUI;
  const Store = root.XNStore;
  const RULES = root.XNRules;
  const A = function () { return root.XNApp; };

  function genderLabel(g) {
    return g === 'male' ? '👦 男宝' : (g === 'female' ? '👧 女宝' : '未设置');
  }

  function render() {
    const el = UI.$('#view-profile');
    const app = A();
    const baby = app.state.baby || { nickname: '小年', gender: '', birthDate: null };
    const settings = app.state.settings;

    let html = '';

    if ((!baby.birthDate || !baby.gender)) {
      html += '<div class="banner-inline card"><span>😊</span> 宝宝信息尚未补全，今日推荐会不那么准确。'
        + '<button class="chip-btn pull-right" data-act="editProfile">去补全</button></div>';
    }

    // 宝宝档案
    html += '<div class="section-title">宝宝档案</div>';
    const ageText = baby.birthDate ? RULES.computeAge(baby.birthDate, new Date()).label : '未设置出生日期';
    html += '<div class="card profile-card">'
      + '<div class="avatar-lg">' + UI.escape(baby.nickname ? baby.nickname.slice(0, 1) : '年') + '</div>'
      + '<div class="profile-row"><span class="k">昵称</span><span class="v">' + UI.escape(baby.nickname || '小年') + '</span></div>'
      + '<div class="profile-row"><span class="k">性别</span><span class="v">' + genderLabel(baby.gender) + '</span></div>'
      + '<div class="profile-row"><span class="k">出生日期</span><span class="v">' + UI.escape(baby.birthDate ? new Date(baby.birthDate).toLocaleDateString('zh-CN') : '未设置') + '</span></div>'
      + '<div class="profile-row"><span class="k">当前月龄</span><span class="v">' + UI.escape(ageText) + '</span></div>'
      + '<button class="btn btn-primary btn-block" data-act="editProfile">编辑档案</button>'
      + '</div>';

    // 设置
    html += '<div class="section-title">设置</div>';
    html += '<div class="card settings-card">'
      + '<div class="set-row"><div class="set-info"><div>提示音</div><div class="text-soft">到点播放柔和叮咚声</div></div>'
      + '<button class="switch' + (settings.soundOn ? ' on' : '') + '" data-act="sound"><span class="knob"></span></button></div>'
      + '<div class="set-row"><div class="set-info"><div>浏览器通知</div><div class="text-soft">授权后到点可发系统提醒</div></div>'
      + '<button class="btn ' + (UI.Notify.granted() ? 'btn-ghost' : 'btn-primary') + ' btn-sm" data-act="notify">'
      + (UI.Notify.granted() ? '已授权 ✓' : '去授权') + '</button></div>'
      + '</div>';

    // 数据
    html += '<div class="section-title">数据</div>';
    html += '<div class="card data-card">'
      + '<button class="btn btn-ghost btn-block" data-act="export">⬇️ 导出备份 JSON</button>'
      + '<button class="btn btn-ghost btn-block" data-act="import">⬆️ 导入备份 JSON</button>'
      + '<input type="file" accept="application/json" id="importFile" class="hidden">'
      + '<button class="btn btn-ghost btn-block danger" data-act="clear">🗑️ 清空全部数据</button>'
      + '</div>';

    // 关于与免责声明
    html += '<div class="section-title">关于与依据</div>';
    html += '<div class="card about-card">'
      + '<div class="about-title">小年的玩具屋</div>'
      + '<div class="text-soft">一个完全离线、只存本地、给你家宝宝定制的陪玩小助手。</div>'
      + '<div class="about-sources">'
      + '<div class="about-sub">育儿依据来源</div>'
      + '<div class="about-item">• 美国儿科学会 AAP</div>'
      + '<div class="about-item">• 美国疾控中心 CDC 发育里程碑</div>'
      + '<div class="about-item">• 世界卫生组织 WHO/UNICEF 养育照护框架</div>'
      + '<div class="about-item">• 蒙台梭利（Montessori）与皮亚杰发展理论</div>'
      + '</div>'
      + '<div class="disclaimer">本工具仅用于日常陪伴参考，不构成医疗诊断，也不替代儿科医生的专业建议。若您对宝宝的发育有担忧，请咨询专业儿科医生。</div>'
      + '</div>';

    el.innerHTML = html;

    el.querySelectorAll('[data-act]').forEach(function (b) {
      const act = b.getAttribute('data-act');
      if (act === 'editProfile') openProfileEditor(baby);
      else if (act === 'sound') {
        const on = !settings.soundOn;
        settings.soundOn = on;
        UI.Sound.enabled = on;
        Store.saveSettings(settings);
        b.classList.toggle('on', on);
        UI.toast(on ? '提示音已开启' : '提示音已关闭');
      } else if (act === 'notify') {
        UI.Notify.request().then(function (p) {
          if (p === 'granted') {
            settings.notifyGranted = true;
            Store.saveSettings(settings);
            UI.toast('已授予通知权限');
            UI.Notify.send('小年的玩具屋', '通知已开启，到点会提醒你换玩具啦');
            render();
          } else {
            UI.toast(p === 'denied' ? '通知权限被拒绝，可在浏览器设置中开启' : '未授权，将使用页面内提醒');
          }
        });
      } else if (act === 'export') {
        Store.exportData().then(function (data) {
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = '小年的玩具屋-备份-' + new Date().toLocaleDateString('zh-CN') + '.json';
          document.body.appendChild(a);
          a.click();
          setTimeout(function () { URL.revokeObjectURL(url); document.body.removeChild(a); }, 200);
          UI.toast('已导出备份文件 🧾');
        });
      } else if (act === 'import') {
        const fileInput = el.querySelector('#importFile');
        fileInput.click();
      } else if (act === 'clear') {
        UI.confirm('清空数据', '将删除全部玩具图片、玩耍记录与宝宝档案，且无法恢复。确定清空吗？', '清空').then(function (ok) {
          if (!ok) return;
          UI.confirm('最后确认', '真的要清空所有数据吗？建议先导出备份。', '已确认，清空').then(function (ok2) {
            if (!ok2) return;
            Store.clearAll(true).then(function () {
              A().loadData().then(function () {
                A().notifyChange();
                UI.toast('已清空全部数据');
                render();
                A().goTab('home');
              });
            });
          });
        });
      }
    });

    const fileInput = el.querySelector('#importFile');
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        if (!fileInput.files.length) return;
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function () {
          try {
            const json = JSON.parse(reader.result);
            Store.importData(json).then(function () {
              UI.toast('导入成功 🎉');
              A().loadData().then(function () {
                A().notifyChange();
                render();
                A().goTab('home');
              });
            }).catch(function (err) {
              UI.toast('导入失败：' + (err && err.message ? err.message : '数据格式不正确'));
            });
          } catch (e) {
            UI.toast('导入失败：文件不是有效的 JSON');
          }
        };
        reader.readAsText(file);
        fileInput.value = '';
      });
    }
  }

  /* ---------- 档案编辑 ---------- */
  function openProfileEditor(baby) {
    const f = {
      nickname: baby && baby.nickname ? baby.nickname : '小年',
      gender: baby ? (baby.gender || '') : '',
      birthDate: baby && baby.birthDate ? baby.birthDate.slice(0, 10) : '',
    };
    const genderBtns = [['', '未设置'], ['male', '👦 男宝'], ['female', '👧 女宝']].map(function (g) {
      return '<button class="gender-opt' + (f.gender === g[0] ? ' active' : '') + '" data-gender="' + g[0] + '">' + g[1] + '</button>';
    }).join('');

    UI.modal({
      title: '编辑宝宝档案',
      html: '<div class="kid-form">'
        + '<label class="field-label">昵称</label>'
        + '<input type="text" id="nick" class="input" maxlength="12" value="' + UI.escape(f.nickname) + '">'
        + '<label class="field-label">性别</label>'
        + '<div class="gender-row">' + genderBtns + '</div>'
        + '<label class="field-label">出生日期</label>'
        + '<input type="date" id="birth" class="input" value="' + UI.escape(f.birthDate) + '" max="' + new Date().toISOString().slice(0, 10) + '">'
        + '<div id="minterp" class="interp-box mt-16"></div>'
        + '</div>',
      buttons: [
        { label: '取消', value: 'cancel' },
        { label: '保存档案', value: 'save', primary: true },
      ],
    }).then(function (val) {
      // 仅 val==='save' 时保存；'cancel' 或 null（点 ✕ / 点遮罩）一律 no-op。
      if (val !== 'save') return;
      // 同步读取表单值（save resolve 后 modal 约 220ms 会移除 DOM，须先捕获）
      const box = UI.$('#modalRoot .modal-box .kid-form');
      const nick = box ? box.querySelector('#nick') : null;
      const birth = box ? box.querySelector('#birth') : null;
      const nickname = (nick && nick.value.trim()) || '小年';
      const birthDate = birth && birth.value
        ? new Date(birth.value + 'T00:00:00').toISOString() : null;
      const profile = { nickname: nickname, gender: f.gender, birthDate: birthDate, updatedAt: new Date().toISOString() };
      Store.saveBaby(profile);
      UI.toast('档案已保存');
      A().loadData().then(function () { A().notifyChange(); render(); });
    });

    // 非-foot 交互：gender 激活态切换 + 出生日期实时"当前月龄"
    // modal() 同步向 #modalRoot 注入 .kid-form，此处可直接绑定监听。
    const box = UI.$('#modalRoot .modal-box .kid-form');
    if (box) {
      function updateInterp() {
        const ip = box.querySelector('#minterp');
        const birth = box.querySelector('#birth');
        if (ip && birth && birth.value) {
          const age = RULES.computeAge(birth.value, new Date());
          ip.innerHTML = '当前月龄：<b>' + UI.escape(age.label) + '</b>（满月实时计算，跨天自动更新）';
        } else if (ip) {
          ip.innerHTML = '填写出生日期后自动计算月龄';
        }
      }
      const birth = box.querySelector('#birth');
      if (birth) { birth.addEventListener('input', updateInterp); updateInterp(); }
      box.querySelectorAll('.gender-opt').forEach(function (b) {
        b.addEventListener('click', function () {
          f.gender = b.getAttribute('data-gender');
          box.querySelectorAll('.gender-opt').forEach(function (x) { x.classList.toggle('active', x === b); });
        });
      });
    }
  }

  root.XNProfile = { render: render };
})(window);