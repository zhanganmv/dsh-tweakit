# 设置窗口尺寸

| 项目 | 内容 |
| --- | --- |
| 状态 | 已实现（dev profile 验收通过） |
| 日期 | 2026-11-09 |
| 目标版本 | 0.1.0 |
| 关联 | [ADR-0001](../architecture/decisions/0001-persist-prefs-in-dsh-settings.md)、[ADR-0002](../architecture/decisions/0002-settings-panel-sizing-modes.md) |
| 代码入口 | `src/shared/prefs.ts`、`src/shared/panel-css.ts`（已实现）；`src/host/index.ts`、`src/client/index.ts`（M1–M3） |

## 1. 背景与问题

DSH 的设置面板固定为 **800×800**（`max-width: calc(100vw - 48px)`，高度 `min(800px, calc(100vh - 2 * max(24px, var(--dsh-frame-overlay-top, 24px))))`）。在大屏上这个尺寸浪费空间，在 1366×768 这类笔记本上又显得局促。

当前用户通过旧的本地尺寸方案 解决：它只注入一段 CSS，把面板硬编码撑到 1360×1000，并在小窗口时铺满。问题是：

1. 尺寸写死，不能按屏幕和习惯调整；
2. 没有 UI，改一次要改代码；
3. 与新的「界面调整」能力没有共同入口。

本需求把这件事升级为插件 `dsh-tweakit` 的第一个 tweak：在设置里新增一个 tab，用三种模式控制设置窗口的尺寸，并把配置持久化。

## 2. 目标与非目标

### 目标

- 设置面板尺寸可配置：`default`（不接管）、`full`（全屏 + 边距）、`custom`（宽、高、边距）。
- 面板永远不会超出视口；请求尺寸大于可用空间时，四周保留设定边距。
- 改动实时预览；持久化后跨应用重启、跨动态端口生效。
- 安装即替代旧的本地尺寸方案，默认观感一致。
- 只接管设置面板，不碰其他界面。
- 为后续 tweak 提供同一套 tab 骨架（见架构文档）。

### 非目标

- 不改主界面布局、侧栏、字号、圆角、主题（后续 tweak）。
- 不做移动端（`< 768px`）接管；那里由 shell 的铺满 + 横向导航布局负责。
- 不做多窗口实时同步（同一浏览器多标签的并发写用 revision 拒绝，不做广播）。
- 不做云端同步；配置只存在本机 profile。

## 3. 用户故事

1. 作为大屏用户，我打开「设置 → 界面调整」，选择「全屏」，面板立刻铺满窗口并保留 24px 边距。
2. 作为 1366×768 笔记本用户，我设置 1600×1200，面板自动收缩到 1318×720，四周仍有 24px，不会露出窗口边缘。
3. 作为 macOS 用户，我把边距调到 0，面板横向贴边，但顶部仍在交通灯下方。
4. 作为不想被打扰的用户，我选择「默认」，面板回到 DSH 原生 800×800，插件不再注入任何样式。
5. 作为洁癖用户，我卸载插件后，样式立即消失，DSH 恢复原样。
6. 作为多标签用户，我在 A 标签改了宽度，B 标签保存时被拒绝，并看到「已在别处修改，请重试」，不会静默覆盖。

## 4. 模式规格

记：

- `vw`、`vh`：视口宽高（CSS px）；
- `margin`：用户设置的边距，0–64，默认 24；
- `overlayTop`：框架顶部安全区，来自 `--dsh-frame-overlay-top`，Web 下通常为 0，macOS 桌面下为交通灯高度；
- `gapX = margin`，`gapY = max(margin, overlayTop)`。

| 模式 | 语义 | 注入的尺寸 |
| --- | --- | --- |
| `default` | 不接管 | 无样式；面板由 shell 决定（800×800） |
| `full` | 全屏，保留边距 | `width: calc(100vw - 2·gapX)`；`height: calc(100vh - 2·gapY)` |
| `custom` | 自定义宽高，超出时收缩 | `width: min(W, calc(100vw - 2·gapX))`；`height: min(H, calc(100vh - 2·gapY))` |

约束：

| 字段 | 范围 | 默认 | 说明 |
| --- | --- | --- | --- |
| `width` | 640–1920 | 1360 | 仅 `custom` 使用 |
| `height` | 480–1440 | 1000 | 仅 `custom` 使用 |
| `margin` | 0–64 | 24 | 三模式共用（`default` 下无效果） |

示例（`margin = 24`，`overlayTop = 0`）：

| 视口 | 模式 | 请求 | 实际 |
| --- | --- | --- | --- |
| 1920×1080 | `custom` | 1360×1000 | 1360×1000 |
| 1366×768 | `custom` | 1600×1200 | 1318×720 |
| 1366×768 | `full` | — | 1318×720 |
| 1440×900 | `full`，`margin=0`，`overlayTop=68` | — | 1440×764 |

> 尺寸解析的纯函数在 `src/shared/prefs.ts` 的 `resolvePanelSize()`；CSS 由 `src/shared/panel-css.ts` 的 `buildPanelCss()` 生成，两者必须使用同一公式，并由单测锁住。

移动端：`@media (width <= 767px)` 内不注入任何尺寸规则。插件在窄屏下等价于 `default`。

## 5. 默认值与迁移

- **首装默认**：`custom / 1360×1000 / margin 24`。这是对 旧的本地尺寸插件 的等价替代，安装后视觉无回归。
- 「恢复默认」按钮回到上述默认值（不是切到 `default` 模式）；想恢复原生请显式选择「默认」。
- **迁移**：没有历史数据需要迁移（旧插件不存配置）。安装流程要求移除 旧的本地尺寸插件，两者不能共存。
- 配置文件里的未知字段在读取时丢弃；`version` 不匹配时按当前版本重新归一化（v1 只有归一化，没有字段搬迁）。

> 待评审：是否把首装默认改成 `default`（完全不接管）。改一个常量即可，见 `DEFAULT_SETTINGS_PANEL`。

## 6. 数据模型

内存文档（嵌套、按 tweak id 分组）：

```ts
type PanelMode = 'default' | 'full' | 'custom'

interface SettingsPanelPrefs {
  mode: PanelMode
  width: number
  height: number
  margin: number
}

interface TweakPrefsMap {
  'settings-panel': SettingsPanelPrefs
  // 后续 tweak 在这里扩展
}

interface TweakitPrefs {
  version: 1
  tweaks: TweakPrefsMap
}
```

宿主 Config 使用**扁平字段**（DSH settings 服务的 volatile 约定，见 ADR-0001）：

| wire 字段 | 类型 | 对应 |
| --- | --- | --- |
| `settingsPanelMode` | `'default' \| 'full' \| 'custom'` | `tweaks['settings-panel'].mode` |
| `settingsPanelWidth` | number | `tweaks['settings-panel'].width` |
| `settingsPanelHeight` | number | `tweaks['settings-panel'].height` |
| `settingsPanelMargin` | number | `tweaks['settings-panel'].margin` |

`toWire()` / `fromWire()` 在 `src/shared/prefs.ts` 中完成双向映射，并有 round-trip 单测。新增 tweak 时按同一约定扩展（架构文档第 5 节）。

归一化规则：

- 非对象、非有限数字、未知模式 → 回退默认值；
- 数字四舍五入后 clamp 到范围；
- 未知 tweak、未知字段忽略；
- 文档版本号由代码写入，不信任输入。

## 7. 交互规格

### 7.1 tab

- `settings.section` 注册：`id = tweakit`，`order = 90`（当前构建里排在 Agent 预设之后；Account 由 shell 固定在首位）。
- 标签文案：中文「界面调整」，英文「Tweaks」；跟随 DSH 语言，未接入 locale 服务时按 `document.documentElement.lang` / `navigator.language` 回退。
- tab 内容按「分组卡片」组织：一个 tweak 一组。v1 只有「设置窗口」一组。

### 7.2 「设置窗口」组

| 控件 | 行为 |
| --- | --- |
| 模式分段控件 | 默认 / 全屏 / 自定义；切换立即生效 |
| 宽度 | `custom` 下显示；滑杆 + 数字输入，640–1920，步进 10；输入非法时回显上一个有效值 |
| 高度 | `custom` 下显示；480–1440，步进 10 |
| 边距 | 三种模式都显示（`default` 下禁用并置灰）；0–64，步进 1 |
| 恢复默认 | 回到 `custom / 1360×1000 / 24` |
| 当前生效尺寸 | 只读回显：`1318 × 720（视口 1366 × 768）`；`default` 下显示「由 DSH 决定」 |

交互细节：

- 拖动滑杆 / 输入数字 → **立即**更新本地状态与 CSS（实时预览），200ms 防抖后写宿主。
- 写入中在组标题右侧显示「保存中…」；成功显示「已保存」（1.5s 后淡出）；失败显示「保存失败，重试」按钮。
- `default` 模式不隐藏其他控件，只置灰，避免布局跳动。
- 面板当前尺寸的监听：打开 tab 时读取 `getBoundingClientRect()`，窗口 `resize` 时更新回显（节流 100ms）。

### 7.3 无障碍

- 每个控件有可见 `<label>` 且与 input 关联；滑杆有 `aria-valuetext`（如「1360 像素」）。
- 保存状态用 `aria-live="polite"`；错误用 `role="alert"`。
- 分段控件支持左右方向键切换；Tab 顺序 = 视觉顺序。
- 不因实时预览打断读屏焦点。

## 8. CSS 接管规格

### 8.1 选择器

```css
[role="dialog"][data-shortcut-modal="settings"]
```

这是设置 shell 给 modal 面板的稳定标记（`data-shortcut-modal` 属于快捷键/模态层的公开语义），不使用 `SettingsRoot.module.css` 的 hash 类名。移动端媒体查询内不接管。

### 8.2 生成的样式（`custom` 示例）

```css
/* dsh-tweakit: settings panel size (custom) */
:root {
  --dsh-tweakit-gap-x: 24px;
  --dsh-tweakit-gap-y: max(24px, var(--dsh-frame-overlay-top, 0px));
}

@media (width >= 768px) {
  [role="dialog"][data-shortcut-modal="settings"] {
    width: min(1360px, calc(100vw - 2 * var(--dsh-tweakit-gap-x))) !important;
    height: min(1000px, calc(100vh - 2 * var(--dsh-tweakit-gap-y))) !important;
    max-width: none !important;
    max-height: none !important;
  }
}
```

要点：

- 必须覆盖 shell 的 `max-width: calc(100vw - 48px)` 与 `max-height`，否则 shell 的上限会压过我们的宽度；
- `!important` 是必要的：shell 的规则同元素同特异性，且顺序不可控；
- 只有一个 `<style data-dsh-tweakit-panel id="dsh-tweakit-panel-style">`；`default` 模式直接移除；
- 样式随插件 fiber 卸载移除，HMR/禁用/卸载即时还原。

### 8.3 为什么不改 React 组件

设置面板是 shell 私有组件，没有公开的尺寸 props；直接改 CSS 不需要依赖未公开的组件 API，升级风险最小。插件只依赖两个公开面：`settings.section` 槽位与模态标记。

## 9. 持久化与读写契约

见 [ADR-0001](../architecture/decisions/0001-persist-prefs-in-dsh-settings.md)。摘要：

- 命名空间 = Loader entry id `dsh-tweakit`；
- Config 的每个偏好字段都是 `.volatile()`，由 DSH settings 服务持久化到 profile 用户层；
- 客户端不写自建 HTTP 路由，而是用官方 `ctx.configForms.get('dsh-tweakit')` 读写该命名空间（P0 在 dev profile 实测通过：第三方命名空间可读、可写、revision 正常递增）。

### 9.1 读

`ConfigForm.getSnapshot()` 返回：

```ts
{
  status: 'loading' | 'ready' | 'unavailable',
  value: { settingsPanelMode, settingsPanelWidth, settingsPanelHeight, settingsPanelMargin },
  base: unknown,      // 组合层默认值
  user: unknown,      // 用户层原始值
  revision: number | undefined,
  writable: boolean,
}
```

客户端用 `fromWire(value)` 还原成嵌套的 `TweakitPrefs`；`status !== 'ready'` 时控件禁用。

### 9.2 写

`ConfigForm.mutate(ops, expectedRevision)`，`ops` 是路径寻址的原子批次：

```ts
[
  { op: 'set', path: ['settingsPanelWidth'], value: 1500 },
  { op: 'set', path: ['settingsPanelMargin'], value: 24 },
]
```

- 客户端把一次防抖窗口内的所有变更合并成一个 `mutate`；
- `expectedRevision` 取当前快照的 revision；成功后 revision 递增；
- Host 拒绝（返回 `false`）表示 revision 冲突或值被拒，客户端重新从快照播种并提示；
- 传输异常 reject，客户端回滚到上一次 Host 值并提示重试。

### 9.3 重置

「恢复默认」发送 `unset` 操作清空用户层，而不是把默认值写成显式覆盖：

```ts
[{ op: 'unset', path: ['settingsPanelMode'] }, ...]
```

四个字段全部 unset 后，profile 用户层里的 `dsh-tweakit` 配置行会被移除（实测），下次启动继续用 Config 默认值。

### 9.4 与自建路由的取舍

0.1.0 早期版本曾用 `/tweakit/api/prefs` 宿主路由 + 前端 api/store 读写。P0 证明官方 `configForms` 对第三方命名空间可用后，路由、`client/api.ts` 与对应的 route/api 测试全部删除（约 250 行）；现在只有官方 settings RPC 一条链路。

## 10. 失败与降级

| 场景 | 行为 |
| --- | --- |
| 快照 `loading` | 显示「正在读取设置…」，不接管面板样式（避免预加载闪烁） |
| 快照 `unavailable` | `writable=false`；控件禁用；提示「当前环境不支持保存」；重试按钮重新播种 |
| 写入被拒（`mutate` 返回 false） | 从 Host 快照重新播种，提示「已在别处修改，已刷新为最新值」 |
| 传输异常 | 回滚到上一次确认值，显示错误与重试 |
| 面板标记不存在 | tab 内显示「未检测到设置面板，尺寸设置暂不可用」（说明 DSH 版本可能变化） |
| `< 768px` | 不接管，交给 shell 自己的布局 |

任何失败都不能抛到 shell：错误在 tab 内局部呈现，样式控制器与 store 保持可用。

## 11. 验收标准

- [x] `pnpm check` 全绿（typecheck、lint、format、39 个测试、构建）。
- [x] dev profile 中安装后，设置里出现「界面调整」tab。
- [x] `default`：样式节点移除，面板回到 shell 的 800×529（1280×577 视口）。
- [x] `full` + `margin 0`：面板 1280×577、坐标 (0,0)。
- [x] `custom 1200×800 / margin 30`：在 1280×577 视口显示 1200×517、坐标 (40,30)。
- [x] 拖动滑杆/输入数值时面板实时变化，无闪烁。
- [x] 保存后重启进程（端口从 58915 变为 62483），尺寸保持。
- [x] 写入被拒/并发写：store 单测覆盖“重新播种 + 提示”，不再使用自建 409 路由。
- [x] 窄视口 700×900：本插件的 `@media (width >= 768px)` 不匹配，不接管面板。
- [ ] 禁用/卸载插件后样式立即移除：样式控制器的 dispose 有 jsdom 单测；真实插件禁用留给装机后验证。
- [x] 控制台无未捕获异常；tab 内错误可见且可重试。

## 12. 测试计划

| 层 | 内容 | 状态 |
| --- | --- | --- |
| 单测 | 归一化、clamp、wire round-trip、尺寸解析、CSS 文本、字段元数据与 wire 一一对应 | ✅ 16 例 |
| 单测 | configForms store：乐观预览、防抖 mutate、拒绝/异常回滚、unset 重置、dispose | ✅ 8 例 |
| 样式 | 单例 style 元素、更新、default 移除、dispose | ✅ 2 例（jsdom） |
| 组件 | 声明式字段渲染、模式切换、滑杆/clamp、条件可见性、禁用态、重试、重置、zh 文案 | ✅ 7 例（jsdom + Testing Library） |
| E2E | dev profile + 独立端口，configForms 读写与尺寸断言 | ✅ 已完成（agent-browser） |

E2E 实际步骤：

1. 手工创建 `tweakit-dev` profile（`dsh-base + dsh-web-app`）；
2. `dsh plugin --profile tweakit-dev add -w file:$PWD` 安装并加入 bundles；
3. `dsh --profile tweakit-dev --port 0 --no-open` 启动；
4. agent-browser 打开打印的 URL → 账号菜单 → 设置 → 界面调整；
5. 逐模式断言 `getBoundingClientRect()`、样式节点与 readout；
6. 改值 → 检查 profile `cordis.patch.yml` → 重启进程 → 断言保持；
7. 缩到 700×900，断言 `matchMedia('(width >= 768px)') === false`。

## 13. 风险与备选

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| `data-shortcut-modal` 标记在未来版本移除/改名 | 尺寸不生效 | tab 内检测并提示；备选：按 `role=dialog` + `aria-labelledby` 结构探测，但更脆弱，需谨慎 |
| 与旧的本地尺寸方案 或其它改面板的插件冲突 | 尺寸不可预期 | 安装流程强制移除旧插件；CSS 变量独立命名 |
| settings 服务在部分组合中缺失 | 无法持久化 | 只读降级 + 明确提示 |
| macOS 顶部安全区差异 | 面板压住交通灯 | `gapY = max(margin, overlayTop)` |
| 超宽屏 1920 上限不够 | 无法铺满 4K | `full` 模式不受上限影响；`custom` 上限可后续放宽 |
| 第三方插件也改同一元素的宽度 | `!important` 互相覆盖 | 文档声明单一属主；冲突时以最后注入者为准，需要时提供开关 |

## 14. 未决问题

1. ~~首装默认保持 `custom 1360×1000`，还是改成 `default`？~~ 已按“替代旧插件不回归”定为 `custom 1360×1000`；常量在 `src/shared/prefs.ts`，要改只动一处。
2. 边距是否需要「按边独立」（上/右/下/左）？v1 统一值，v2 再评估。
3. `custom` 的上限 1920×1440 是否够用？4K 用户可能希望更大，但实际会被视口夹住，上限只影响输入框可填的值。
4. 是否需要「双击标题栏在默认/全屏之间切换」这类快捷操作？暂不做。
## 15. 验收记录（2026-11-09）

环境：`tweakit-dev` profile，`dsh 0.2.1-rc.3`，Chrome（agent-browser），视口 1280×577 与 700×900。

| 检查 | 结果 |
| --- | --- |
| tab 出现 | ✅ 「界面调整」，文案跟随 DSH 语言（`ctx.locale`） |
| 首装默认 | ✅ 面板 1232×529（custom 1360×1000 被视口与 24px 边距夹住） |
| 声明式字段渲染 | ✅ 卡片标题、模式单选、宽/高/边距输入、readout 均由 `TweakUi` 生成 |
| configForms 写入 | ✅ 边距改 40 → 面板 1200×497，`cordis.patch.yml` 出现 `settingsPanelMargin: 40`，状态「已保存」 |
| 恢复默认 | ✅ 4 个字段 `unset`，`dsh-tweakit` 配置行从 profile patch 移除，面板回 1232×529 |
| default | ✅ `<style data-dsh-tweakit-panel>` 移除；面板 800×529 |
| 重启保持 | ✅ 重启并换端口后仍按持久化值/默认值应用样式 |
| 旧路由下线 | ✅ `/tweakit/api/prefs` 返回 404（自建路由已删除） |
| 窄屏 | ✅ 700×900 时 `matchMedia('(width >= 768px)').matches === false`，不接管 |
| 控制台 | ✅ 重新加载后无异常 |
| desktop 热重载 | ✅ 宿主半换版后旧路由由 401 变 404，运行中的实例已重载 |
| 构建 | ✅ `lib/host.js` / `lib/client.js` / `lib/types/**` |
