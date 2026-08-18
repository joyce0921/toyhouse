# 设计文档 — 小年的玩具屋

> 文档状态：v1.0 待设计评审
> 关联文档：[需求文档](PRD-需求文档.md)、[育儿依据资源](References-育儿依据.md)

## 1. 目标与技术选型

### 1.1 目标
实现一个 **纯前端、完全离线、单宝宝** 的玩具管理与陪玩计划工具，覆盖 0-36 个月儿童。

### 1.2 技术栈（零依赖、零构建）
- **语言**：原生 JavaScript（ES2020+）+ HTML5 + CSS3，单页面应用。
- **构建**：无需 Node/npm/打包器，浏览器直接打开 index.html 即可运行。
- **存储**：
  - **IndexedDB**：玩具图片 Base64、玩耍历史等较大/较多数据（封装 Promise 存储层）。
  - **localStorage**：宝宝档案、设置等轻量数据。
- **月龄计算**与日期处理：原生 Date，无第三方库。
- **导出/导入**：JSON 文件（`Blob` / `FileReader`）。

### 1.3 文件结构
```
/（项目根）
├── index.html          # 单页入口，含导航与各视图挂载点
├── css/
│   ├── theme.css       # 设计令牌（颜色/圆角/阴影/字号）与全局基础
│   └── app.css         # 各组件/视图样式
├── js/
│   ├── app.js          # 入口：路由、初始化、App 状态
│   ├── store.js        # 数据持久化封装（IndexedDB + localStorage）
│   ├── rules.js        # 规则引擎：月龄段、玩具类型映射、专注时长、推荐算法
│   ├── views/
│   │   ├── home.js     # 首页：今日推荐 + 宝宝档案 + 开始玩耍
│   │   ├── toys.js     # 玩具库：列表、筛选、添加/编辑
│   │   ├── plan.js     # 玩耍计划 + 计时器 + 历史复盘
│   │   └── profile.js  # 我的：宝宝档案编辑、设置、导出导入
│   └── ui.js           # DOM 工具、Toast、弹窗、横幅提醒、声音
├── assets/
│   └── (内置内联 SVG，非外部图片)
└── docs/               # 本系列设计文档
```

---

## 2. 数据层设计

### 2.1 存储封装 `store.js`
- `idb` 数据库：对象仓库 `toys`、`playLogs`（keyPath=id）。
- `localStorage`：键 `babyProfile`、`settings`、`firstRunDone`。
- 对外 API：
  - `getAllToys()` / `addToy(toy)` / `updateToy(toy)` / `deleteToy(id)`
  - `getAllLogs()` / `addLog(log)` / `deleteLog(id)`
  - `getBaby()` / `saveBaby(profile)`
  - `getSettings()` / `saveSettings(s)`
  - `exportData()` / `importData(json)`
  - 数据版本号 `schemaVersion` 便于迁移。

### 2.2 数据模型
- **宝宝档案**：`{ nickname="小年", gender:'male'|'female'|'', birthDate:iso|null }`
- **玩具**：`{ id, name, imageData? , type, skills:[], ageMin, ageMax, note?, createdAt }`（skill 取值来自 7 大维度 key）
- **玩耍记录**：`{ id, toyId, minutes?, playedAt:iso, comment? }`
- **设置**：`{ soundOn:true, notifyGranted:false, onboardingDone:false }`

### 2.3 月龄计算（核心工具）
```
computeAge(birthDate, now) -> { months: int, weeks: int, days: int, label: string }
```
- 满整月显示「X 岁 Y 个月」/「X 个月」；不足 1 月显示「X 天」；1-4 周显示「X 周」。
- 全局基于**当日实时计算**，跨天自动更新，无需手动维护。

---

## 3. 规则引擎 `rules.js`

### 3.1 数据结构
```js
// 月龄段（覆盖 0-36 月）
AGE_BANDS = [
  { key:'0-3',  min:0,  max:3  },
  { key:'4-6',  min:4,  max:6  },
  { key:'7-9',  min:7,  max:9  },
  { key:'10-12',min:10, max:12 },
  { key:'13-18',min:13, max:18 },
  { key:'19-24',min:19, max:24 },
  { key:'25-30',min:25, max:30 },
  { key:'31-36',min:31, max:36 },
]

// 能力维度
SKILLS = [
  {key:'gross', name:'大运动'}, {key:'fine', name:'精细动作'},
  {key:'sensory', name:'感官'}, {key:'language', name:'语言'},
  {key:'cognition', name:'认知'}, {key:'social', name:'社交情绪'},
  {key:'creativity', name:'创造力'},
]

// 玩具类型 + 默认能力映射 + emoji（来源凝练自 References）
TOY_TYPES = [
  {key:'comfort', name:'安抚/牙胶', icon:'🫶', defaultSkills:['sensory','fine']},
  {key:'audiovisual', name:'视听玩具', icon:'🔊', defaultSkills:['sensory','cognition']},
  {key:'motor', name:'运动玩具', icon:'🏃', defaultSkills:['gross']},
  {key:'stacking', name:'堆叠/构建', icon:'🧱', defaultSkills:['fine','cognition']},
  {key:'blocks', name:'拼插积木', icon:'🧩', defaultSkills:['fine','cognition','creativity']},
  {key:'roleplay', name:'角色扮演', icon:'🧸', defaultSkills:['social','creativity','language']},
  {key:'art', name:'涂画手工', icon:'🎨', defaultSkills:['fine','creativity']},
  {key:'music', name:'音乐乐器', icon:'🎵', defaultSkills:['sensory','social','language']},
  {key:'reading', name:'绘本阅读', icon:'📚', defaultSkills:['language','cognition']},
]

// 专注时长基线（月龄段 -> 建议分钟）
FOCUS = { '0-3':3, '4-6':4, '7-9':4, '10-12':5, '13-18':6, '19-24':8, '25-30':10, '31-36':12 }
```

### 3.2 能力解读文案（skill → 月龄段 → 文案）
- 通过 `skillInterpretation(skillKey, ageMonths)` 返回发展依据解读（引用 References refId）。
- 每段文案含「现状描述 + 依据 + 陪玩建议」，并附「个体差异」提示。

### 3.3 今日推荐算法 `generateTodayPlan(profile, toys, logs)`
**输入**：宝宝年龄（月）、玩具库、近期玩耍历史。
**输出**：按序排列的推荐玩具清单（1~3 个）+ 每条的建议专注时长 + 陪玩讲解 + 依据。

**步骤**：
1. **候选过滤**：`ageMin ≤ 当前月龄 ≤ ageMax` 的玩具进入候选池；若无则放宽为「最接近当前月龄」的 1 个，并提示"接近适龄"。
2. **能力覆盖打分**：统计近 N 天（默认 7 天）各能力维度的玩耍分布，给**锻炼较少的能力**更高权重（补齐短板）。
3. **多样性排序**：贪婪选取——优先能力权重高且与已选玩具维度不重复的候选，组成 2~3 个推荐；避免连续同维度。
4. **时长**：按当前月龄段查 FOCUS 表。
5. **输出解读**：每条带 `{toy, skillMain, minutes, playGuide, refId}`。

### 3.4 生成玩耍历史聚合 `analyzeLogs(logs, days=7)`
返回各能力维度的玩耍分钟聚合，供"复盘"与推荐权重使用。

---

## 4. 视图与交互设计

### 4.1 导航与布局
- 底部 Tab：**首页 / 玩具库 / 玩耍计划 / 我的**。
- 顶部标题栏：显示宝宝昵称与当前月龄。
- 手机竖屏为主，max-width 容器居中，平板/桌面加宽并居中内容。

### 4.2 首页（今日玩什么）
- 宝宝档案卡（昵称/性别/月龄 + 编辑入口）。
- 今日推荐卡片区：每个玩具显示缩略图 + 能力标签 + 建议分钟 + 「开始玩耍」按钮。
- 无玩具/无宝宝时显示空态引导（去添加玩具/去设置宝宝）。

### 4.3 玩具库
- 网格卡片列表 + 顶部能力筛选 chips + **排序控件**（按添加时间/名称/月龄上限/最近使用）+ 添加按钮。
- **添加流程**（引导式）：
  1. 拍照/选图（`<input type=file accept=image>`），Canvas 压缩到 ≤约 300KB（长边约 900px）。
  2. 填名称（默认按类型联想）。
  3. 选**玩具类型**（emoji 单选）→ 自动带出默认能力。
  4. 复选**能力维度**。
  5. 双滑块选**适配月龄区间** 0~36。
  6. 实时显示**能力解读**（随类型/能力/月龄动态更新）。
  7. 可选备注 → 保存。
- 编辑：点击卡片进入同表单回填修改或删除。

### 4.4 玩耍计划 + 计时器
- 展示今日/推荐计划列表（规则引擎输出），每项含锻炼目标、玩法讲解、建议分钟、依据 refId。
- **「开始玩耍」** → 全屏计时器视图：
  - 倒计时（建议分钟），大字 + 进度环。
  - 「完成本玩具 / 换一个 / 中途暂停」。
  - 到点：**提示音 + 视觉横幅** +（若授权）**Notification**，提示"该切换到下一个玩具啦"，并展示下一条陪玩小贴士。
- **玩耍记录**：完成后记录 `{toyId, minutes}` → 写入历史。
- **复盘视图**：近 7 天各能力维度玩耍分布（柱状/环形），帮父母看到"哪些能力覆盖不足"。

### 4.5 我的
- 宝宝档案编辑（昵称/性别/出生日期）。
- 设置：声音开关、浏览器通知授权按钮。
- 数据：导出 JSON / 导入 JSON / 清空数据（二次确认）。
- 关于与免责声明（引用 References 末尾声明），育儿依据来源说明。
### 4.6 健壮性与提示
- **图片解码失败**：`try/catch` 捕获后显示占位图标 + Toast 提示，不影响卡片与列表。
- **存储满（QuotaExceededError）**：保存玩具捕获后降级为「无图」，并横幅提示「存储空间不足，建议导出备份」。
- **宝宝档案完善度**：出生日期/性别缺失时，在首页与「我的」显示轻量横幅「去补全宝宝信息」，直至补全。

---

## 5. 界面风格（设计令牌）

- **配色**：奶油底 `#FFF8F0`；主色暖橙 `#FF8A5C`；辅助珊瑚粉 `#FFB4A2`；点缀青 `#7FD1C0`；文字暖棕 `#5D4037`。
- **圆角**：卡片 `16px`，按钮`12px`，圆润友好。
- **阴影**：柔和暖色投影。
- **字体**：系统无衬线 + 圆体优先；标题略粗。
- **插画/动效**：内联 SVG（太阳/云/玩具熊/星星）点缀；按钮按压强反馈、卡片入场过渡、计时进度动画。
- **空态/引导**：首次进入弹出简短引导动画。

---

## 6. 提醒与声音实现
- **提示音**：Web Audio API 生成柔和"叮咚"（Go for non-JS asset）或内联 base64 短音频；有开关。
- **视觉横幅**：顶部/底部滑入 Toast-banner。
- **浏览器通知**：`Notification.requestPermission()`，授权后 `new Notification()`；未授权则隐藏入口并仅用页面内提醒。

---

## 7. 测试与验收计划
- **单元逻辑**：`computeAge` 跨边界（出生当天/满月/岁数）；推荐算法在无玩具/无宝宝/全不适龄/能力集中等场景的输出。
- **浏览器手动测试清单**：添加玩具、编辑、删除、筛选、生成计划、计时提醒（声音/横幅/授权通知）、历史复盘、导出导入、清空数据、离线刷新。
- **验收**：对照 PRD 第 6 节验收标准逐条核对。

---

## 8. 风险与取舍
- **真实 AI 识别**：本轮不做（用户确认），采用引导式；留出 type 字段便于未来扩展。
- **系统级推送**：浏览器限制，采用页面内提醒兜底（用户确认）。
- **图片存储体积**：压缩 + 提示导出备份；IndexedDB 清除前需用户确认。
- **规则库准确性**：基于公认共识，文稿含个体差异与免责声明；不构成医疗建议。

## 9. 后续扩展方向（不在本轮）
- 多宝宝、多设备云同步、统计报表图表化、真实图像识别接口、父母陪玩建议 AI 化。