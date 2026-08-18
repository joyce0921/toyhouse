# Bugfix 设计：档案编辑弹窗缺少"保存"按钮

> 状态：v1.0，待评审后由 eng-coder 实施
> 关联文档：[Design-架构设计.md](Design-架构设计.md)、[Bugfix-空弹窗拦截点击.md](Bugfix-空弹窗拦截点击.md)

## 问题
手机真机：进入"我的"→ 点"编辑档案"（或首页"去设置"）后弹窗打开，能输入昵称/选性别/选日期，但**底部没有"保存档案"按钮**，无法保存。

## 现状（架构缺陷）
- `UI.modal()`（js/ui.js）生成的 `.modal-foot` 只有在传入 `opts.buttons` 时才含按钮；否则 `<div class="modal-foot">` 为空。
- `openProfileEditor()`（js/views/profile.js）调用 `UI.modal({...})` 时**不传 buttons**，改为在弹窗 DOM 就绪后通过 `attach()` 手动向 `.modal-foot` 注入"取消/保存档案"两个按钮。
- 该注入依赖 `attach()` 在正确时序找到 `#modalRoot .modal-box .kid-form` 并执行 `foot.innerHTML = ...`；任何选择器匹配失败、DOM 就绪时序竞态或 `attach()` 中途抛异常，都会导致 foot 保持为空 → 无保存按钮。
- 此"手动注入 + MutationObserver 兜底"模式脆弱，且在实际环境已出现无按钮现象。

## 修复方案（根治，走 modal 官方 buttons 通道）
将档案编辑的"保存/取消"改为**通过 `UI.modal` 的 `buttons` 参数声明**，由 `UI.modal` 统一生成，消除对 `attach()` 注入的依赖：

1. `openProfileEditor()` 调用 `UI.modal()` 时传入：
   ```
   buttons: [ {label:'取消', value:'cancel'}, {label:'保存档案', value:'save', primary:true} ]
   ```
2. `.then(function(val){ ... })` 中根据 `val`（'cancel'/'save'）处理：save 时读取 `f`（昵称/性别/出生日期）校验后 `Store.saveBaby()`；cancel 直接关闭。
3. 移除原依赖 `attach()` 注入 foot 按钮的繁琐逻辑，改为在 modal 的 `html` 内已含表单元素、通过 DOM 查询读取输入值（仍用 `.kid-form` 作用域）。
4. `UI.modal` 的 `close(res)` 会以按钮 value resolve——无需额外 closeModal 调用；确认 modal 关闭时 `.show` 移除与节点清理不变。

## 受影响文件
- `js/views/profile.js`（`openProfileEditor` 重构）

## 显式不做
- 不改 `js/ui.js`（modal 机制已支持 buttons，够用）。
- 不改其他文件、不引入新依赖。

## 验收标准
1. 真机/浏览器：点"编辑档案"→ 弹窗含昵称/性别/日期输入 + 底部"取消/保存档案"两个按钮。
2. 输入完整后点"保存档案"→ 档案写入，弹窗关闭，首页/我的实时更新昵称与月龄；toast 提示"档案已保存"。
3. 点"取消"→ 弹窗关闭，不改数据。
4. 不填出生日期/性别时保存仍可完成（档案可部分保存，符合现有容错）。