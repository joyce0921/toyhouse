# Bugfix 设计：修复空弹窗容器拦截全屏点击

> 状态：v1.0，待设计评审后由 eng-coder 实施
> 关联：[Design-架构设计.md §7.5](Design-架构设计.md)

## 问题
真机现象：首次引导能走完，但结束后点击底部 Tab 及页面按钮均无反应。

## 根因
`css/app.css` 中 `.modal-root` 为 `position:fixed; inset:0; z-index:50`，**未设 `pointer-events:none`**。该容器常驻 DOM、即使内容为空也全屏覆盖，拦截其下方 `#app`（z-index 20/30）的所有点击。

佐证：
- 引导 `.onboarding-root`（z-80）层级高于 modal-root，故引导内按钮可点、能走完；
- 引导结束后其 `.hidden`(display:none) 移除占位，但 modal-root 仍空着全屏拦截 → Tab 全无反应；
- `.timer-root` 因有 `pointer-events:none`（496 行）而无此问题，是正确参照。

## 修复方案（仅改 css/app.css）
容器层指针事件统一采用"根容器 none、可见子弹层 show 时 auto"模式（与 .timer-root 一致）：

1. `.modal-root` 增加 `pointer-events: none;`。
2. `.modal-root .modal-shade.show` 显式 `pointer-events: auto;`，确保弹窗真正显示时可操作；shade 未显示/关闭后回归不拦截。
3. 核查 `.onboarding-root`：引导可见时应可点（onboard-overlay 内按钮），结束 `.hidden` 后不拦截——如需与 modal 对齐，同样 none + overlay 有效状态 auto；**避免破坏引导**，若存在冲突以"不回归引导"优先。

## 受影响文件
- `css/app.css`（样式，本次唯一修改）

## 显式不做
- 不改任何 JS（js/ui.js modal 关闭逻辑、js/app.js 引导逻辑均不动）
- 不改其他文件

## 验收标准
1. 首次引导走完后，底部四 Tab 均可点、切换正常。
2. 档案编辑弹窗可打开、可操作（点遮罩关闭、点按钮保存生效），关闭后 Tab 恢复可点。
3. banner、toast、计时器提醒行为不受影响。