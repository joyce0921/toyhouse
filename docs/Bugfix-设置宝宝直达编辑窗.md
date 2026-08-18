# Bugfix 设计：首页「设置宝宝」必须直达档案编辑窗口

> 状态：v1.0，待评审后由 eng-coder 实施

## 问题（真机 + 控制台线索确凿）
用户点首页「设置宝宝」（或「去设置宝宝 / 去设置」），本应弹出「编辑宝宝档案」窗口，但当前行为是 `app.goTab('profile')`（仅切到「我的」Tab）。跳转后用户面对「我的」页（含导出/导入/声音/通知等按钮），并未进入编辑；且控制台出现：
- `File chooser dialog can only be shown with a user activation.`
- 持续下载 json（导出触发）
- 频繁：提示音已开启 / 通知权限被拒 / 已导出备份文件

这些是「导入备份(file chooser) / 导出备份(下载json) / 声音 / 通知」按钮被连续/误触发所致。用户期望：点「设置宝宝」一步直达「编辑宝宝档案」。

## 根因
首页 `js/views/home.js` 中：
```js
if (act === 'editBaby') { app.goTab('profile'); }
```
只切换 tab、不打开编辑窗。用户无法直接用「设置宝宝」进入编辑档案，且「我的」页易误触导出/导入/通知。

## 修复方案（仅改 2 处 js）
1. `js/views/profile.js`：`XNProfile` 暴露 `openEditor(baby)`，内部调用已有的 `openProfileEditor(baby)`；并导出。
   ```js
   root.XNProfile = { render: render, openEditor: openProfileEditor };
   ```
2. `js/views/home.js`：`editBaby` 分支改为「切到我的 tab，然后立即打开编辑窗」：
   ```js
   if (act === 'editBaby') {
     app.goTab('profile');
     const baby = app.state.baby;
     root.XNProfile.openEditor(baby);
   }
   ```
   仍需 `app.state.baby` 已取（home render 内已有 `baby`）。

> 说明：`goTab('profile')` 会渲染「我的」页；随后 `openEditor` 弹出档案编辑弹窗，用户可直接编辑。弹窗基于 `UI.modal`（已修复防重入），覆盖「我的」页，与其他按钮不冲突。

## 显式不做
- 不改「我的」页的导出/导入/通知/声音功能本身（它们是正常功能，非本期问题）。
- 不改数据层、规则引擎、其他视图。
- 不加依赖。

## 受影响文件
- `js/views/home.js`
- `js/views/profile.js`

## 验收标准
1. 首页点「设置宝宝 / 去设置宝宝 / 编辑」→ 自动进入「我的」tab 并**直接弹出「编辑宝宝档案」窗口**，可立即录入昵称/性别(男宝/女宝)/出生日期并保存。
2. 不出现「文件选择框 / 自动下载 json / 提示音/通知 误触发」。
3. 保存后首页与头部实时显示宝宝昵称与月龄。
4. 首次引导后的首页点击「设置宝宝」同样直达编辑，无残留拦截或误触发。