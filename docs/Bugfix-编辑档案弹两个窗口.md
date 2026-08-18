# Bugfix 设计：编辑档案弹出两个窗口

> 状态：v1.0，待评审后由 eng-coder 实施

## 问题（真机无痕稳定复现）
打开「编辑档案」时出现**两个重叠的弹窗**：第一个点不动、需手动关掉，第二个才是可用表单。用户需先关第一个才能操作，体验严重受损。

## 根因
`js/ui.js` 的 `UI.modal()` **每次调用都会向 `#modalRoot` `appendChild` 一个新的 `.modal-shade`，且打开前不清空既有 modal**。当 `openProfileEditor()` 被触发两次（见下"触发路径"），modalRoot 内累积两个 `.modal-shade`，叠加显示为两个窗口。
- 第二个（后创建的）在 DOM 后部、z-index 相同 → 视觉上覆盖前一个；前一个因 `requestAnimationFrame` 时序/遮罩淡而"点不动"，用户需先关。
- 这是 UI.modal 的**通用缺陷**：不防重入、不清理旧实例，凡连续/重复打开 modal 都会叠加。

## 触发路径（编辑档案场景）
`js/views/profile.js` 的 `render()` 在宝宝性别/出生日期缺失时，页面上**同时存在两个 `data-act="editProfile"`**：
- 第 25 行 banner「去补全」
- 第 37 行「编辑档案」
用户点击后若再触发一次 openProfileEditor（如点击穿透、延迟、或先后点到两个按钮），两次都 `UI.modal()` → 两个 shade 叠加。

## 修复方案（防重入 + 打开前清理，根治）
在 `js/ui.js` 的 `UI.modal()` 函数体开头，`const rootEl = $('#modalRoot')` 之后，**appendChild 新 shade 前**，先**移除 rootEl 内已有的全部 `.modal-shade`**：
```js
// 打开新弹窗前，清理遗留弹窗，避免叠加
Array.prototype.slice.call(rootEl.querySelectorAll('.modal-shade')).forEach(function (s) { s.remove(); });
```
这样同一时间始终只有一个 modal，杜绝两个窗口叠加。适用于所有 modal 打开场景（档案编辑、清空确认、引导等）。

## 附加（可选，低风险）：profile 页避免双入口引发困惑
`render()` 中当宝宝信息不完整时 banner「去补全」与「编辑档案」并存，两者都打开同一表单。可保留（均可打开编辑），因 UI.modal 已防重入，行为一致、无叠加。**不改** profile.js 双按钮，除非评审需要。

## 显式不做
- 不改其他文件；不引入依赖；不改 modal 关闭/动画逻辑，仅防重入。

## 受影响文件
- `js/ui.js`（`UI.modal` 开头加清理）

## 验收标准
1. 真机/浏览器连续/重复打开「编辑档案」，**始终只有一个弹窗**，不再叠加两个窗口。
2. 该弹窗可正常操作（选性别/日期/昵称）并保存，保存关闭后无残留遮罩。
3. 其他 modal（清空确认两段式、无数据确认）正常，不叠加、可正常关闭。
4. 关闭后再次正常打开下一个 modal。

## 关联
- 另见 `docs/Bugfix-资源加版本号防缓存.md`（缓存类问题的独立处理，不受本修复影响）。