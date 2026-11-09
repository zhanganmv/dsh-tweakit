# dsh-tweakit

[![CI](https://github.com/zhanganmv/dsh-tweakit/actions/workflows/ci.yml/badge.svg)](https://github.com/zhanganmv/dsh-tweakit/actions/workflows/ci.yml)

在 DeepSeek Harness 的设置里增加一个 **界面调整** tab，用来按需定制 Web 界面。

第一个 tweak 是**设置窗口尺寸**：默认、全屏、自定义三种模式，带边距控制，替代本地的 旧的本地尺寸插件。后续 tweak（字号、圆角、间距等）通过同一套注册表接入，不需要再改设置页骨架。

> **当前状态：0.1.0 — 已实现并在独立 `tweakit-dev` profile 完成浏览器验收。** 宿主半只保留 volatile `Config`；客户端通过官方 `ctx.configForms` 读写命名空间，字段由声明式 `TweakUi` 自动渲染；39 个单测/组件测试通过。desktop profile 已安装并通过 HMR 热加载。

## 尺寸模式

| 模式      | 行为                                                 | 生效公式                                                                                 |
| --------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `default` | 完全不接管，设置面板保持 DSH 原生的 800×800          | 不注入样式                                                                               |
| `full`    | 全屏，保留自定义边距                                 | `w = 100vw - 2·margin`；`h = 100vh - 2·max(margin, overlayTop)`                          |
| `custom`  | 自定义宽、高、边距；超出视口时自动收缩并保留四周边距 | `w = min(width, 100vw - 2·margin)`；`h = min(height, 100vh - 2·max(margin, overlayTop))` |

`overlayTop` 是框架为 macOS 交通灯预留的顶部安全区（`--dsh-frame-overlay-top`），即使把边距设为 0，面板也不会钻到窗口标题栏下面。移动端（`< 768px`）不接管，交给 DSH 自己的铺满布局。

首装默认值是 `custom / 1360×1000 / margin 24`，与旧的本地尺寸方案 的观感一致；想恢复原生就切到 `default`（见 [ADR-0002](docs/architecture/decisions/0002-settings-panel-sizing-modes.md)）。

![界面调整 tab](docs/assets/settings-window.png)

## 已验证（dev profile）

在 `tweakit-dev`（`dsh-base + dsh-web-app + dsh-tweakit`）中实测：

- 视口 1280×577，`custom 1360×1000 / margin 24` → 面板 **1232×529**；
- `full / margin 0` → 面板 **1280×577**，坐标 (0,0)；
- `custom 1200×800 / margin 30` → 面板 **1200×517**，坐标 (40,30)，四周边距保留；
- `default` → 样式节点被移除，面板回到 shell 的 **800×529**；
- 声明式表单写回走 `ctx.configForms`：把边距改为 40 后，面板变为 **1200×497**，`cordis.patch.yml` 出现 `settingsPanelMargin: 40`；
- 「恢复默认」通过 `unset` 清空用户层，`dsh-tweakit` 配置行被移除，面板回到 1360×1000 的默认值；
- 重启进程（端口变化）后仍按持久化值/默认值应用样式；
- 旧的自建 HTTP 路由已删除：`/tweakit/api/prefs` 返回 404；
- 窄视口 700×900 时本插件的 `@media (width >= 768px)` 不匹配，不接管面板；
- 刷新页面后控制台无异常。

## 声明式表单

每个 tweak 的界面由 `shared/prefs.ts` 里的 `TweakUi` 描述，通用渲染器负责出控件：

```ts
fields: [
  { kind: 'segmented', key: 'mode', field: 'mode', label: { zh: '模式', en: 'Mode' }, options: [...] },
  { kind: 'slider', key: 'width', field: 'width', label: { zh: '宽度', en: 'Width' }, min: 640, max: 1920, step: 10, unit: 'px',
    visibleWhen: (prefs) => prefs.mode === 'custom' },
  { kind: 'number', key: 'margin', field: 'margin', label: { zh: '边距', en: 'Margin' }, min: 0, max: 64, step: 1, unit: 'px',
    disabledWhen: (prefs) => prefs.mode === 'default' },
]
```

- 支持 `segmented` / `slider`（滑杆 + 数字）/ `number` / `switch` / `text`，以及 `visibleWhen` / `disabledWhen`；
- 复杂内容（尺寸读数、实时预览）作为 `extra` 逃生口，不破坏通用渲染器；
- 宿主 `Config` 仍是校验/持久化权威，一条测试断言“字段集合 == prefs 键集合、wire 映射一一对应”，防止漂移；
- 新增 tweak：加 prefs + descriptor + `TweakUi.fields` + 可选 effect，不再写 React 组件。

## 安装

从 GitHub 源码安装：

```bash
dsh plugin --profile web add github:zhanganmv/dsh-tweakit
# desktop profile 由应用管理，可在应用内「插件」页安装，或使用应用自带 pnpm：
dsh plugin --profile desktop add github:zhanganmv/dsh-tweakit
```

当前已验证的 desktop profile 安装方式（2026-11-09）：

- `~/.dsh/profiles/desktop/package.json` 的 `dependencies` 增加 `dsh-tweakit: file:/Users/admin/Github/zhanganmv/dsh-tweakit`；
- `dsh.profile.bundles` 末尾追加 `dsh-tweakit`；
- 旧的本地尺寸插件 已从依赖和 bundles 移除（两者都用 `!important` 抢同一面板，不能共存）；
- 通过 HMR 热加载生效，无需重启：宿主半换版后旧路由 `/tweakit/api/prefs` 从 401 变为 404，证明运行中的实例已重载。

注意：`file:` 安装的是**快照副本**（`~/.dsh/profiles/desktop/node_modules/dsh-tweakit`），改完源码后需要在应用内「插件」页重新安装，或在该 profile 用应用自带 pnpm 重新 `add`，新代码才会生效。

## 兼容与权限

- **DSH 版本**：开发与验收基于 `0.2.1-rc.3`；更低版本未验证。
- **Profile**：`web` 与 `desktop` 均可；插件只依赖 `settings`、`configForms`、`slots` 三个客户端服务。
- **权限**：不发起网络请求、不读取凭证、不写业务文件；只注册 `settings.section` 一个 tab，并通过 DSH settings 服务读写自己的命名空间 `dsh-tweakit`。
- **作用范围**：仅向设置面板（`[role="dialog"][data-shortcut-modal="settings"]`）注入尺寸样式；`< 768px` 不接管。
- **已知限制**：依赖 `data-shortcut-modal` 标记，未来 shell 改名会让尺寸失效（tab 内会提示）；declarative 表单目前覆盖数字/滑杆/分段/开关/文本五类字段。

## 开发

```bash
pnpm install
pnpm check        # typecheck + lint + format:check + test + build
pnpm test         # Vitest
pnpm build        # lib/host.js + lib/client.js + lib/types/**
pnpm build:watch  # 监听 src/（不重新生成 d.ts）
```

环境要求：Node ≥ 22.6、pnpm 9。

验证环境（功能实现后）：独立的 `tweakit-dev` profile + 独立端口的 `dsh web`，不触碰当前的 desktop 会话。

## 目录结构

```
src/
├─ shared/            # 双端共享、无 DOM/Node 依赖
│  ├─ prefs.ts        # 偏好模型、默认值、校验、wire 映射、尺寸解析
│  └─ panel-css.ts    # 由偏好生成设置面板 CSS
├─ host/index.ts      # 宿主半：volatile Config + settings 呈现策略
└─ client/
   ├─ index.ts        # apply：configForms store / 样式效果 / tab 注册
   ├─ config-form.ts  # ctx.configForms 的结构化类型
   ├─ store.ts        # 乐观预览 + 防抖 mutate + unset 重置
   ├─ TweakForm.tsx   # 声明式字段 → 控件的通用渲染器
   ├─ TweakCard.tsx   # 通用分组卡片
   ├─ TweakitSection.tsx
   └─ ui.css / style.ts / i18n.ts
test/                 # 共享层 + store + 组件测试
docs/
├─ features/          # 需求设计
└─ architecture/      # 架构设计与 ADR
```

## 设计文档

- [设置窗口尺寸 — 需求设计](docs/features/2026-11-09-settings-window-size.md)
- [插件架构设计](docs/architecture/plugin-architecture.md)
- [ADR-0001：用 DSH settings 服务持久化偏好](docs/architecture/decisions/0001-persist-prefs-in-dsh-settings.md)
- [ADR-0002：设置面板尺寸三模式](docs/architecture/decisions/0002-settings-panel-sizing-modes.md)

## 路线图

| 阶段 | 内容                                             | 状态     |
| ---- | ------------------------------------------------ | -------- |
| M0   | 设计文档 + 工程骨架 + 共享模型                   | ✅       |
| M1   | 可安装、tab 可见、client 生命周期                | ✅       |
| M2   | 尺寸模型 + CSS 接管 + tab UI                     | ✅       |
| M3   | settings 服务持久化 + revision 守卫 + 降级       | ✅       |
| M4   | 组件/E2E 测试、dev profile 验收                  | ✅       |
| —    | 安装到主 profile 并移除 旧的本地尺寸插件 | 待你确认 |

## License

[MIT](LICENSE)
