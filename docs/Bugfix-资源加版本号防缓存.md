# Bugfix 设计：静态资源加版本号，根治缓存不失效

> 状态：v1.0，待评审后由 eng-coder 实施

## 问题
真机/微信端反复出现"加载到旧版本"现象（如之前 Tab 点不动、无保存按钮、保存误触发导出等），均为缓存了旧版 `css/`、`js/` 资源导致的行为错乱。根因是 `index.html` 用固定资源路径（`css/app.css`、`js/views/profile.js` 等）且**无版本号**，GitHub Pages / 浏览器 / 微信 WebView 会永久缓存，部署新版本后用户仍命中旧资源。

## 现状
`index.html` 中引用格式（无版本参数）：
```html
<link rel="stylesheet" href="css/theme.css" />
<link rel="stylesheet" href="css/app.css" />
<script src="js/store.js"></script>
...
<script src="js/app.js"></script>
```

## 修复方案
给 `index.html` 内**所有 CSS 与 JS 资源引用**追加版本查询参数 `?v=<缓>签>`，使每次发布新版本时资源 URL 变化、浏览器自动取新。
- 版本标识建议用**构建/发布时的高可信时间戳**（如 `20260818`），在本次修复中写一个固定值；后续每次改版由维护者更新该值（可写死在 index.html，或在注释中注明如何更新）。
- 只需改 `index.html` 一处（所有 link/script 的 href/src）。

示例：
```html
<link rel="stylesheet" href="css/theme.css?v=20260818" />
<link rel="stylesheet" href="css/app.css?v=20260818" />
<script src="js/store.js?v=20260818"></script>
<script src="js/rules.js?v=20260818"></script>
<script src="js/ui.js?v=20260818"></script>
<script src="js/views/home.js?v=20260818"></script>
<script src="js/views/toys.js?v=20260818"></script>
<script src="js/views/plan.js?v=20260818"></script>
<script src="js/views/profile.js?v=20260818"></script>
<script src="js/app.js?v=20260818"></script>
```

## 显式不做
- 不改 JS/CSS 逻辑（本轮只解决缓存；若另有真实代码 bug，单独评估）。
- 不加构建工具 / service worker / 哈希文件。

## 验收标准
1. `index.html` 所有 link/script 均带 `?v=` 版本参数，且值一致。
2. 部署新版本后，浏览器/微信能加载到最新资源（无旧缓存命中）；本地文件直接打开仍可运行（查询参数不影响）。
3. 现有功能不回归（引导、档案编辑保存、性别仅男女、Tab 切换等）。