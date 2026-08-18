/* ==========================================================================
 * store.js — 数据持久化封装
 *   IndexedDB : 对象仓库 toys、playLogs（keyPath=id），存玩具/图片 Base64、玩耍历史
 *   localStorage : babyProfile、settings、firstRunDone、schemaVersion
 * 零依赖；返回 Promise 的 API。
 * ========================================================================== */
(function (root) {
  'use strict';

  const DB_NAME = 'xiaonian-toy-house';
  const DB_VERSION = 1;
  const SCHEMA_VERSION = '1';

  /* ---------- IndexedDB 基础封装 ---------- */
  function idbOpen() {
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('toys')) {
          db.createObjectStore('toys', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('playLogs')) {
          db.createObjectStore('playLogs', { keyPath: 'id' });
        }
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  /* 请求 Promise 化 */
  function reqToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function (e) {
        Promise.resolve(e.target.result).then(resolve, reject);
      };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  function withStore(storeName, mode, cb) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        const store = db.transaction(storeName, mode).objectStore(storeName);
        const result = cb(store);
        if (result instanceof IDBRequest) {
          // 单请求：等其完成，取 e.target.result；错误 reject（含 QuotaExceededError）
          reqToPromise(result).then(
            function (v) { db.close(); resolve(v); },
            function (err) { db.close(); reject(err); }
          );
        } else {
          // 回调直接返回普通值（当前无此情况），直接 resolve
          db.close();
          resolve(result);
        }
      });
    });
  }

  /* ---------- 存储层 API ---------- */
  const Store = {
    schemaVersion: SCHEMA_VERSION,

    /* ---- 玩具 ---- */
    getAllToys() {
      return withStore('toys', 'readonly', function (s) {
        return s.getAll();
      });
    },
    addToy(toy) {
      return withStore('toys', 'readwrite', function (s) {
        return s.add(toy);
      });
    },
    updateToy(toy) {
      return withStore('toys', 'readwrite', function (s) {
        return s.put(toy);
      });
    },
    deleteToy(id) {
      return withStore('toys', 'readwrite', function (s) {
        return s.delete(id);
      });
    },

    /* ---- 玩耍记录 ---- */
    getAllLogs() {
      return withStore('playLogs', 'readonly', function (s) {
        return s.getAll();
      });
    },
    addLog(log) {
      return withStore('playLogs', 'readwrite', function (s) {
        return s.add(log);
      });
    },
    deleteLog(id) {
      return withStore('playLogs', 'readwrite', function (s) {
        return s.delete(id);
      });
    },

    /* ---- localStorage：宝宝档案 / 设置 ---- */
    getBaby() {
      try {
        const raw = localStorage.getItem('babyProfile');
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    saveBaby(profile) {
      localStorage.setItem('babyProfile', JSON.stringify(profile));
    },

    getSettings() {
      const defs = {
        soundOn: true,
        notifyGranted: false,
        onboardingDone: false,
        dataUpdatedAt: null,
      };
      try {
        const raw = localStorage.getItem('settings');
        return raw ? Object.assign(defs, JSON.parse(raw)) : defs;
      } catch (e) { return defs; }
    },
    saveSettings(s) {
      s.dataUpdatedAt = new Date().toISOString();
      localStorage.setItem('settings', JSON.stringify(s));
    },

    getFirstRun() {
      return localStorage.getItem('firstRunDone') === 'true';
    },
    setFirstRun(v) {
      localStorage.setItem('firstRunDone', v ? 'true' : 'false');
    },

    /* ---- 导出 / 导入 ---- */
    exportData() {
      return Promise.all([this.getAllToys(), this.getAllLogs()]).then(function (res) {
        return {
          app: 'xiaonian-toy-house',
          schemaVersion: SCHEMA_VERSION,
          exportedAt: new Date().toISOString(),
          babyProfile: Store.getBaby(),
          settings: Store.getSettings(),
          toys: res[0],
          playLogs: res[1],
        };
      });
    },

    importData(json) {
      if (!json || json.app !== 'xiaonian-toy-house') {
        throw new Error('数据格式不正确，无法导入');
      }
      return withStore('toys', 'readwrite', function (s) { return s.clear(); })
        .then(function () {
          return withStore('playLogs', 'readwrite', function (s) { return s.clear(); });
        })
        .then(function () {
          const toys = json.toys || [];
          const logs = json.playLogs || [];
          // 逐条写入并等待完成（每条返回 IDBRequest，withStore 会正确 await）
          const tasks = [];
          toys.forEach(function (t) {
            tasks.push(withStore('toys', 'readwrite', function (s) { return s.put(t); }));
          });
          logs.forEach(function (l) {
            tasks.push(withStore('playLogs', 'readwrite', function (s) { return s.put(l); }));
          });
          return Promise.all(tasks);
        })
        .then(function () {
          if (json.babyProfile) Store.saveBaby(json.babyProfile);
          if (json.settings) Store.saveSettings(json.settings);
        });
    },

    /* ---- 清空全部数据（含档案/设置；可选保留首次引导标记） ---- */
    clearAll(keepFirstRun) {
      return Promise.all([
        withStore('toys', 'readwrite', function (s) { return s.clear(); }),
        withStore('playLogs', 'readwrite', function (s) { return s.clear(); }),
      ]).then(function () {
        localStorage.removeItem('babyProfile');
        localStorage.removeItem('settings');
        if (!keepFirstRun) localStorage.removeItem('firstRunDone');
      });
    },
  };

  root.XNStore = Store;
})(window);