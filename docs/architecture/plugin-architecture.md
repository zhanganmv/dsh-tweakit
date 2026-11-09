# dsh-tweakit 插件架构

| 项目 | 内容 |
| --- | --- |
| 状态 | 已实现（0.1.0） |
| 日期 | 2026-11-09 |
| 适用版本 | dsh-tweakit 0.1.x |
| 关联 | [ADR-0001](decisions/0001-persist-prefs-in-dsh-settings.md)、[ADR-0002](decisions/0002-settings-panel-sizing-modes.md) |

## 1. 目标与设计原则

`dsh-tweakit` 不是「一个改设置窗口的插件」，而是**一个承载多个界面 tweak 的容器**。设置窗口尺寸只是第一个 tweak；后续字号、圆角、间距、动效都应沿用同一套接入方式，不重写设置页、不新增设置 tab。

设计原则：

1. **双半职责清晰**：客户端只做 UI、状态和 DOM；宿主只做持久化、进程和文件。两端只通过 `shared/` 的纯函数和 DSH 的 settings/configForms 契约通信。
2. **共享层无环境依赖**：`src/shared/` 不 import DOM、Node、React、DSH 运行时，保证双端与测试可复用。
3. **单一事实来源**：默认值、范围、归一化、wire 映射只在 `shared/prefs.ts` 定义一次。
4. **扩展点是数据，不是分支**：新增 tweak = 注册一个 descriptor + 一个组件，不修改设置页骨架、不改路由分支。
5. **所有副作用有归属**：样式、监听、定时器都挂在插件 fiber 的 effect 上，禁用/卸载/HMR 即回收。
6. **不依赖未公开的 UI 内部结构**：只使用 `settings.section` 槽位和面板的稳定标记；不碰 hash 类名、不 patch 组件。

## 2. 运行时形态

一个 npm 包，两个入口：

- 宿主半：`lib/host.js`（`package.json` 的 `main`），由 Cordis Loader 作为 profile entry 加载；
- 客户端半：`lib/client.js`（`./client` export），由 DSH 浏览器模块系统按 `dsh.client` 声明加载。

```text
┌──────────────────────────── Browser ────────────────────────────┐
│ client/index.ts apply(ctx)                                      │
│   ├─ configForms store（ctx.configForms.get('dsh-tweakit')）    │
│   ├─ style controller（单个 <style>，按 tweak 生成 CSS）        │
│   ├─ declarative fields + TweakForm 通用渲染器                  │
│   └─ settings.section 注册（一个 tab，投影全部 tweak 分组）     │
└───────────────▲──────────────────────────────┬─────────────────┘
                │ settings RPC（remote.settings）│ 官方 configForms
                │ 读 describe / 写 mutate+revision│
┌───────────────┴──────────────────────────────▼─────────────────┐
│ host/index.ts apply(ctx)                                        │
│   ├─ Config：每个偏好一个 .volatile() 扁平字段                  │
│   ├─ settings.configure({ auto: false })                        │
│   └─ 无自建路由；DSH settings 服务负责持久化                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                    profile 用户层（cordis.patch.yml）
```

宿主半还负责可选的启动注入：若后续 tweak 需要在首屏前生效（例如主题、字号），宿主可以通过 `webserver/index-inject` 把当前值注入页面；设置窗口尺寸不需要（面板默认关闭），v1 不实现。

## 3. 模块与依赖规则

| 模块 | 职责 | 允许依赖 |
| --- | --- | --- |
| `src/shared/prefs.ts` | 偏好模型、默认值、范围、归一化、wire 映射、尺寸解析 | 无（纯 TS） |
| `src/shared/panel-css.ts` | 设置面板 CSS 生成 | `shared/prefs`（type-only） |
| `src/host/index.ts` | Config、settings 呈现策略、服务装配 | `shared/*`、`@deepseek-ai/*`（运行时提供） |
| `src/client/index.ts` | apply：configForms store、样式、tab 注册、生命周期 | `shared/*`、`client/*`、平台模块 |
| `src/client/config-form.ts` | `ctx.configForms` 的结构化类型 | 无 |
| `src/client/store.ts` | 乐观预览、防抖 mutate、回滚、unset 重置 | `shared/*`、`config-form` |
| `src/client/TweakForm.tsx` | 声明式字段 → 控件的通用渲染器 | `shared/*` |
| `src/client/TweakCard.tsx` | 通用分组卡片（标题/状态/重置/extra） | `shared/*`、`store` |

硬性规则：

- `shared/` 不得 import `host/`、`client/`、`react`、`node:*`、`@deepseek-ai/*`；
- `client/` 不得 import `host/`；
- 对 DSH 包只允许 `import type`（构建时擦除），运行时能力一律通过 Cordis 服务（`ctx.slots`、`ctx.locale` 等）；
- 跨端只传 JSON 可序列化数据。

## 4. 生命周期与数据流

### 4.1 启动

```text
Loader 启动 host entry
  → apply(ctx)：Config 解析（volatile 字段变成引用）
  → settings 服务就绪后 configure({ auto: false })

浏览器加载 client bundle
  → factory(require) 材质化，Cordis 调 apply(ctx)
  → ctx.configForms.get('dsh-tweakit') → 订阅快照
  → fromWire() → store（Host 快照 + 本地乐观覆盖）
  → 对每个启用的 tweak 安装 effect（v1：写入面板样式）
  → ctx.slots.inject('settings.section', register(...))
```

`slots.inject` 会等待设置 shell 声明 `settings.section`（打开过设置后仍在 ledger 上），注册随 fiber 卸载自动撤销；不需要额外包一层 `ctx.effect`。

### 4.2 一次编辑

```text
用户拖动滑杆
  → store.patchAny('settings-panel', patch)       // 同步、乐观
  → 通知订阅者 → CSS 重新生成并写回 <style>       // 实时预览
  → 200ms 防抖
  → ctx.configForms.mutate(ops, revision)
      ├─ true  → 从 Host 快照重新播种 → “已保存”
      ├─ false → 重新播种 → 提示“已在别处修改”
      └─ reject → 回滚到 Host 值 → 提示 + 重试
```

### 4.3 卸载 / HMR

`ctx.effect` 的 disposer 依次：取消防抖定时器、移除 `<style>`、断开监听、释放 section 注册、清空 store 订阅。任何一步失败都不得抛到 shell。

## 5. Tweak 扩展模型（核心）

### 5.1 偏好切片

每个 tweak 拥有 `TweakPrefsMap` 里的一个键，形状由自己定义：

```ts
export interface TweakPrefsMap {
  'settings-panel': SettingsPanelPrefs
  // 'typography': TypographyPrefs
  // 'chrome': ChromePrefs
}

export interface TweakitPrefs {
  version: 1
  tweaks: TweakPrefsMap
}
```

### 5.2 descriptor

每个 tweak 注册一个 descriptor，集中声明默认值、校验与 wire 映射：

```ts
export interface TweakDescriptor<P> {
  readonly id: string
  defaults(): P                       // 每次返回新对象
  normalize(input: unknown): P        // 任意输入 → 合法值
  toWire(prefs: P): Record<string, unknown>    // 嵌套 → Config 扁平字段
  fromWire(wire: Record<string, unknown>): P   // Config 扁平字段 → 嵌套
}
```

注册：

```ts
export const TWEAK_IDS = ['settings-panel'] as const
export const TWEAK_DESCRIPTORS = { 'settings-panel': settingsPanelTweak }
```

`createDefaultPrefs()` / `normalizePrefs()` / `toWire()` / `fromWire()` 遍历注册表，新增 tweak 不需要改这四个函数。

### 5.3 视图：声明式字段

每个 tweak 不再手写组件，而是在 `TWEAK_UI` 里声明字段：

```ts
export const TWEAK_UI = {
  'settings-panel': {
    order: 10,
    title: { zh: '设置窗口', en: 'Settings window' },
    description: { zh: '...', en: '...' },
    fields: [
      { kind: 'segmented', key: 'mode', field: 'mode', label: {...}, options: [...] },
      { kind: 'slider', key: 'width', field: 'width', label: {...}, min: 640, max: 1920, step: 10, unit: 'px',
        visibleWhen: (prefs) => prefs.mode === 'custom' },
      { kind: 'number', key: 'margin', field: 'margin', label: {...}, min: 0, max: 64, step: 1, unit: 'px',
        disabledWhen: (prefs) => prefs.mode === 'default' },
    ],
  },
}
```

`TweakForm` 按 `kind` 映射到 5 种通用控件（segmented / slider / number / switch / text），并求值 `visibleWhen` / `disabledWhen`；`TweakCard` 负责标题、保存状态、重置和可选 `extra`。复杂内容（尺寸读数、实时预览）通过 `TWEAK_EXTRAS` 逃生口注入，不阻塞通用渲染器。

字段集合与 prefs 键集合、wire 映射由单测锁死（`test/prefs.test.ts`），防止新增字段时 UI 与持久化漂移。

### 5.4 宿主侧

宿主 Config 是扁平字段的集合，命名约定 `<tweakIdPascal><FieldPascal>`：

```ts
const Config = z.object({
  settingsPanelMode: z.union([...]).default('custom').volatile(),
  settingsPanelWidth: z.number().min(640).max(1920).default(1360).volatile(),
  settingsPanelHeight: z.number().min(480).max(1440).default(1000).volatile(),
  settingsPanelMargin: z.number().min(0).max(64).default(24).volatile(),
  // 后续 tweak 的字段追加在这里
})
```

为什么扁平而不是嵌套：DSH 的 settings 表单/补丁路径以字段路径为单位，扁平字段让 `settings.update` 的 patch、revision 比较、profile YAML 都保持最简形式；代价是字段名较长，由命名约定约束。**注意**：schema 必须使用 DSH 提供的 `@deepseek-ai/schemastery`（运行时解析时会把 `.volatile()` 包成可提交的引用）；用公共 `schemastery` 包会静默丢失写入。

### 5.5 新增一个 tweak 的步骤

1. `src/shared/prefs.ts`：定义 `XxxPrefs`，加入 `TweakPrefsMap`，写 descriptor，注册进 `TWEAK_IDS` / `TWEAK_DESCRIPTORS`；
2. 同一文件：在 `TWEAK_UI` 里声明该 tweak 的标题、顺序和 `fields`；
3. `src/host/index.ts`：给 Config 追加扁平 volatile 字段；
4. `src/client/index.ts`：若该 tweak 需要 DOM 副作用，在 `applyPanelStyle` 同级加一个 effect；纯表单 tweak 不需要改 client；
5. 需要读数/预览时在 `TweakitSection` 的 `TWEAK_EXTRAS` 里加一个函数；
6. 补单测：归一化、wire round-trip、字段与 prefs 一致、可见性；
7. 更新 `docs/features/` 与 dev profile「改值 → 重启 → 仍生效」验证。

### 5.6 未来的外部 tweak API

v1 只支持内置 tweak。后续可以暴露 `ctx.tweakit.registerTweak(...)` 服务，让第三方插件贡献 tweak 组：注册表从模块常量变成可观察集合，tab 组件订阅集合变化。设计上已经预留：descriptor 是纯数据，视图是组件，注册器可以复用。v1 不实现，避免过早承诺 API。

## 6. 持久化层

细节见 [ADR-0001](decisions/0001-persist-prefs-in-dsh-settings.md)。

- **命名空间**：profile entry id `dsh-tweakit`（`cordis.patch.yml` 里的 id），也是 `Config` 的条目 id。
- **读**：客户端 `ctx.configForms.get('dsh-tweakit')` 的 `getSnapshot()`，包含 `status/value/base/user/revision/writable`；`value` 是扁平 wire 字段，用 `fromWire()` 还原。
- **写**：`ConfigForm.mutate(ops, expectedRevision)`，一次防抖窗口内的字段变更合并成一个原子批次；成功 revision 递增，失败从快照重新播种。
- **重置**：发送 `unset` 操作清空用户层；四个字段都 unset 后 profile 用户层里的配置行会消失，下次启动回落到 Config 默认值。
- **并发**：`mutate` 携带 revision fence；Host 拒绝（`false`）即提示刷新，不静默覆盖。
- **降级**：`status === 'unavailable'` 时控件禁用并提示；没有自建路由，也没有第二条存储链路。

为什么不用 localStorage：桌面端 GUI 由本机 web 服务提供，端口每次启动可能不同，localStorage 按 origin 隔离，跨重启不可靠。为什么不用插件自己的 JSON 文件：DSH 的 settings 服务已经提供持久化、schema 校验、revision 守卫和用户层合并，重复实现只会多一个存储约定。

## 7. 样式接管层

- **唯一属主**：一个 `<style data-dsh-tweakit-panel id="dsh-tweakit-panel-style">`，由 `style controller` 创建/更新/移除；任何 tweak 不得自行插 `<style>`。
- **CSS 变量**：tweak 通过 `:root` 上的变量（`--dsh-tweakit-*`）参数化，避免每条规则都重写；v1 每次变更重写整段样式文本（体积很小，性能足够）。
- **选择器策略**：只用稳定标记（`settings.section`、`data-shortcut-modal`），不用 hash 类名；所有覆盖规则带 `!important`，因为 shell 的规则同特异性且顺序不可控。
- **移动端**：`@media (width <= 767px)` 内不接管。
- **可观测性**：tab 打开时检测面板标记是否存在；不存在则显示告警，不静默失败。

## 8. 设置页组合

- tab 通过 `settings.section` 注册，`id = tweakit`、`order = 90`、`label` 为 locale thunk。
- 组件 props 来自 `PropsRuntime<'settings.section'>`（含 `close`），加上注册时 `inject` 的面（store、actions）。
- tab 内部：标题区（当前 tweak 数、保存状态）+ 每个 tweak 一张分组卡片。
- 文案：v1 用 `client/i18n.ts` 的 zh/en 字典，按 `navigator.language` / `document.documentElement.lang` 选择；后续接入 `ctx.locale`（`LocaleFace`）实现实时切换。

## 9. 安全

- 路由只接受同源、带启动认证的请求：`ctx.connection.requestRejection(req)` 返回非 `undefined` 即 401/403。
- 只接受白名单字段；body ≤ 16 KiB；不解析路径、不执行命令、不写任意文件。
- 客户端不读取凭据；写操作只发偏好字段。
- 单测覆盖：非法方法、超大 body、未知字段、缺失 revision、冲突映射。

## 10. 构建与发布

- **宿主半**：esbuild → ESM，`packages: 'external'` 保留所有裸导入，由 DSH 运行时解析。
- **客户端半**：esbuild → CJS，再用 `window.__ModuleLoader__.load({ id, factory(require) })` 外壳包起来；`react`、`react/jsx-runtime`、`react-dom`、`@deepseek-ai/*` 全部 external，由平台模块表提供。
- **类型**：`tsc --emitDeclarationOnly` → `lib/types/**`；`exports` 同时提供 `types` 与 `default`。
- **包清单**：`dsh.bundle.patch`（装哪个 Loader row）、`dsh.client.platform = 'web'`、`manifestVersion: 1`。
- **仓库形态**：仓库公开，`private: true` 表示不发 npm，用户通过 GitHub 安装；`lib/` 随源码入库，CI 校验构建产物与源码一致。版本语义按 minor 递增，prefs `version` 字段独立演进。

## 11. 测试策略

| 层 | 工具 | 重点 |
| --- | --- | --- |
| 共享纯函数 | Vitest | 归一化、clamp、wire round-trip、尺寸公式、CSS 文本 |
| 客户端 store | Vitest + fake timers + fake configForm | 乐观预览、防抖 mutate、拒绝/异常回滚、unset 重置、dispose |
| 组件 | Vitest + jsdom + Testing Library | 渲染、禁用态、aria、键盘 |
| E2E | agent-browser + dev profile | 真实尺寸断言、重启保持、移动端不接管、卸载还原 |

E2E 不跑在当前 desktop profile 上：使用独立 `tweakit-dev` profile 和独立端口，避免影响正在使用的会话。

## 12. 目录结构与状态

```text
src/
├─ shared/
│  ├─ prefs.ts            ✅ 模型/归一化/wire/尺寸解析/声明式字段与 TWEAK_UI
│  └─ panel-css.ts        ✅ CSS 生成
├─ host/
│  └─ index.ts            ✅ Config + settings 呈现策略
├─ client/
│  ├─ index.ts            ✅ apply：configForms store / 样式效果 / tab / locale
│  ├─ config-form.ts      ✅ ctx.configForms 结构化类型
│  ├─ store.ts            ✅ 乐观预览 + 防抖 mutate + unset 重置
│  ├─ TweakForm.tsx       ✅ 声明式字段 → 5 种通用控件
│  ├─ TweakCard.tsx       ✅ 通用分组卡片
│  ├─ TweakitSection.tsx  ✅ settings.section 页面 + extra 逃生口
│  ├─ style.ts            ✅ 单例样式控制器
│  ├─ ui-style.ts         ✅ 静态 section 样式注入
│  └─ i18n.ts             ✅ zh/en 页面文案（字段文案在 TWEAK_UI）
├─ types/assets.d.ts      ✅ CSS 文本导入声明
test/                     ✅ 5 个文件 / 39 例
docs/                     ✅ 本设计与 ADR
## 13. 已知限制

- 只支持内置 tweak；外部注册 API 未实现。
- 多标签不同步（用 409 代替广播）。
- 依赖 `data-shortcut-modal` 标记；未来 shell 变更时需要适配（tab 内有标记缺失告警）。
- settings 服务缺失时只读。
- 客户端 bundle 的 source map 覆盖 wrapper 内的代码；调试时行号与源码基本对齐，但不含外壳两行。
- tab 文案在挂载时按 `ctx.locale` 的活动语言选择；切换语言后 tab 标签会跟随（thunk），已挂载的页面内容要重新打开设置才换语言。
- 窄屏行为由 shell 自己决定：当前 shell 的移动端规则带 `:not([data-platform=darwin])` 门控，macOS 桌面即使窄窗口也保留导航栏；本插件只保证 `<768px` 不注入尺寸覆盖。

## 14. ADR 索引

- [ADR-0001：用 DSH settings 服务持久化偏好](decisions/0001-persist-prefs-in-dsh-settings.md)
- [ADR-0002：设置面板尺寸三模式](decisions/0002-settings-panel-sizing-modes.md)
- [ADR-0003：配置驱动的 tweak 表单](decisions/0003-config-driven-forms.md)
## 15. 实现与验收摘要（0.1.0）

- 宿主：`Config` 4 个 volatile 字段；`settings.configure({ auto: false })`；无自建路由，持久化完全交给 DSH settings 服务。
- 客户端：`ctx.configForms` 读快照、按 revision fence 提交 `mutate`；启动即按持久化值应用样式（加载完成前不接管，避免闪烁）；tab 表单由 `TWEAK_UI.fields` 自动渲染；实时预览、200ms 防抖、失败回滚、`unset` 重置；`ctx.locale` 决定文案；所有副作用挂在 fiber effect 上。
- 验收：`tweakit-dev` profile 实测三模式、重启保持、窄屏不接管、控制台无异常；数据写入 `cordis.patch.yml`。详见[需求设计第 15 节](../features/2026-11-09-settings-window-size.md#15-验收记录2026-11-09)。