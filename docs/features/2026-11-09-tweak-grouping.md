# 配置分组与左侧折叠导航

| 项目 | 内容 |
| --- | --- |
| 状态 | 已实现（M1 + M2，2026-11-09），待 dev profile 手工验收 |
| 日期 | 2026-11-09 |
| 目标版本 | 0.2.0 |
| 关联 | [ADR-0003：配置驱动的 tweak 表单](../architecture/decisions/0003-config-driven-forms.md)、[设置窗口尺寸](2026-11-09-settings-window-size.md) |
| 代码入口 | `src/shared/prefs.ts`（分组与注册表）、`src/client/TweakitSection.tsx`（布局壳）、`src/client/TweakCard.tsx`、`src/client/ui-style.ts` |

## 0. 评审结论（v1 → v2 变更）

| 议题 | 决定 |
| --- | --- |
| 布局 | 放弃 v1 的"顶部切组 + 竖向 tab"，采用 **B 方案：左侧单栏两级树，组头淡化、可折叠** |
| 层级命名 | **分组（group）→ tweak → field**；不用 section，见第 3 节理由 |
| 折叠 | 手风琴：同时只展开一组；切组即切选中模块 |
| 第三方注册 | 延后，本期不实现；当前定位是"tweakit 主动适配其它插件"，见第 11 节 |

## 1. 背景与问题

现在「界面调整」把每个 tweak 顺序渲染成卡片，字段全部平铺在同一列里。只有一个 tweak 时观感尚可，但有两个直接后果：

1. **加第二个 tweak 就开始堆长**。卡片上下串联，用户要滚过整页才能看到后面的模块，模块之间没有导航。
2. **没有归属概念**。tweak 改的都是 DSH 本体或某个插件的界面，但界面上表达不出"这一项属于谁、管的是哪块"。以后适配别的插件（侧栏增强、ds-bot…）时，所有可调项会混在一列里。

本需求只改信息架构与展示：把配置按**归属**分组，组头淡化、可折叠；组内列出 tweak，选中后右侧只渲染该 tweak 的字段。分组是展示层元数据，不进入持久化契约，现有配置不需要迁移。

## 2. 目标与非目标

### 目标

- 左侧单栏两级导航：**分组（可折叠）→ tweak**；右侧只显示当前 tweak 的字段，不再平铺。
- 组头视觉弱化，模块条目是导航的视觉主体；同时只展开一组。
- 组数 = 1 时省略组头（当前真实状态），直接显示模块列表，避免无意义的单层折叠。
- 现有「设置窗口」tweak 归入「DSH 本体」分组；行为、持久化、默认值完全不变。
- 新增一个 tweak 时，只加描述符与归属，不改布局代码。
- 键盘可完整操作，ARIA 语义正确；面板拖窄时导航降级为紧凑形态。

### 非目标

- 不改任何 tweak 的字段、默认值、取值范围、wire 格式；不升 `PREFS_VERSION`。
- 不做第三方插件的运行时注册/发现；不提供跨插件存储路由（第 11 节）。
- 不做配置搜索、跨组批量重置、导入导出。
- 不做跨重启记忆：重启回到默认分组与模块；会话内切组有记忆，见 7.3。
- 不改 DSH 设置弹窗本身的左侧导航；本方案的内层导航只存在于「界面调整」这一页内部。

## 3. 层级命名

三级概念建议命名如下，并已按此统一文档与代码：

| 层级 | 含义 | 代码名 | 文案 |
| --- | --- | --- | --- |
| L1 | 一组 tweak 的归属（被适配对象） | `group`（`TweakGroup`） | 显示为「DSH 本体」「侧栏增强」等具体名字，不出现"分组"字样 |
| L2 | 一个可调项，对应一张表单 | `tweak`（`TweakDescriptor` / `TweakUi`） | 即现有的标题，如「设置窗口」 |
| L3 | tweak 内的一个配置项 | `field`（`TweakField`） | 现有字段标签 |

### 为什么不用 section

- `section` 在 DSH 里已经是既成概念：`ctx.slots.register({ name: 'settings.section' })` 指的是设置弹窗左侧导航里的一页，也就是「界面调整」这**一整页**本身；组件也叫 `TweakitSection`。若 L1 再叫 section，就会出现"section 里的 section"，文档、日志与代码里都无法区分层级。
- `section` 不表达归属。用户心智里「DSH 本体」是一个**来源/对象**，不是一个段落。
- `tweak` 与 `field` 沿用现有代码命名，零迁移；`module` 在文档里已被多义使用（代码模块、界面模块），去掉它反而更清楚。

如后续仍希望 L1 有一个更具体的名字，备选是 `provider`（提供方），但不建议 `section`。本方案按 `group` 定稿。

## 4. 布局（B 方案）

### 4.1 定稿形态

左侧一列完成两级切换，右侧是当前 tweak 的内容：

```
┌ 界面调整 ──────────────────────────────────────────────────────┐
│ ┌────────────────┬───────────────────────────────────────────┐ │
│ │ ▾ DSH 本体  3   │  设置窗口                         [已保存] │ │
│ │   ▎设置窗口     │  控制设置面板打开时的宽度、高度与边距。      │ │
│ │    字体与密度   │  ┌───────────────────────────────────────┐ │ │
│ │    侧栏         │  │ 尺寸模式   [默认][全屏][自定义]        │ │ │
│ │ ▸ 侧栏增强  2   │  │ 宽度  [ 1360 ] px   …                 │ │ │
│ │ ▸ ds-bot    1   │  └───────────────────────────────────────┘ │ │
│ │                │  [恢复默认]                               │ │ │
│ └────────────────┴───────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
  组头：淡色、小一号、可折叠（▾/▸），右侧灰字为模块数
  模块：缩进 12px，选中项左侧 2px 强调条 + 浅底色 + 中等字重
```

要点：

- **组头淡化**：12px、次级文字色、无底色、无卡片边框；只有展开箭头与模块数使用更弱的色阶。目的：不与 DSH 设置弹窗自己的左侧导航争视觉权重。
- **模块是导航主体**：34px 行高、正常字号；选中态用强调条 + 底色，不能只靠颜色（色弱可辨）。
- **组数 = 1 时省略组头**：当前只有「DSH 本体」一组，此时直接列出模块，不渲染组头、不缩进，观感接近"导轨 + 内容"。组数 ≥ 2 时自动出现组头。两条路径都要有测试与截图。
- **组头显示模块数**（灰字）：折叠状态下用户仍能判断组内有多少可调项，缓解"折起来就找不到"。

### 4.2 尺寸与滚动

- 左栏固定 **200px**（组名 + 缩进 + 计数），右侧内容最大 **640px**，整页最大 **880px**（比现在的 760px 略宽，容纳左栏）。
- 侧栏独立滚动：模块多或组多时只滚左栏，内容区高度不跟着变。
- 组名过长（插件名）省略号 + `title` 全文提示。

### 4.3 折叠规则

- **手风琴**：同时只展开一组。展开新组时，旧的自动折叠，并选中新组的模块——组与内容永远一致。
- 点击**已展开**的组头：折叠该组。若它是当前选中的组，**内容区保持不变**（仍显示该组当前 tweak），组头保留一条细强调线，表示"内容属于这个已折叠的组"。这样折叠不会让人误以为配置丢了。
- 点击**已折叠**的组头：展开并选中该组上次停留的 tweak（会话内记忆），没有则选第一个。
- 默认进入：展开包含默认选中 tweak 的组。

### 4.4 降级（按本页可用宽度，不按视口）

| 本页可用宽度（左栏 + 内容） | 行为 |
| --- | --- |
| ≥ 720px | 完整左侧导航（200px） |
| 560–719px | 左栏收窄到 156px，组名与 tweak 名允许两行截断 |
| < 560px | 左栏变为顶部两行：第一行分组下拉（组数 = 1 时隐藏），第二行横向滚动的 tweak chip；内容全宽 |

样式注入的 `<768px` 门槛针对视口，本表针对「界面调整」页面自身可用宽度（面板可被拖窄），实现时用 `ResizeObserver` 量 `.tk-section`，不读视口；首次测量前宽度为 0，按宽屏处理，避免 jsdom 或首帧误判成紧凑形态。

## 5. 数据模型与注册表

只改 `src/shared/prefs.ts`（仍是不含 React/DOM 的纯数据模块）：

```ts
export interface TweakGroupMeta {
  readonly order: number
  readonly title: LocalizedText // { zh: 'DSH 本体', en: 'DSH' }
  readonly description?: LocalizedText
}

export const TWEAK_GROUPS = [
  { id: 'dsh', order: 10, title: { zh: 'DSH 本体', en: 'DSH' } },
  { id: 'other', order: 999, title: { zh: '其它', en: 'Other' } }, // 兜底，正常不出现
] as const satisfies readonly (TweakGroupMeta & { readonly id: string })[]

export type TweakGroupId = (typeof TWEAK_GROUPS)[number]['id']
export interface TweakGroup extends TweakGroupMeta {
  readonly id: TweakGroupId
}
export const TWEAK_GROUP_IDS: readonly TweakGroupId[]
export interface TweakSelection {
  readonly group: TweakGroupId
  readonly tweak: TweakId
}
```

组 id 由 `TWEAK_GROUPS` 派生（闭集 union），归属写错在 `TweakUi.group` 处就是编译错误，比 `string` + 运行期校验更早暴露问题。

`TweakUi` 增加必填归属，`order` 语义改为组内排序：

```ts
export interface TweakUi<P> {
  readonly group: TweakGroupId   // 新增，必填
  readonly order: number         // 语义：组内排序
  // …其余不变
}
```

新增纯函数（放 `prefs.ts`，便于单测）：

```ts
export function groupOfTweak(id: TweakId): TweakGroupId // 未声明归属时回落 'other'
export function groupsWithTweaks(): readonly TweakGroup[] // 过滤空组，按 order 排
export function tweaksInGroup(group: TweakGroupId): TweakId[] // 按组内 order 稳定排序
export function resolveSelection(previous: TweakSelection | null): TweakSelection
// 保留仍然有效的选择；组还在但 tweak 没了 → 组内第一个；否则第一组的第一个 tweak
// 一个 tweak 都没有时抛 'dsh-tweakit: no tweak is registered'
```

组数 = 1 时不画组头由 UI 判断（`groups.length > 1`），数据层不额外提供 `visibleGroups`。

`TweakDescriptor`、`toWire/fromWire`、字段定义、`PANEL_LIMITS`、`PREFS_VERSION` **都不动**。分组完全是 `TweakUi` 的展示元数据。

`TweakUi.group` 的类型是派生的 `TweakGroupId`，归属写错即编译错误；`groupOfTweak` 再为运行期的数据错配兜底到 `other`。

## 6. 组件切分

- `TweakitSection.tsx`：页面壳。负责加载状态、全局告警、当前选择（`TweakSelection`）、宽度测量（wide/narrow/compact）、拼装导航与内容。
- 新增 `TweakNav.tsx`：两级导航。持有 `role="tablist"` 的模块列表与组头按钮，向 Section 回报选择；组展开状态与「每组上次停留的 tweak」记忆也在这里（`useState` + `useRef<Map<string, string>>`），不落任何存储。
- `TweakCard.tsx`：保留为内容区卡片，去掉重复的页面级留白；标题/描述/状态徽标/恢复默认不动。
- 选择由 Section 持有（可被 `resolveSelection` 兜底），展开由 Nav 持有（纯视图状态）；两者通过 `selection` 单向同步，避免两份真值。

## 7. 交互规格

### 7.1 进入

- 打开「界面调整」：展开第一个有 tweak 的组，选中该组第一个 tweak。
- 全局横幅（读取失败、marker 缺失、不可写）在导航**上方**，跨组常驻。

### 7.2 切换

- 点模块：直接切换，不弹确认；字段仍是即时保存。
- 点组头：见 4.3；展开动作与选择动作合并为一次状态更新，避免先渲染空内容。
- 恢复默认：只重置**当前 tweak**，按钮留在内容区底部，文案不变。

### 7.3 会话内记忆

- 每个组记住"最后停留的 tweak"，切走再切回仍回到它。
- 仅内存，重启失效；不做跨重启记忆（不写 localStorage，符合 AGENTS 约束）。

### 7.4 状态与反馈

- 内容区标题右侧保留 `StatusBadge`（loading / saving / saved / conflict / error）。
- 单字段校验失败仍在字段就地提示，不阻止切组。
- 一期不做跨 tweak 的状态聚合（不在组头挂红点），避免状态系统复杂化。

### 7.5 键盘与无障碍

- 组头：`<button aria-expanded aria-controls>`。`Enter/Space` 展开/折叠；`→` 展开、`←` 折叠为快捷方式。
- 模块列表：`role="tablist" aria-orientation="vertical"`，`↑/↓`（以及 `←/→`）移动，`Home/End` 到首尾；采用 roving tabindex + **焦点即激活**，不额外要求 `Enter/Space`。
- roving tabindex：只有选中项 `tabIndex=0`；组头与模块列表是两个独立焦点站，`Tab` 顺序为组头 → 模块列表 → 内容区。
- 内容区：`role="tabpanel"`，tab 上 `aria-controls` 指向 panel。panel 用 `aria-label`（当前 tweak 标题）而不是 `aria-labelledby`：折叠当前组后 tab 会移出无障碍树，`aria-labelledby` 会指向不存在的节点。
- 折叠组内的模块移出 tab 序列与无障碍树。
- 选中态不能只靠颜色：2px 强调条 + 字重变化。

取舍说明：没有用 `role="tree"`。树语义要求方向键在层级间移动，而这里"组"是折叠容器、"tweak"是选中项，用 button + tablist 两级组合语义更准，实现与测试也更稳。

## 8. 视觉

- 沿用 `.tk-*` 前缀，新增 `.tk-nav-*`；颜色只用 `--dsw-alias-*` / `--dsw-elevation-*` token，不引入新色值。
- 组头：12px、次级色；hover 时背景用最浅的 hover token，不用强调色。
- 模块条目：34px 高，字号小一号于内容标题；选中底色用 accent 的 8% 透明或 shell 提供的选中 token。
- 强调条：左边 2px，圆角 0；折叠当前组时组头复用同一条 2px 强调线，表示「右侧内容仍属于这个组」。
- 内容卡片沿用 `.tk-card` 的边框与 16px 圆角，保持唯一"重"的容器。
- 样式仍只在设置弹窗范围内生效（`[role="dialog"][data-shortcut-modal="settings"]`），不碰主界面。

## 9. 持久化与兼容

- wire 字段、默认值、normalize、写回路径**完全不变**；`PREFS_VERSION` 保持 1。
- 已安装用户升级后：值不变、布局变化；无迁移、无 reset。
- 选择与展开状态不进 settings，不占 revision，不触发写。
- 回滚：去掉分组层只影响渲染，配置文档不受影响，可安全回到 0.1.x。

## 10. 失败与降级

| 场景 | 表现 |
| --- | --- |
| settings 读取失败 | 顶部 alert + 重试；导航仍渲染，字段禁用（与现状一致） |
| 配置不可写（只读 profile） | 字段禁用 + 只读提示；导航可用 |
| `PANEL_SELECTOR` 未命中 | 现有 markerMissing 告警保留，置于导航上方 |
| 未知 group | 归入「其他」组并 `warn` 一次；不丢字段 |
| 组内 tweak 全部被过滤 | 该组不渲染；若无任何组，走空态 |
| 当前选中被过滤掉 | `resolveSelection` 回退到第一个可用 tweak，不白屏 |

## 11. 关于第三方注册（本期不做）

结论：**本期不提供运行时注册能力**。分组只是本插件内部的展示结构，适配其它插件的方式是改 tweakit 源码、按目标插件建组、发版。

理由（评审确认）：

1. 其它插件要做可调项，第一选择是 DSH 自己的 settings/configForms，不大可能为了配置去依赖 tweakit；
2. 只有当 tweakit 的 UI 与存储变成事实标准时，注册接口才有价值；现在开放只会把不稳定的存储形状固化；
3. 跨插件存储本身没有干净方案：tweakit 的 entry 字段必须在宿主 schema 预声明，跨插件写别人的 entry 不成立。

保留的形状：`TweakGroup.id` 用目标插件标识、`TweakUi.group` 必填、注册表纯数据可增量合并。未来若要做，再按以下顺序评估：贡献方声明字段 → tweakit 提供统一存储（需验证 settings 对大 JSON 字段的支持）→ 贡献方自行订阅并应用效果。

## 12. 交付切分

| 里程碑 | 内容 | 出口 |
| --- | --- | --- |
| M1 | `TweakGroup` 模型与注册表、选择/回退纯函数；现有 tweak 归入 `dsh`；左侧导航壳（组头、折叠、缩进） | 单测全绿；组数 = 1 时设置页可用、观感不倒退 |
| M2 | 键盘与 ARIA、会话内记忆、响应式降级、空态/未知组兜底、状态徽标迁位 | 键盘可完成全部操作；1280 与 520 两种宽度验收 |
| M3 | 第二个内置 tweak（建议「字体与信息密度」），并补一个跨组用例（`better-sidebar` 或占位组） | 新增 tweak 只改 `prefs.ts`；组头出现且折叠正常；截图存档 |

M1 落地时同步：`architecture/plugin-architecture.md` 扩展模型一节补分组说明；把"组按归属划分、本期不做运行时注册"写成 **ADR-0004**。

状态：M1、M2 已完成（2026-11-09，见第 17 节）；M3 未开始。

## 13. 验收标准

1. 打开「界面调整」：只看到当前 tweak 的字段，不再看到其它 tweak 的字段平铺。
2. 组数 = 1 时不渲染组头；加第二个组后组头自动出现，且默认只展开当前组。
3. 组头淡化（无底色、小字、次级色），选中 tweak 有强调条；两者视觉层级明显不同。
4. 手风琴：展开新组 → 旧组自动折叠，内容切到新组模块；同时只有一个组展开。
5. 折叠当前组：内容不消失，组头有"当前组"标识；重新展开仍选中原 tweak。
6. 切走再切回：回到该组上次停留的 tweak（会话内）。
7. 新增 tweak 只需要在 `prefs.ts` 加描述符 + 归属，布局代码零改动。
8. 「恢复默认」只影响当前 tweak。
9. 仅用键盘可完成：切组、展开/折叠、切 tweak、改字段、恢复默认；焦点不丢、不循环。
10. DOM 检查：`aria-expanded`、`aria-selected`、tab/tabpanel 关系、roving tabindex 正确；折叠组的 tab 不在序列中。
11. 内容区拖到 < 560px：导航降级为下拉 + 横向 chip，无横向滚动条，字段可用。
12. 未知 group 归入「其他」，字段可改可保存；选中不白屏。
13. `pnpm test`、`pnpm typecheck`、`pnpm build` 全绿；dev profile 手工验收截图存档。
14. 热更/卸载后无残留 DOM、无重复样式、无重复 slot。

## 14. 测试计划

- 纯函数单测：`groupsWithTweaks` 排序与空组过滤、`tweaksInGroup`、`resolveSelection` 三种回退（组消失、tweak 消失、prev 为空）。
- 组件测试：组头 `aria-expanded` 与手风琴互斥、折叠当前组时内容保留、会话内记忆、方向键与 roving tabindex、未知组兜底、组数 = 1 不渲染组头。
- 手工：`tweakit-dev` profile，1280×900 与拖窄到 520px 两种尺寸截图；确认主界面无变化。
- 回归：设置窗口尺寸三模式与实时预览不受影响（同一条链路）。

## 15. 风险

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 折叠让配置"藏起来" | 用户找不到可调项 | 组头显示模块数；默认展开当前组；折叠当前组时内容保留并标记归属 |
| 两层竖排导航（DSH 外层 + 本页内层）视觉过重 | 观感反而更乱 | 组头淡化 + 模块为主体；M1 先出截图评审再往下做 |
| 组数 = 1 与 ≥ 2 两套形态 | 双倍测试面 | 只切"是否渲染组头与缩进"，状态机同一套；两条路径都进测试 |
| `TweakUi.order` 语义从全局变组内 | 误读 | 只有 1 个 tweak，迁移成本为零；类型注释写"组内" |
| 将来组划分维度推翻 | 返工 | 归属只在展示层；写 ADR-0004 固定"按归属/被适配对象"的理由 |

## 16. 待拍板

1. 手风琴（同时只展开一组，推荐）vs 多组可同时展开？
2. 折叠当前组时内容保留（推荐）vs 显示空态提示？
3. 组数 = 1 时省略组头（推荐）vs 始终显示组头？
4. 命名按 `group / tweak / field` 定稿（推荐）；若坚持 `section` 需接受与 `settings.section` 的歧义。
5. 左栏 200px、内容 640px、整页 880px（推荐值），是否接受？

以上 1–3、5 都可以先按推荐实现、M1 截图时再调；第 4 条需要你确认后我再改文档与代码命名。

## 17. 验收记录

| 日期 | 范围 | 验证方式 | 结果 |
| --- | --- | --- | --- |
| 2026-11-09 | M1 + M2 | `pnpm typecheck` | 通过 |
| 2026-11-09 | M1 + M2 | `pnpm test`：6 个文件 / 53 例（`tweak-nav` 7、`section` 8、`prefs` 22） | 全绿 |
| 2026-11-09 | M1 + M2 | `pnpm lint`、`pnpm format:check` | 通过 |
| 2026-11-09 | M1 + M2 | `pnpm check`（typecheck + lint + format:check + 53 例测试 + build） | 全绿 |
| 2026-11-09 | M1 + M2 | 桌面应用实测（1280 × 577，宽档）：单组隐藏组头、`headers=false`、tab 选中态、`aria-controls` 指向 panel、panel `aria-label` | 通过 |
| 2026-11-09 | M1 + M2 | 桌面应用实测（520 × 900，紧凑档）：`data-mode=compact`、横向 chips 只剩当前 tweak、内容单列 | 通过 |

对应验收标准：

- 1–8：组件测试覆盖（单组无组头、切组记忆、折叠保留内容、只剩当前 tweak 的字段、tab 选中态）；第 7 条另由「新增 tweak 只改 `prefs.ts`」的模型测试保证。
- 9–10：键盘与 ARIA 有组件测试（方向键/Home/End、组头左右键、`aria-expanded` / `aria-selected` / `aria-controls`、roving tabindex）。
- 11（< 560px 降级）、13（build）、14（热更/卸载残留）：**已手工验收**；窄档与宽档各截一张图。
- 组头视觉、手风琴折叠强调线：目前只有 `dsh` 一个组，真实界面里组头按设计隐藏，**留待 M3 新增第二个 tweak 后复验**。

说明：桌面应用的设置入口是账户菜单 → Bot 设置 → `Harness 设置` 子页，插件注册的「界面调整」在该子页导航底部，不在主列表。