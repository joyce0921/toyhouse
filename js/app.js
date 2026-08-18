/* ==========================================================================
 * app.js — 入口：Tab 路由、初始化、App 状态、首次引导
 * ========================================================================== */
(function (root) {
  'use strict';
  const UI = root.XNUI;
  const Store = root.XNStore;
  const RULES = root.XNRules;

  const App = {
    state: {
      baby: null,
      toys: [],
      logs: [],
      settings: null,
      currentTab: 'home',
      toyContext: 0,
    },

    /* ---------- 数据装载 ---------- */
    loadData() {
      const s = Store.getSettings();
      if (!s.onboardingDone) {
        // 首次运行默认打开声音
        s.soundOn = true;
      }
      this.state.settings = s;
      UI.Sound.enabled = s.soundOn;
      return Promise.all([Store.getBaby(), Store.getAllToys(), Store.getAllLogs()])
        .then(function (res) {
          App.state.baby = res[0];
          App.state.toys = res[1] || [];
          App.state.logs = res[2] || [];
          return App.state;
        });
    },

    /* ---------- 标题栏 ---------- */
    updateHeader() {
      const titleEl = UI.$('#header-title');
      const subEl = UI.$('#header-sub');
      const baby = this.state.baby;
      if (baby && baby.nickname) titleEl.textContent = baby.nickname + ' 的玩具屋';
      else titleEl.textContent = '小年的玩具屋';
      const gender = baby && baby.gender === 'male' ? '👦' : (baby && baby.gender === 'female' ? '👧' : '');
      subEl.textContent = (baby && baby.birthDate)
        ? gender + ' ' + RULES.computeAge(baby.birthDate, new Date()).label
        : '设置宝宝信息后可计算月龄';
    },

    /* ---------- Tab 路由 ---------- */
    goTab(name) {
      this.state.currentTab = name;
      const order = ['home', 'toys', 'plan', 'profile'];
      (UI.$$('.view')).forEach(function (v) {
        v.classList.toggle('active', v.getAttribute('data-view') === name);
      });
      (UI.$$('.tab-btn')).forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-tab') === name);
      });
      this.updateHeader();
      (UI.$$('.view[data-view="' + name + '"]'))[0].scrollTop = 0;
      switch (name) {
        case 'home': root.XNHome.render(); break;
        case 'toys': root.XNToys.render(); break;
        case 'plan': root.XNPlan.render(); break;
        case 'profile': root.XNProfile.render(); break;
      }
    },

    /* ---------- 数据变更后刷新当前视图 ---------- */
    notifyChange() {
      this.updateHeader();
      this.goTab(this.state.currentTab);
    },

    /* ---------- 打开计时器 ---------- */
    openTimer(reco) {
      root.XNPlan.openTimer(reco);
    },

    /* ---------- 初始化 ---------- */
    init() {
      this.loadData().then(function () {
        App.bindTabbar();
        App.updateHeader();
        App.goTab('home');
        const settings = App.state.settings;
        if (!settings.onboardingDone) {
          App.showOnboarding();
        }
      });
    },

    bindTabbar() {
      (UI.$$('.tab-btn')).forEach(function (b) {
        b.addEventListener('click', function () {
          const name = b.getAttribute('data-tab');
          if (App.state.currentTab === name) return;
          App.goTab(name);
        });
      });
    },

    /* ---------- 首次引导 ---------- */
    showOnboarding() {
      const rootEl = UI.$('#onboardingRoot');
      const steps = [
        { icon: '🧸', title: '欢迎来到小年的玩具屋', desc: '一个完全离线、只存你手机里的陪玩小助手。按宝宝的月龄，帮你安排「今天玩什么、怎么玩」。' },
        { icon: '📷', title: '先录入玩具', desc: '给家里的玩具拍张照，选择类型和能力维度，系统会自动给出发育解读。' },
        { icon: '⏱️', title: '每天一计划', desc: '系统会补足宝宝锻炼较少的能力短板，配上计时器，到点用提示音和横幅提醒你换玩具。' },
      ];
      let idx = 0;
      function draw() {
        const s = steps[idx];
        if (!s) { finish(); return; }
        rootEl.innerHTML = ''
          + '<div class="onboard-overlay show">'
          + '<div class="onboard-card">'
          + '<div class="onboard-icon">' + s.icon + '</div>'
          + '<div class="onboard-title">' + s.title + '</div>'
          + '<div class="onboard-desc">' + s.desc + '</div>'
          + '<div class="onboard-dots">' + steps.map(function (x, i) {
            return '<span class="od' + (i === idx ? ' on' : '') + '"></span>';
          }).join('') + '</div>'
          + '<button class="btn btn-primary btn-block" id="onNext">' + (idx < steps.length - 1 ? '下一步' : '开始使用') + '</button>'
          + '</div>'
          + '</div>';
        rootEl.querySelector('#onNext').addEventListener('click', function () { idx++; draw(); });
      }
      function finish() {
        rootEl.innerHTML = '';
        rootEl.classList.add('hidden');
        const st = Store.getSettings();
        st.onboardingDone = true;
        Store.saveSettings(st);
        App.state.settings = st;
      }
      rootEl.classList.remove('hidden');
      draw();
    },
  };

  // 启动
  document.addEventListener('DOMContentLoaded', function () { App.init(); });
  root.XNApp = App;
})(window);