/* ==========================================================================
 * views/plan.js — 玩耍计划：推荐列表 + 全屏计时器 + 到点提醒 + 玩耍记录 + 历史复盘
 * ========================================================================== */
(function (root) {
  'use strict';
  const UI = root.XNUI;
  const RULES = root.XNRules;
  const Store = root.XNStore;
  const A = function () { return root.XNApp; };

  function skillName(key) {
    const s = RULES.SKILLS.find(function (x) { return x.key === key; });
    return s ? s.name : key;
  }
  function typeNode(key) {
    return RULES.TOY_TYPES.find(function (t) { return t.key === key; }) || { icon: '🧸', name: key };
  }

  function recoCard(reco, index) {
    const toy = reco.toy;
    const tn = typeNode(toy.type);
    const img = toy.imageData ? '<img class="toy-img" alt="" data-img="plan' + index + '">'
      : '<div class="toy-img-holder">' + UI.escape(tn.icon) + '</div>';
    return '<div class="card reco-card plan-item" data-reco="' + index + '">'
      + '<div class="reco-thumb plan-thumb">' + img + '</div>'
      + '<div class="plan-body">'
      + '<div class="plan-name">' + UI.escape(toy.name) + '</div>'
      + '<div class="skill-tag skill-' + UI.escape(reco.skillMain) + '">锻炼 ' + UI.escape(reco.skillName) + '</div>'
      + '<div class="plan-meta">⏱ ' + reco.minutes + ' 分钟 · 适龄 ' + (toy.ageMin === undefined ? 0 : toy.ageMin) + '-' + (toy.ageMax === undefined ? 36 : toy.ageMax) + ' 月</div>'
      + '<div class="plan-goal">' + UI.escape(reco.playGuide.goal) + '</div>'
      + '<div class="plan-how">💬 ' + UI.escape(reco.playGuide.how) + '</div>'
      + '<div class="plan-why">📖 ' + UI.escape(reco.playGuide.why) + '</div>'
      + '<div class="reco-ref">依据：' + UI.escape(reco.refId) + '</div>'
      + '<button class="btn btn-primary btn-block" data-act="start">开始玩耍</button>'
      + '</div>'
      + '</div>';
  }

  function reviewBars(logs) {
    const hist = (function () {
      if (!A().state.toys) return { skillMinutes: {} };
      return RULES.analyzeLogs(logs, 7, A().state.toys);
    })();
    const total = Object.keys(hist.skillMinutes || {}).reduce(function (s, k) { return s + (hist.skillMinutes[k] || 0); }, 0);
    const max = Math.max(1, RULES.SKILLS.reduce(function (m, s) { return Math.max(m, hist.skillMinutes[s.key] || 0); }, 0));
    if (total <= 0) {
      return '<div class="text-soft">近 7 天还没有玩耍记录，开始一次陪玩就能看到能力分布。</div>';
    }
    let html = '';
    RULES.SKILLS.forEach(function (s) {
      const mins = hist.skillMinutes[s.key] || 0;
      const pct = Math.round((mins / max) * 100);
      const pctTotal = Math.round((mins / total) * 100);
      html += '<div class="bar-row">'
        + '<div class="bar-label">' + s.name + '</div>'
        + '<div class="bar-track"><div class="bar-fill skill-' + s.key + '" style="width:' + pct + '%"></div></div>'
        + '<div class="bar-val">' + mins + '分</div>'
        + '<div class="bar-total">' + pctTotal + '%</div>'
        + '</div>';
    });
    return html;
  }

  function logRow(log) {
    const toy = (A().state.toys || []).find(function (t) { return t.id === log.toyId; });
    const name = toy ? toy.name : '已删除的玩具';
    const tn = toy ? typeNode(toy.type) : { icon: '🧸' };
    return '<div class="card log-row" data-logid="' + UI.escape(log.id) + '">'
      + '<div class="log-icon">' + tn.icon + '</div>'
      + '<div class="log-info">'
      + '<div class="log-name">' + UI.escape(name) + '</div>'
      + '<div class="log-time">' + UI.fmtDate(log.playedAt) + ' ' + UI.fmtTime(log.playedAt) + ' · ' + (log.minutes || 0) + ' 分钟</div>'
      + (log.comment ? '<div class="log-comment">' + UI.escape(log.comment) + '</div>' : '')
      + '</div>'
      + '<button class="btn btn-ghost btn-sm" data-act="delLog">删除</button>'
      + '</div>';
  }

  function render() {
    const el = UI.$('#view-plan');
    const app = A();
    const baby = app.state.baby;
    const logs = app.state.logs;

    let html = '<div class="section-title">今日陪伴计划 <span class="text-soft">补短板 · 多样化</span></div>';

    if (!baby || !baby.birthDate) {
      html += '<div class="card empty-card">'
        + '<div>' + UI.placeholderImg('⏱️') + '</div>'
        + '<div class="empty-title">先设置宝宝信息</div>'
        + '<div class="text-soft">填写出生日期后才能生成计划</div>'
        + '<button class="btn btn-primary" data-act="goProfile">去设置宝宝</button>'
        + '</div>';
    } else if (!app.state.toys.length) {
      html += '<div class="card empty-card">'
        + '<div>' + UI.placeholderImg('🧸') + '</div>'
        + '<div class="empty-title">还没有玩具</div>'
        + '<div class="text-soft">去玩具库添加玩具生成计划</div>'
        + '<button class="btn btn-primary" data-act="goToys">去添加玩具</button>'
        + '</div>';
    } else {
      const plan = RULES.generateTodayPlan(baby, app.state.toys, logs);
      if (plan.length === 0) {
        html += '<div class="card empty-card"><div class="text-soft">暂时没有可推荐玩具，请调整玩具的适龄区间</div></div>';
      } else {
        plan.forEach(function (p, i) { html += recoCard(p, i); });
        if (plan.some(function (p) { return p.nearAge; })) {
          html += '<div class="near-note text-soft">部分玩具与当前月龄最接近，可先短时间陪玩观察兴趣。</div>';
        }
        html += '<div class="interp-agenda card"><div class="agenda-title">为什么这样安排？</div>'
          + '<div class="text-soft">优先补足近 7 天锻炼较少的能力维度，并让不同维度的玩具交替，避免专注疲劳。每个玩具的建议时长基于宝宝月龄的专注基线（' + '不同宝宝有个体差异，可按兴趣时长灵活调整）。</div></div>';
      }
    }

    // 历史复盘
    html += '<div class="section-title">近 7 天能力分布 <span class="text-soft">复盘</span></div>';
    html += '<div class="card review-card">' + reviewBars(logs) + '</div>';

    // 玩耍记录
    html += '<div class="section-title">玩耍记录 <span class="text-soft">' + logs.length + ' 条</span></div>';
    if (logs.length === 0) {
      html += '<div class="card empty-card slim"><div class="text-soft">还没有玩耍记录，完成一次计时陪玩就会自动记录</div></div>';
    } else {
      const sorted = logs.slice().sort(function (a, b) { return new Date(b.playedAt) - new Date(a.playedAt); });
      html += '<div class="log-list">' + sorted.map(logRow).join('') + '</div>';
    }

    el.innerHTML = html;

    el.querySelectorAll('[data-act]').forEach(function (b) {
      const act = b.getAttribute('data-act');
      if (act === 'goProfile') app.goTab('profile');
      else if (act === 'goToys') app.goTab('toys');
      else if (act === 'start') {
        const idx = Number(b.closest('[data-reco]').getAttribute('data-reco'));
        const reco = RULES.generateTodayPlan(baby, app.state.toys, logs)[idx];
        if (reco) openTimer(reco);
      } else if (act === 'delLog') {
        const id = b.closest('[data-logid]').getAttribute('data-logid');
        UI.confirm('删除记录', '确定要删除这条玩耍记录吗？').then(function (ok) {
          if (ok) {
            Store.deleteLog(id).then(function () {
              A().loadData().then(function () { A().notifyChange(); render(); });
            });
          }
        });
      }
    });
    // 图片
    el.querySelectorAll('img[data-img]').forEach(function (img) {
      const idx = Number(img.getAttribute('data-img').slice(4));
      const plan = RULES.generateTodayPlan(baby, app.state.toys, logs);
      if (plan[idx]) UI.loadToyImage(img, plan[idx].toy.imageData, typeNode(plan[idx].toy.type).icon);
    });
  }

  /* ======================================================================
   * 全屏计时器
   * ====================================================================== */
  let timerState = null;
  let overlayGen = 0; // 用于防止过期动画/清理回调误操作新计时器

  function openTimer(reco) {
    if (!reco) return;
    const rootEl = UI.$('#timerRoot');
    if (!rootEl) return;
    rootEl.classList.remove('hidden');
    const gen = ++overlayGen; // 使上一个计时器的延迟清理全部失效
    const toy = reco.toy;
    const tn = typeNode(toy.type);
    const totalSec = reco.minutes * 60;
    const suggested = reco.minutes;

    timerState = {
      running: false,
      endedReceipt: false,
      remaining: totalSec,
      totalSec: totalSec,
      elapsed: 0,
      toyId: toy.id,
      toyName: toy.name,
      range: [toy.ageMin === undefined ? 0 : toy.ageMin, toy.ageMax === undefined ? 36 : toy.ageMax],
      tip: reco.playGuide && reco.playGuide.how ? reco.playGuide.how : '多鼓励、多回应，跟随宝宝的兴趣。',
    };

    const svgCirc = 2 * Math.PI * 52;

    rootEl.innerHTML = ''
      + '<div class="timer-overlay">'
      + '<div class="timer-head"><div class="timer-toy">' + tn.icon + ' ' + UI.escape(toy.name) + '</div>'
      + '<button class="chip-btn" data-act="close">退出</button></div>'
      + '<div class="timer-ring-wrap">'
      + '<svg class="timer-ring" viewBox="0 0 120 120"><circle class="ring-bg" cx="60" cy="60" r="52"/><circle class="ring-fg" cx="60" cy="60" r="52" stroke-dasharray="' + svgCirc + '" stroke-dashoffset="0"/></svg>'
      + '<div class="timer-digit">' + fmtClock(totalSec) + '</div>'
      + '<div class="timer-sub">建议 ' + suggested + ' 分钟</div>'
      + '</div>'
      + '<div class="timer-tip" id="tipBox">💬 ' + UI.escape(timerState.tip) + '</div>'
      + '<div class="timer-btns">'
      + '<button class="btn btn-ghost" data-act="pause">暂停</button>'
      + '<button class="btn btn-primary" data-act="next">换一个</button>'
      + '<button class="btn btn-primary" data-act="done">完成本玩具</button>'
      + '</div>'
      + '<div class="timer-end-banner hidden" id="endBanner">⏰ 该切换到下一个玩具啦！</div>'
      + '</div>';

    rootEl.classList.remove('hidden');
    const overlay = rootEl.querySelector('.timer-overlay');
    requestAnimationFrame(function () { overlay.classList.add('show'); });

    const digit = rootEl.querySelector('.timer-digit');
    const fg = rootEl.querySelector('.ring-fg');
    const pauseBtn = rootEl.querySelector('[data-act="pause"]');

    function fmtClock(sec) {
      const m = Math.floor(Math.max(0, sec) / 60);
      const s = Math.floor(Math.max(0, sec) % 60);
      return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
    }
    function draw() {
      digit.textContent = fmtClock(timerState.remaining);
      const pct = timerState.totalSec > 0 ? timerState.remaining / timerState.totalSec : 0;
      fg.setAttribute('stroke-dashoffset', String(svgCirc * (1 - pct)));
    }
    draw();

    let lastTs = null;
    function tick(ts) {
      if (!timerState.running) return;
      if (lastTs === null) lastTs = ts;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      timerState.remaining -= dt;
      timerState.elapsed += dt;
      draw();
      if (timerState.remaining <= 0) {
        timerState.remaining = 0;
        timerState.running = false;
        draw();
        onTimeUp();
        return;
      }
      requestAnimationFrame(tick);
    }

    const pauseLabel = function () { return timerState.running ? '暂停' : '继续'; };
    function syncPauseLabel() { pauseBtn.textContent = pauseLabel(); }

    function startTimer() {
      timerState.running = true;
      lastTs = null;
      requestAnimationFrame(tick);
    }
    function onTimeUp() {
      if (timerState.endedReceipt) return;
      timerState.endedReceipt = true;
      UI.Sound.play();
      UI.banner('⏰ ' + UI.escape(toy.name) + ' 时间到，该切换到下一个玩具啦！', { type: 'primary' });
      const endBanner = rootEl.querySelector('#endBanner');
      if (endBanner) { endBanner.classList.remove('hidden'); endBanner.textContent = '⏰ 该切换到下一个玩具啦！' + ' · 陪玩小贴士：' + timerState.tip; }
      UI.Notify.send('该切换到下一个玩具啦', (toy.name) + ' 的建议时长到了。叮咚，快陪宝宝换一个玩具玩吧！');
    }

    function recordPlay(comment) {
      const mins = Math.max(0, Math.round(timerState.elapsed / 60 * 10) / 10);
      const log = {
        id: UI.uid(),
        toyId: timerState.toyId,
        minutes: mins,
        playedAt: new Date().toISOString(),
        comment: comment || '',
      };
      return Store.addLog(log);
    }
    function teardown() {
      rootEl.classList.remove('show');
      setTimeout(function () {
        if (overlayGen !== gen) return; // 防止误清新建的计时器
        rootEl.classList.add('hidden');
        rootEl.innerHTML = '';
        timerState = null;
      }, 250);
    }
    function exitToPlan() {
      teardown();
      A().loadData().then(function () { A().notifyChange(); A().goTab('plan'); });
    }

    pauseBtn.addEventListener('click', function () {
      if (timerState.running) { timerState.running = false; }
      else { lastTs = null; timerState.running = true; requestAnimationFrame(tick); }
      syncPauseLabel();
    });

    rootEl.querySelector('[data-act="close"]').addEventListener('click', function () {
      if (timerState.running || timerState.elapsed > 0.5) {
        UI.confirm('退出计时', '正在陪玩中，确定要退出吗？本次进度将不会保存。', '退出').then(function (ok) {
          if (ok) exitToPlan();
        });
      } else { exitToPlan(); }
    });

    rootEl.querySelector('[data-act="done"]').addEventListener('click', function () {
      recordPlay().then(function () {
        UI.toast('已记录这次玩耍 🎉');
        exitToPlan();
      }).catch(function () { UI.toast('记录失败'); });
    });

    rootEl.querySelector('[data-act="next"]').addEventListener('click', function () {
      recordPlay().then(function () {
        UI.toast('已记录，换一个玩具继续吧');
        teardown();
        // 重新生成计划并打开下一条
        const baby = A().state.baby;
        const logs = A().state.logs;
        const plan = RULES.generateTodayPlan(baby, A().state.toys, logs);
        const cx = A().state.toyContext || 0;
        const next = plan[cx + 1];
        if (next) { A().state.toyContext = cx + 1; openTimer(next); }
        else {
          A().state.toyContext = 0;
          A().loadData().then(function () { A().notifyChange(); A().goTab('plan'); });
        }
      }).catch(function () { UI.toast('记录失败'); });
    });

    startTimer();
  }

  root.XNPlan = { render: render, openTimer: openTimer };
})(window);