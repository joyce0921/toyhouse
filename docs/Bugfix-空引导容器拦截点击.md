# Bugfix 设计：空引导容器拦截点击——页面整体点不动

> 状态：v1.0，待评审后由 eng-coder 实施

## 问题（清除缓存复现）
重新打开页面后，首页能正常渲染显示（宝宝档案卡、今日推荐等），但**所有按钮点击均无反应**，包括「设置宝宝信息」等——点后不跳转、停留在首页。

## 根因（确凿）
`index.html` 中 `#onboardingRoot` 初始为 `<div class="onboarding-root"></div>`（**无 `hidden` 类**）。其 CSS（css/app.css）为：
```css
.modal-root, .onboarding-root, .timer-root {
  position: fixed; inset: 0; z-index: 50;   /* 全屏覆盖 */
}
.onboarding-root { z-index: 80; }            /* 最高层，且未设 pointer-events:none */
```
- `.modal-root`、`.timer-root` 都设了 `pointer-events:none`（空时点不透），唯独 `.onboarding-root` **没有**——当初设计假设"引导结束后会加 hidden"。
- 但当 `settings.onboardingDone === true`（用户已走过引导，或 localStorage 存有旧标记）时，`init()`（js/app.js）**不会调用 `showOnboarding()`**，因此 `#onboardingRoot` 的 `hidden` 类**永远不会被加上**。
- 结果：`#onboardingRoot` 常以「空壳 + fullscreen fixed + z-index80 + pointer-events可透」存在，**透明覆盖整个首页并拦截所有点击**。恢复/清除缓存后用户首屏即中招。

（首次进入且 onboardingDone=false 时能走完引导：`showOnboarding()` 里 `rootEl.classList.remove('hidden')` → 引导显示 → 点「开始使用」→ `finish()` 加 `hidden`，此时才正常。一旦已 onboardingDone=true，就永远卡在无 hidden 的拦截态。）

## 修复方案（仅改 css/app.css）
让 `.onboarding-root` 与其他容器一致采用"根容器 none、可见子弹层 show 时 auto"模式：
1. `.onboarding-root { pointer-events: none; }`
2. `.onboarding-root .onboard-overlay { pointer-events: auto; }`（引导内容可见时可点）
这样空容器不拦截点击；引导真正显示时其 `#onNext` 按钮仍可点。

## 受影响文件
- `css/app.css`（仅容器样式）

## 显式不做
- 不改 js（showOnboarding/finish 逻辑、hidden 处理均不变）。
- 不改 index.html。
- 不加 hover/其他样式。

## 验收标准
1. 清除缓存/冷启动后（onboardingDone=true 场景），首页可正常点击任意按钮（设置宝宝、添加玩具、Tab 切换等）。
2. 首次进入（onboardingDone=false）引导仍正常显示并可按「下一步/开始使用」走完。
3. 引导走完后页面交互正常，两个 onboarding 空壳（情境）均不拦截。
4. 其他容器（modal/timer/banner/toast）行为不变。

## 关联
- 此前 `.modal-root` 同类问题已修复（见 docs/Bugfix-编辑档案弹两个窗口.md）；本次补上 `.onboarding-root` 这一处同类遗漏。