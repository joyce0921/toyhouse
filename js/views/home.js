/* ==========================================================================
 * views/home.js — 首页：宝宝档案卡 + 今日推荐 + 开始玩耍
 * ========================================================================== */
(function (root) {
  'use strict';
  const UI = root.XNUI;
  const RULES = root.XNRules;
  const A = function () { return root.XNApp; };

  function skillName(key) {
    const s = (RULES.SKILLS.find(function (x) { return x.key === key; }));
    return s ? s.name : key;
  }
  function typeNode(key) {
    return RULES.TOY_TYPES.find(function (t) { return t.key === key; }) || { icon: '🧸', name: key };
  }

  function emptyToyImage() {
    return UI.placeholderImg('🧸');
  }

  function babyCard(baby) {
    if (!baby || !baby.birthDate) {
      return '<div class="card baby-card">'
        + '<div class="baby-avatar">' + (baby && baby.nickname ? baby.nickname.slice(0, 1) : '年') + '</div>'
        + '<div class="baby-info"><div class="baby-name">' + UI.escape((baby && baby.nickname) || '小年') + '</div>'
        + '<div class="text-soft">还未设置出生日期，无法计算月龄</div></div>'
        + '<button class="chip-btn" data-act="editBaby">去设置</button>'
        + '</div>';
    }
    const age = RULES.computeAge(baby.birthDate, new Date());
    const gender = baby.gender === 'male' ? '👦' : (baby.gender === 'female' ? '👧' : '');
    return '<div class="card baby-card">'
      + '<div class="baby-avatar">' + UI.escape(baby.nickname ? baby.nickname.slice(0, 1) : '年') + '</div>'
      + '<div class="baby-info">'
      + '<div class="baby-name">' + UI.escape(baby.nickname || '小年') + ' ' + gender + '</div>'
      + '<div class="baby-age">' + UI.escape(age.label) + '</div>'
      + '</div>'
      + '<button class="chip-btn" data-act="editBaby">编辑</button>'
      + '</div>';
  }

  function recoCard(reco, index) {
    const toy = reco.toy;
    const tn = typeNode(toy.type);
    const img = toy.imageData ? '' : '<div class="toy-img-holder">' + UI.escape(tn.icon) + '</div>';
    return '<div class="card reco-card" data-reco="' + index + '">'
      + '<div class="reco-header">'
      + '<div class="reco-order">' + (index + 1) + (reco.nearAge ? '<span class="near-tag">接近适龄</span>' : '') + '</div>'
      + '<div class="reco-title">' + UI.escape(toy.name) + '</div>'
      + '</div>'
      + '<div class="reco-main">'
      + '<div class="reco-thumb">'
      + (img || '<img class="toy-img" alt="" data-img="' + index + '">')
      + '</div>'
      + '<div class="reco-body">'
      + '<div class="skill-tag skill-' + UI.escape(reco.skillMain) + '">' + UI.escape(reco.skillName) + '</div>'
      + '<div class="reco-minutes">⏱ 建议 ' + reco.minutes + ' 分钟</div>'
      + '<div class="reco-goal">锻炼：' + UI.escape(reco.playGuide.goal.split('｜')[0] || '') + '</div>'
      + '<div class="reco-ref">依据：' + UI.escape(reco.refId) + '</div>'
      + '</div>'
      + '</div>'
      + '<button class="btn btn-primary btn-block" data-act="start">开始玩耍</button>'
      + '</div>';
  }

  function render() {
    const el = UI.$('#view-home');
    const app = A();
    const baby = app.state.baby;
    const toys = app.state.toys;
    const logs = app.state.logs;

    let html = '';

    // 档案完善度横幅（出生日期/性别缺失）
    if (baby && (!baby.birthDate || !baby.gender)) {
      html += '<div class="banner-inline card" data-act="editBaby"><span>😊</span> 去补全宝宝信息，今日推荐才更准确'
        + '<button class="chip-btn pull-right">去补全</button></div>';
    }

    html += babyCard(baby);

    html += '<div class="section-title">今日玩什么 <span class="text-soft">按宝宝月龄智能推荐</span></div>';

    if (!baby || !baby.birthDate) {
      html += '<div class="card empty-card">'
        + '<div>' + UI.placeholderImg('👶') + '</div>'
        + '<div class="empty-title">先设置宝宝信息</div>'
        + '<div class="text-soft">填写出生日期后，才能按月龄为你推荐玩具</div>'
        + '<button class="btn btn-primary" data-act="editBaby">去设置宝宝</button>'
        + '</div>';
    } else if (toys.length === 0) {
      html += '<div class="card empty-card">'
        + '<div>' + UI.placeholderImg('🧸') + '</div>'
        + '<div class="empty-title">玩具库还是空的</div>'
        + '<div class="text-soft">去玩具库添加几件家里现有的玩具吧</div>'
        + '<button class="btn btn-primary" data-act="goToys">去添加玩具</button>'
        + '</div>';
    } else {
      const plan = RULES.generateTodayPlan(baby, toys, logs);
      if (plan.length === 0) {
        html += '<div class="card empty-card">'
          + '<div class="text-soft">暂时没有可推荐的玩具，试试在玩具库调整适配月龄</div>'
          + '<button class="btn btn-primary" data-act="goToys">去玩具库</button>'
          + '</div>';
      } else {
        plan.forEach(function (p, i) { html += recoCard(p, i); });
        if (plan.some(function (p) { return p.nearAge; })) {
          html += '<div class="near-note text-soft">部分玩具与宝宝当前月龄最接近，可先陪玩短时间再观察兴趣。</div>';
        }
      }
    }

    el.innerHTML = html;

    // 事件绑定
    el.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const act = btn.getAttribute('data-act');
        if (act === 'editBaby') { app.goTab('profile'); }
        else if (act === 'goToys') { app.goTab('toys'); }
        else if (act === 'start') {
          const idx = Number(btn.closest('[data-reco]').getAttribute('data-reco'));
          const reco = RULES.generateTodayPlan(baby, toys, logs)[idx];
          if (reco) app.openTimer(reco);
        }
      });
    });
    // 图片加载
    el.querySelectorAll('img[data-img]').forEach(function (img) {
      const idx = Number(img.getAttribute('data-img'));
      const plan = RULES.generateTodayPlan(baby, toys, logs);
      if (plan[idx]) UI.loadToyImage(img, plan[idx].toy.imageData, typeNode(plan[idx].toy.type).icon);
    });
  }

  root.XNHome = { render: render };
})(window);