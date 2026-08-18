/* ==========================================================================
 * ui.js — DOM 工具、Toast、弹窗、横幅提醒、提示音(Web Audio)、浏览器通知
 * ========================================================================== */
(function (root) {
  'use strict';

  const $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  const $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function uid() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- 提示音（Web Audio 柔和叮咚） ---------- */
  const Sound = {
    ctx: null,
    enabled: true,
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { this.ctx = new AC(); } catch (e) { this.ctx = null; }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(function () {});
      }
    },
    play() {
      if (!this.enabled) return;
      try {
        this.ensure();
        if (!this.ctx) return;
        const t0 = this.ctx.currentTime;
        const notes = [880, 1320, 1760];
        notes.forEach(function (f, i) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = f;
          const t = t0 + i * 0.16;
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
          osc.connect(gain).connect(this.ctx.destination);
          osc.start(t);
          osc.stop(t + 0.52);
        }, this);
      } catch (e) { /* 忽略音频失败 */ }
    },
  };

  /* ---------- Toast ---------- */
  let toastId = 0;
  function toast(msg, type) {
    const c = $('#toastContainer');
    if (!c) return;
    const id = 'toast_' + (++toastId);
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast-' + type : '');
    el.id = id;
    el.textContent = msg;
    c.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, 2600);
    return el;
  }

  /* ---------- 横幅提醒（顶部滑入） ---------- */
  function banner(msg, opts) {
    opts = opts || {};
    const c = $('#bannerContainer');
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'banner' + (opts.type ? ' banner-' + opts.type : '');
    el.textContent = msg;
    el.addEventListener('click', function () { dismissBanner(el); });
    c.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    if (!opts.persist) {
      setTimeout(function () { dismissBanner(el); }, opts.duration || 4200);
    }
    return el;
  }
  function dismissBanner(el) {
    if (!el) return;
    el.classList.remove('show');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
  }

  /* ---------- 弹窗 ---------- */
  function modal(opts) {
    return new Promise(function (resolve) {
      const rootEl = $('#modalRoot');
      if (!rootEl) { resolve(null); return; }
      // 打开新弹窗前，清理 rootEl 内遗留的弹窗（防重入），确保同一时间只有一个弹窗
      $$('.modal-shade', rootEl).forEach(function (sh) { if (sh.parentNode) sh.parentNode.removeChild(sh); });
      const shade = document.createElement('div');
      shade.className = 'modal-shade';
      const box = document.createElement('div');
      box.className = 'modal-box';
      let html = '<div class="modal-head">';
      if (opts.title) html += '<div class="modal-title">' + escapeHtml(opts.title) + '</div>';
      html += '<button class="modal-close" data-act="close" aria-label="关闭">✕</button></div>';
      html += '<div class="modal-body">' + (opts.html || '') + '</div>';
      html += '<div class="modal-foot">';
      if (opts.buttons && opts.buttons.length) {
        opts.buttons.forEach(function (b, i) {
          html += '<button class="btn ' + (b.primary ? 'btn-primary' : 'btn-ghost') + '" data-act="btn" data-i="' + i + '">' + escapeHtml(b.label) + '</button>';
        });
      }
      html += '</div>';
      box.innerHTML = html;
      shade.appendChild(box);
      rootEl.appendChild(shade);
      requestAnimationFrame(function () { shade.classList.add('show'); });

      function close(res) {
        shade.classList.remove('show');
        setTimeout(function () { if (shade.parentNode) shade.parentNode.removeChild(shade); }, 220);
        resolve(res);
      }
      box.addEventListener('click', function (e) {
        const act = e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'close') { close(null); return; }
        if (act === 'btn') {
          const i = Number(e.target.getAttribute('data-i'));
          const b = opts.buttons[i];
          close(b ? b.value : null);
        }
      });
      shade.addEventListener('click', function (e) {
        if (e.target === shade) close(opts.onDismiss !== undefined ? opts.onDismiss : null);
      });
    });
  }

  function confirmDialog(title, msg, okLabel) {
    return modal({
      title: title,
      html: '<div class="confirm-body">' + escapeHtml(msg) + '</div>',
      buttons: [
        { label: '取消', value: false },
        { label: okLabel || '确定', value: true, primary: true },
      ],
    }).then(function (v) { return v === true; });
  }

  /* ---------- 内联 SVG 占位插画 ---------- */
  const EMPTY_SVG = '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
    + '<circle cx="60" cy="62" r="46" fill="#FFF1E6"/>'
    + '<circle cx="60" cy="52" r="22" fill="#FFB4A2"/>'
    + '<circle cx="60" cy="78" r="30" fill="#FF8A5C"/>'
    + '<circle cx="52" cy="50" r="3" fill="#5D4037"/>'
    + '<circle cx="68" cy="50" r="3" fill="#5D4037"/>'
    + '<path d="M54 62 q6 8 12 0" stroke="#5D4037" stroke-width="3" fill="none" stroke-linecap="round"/>'
    + '</svg>';

  function placeholderImg(icon) {
    const svg = icon
      ? '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
        + '<rect width="120" height="120" rx="20" fill="#FFF1E6"/>'
        + '<text x="60" y="74" font-size="46" text-anchor="middle">' + icon + '</text>'
        + '</svg>'
      : EMPTY_SVG;
    return 'data:image/svg+xml;base64,' + root.btoa(unescape(encodeURIComponent(svg)));
  }

  /* ---------- 图片加载（含解码失败降级） ---------- */
  function loadToyImage(imgEl, imageData, fallbackIcon) {
    if (!imageData) {
      imgEl.src = placeholderImg(fallbackIcon || '🧸');
      return;
    }
    const setFallback = function () {
      imgEl.src = placeholderImg(fallbackIcon || '🧸');
      toast('图片预览失败，已显示占位图');
    };
    imgEl.onerror = setFallback;
    // 用 createImageBitmap/decode 校验，失败则降级
    const probe = new Image();
    probe.onload = function () {
      try {
        if (window.createImageBitmap) {
          window.createImageBitmap(probe).then(function () {
            if (imgEl) imgEl.src = imageData;
          }).catch(setFallback);
        } else {
          imgEl.src = imageData;
        }
      } catch (e) { setFallback(); }
    };
    probe.onerror = setFallback;
    probe.src = imageData;
  }

  /* ---------- 浏览器通知 ---------- */
  const Notify = {
    supported() {
      return 'Notification' in root && root.Notification.permission !== 'denied';
    },
    granted() {
      return 'Notification' in root && root.Notification.permission === 'granted';
    },
    request() {
      if (!('Notification' in root)) return Promise.resolve('unsupported');
      return root.Notification.requestPermission();
    },
    send(title, body) {
      if (!this.granted()) return;
      try {
        const n = new root.Notification(title, { body: body, icon: undefined, tag: 'xiaonian' });
        if (n.onclick) {
          n.onclick = function () { root.focus(); n.close(); };
        }
      } catch (e) { /* ignore */ }
    },
  };

  /* ---------- 时间格式化 ---------- */
  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /* ---------- 分享 ---------- */
  const UI = {
    $: $,
    $$: $$,
    escape: escapeHtml,
    uid: uid,
    toast: toast,
    banner: banner,
    dismissBanner: dismissBanner,
    modal: modal,
    confirm: confirmDialog,
    Sound: Sound,
    Notify: Notify,
    placeholderImg: placeholderImg,
    loadToyImage: loadToyImage,
    fmtDate: fmtDate,
    fmtTime: fmtTime,
  };

  root.XNUI = UI;
})(window);