# ADR-0003：配置驱动的 tweak 表单（评估）

| 项目 | 内容 |
| --- | --- |
| 状态 | Accepted（P0/P1/P2 已实施） |
| 日期 | 2026-11-09 |
| 关联 | [需求设计](../../features/2026-11-09-settings-window-size.md)、[插件架构](../plugin-architecture.md)、[ADR-0002](0002-settings-panel-sizing-modes.md) |
| 参考 | VS Code Settings / `contributes.configuration` |

## 背景

当前每个 tweak 的界面都是手写 React：`SettingsPanelGroup.tsx` 负责模式分段控件、宽高滑杆 + 数字输入、边距、实时读数、保存状态，另有一份 `ui.css`。新增一个 tweak 就要新增组件、样式和组件测试，React 代码与配置事实（字段名、范围、默认值）分散在两处。

希望参考 VS Code settings：**用一份声明式配置描述字段，由通用渲染器自动生成表单**，把每个 tweak 的 React 代码降到接近零。

## 参考模型：VS Code settings

VS Code 扩展在 `package.json` 里声明 `contributes.configuration`（JSON Schema 的子集），Settings 编辑器读取后自动生成：

- 控件：`type`（string/number/boolean/array/object）、`enum` + `enumDescriptions`、`minimum` / `maximum` / `multipleOf`、`editPresentation`；
- 展示：`markdownDescription`、`order`、`scope`、`tags`、`deprecationMessage`；
- 交互：分组、搜索、“已修改”过滤、单项重置、JSON 模式下的 IntelliSense；
- 扩展不写任何设置页 UI；持久化在 `settings.json`（JSONC），UI 与 JSON 双向一致。

核心是两件事：**声明式 schema** + **平台级渲染器**。两者缺一不可。

## DSH 现状（0.2.1-rc.3 实测）

### 宿主侧

- 插件用 schemastery `Config` 声明字段，`.volatile()` 标记可热更新字段；
- `settings.describe()` 返回每个命名空间的 `schema`（`toJSON()`）、`value` / `base` / `user` / `revision` / `applies` / `secrets`，以及 `autoGenerate`。

把我们当前的 `Config.toJSON()` 打出来，实际只有：

```json
{
  "type": "number",
  "meta": { "step": 1, "min": 640, "max": 1920, "default": 1360, "volatile": true }
}
```

以及 `union` 的 const 列表。**没有 label、description、单位、分组、顺序、条件可见性，也没有本地化文本。**

### 客户端侧

- `ctx.configForms.get(entryId)`：按命名空间取快照（`status/value/base/user/revision/writable`）与 `set/unset/mutate` 写入；
- `ctx.settingsSchema`：`rehydrate` / `validate` / `nodeAtPath` / `getPath` 等 schema 操作；
- 官方控件：`SettingsForm` / `SettingsFormModel` / `SettingsValueField`（staged 保存，只有文本/数字输入，没有滑杆/分段/开关）；
- 官方插件页（`ui-settings-shell`、`ui-settings-models` 等）**仍然手写字段列表**，schema 只用来取 union 候选项、路径和默认值；
- `autoGenerate` 目前**没有任何客户端消费者**。DSH 的 settings README 明确写着 “no shipped client does so yet”。

### 结论

DSH 目前**没有** VS Code 那样的“声明即表单”能力。`autoGenerate` 只是一个标记，官方插件页也是手写 React；要让 tweak 配置自动出表单，必须自己实现渲染器（或推动上游做平台级渲染器）。

## 选项对比

| 方案 | 做法 | 代码量 | 体验 | 风险 |
| --- | --- | --- | --- | --- |
| A 维持现状 | 每个 tweak 手写 React + CSS | 新增 tweak ≈ 150–250 行 | 最好，完全可控 | 重复劳动，字段事实两处维护 |
| **B 插件内声明式字段 + 通用渲染器** | `shared` 定义字段元数据，一个 `TweakForm` 渲染 5 种控件 | 一次性约 2 天；新增 tweak ≈ 20–40 行 | 接近现状（滑杆/分段/读数都能保留） | 抽象过度；需要逃生口 |
| C 宿主 schema 驱动 | 从 `settings.describe().schema` 自动出表单 | 一次性约 3–5 天 | 最接近 VS Code，但缺 label/单位/条件显示 | 元数据塞进 schemastery meta，i18n/类型都别扭 |
| D 只依赖 autoGenerate | 去掉 `auto:false`，等平台渲染 | 0 行 | 目前不存在消费者，实际不可用 | 不可行 |
| E 完全无 React | 宿主 Config + 启动注入 CSS | 少 | 无设置 tab、无实时预览、改配置需刷新 | 不满足当前需求 |

## 推荐：方案 B

### 设计

在 `shared` 的 tweak descriptor 旁边增加字段声明，与 prefs 模型同源：

```ts
type TweakField =
  | { kind: 'segmented'; field: 'settingsPanelMode'; label: CopyKey; options: PanelMode[] }
  | { kind: 'slider'; field: 'settingsPanelWidth'; label: CopyKey; min: number; max: number; step: number; unit: 'px'; visibleWhen?: ... }
  | { kind: 'switch'; field: 'someBool'; label: CopyKey; hint?: CopyKey }
  | { kind: 'text'; field: 'someText'; label: CopyKey; placeholder?: string }
  | { kind: 'extra'; render: (props) => ReactNode } // 读数/预览等逃生口
```

- 一个 `TweakForm` 组件按 `kind` 映射到统一控件；标签、提示、a11y、单位在一处；
- 每个 tweak 仍保留 `effect(prefs)`（例如写入面板样式）和可选的 `renderExtra`；
- 宿主 `Config` 继续作为校验/持久化权威，字段声明只负责展示；加一条测试断言“字段声明的 wire 名集合 == `toWire(defaults)` 的键集合”，防止漂移；
- 文案放 shared 字典，不塞进宿主 schema。

### 传输层顺带优化（可选，先 spike）

`configForms` 已经提供 revision、writable、base/user 语义。如果第三方命名空间可用，可以删掉自建的 `/tweakit/api/prefs` 路由和 `client/api.ts` + `client/store.ts`，减少约 250 行和维护面。

代码里没有找到 `exposedNamespaces` 之类的白名单，`settings.describe()` 会返回所有已注册命名空间；但 `dsh-better-sidebar` 的注释声称第三方命名空间不被 RPC 服务。**需要用 dev profile 做一次 0.5 天的实测**，通过后再迁移；不通过就保留现有路由，只做 UI 层。

### 成本

| 阶段 | 内容 | 预估 |
| --- | --- | --- |
| P0 | configForms 第三方命名空间 spike | 0.5d |
| P1 | `TweakField` 类型 + `TweakForm` 渲染器 + 控件抽取 | 1d |
| P2 | 迁移 settings-panel、删除专属组件、补测试/文档 | 0.5d |

收益：新增 tweak 从“组件 + 样式 + 测试”降为“字段声明 + 可选 effect”；标签/a11y/校验/格式统一；字段与 prefs 的漂移有测试兜底。

## 不推荐的做法

- **追求宿主 schema 全自动渲染（C）**：schema 缺 UI 元数据，补 meta 会把展示细节塞进配置协议，i18n 无法优雅表达；只有当平台需要“所有插件共享一套设置页”时才值得。
- **完全去掉 React（E）**：DSH 的设置页就是 React slot；没有客户端就无法实时应用样式和提供 tab。
- **依赖 `autoGenerate`（D）**：目前没有消费者，属于未实现的平台能力。

## 若目标是生态级能力

应该向上游提 feature：让 `settings.describe().schema` + `autoGenerate` 有平台级渲染器（或让 `SettingsForm` 接受 schema → fields），而不是每个插件重复造。本 ADR 只讨论 dsh-tweakit 插件内自用的方案。

## 实施结果（2026-11-09）

- **P0 通过**：dev profile 实测 `configForms.get('dsh-tweakit')` 状态 `ready`，`value/base/user/revision/writable` 齐全；`set('settingsPanelMargin', 12)` 被接受、revision 0 → 1，恢复后 1 → 2。
- **传输层已迁移**：删除 `/tweakit/api/prefs` 路由、`src/host/route.ts`、`src/client/api.ts` 及 route/api 测试；新增 `src/client/config-form.ts` 与基于 `ConfigForm` 的 store（乐观预览 + 防抖 `mutate` + `unset` 重置）。
- **P1/P2 完成**：`shared/prefs.ts` 新增 `TweakField` / `TweakUi` / `TWEAK_UI`；新增 `TweakForm.tsx`（segmented / slider / number / switch / text）与 `TweakCard.tsx`；`TweakitSection` 按 `TWEAK_UI` 自动渲染，读数作为 `extra`；删除 `SettingsPanelGroup.tsx`。
- **验证**：39 个测试通过；dev profile 实测边距改 40 → 面板 1200×497、`settingsPanelMargin: 40` 落盘；恢复默认触发 4 个 `unset`，profile 配置行被移除；重启后仍按持久化/默认值应用；旧路由返回 404；desktop profile 安装后宿主半热重载（旧路由 401 → 404）。
- **保留 `autoGenerate: false`**：插件有自己的 tab，不需要 Plugins 页生成第二个入口。

方案 C（宿主 schema 全自动渲染）仍不推荐：DSH 的 schema JSON 没有 label/单位/顺序/条件可见性，补齐会污染配置协议。若未来做平台级能力，应向上游提交 `autoGenerate` 渲染器，而不是在插件内重复实现。