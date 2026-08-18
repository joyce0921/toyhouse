/* ==========================================================================
 * views/toys.js — 玩具库：网格列表 + 能力筛选 + 排序 + 引导式打标签添加/编辑/删除
 * ========================================================================== */
(function (root) {
  'use strict';
  const UI = root.XNUI;
  const RULES = root.XNRules;
  const Store = root.XNStore;
  const A = function () { return root.XNApp; };

  const state = { skillFilter: 'all', sort: 'time' };

  function typeNode(key) {
    return RULES.TOY_TYPES.find(function (t) { return t.key === key; })
      || { icon: '🧸', name: key, defaultSkills: [] };
  }
  function skillName(key) {
    const s = RULES.SKILLS.find(function (x) { return x.key === key; });
    return s ? s.name : key;
  }
  function lastUsedMap(logs) {
    const map = {};
    (logs || []).forEach(function (l) {
      const ts = l.playedAt ? new Date(l.playedAt).getTime() : 0;
      if (!map[l.toyId] || ts > map[l.toyId]) map[l.toyId] = ts;
    });
    return map;
  }

  function filterAndSort(toys, logs) {
    let list = toys.slice();
    if (state.skillFilter !== 'all') {
      list = list.filter(function (t) { return t.skills && t.skills.indexOf(state.skillFilter) >= 0; });
    }
    const used = lastUsedMap(logs);
    list.sort(function (a, b) {
      switch (state.sort) {
        case 'name': return a.name.localeCompare(b.name, 'zh');
        case 'age':
          return (a.ageMax - b.ageMax) || (a.ageMin - b.ageMin);
        case 'recent': {
          const at = used[a.id] || 0, bt = used[b.id] || 0;
          return bt - at;
        }
        default:
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
    });
    return list;
  }

  function render() {
    const el = UI.$('#view-toys');
    const app = A();
    const toys = app.state.toys;
    const logs = app.state.logs;
    const list = filterAndSort(toys, logs);

    const chipOpts = RULES.SKILLS.map(function (s) {
      return '<button class="chip chip-skill' + (state.skillFilter === s.key ? ' active' : '') + '" data-skill="' + s.key + '">' + s.name + '</button>';
    }).join('');
    const sortOpts = [
      { v: 'time', n: '添加时间' }, { v: 'name', n: '名称' },
      { v: 'age', n: '月龄' }, { v: 'recent', n: '最近使用' },
    ].map(function (o) {
      return '<button class="chip chip-sort' + (state.sort === o.v ? ' active' : '') + '" data-sort="' + o.v + '">' + o.n + '</button>';
    }).join('');

    let html = '<div class="toys-toolbar">'
      + '<div class="section-title">玩具库 (' + toys.length + ')</div>'
      + '<button class="btn btn-primary btn-sm" data-act="add">＋ 添加玩具</button></div>'
      + '<div class="chip-scroll">'
      + '<button class="chip chip-skill' + (state.skillFilter === 'all' ? ' active' : '') + '" data-skill="all">全部</button>'
      + chipOpts + '</div>'
      + '<div class="sort-area"><label class="sort-label">排序</label>' + sortOpts + '</div>';

    if (list.length === 0) {
      html += '<div class="card empty-card">'
        + '<div>' + UI.placeholderImg('🧩') + '</div>'
        + '<div class="empty-title">' + (toys.length === 0 ? '还没有玩具' : '没有匹配的玩具') + '</div>'
        + '<div class="text-soft">' + (toys.length === 0 ? '把你家现有的玩具添加进来吧' : '换个能力筛选试试') + '</div>'
        + (toys.length === 0 ? '<button class="btn btn-primary" data-act="add">添加第一个玩具</button>' : '')
        + '</div>';
    } else {
      html += '<div class="toy-grid">' + list.map(function (t) { return toyCard(t); }).join('') + '</div>';
    }

    el.innerHTML = html;

    el.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        const act = b.getAttribute('data-act');
        if (act === 'add') openForm(null);
        else if (act === 'edit') {
          const card = b.closest('[data-toyid]');
          const toy = toys.find(function (t) { return t.id === card.getAttribute('data-toyid'); });
          if (toy) openForm(toy);
        }
      });
    });
    el.querySelectorAll('[data-skill]').forEach(function (b) {
      b.addEventListener('click', function () { state.skillFilter = b.getAttribute('data-skill'); render(); });
    });
    el.querySelectorAll('[data-sort]').forEach(function (b) {
      b.addEventListener('click', function () { state.sort = b.getAttribute('data-sort'); render(); });
    });
    el.querySelectorAll('img[data-toyimg]').forEach(function (img) {
      const toy = toys.find(function (t) { return t.id === img.getAttribute('data-toyimg'); });
      if (toy) UI.loadToyImage(img, toy.imageData, typeNode(toy.type).icon);
    });
  }

  function toyCard(t) {
    const tn = typeNode(t.type);
    const skillTags = (t.skills || []).map(function (s) {
      return '<span class="skill-tag skill-tag-sm skill-' + UI.escape(s) + '">' + UI.escape(skillName(s)) + '</span>';
    }).join('');
    const img = t.imageData
      ? '<img class="toy-img" alt="" data-toyimg="' + UI.escape(t.id) + '">'
      : '<div class="toy-img-holder">' + UI.escape(tn.icon) + '</div>';
    return '<div class="card toy-card" data-toyid="' + UI.escape(t.id) + '">'
      + '<div class="toy-thumb">' + img + '</div>'
      + '<div class="toy-info">'
      + '<div class="toy-name">' + tn.icon + ' ' + UI.escape(t.name) + '</div>'
      + '<div class="toy-age">适龄 ' + (t.ageMin === undefined ? 0 : t.ageMin) + '-' + (t.ageMax === undefined ? 36 : t.ageMax) + ' 月</div>'
      + '<div class="skill-tags">' + skillTags + '</div>'
      + (t.note ? '<div class="toy-note">' + UI.escape(t.note) + '</div>' : '')
      + '</div>'
      + '<button class="btn btn-ghost btn-sm" data-act="edit">编辑</button>'
      + '</div>';
  }

  /* ======================================================================
   * 图片压缩：长边约 900px，≤ ~300KB
   * ====================================================================== */
  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file || file.type.indexOf('image') !== 0) { reject(new Error('请选择图片文件')); return; }
      const reader = new FileReader();
      reader.onerror = function () { reject(new Error('读取图片失败')); };
      reader.onload = function () {
        const src = reader.result;
        const img = new Image();
        img.onerror = function () { reject(new Error('图片解码失败，已使用占位图')); };
        img.onload = function () {
          const MAX = 900;
          let w = img.width, h = img.height;
          if (Math.max(w, h) > MAX) {
            const ratio = MAX / Math.max(w, h);
            w = Math.round(w * ratio); h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          let quality = 0.82;
          let dataUrl = '';
          while (quality > 0.22) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
            if (dataUrl.length <= 300 * 1024) break;
            quality -= 0.1;
          }
          resolve(dataUrl);
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ======================================================================
   * 引导式打标签表单
   * ====================================================================== */
  function formHtml(f) {
    const typeBtns = RULES.TOY_TYPES.map(function (t) {
      return '<button class="type-option' + (f.type === t.key ? ' active' : '') + '" data-type="' + t.key + '" type="button">'
        + '<div class="type-icon">' + t.icon + '</div><div class="type-name">' + t.name + '</div></button>';
    }).join('');
    const skillCbs = RULES.SKILLS.map(function (s) {
      const on = f.skills.indexOf(s.key) >= 0;
      return '<label class="skill-cb' + (on ? ' active' : '') + '">'
        + '<input type="checkbox" value="' + s.key + '"' + (on ? ' checked' : '') + '>'
        + (on ? '✅ ' : '☑️ ') + s.name + '</label>';
    }).join('');
    const imgHtml = f.imageData
      ? '<div class="form-img-preview" id="previewWrap"><img id="previewImg" alt=""><button type="button" class="btn btn-ghost btn-sm mt-8" data-act="clearImg">移除图片</button></div>'
      : '<button type="button" class="form-upload" id="uploadZone"><span class="up-icon">📷</span><div>拍照或选图</div><div class="text-soft up-hint">自动压缩后本地存储</div></button>';
    const interp = f.type && f.skills.length ? interpSection(f) : '<div class="text-muted">选择玩具类型与能力后，这里会实时显示能力解读</div>';

    return '<div class="toy-form">'
      + '<div class="form-step"><div class="step-title">1. 玩具照片</div>' + imgHtml + '<input type="file" accept="image/*" id="fileInput" class="hidden"></div>'
      + '<div class="form-step"><div class="step-title">2. 玩具名称</div><input type="text" id="toyName" class="input" placeholder="例如：摇铃、软积木" value="' + UI.escape(f.name) + '"></div>'
      + '<div class="form-step"><div class="step-title">3. 玩具类型 <em>选择自动带出能力</em></div><div class="type-grid">' + typeBtns + '</div></div>'
      + '<div class="form-step"><div class="step-title">4. 锻炼的能力维度 <em>可多选</em></div><div class="skill-grid">' + skillCbs + '</div></div>'
      + '<div class="form-step"><div class="step-title">5. 适配月龄区间</div>'
      + '<div class="range-area">'
      + '<div class="range-label">起始 <span id="minShow">' + f.ageMin + '</span> 月　结束 <span id="maxShow">' + f.ageMax + '</span> 月</div>'
      + '<input type="range" id="ageMin" min="0" max="36" value="' + f.ageMin + '" class="range-min">'
      + '<input type="range" id="ageMax" min="0" max="36" value="' + f.ageMax + '" class="range-max">'
      + '<div class="range-scale"><span>0月</span><span>18月</span><span>36月</span></div>'
      + '</div></div>'
      + '<div class="form-step"><div class="step-title">能力解读 <em>实时更新</em></div><div id="interpBox" class="interp-box">' + interp + '</div></div>'
      + '<div class="form-step"><div class="step-title">6. 备注 <em>可选</em></div><textarea id="toyNote" class="input" rows="2" placeholder="例如：宝宝特别喜欢的 / 注意安全">' + UI.escape(f.note) + '</textarea></div>'
      + '</div>';
  }

  function interpSection(f) {
    const ageMid = Math.round((f.ageMin + f.ageMax) / 2);
    return f.skills.map(function (s) {
      const it = RULES.skillInterpretation(s, ageMid);
      return '<div class="interp-item"><div class="interp-name">' + UI.escape(skillName(s)) + '</div>'
        + '<div class="interp-text">' + UI.escape(it.text) + '</div>'
        + '<div class="interp-ref">依据：' + UI.escape(it.refId) + '</div></div>';
    }).join('');
  }

  function openForm(toy) {
    const editing = !!toy;
    const id = toy ? toy.id : UI.uid();
    const createdAt = toy ? toy.createdAt : new Date().toISOString();
    const f = {
      id: id,
      name: toy ? (toy.name || '') : '',
      imageData: toy ? (toy.imageData || null) : null,
      type: toy && toy.type
        ? toy.type
        : RULES.TOY_TYPES[0].key,
      skills: toy && Array.isArray(toy.skills) && toy.skills.length
        ? toy.skills.slice()
        : (toy && toy.type ? (typeNode(toy.type).defaultSkills || []).slice() : RULES.TOY_TYPES[0].defaultSkills.slice()),
      ageMin: (toy && typeof toy.ageMin === 'number') ? toy.ageMin : 0,
      ageMax: (toy && typeof toy.ageMax === 'number') ? toy.ageMax : 36,
      note: toy ? (toy.note || '') : '',
      createdAt: createdAt,
    };

    UI.modal({
      title: editing ? '编辑玩具' : '添加玩具',
      html: formHtml(f),
    }).then(function (res) {
      // 我们不使用 modal 的默认按钮，改为自定义 foot
    });

    // modal 使用自定义 foot（form 内不影响）。在 modal 渲染后绑定。
    bindWhenReady(f, editing);
  }

  function bindWhenReady(f, editing) {
    const rootEl = UI.$('#modalRoot');
    const tryBind = function () {
      const box = UI.$('#modalRoot .modal-box .toy-form');
      if (!box) return false;
      attachForm(box, f, editing);
      return true;
    };
    if (!tryBind()) {
      const obs = new MutationObserver(function () {
        if (tryBind()) obs.disconnect();
      });
      obs.observe(rootEl, { childList: true, subtree: true });
    }
  }

  function debounce(fn, ms) { let t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  function attachForm(box, f, editing) {
    const body = box.closest('.modal-body');
    const modalFoot = box.closest('.modal-shade').querySelector('.modal-foot');
    if (modalFoot) {
      modalFoot.innerHTML = '<button class="btn btn-ghost" data-mclose="1">取消</button>'
        + '<button class="btn btn-primary" data-msave="1">' + (editing ? '保存修改' : '保存玩具') + '</button>';
    }

    // 名称/备注
    const nameEl = box.querySelector('#toyName');
    const noteEl = box.querySelector('#toyNote');
    if (nameEl) nameEl.addEventListener('input', function (e) { f.name = e.target.value; });
    if (noteEl) noteEl.addEventListener('input', function (e) { f.note = e.target.value; });

    // 类型
    box.querySelectorAll('.type-option').forEach(function (b) {
      b.addEventListener('click', function () {
        const key = b.getAttribute('data-type');
        if (f.type === key) return;
        f.type = key;
        const defs = (RULES.TOY_TYPES.find(function (t) { return t.key === key; }) || {}).defaultSkills || [];
        defs.forEach(function (s) { if (f.skills.indexOf(s) < 0) f.skills.push(s); });
        rebindMarks(box, f);
      });
    });

    // 复选
    box.querySelectorAll('.skill-cb input').forEach(function (cb) {
      cb.addEventListener('change', function () {
        const key = cb.value;
        if (cb.checked) { if (f.skills.indexOf(key) < 0) f.skills.push(key); }
        else { f.skills = f.skills.filter(function (s) { return s !== key; }); }
        rebindMarks(box, f);
      });
    });

    // 双滑块
    const minEl = box.querySelector('#ageMin');
    const maxEl = box.querySelector('#ageMax');
    const syncRange = debounce(function () {
      let lo = Number(minEl.value), hi = Number(maxEl.value);
      if (lo > hi) { const t = lo; lo = hi; hi = t; minEl.value = lo; maxEl.value = hi; }
      f.ageMin = lo; f.ageMax = hi;
      const ms = box.querySelector('#minShow'); if (ms) ms.textContent = lo;
      const xs = box.querySelector('#maxShow'); if (xs) xs.textContent = hi;
      const ip = box.querySelector('#interpBox');
      if (ip) ip.innerHTML = interpSection(f);
    }, 60);
    minEl.addEventListener('input', syncRange);
    maxEl.addEventListener('input', syncRange);

    // 图片
    const fileInput = box.querySelector('#fileInput');
    const uploadZone = box.querySelector('#uploadZone');
    if (uploadZone) {
      uploadZone.addEventListener('click', function () { fileInput.click(); });
      uploadZone.addEventListener('dragover', function (e) { e.preventDefault(); uploadZone.style.background = '#FFF1E6'; });
      uploadZone.addEventListener('dragleave', function () { uploadZone.style.background = ''; });
      uploadZone.addEventListener('drop', function (e) {
        e.preventDefault();
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
      });
    }
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        if (fileInput.files.length) handleFile(fileInput.files[0]);
        fileInput.value = '';
      });
    }
    const clearBtn = box.querySelector('[data-act="clearImg"]');
    if (clearBtn) clearBtn.addEventListener('click', function () { f.imageData = null; refreshImg(box, f); });

    // 保存/取消
    if (modalFoot) {
      modalFoot.addEventListener('click', function (e) {
        const closeBtn = e.target.closest('[data-mclose]');
        const saveBtn = e.target.closest('[data-msave]');
        if (closeBtn) { closeModal(box); return; }
        if (saveBtn) { doSave(f, editing, box); }
      });
    }

    function handleFile(file) {
      const zone = box.querySelector('#uploadZone');
      if (zone) zone.innerHTML = '<div>⏳ 正在处理图片…</div>';
      compressImage(file).then(function (dataUrl) {
        f.imageData = dataUrl;
        refreshImg(box, f);
      }).catch(function (err) {
        UI.toast(err.message || '图片处理失败');
        refreshImg(box, f);
      });
    }
  }

  function rebindMarks(box, f) {
    box.querySelectorAll('.type-option').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-type') === f.type);
    });
    box.querySelectorAll('.skill-cb').forEach(function (lbl) {
      const cb = lbl.querySelector('input');
      const on = f.skills.indexOf(cb.value) >= 0;
      cb.checked = on;
      lbl.classList.toggle('active', on);
      const label = cb.parentNode.textContent.replace(/^\s*[✅☑️]\s*/, '').trim();
      cb.parentNode.innerHTML = (on ? '✅ ' : '☑️ ') + UI.escape(label);
    });
    const ip = box.querySelector('#interpBox');
    if (ip) ip.innerHTML = interpSection(f);
  }

  function refreshImg(box, f) {
    const zone = box.querySelector('#uploadZone');
    const pw = box.querySelector('#previewWrap');
    if (f.imageData) {
      if (!pw) {
        const step = zone ? zone.closest('.form-step') : box.querySelector('.form-step');
        if (step && zone) {
          zone.outerHTML = '<div class="form-img-preview" id="previewWrap"><img id="previewImg" alt=""><button type="button" class="btn btn-ghost btn-sm mt-8" data-act="clearImg">移除图片</button></div>';
          const pImg = box.querySelector('#previewImg');
          if (pImg) pImg.src = f.imageData;
          const cb = box.querySelector('[data-act="clearImg"]');
          if (cb) cb.addEventListener('click', function () { f.imageData = null; refreshImg(box, f); });
        }
      } else {
        const pImg = box.querySelector('#previewImg');
        if (pImg) pImg.src = f.imageData;
      }
    } else if (pw && !zone) {
      pw.outerHTML = '<button type="button" class="form-upload" id="uploadZone"><span class="up-icon">📷</span><div>拍照或选图</div><div class="text-soft up-hint">自动压缩后本地存储</div></button>';
      // 新上传区交给 reboundFile 绑定
    }
    reboundFile();
  }
  function reboundFile() {
    // 重新挂 fileInput 触发（避免重复绑定）
    const box = UI.$('#modalRoot .modal-box .toy-form');
    if (!box) return;
    const fileInput = box.querySelector('#fileInput');
    if (fileInput) {
      const nz = box.querySelector('#uploadZone');
      if (nz && !nz.getAttribute('data-bound')) {
        nz.setAttribute('data-bound', '1');
        nz.addEventListener('click', function () { fileInput.click(); });
        nz.addEventListener('dragover', function (e) { e.preventDefault(); nz.style.background = '#FFF1E6'; });
        nz.addEventListener('dragleave', function () { nz.style.background = ''; });
        nz.addEventListener('drop', function (e) {
          e.preventDefault();
          e.stopPropagation();
          nz.style.background = '';
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
            if (fileInput.files && 'DataTransfer' in window) {
              fileInput.files = e.dataTransfer.files;
              fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        });
      } else if (nz) {
        nz.addEventListener('drop', function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
            if (window.DataTransfer) {
              fileInput.files = e.dataTransfer.files;
              fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        });
      }
    }
  }

  function closeModal(box) {
    const shade = box.closest('.modal-shade');
    if (shade) {
      shade.classList.remove('show');
      setTimeout(function () { if (shade.parentNode) shade.parentNode.removeChild(shade); }, 220);
    }
  }

  function doSave(f, editing, box) {
    if (!f.skills.length) { UI.toast('请至少选择一项能力维度'); return; }
    if (!(f.name || '').trim()) { UI.toast('请给玩具起个名字'); return; }
    const final = {
      id: f.id,
      name: f.name.trim(),
      imageData: f.imageData,
      type: f.type,
      skills: f.skills.slice(),
      ageMin: Math.min(f.ageMin, f.ageMax),
      ageMax: Math.max(f.ageMin, f.ageMax),
      note: (f.note || '').trim(),
      createdAt: f.createdAt,
      updatedAt: new Date().toISOString(),
    };
    const attempt = function (withImg) {
      const payload = Object.assign({}, final, { imageData: withImg ? final.imageData : null });
      const p = editing ? Store.updateToy(payload) : Store.addToy(payload);
      return p.then(function () {
        if (withImg) UI.toast(editing ? '已更新玩具' : '玩具已添加 🎉');
        return true;
      });
    };
    attempt(true).catch(function (err) {
      if (err && (err.name === 'QuotaExceededError' || /quota/i.test(String(err.message || err.name || '')))) {
        // 降级无图
        return attempt(false).then(function () {
          UI.banner('存储空间不足，图片已省略。建议尽快导出备份 🧾', { type: 'warn', persist: true });
          return true;
        });
      }
      throw err;
    }).then(function (ok) {
      if (ok) {
        closeModal(box);
        return A().loadData().then(function () {
          A().notifyChange();
          A().goTab('toys');
        });
      }
    }).catch(function (err) {
      UI.toast('保存失败：' + (err && err.message ? err.message : '未知错误'));
    });
  }

  root.XNToys = { render: render, state: state };
})(window);