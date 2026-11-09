# AGENTS.md

给在本仓库工作的 AI coding agent 的说明。人类贡献者同样适用；更完整的开发流程见 [docs/development.md](docs/development.md)。

## 项目是什么

`dsh-tweakit` 是 DeepSeek Harness（DSH）的界面微调插件。它在设置里注册一个「界面调整」tab，第一个 tweak 用来调整设置窗口的宽高；后续 tweak 复用同一套声明式表单和 tab 骨架。

技术栈：TypeScript（strict）、React 18、Cordis、esbuild、Vitest、pnpm 9。

## 开始之前先读

1. [README.md](README.md)：产品行为与安装方式。
2. [docs/architecture/plugin-architecture.md](docs/architecture/plugin-architecture.md)：双半架构、数据流、扩展模型。
3. 当前任务对应的 `docs/features/*.md` 与 `docs/architecture/decisions/*.md`。
4. [docs/development.md](docs/development.md)：环境、构建、验收、常见坑。

## 常用命令

```bash
pnpm install
pnpm check        # 提交前必须通过（typecheck + lint + format:check + test + build）
pnpm test         # 只跑测试
pnpm build        # 清空 lib/ 后重新生成产物 + d.ts
pnpm format       # Prettier 写入
```

DSH 里调试：优先用独立 profile，不要动正在使用的 desktop profile。

```bash
dsh plugin --profile tweakit-dev add file:"$PWD"
dsh --profile tweakit-dev
```

`file:` 是快照安装；改完代码要重新 build + add。

## 仓库结构

```text
src/shared/     纯 TS：偏好模型、校验、wire 映射、CSS 生成（无 DOM/Node/React）
src/host/       Cordis 宿主半：volatile Config + settings 呈现策略
src/client/     apply、configForms store、声明式表单、tab、样式、i18n
test/           共享层 / store / 组件测试
docs/           需求、架构、ADR、开发指南
lib/            **入库的生成物**，不要手改
```

## 不可破坏的约束

- **宿主保持薄**：不要新增自建 HTTP 路由、不要自建存储。持久化只走 DSH settings + `ctx.configForms`。
- **客户端只用公开服务**：`ctx.slots`、`ctx.configForms`、`ctx.locale`；对 DSH 包只允许 `import type`，运行时能力从 Cordis 服务取。
- **`shared/` 保持纯净**：不得 import React、DOM、`node:*`、`@deepseek-ai/*`。
- **单一事实来源**：默认值、范围、归一化、扁平 wire 字段只在 `src/shared/prefs.ts` 定义；`TweakField.field` 必须与 prefs 键一致。
- **不用 localStorage / sessionStorage**：desktop 端口动态、origin 会变，持久化会丢。
- **样式作用域**：只命中 `[role="dialog"][data-shortcut-modal="settings"]`，样式节点带 `data-dsh-tweakit-panel`；`<768px` 不注入。
- **客户端 bundle 形态**：必须是 `window.__ModuleLoader__.load({ id, factory(require) })` 外壳；React、`react/jsx-runtime`、`react-dom`、`@deepseek-ai/*` 保持 external。
- **副作用必须可回收**：样式、监听、定时器都挂在 fiber effect 上，卸载/HMR 后不能有残留。
- **双语**：用户可见文案同时提供 zh/en（`i18n.ts` 与 `TWEAK_UI`）。
- **不联网、不读凭证、不写业务文件**；只读写自己的 settings 命名空间 `dsh-tweakit`。

## 改代码的流程

1. 先找/写需求文档（`docs/features/`）；行为或数据模型变化先更新文档。
2. 先写或改测试：纯逻辑放 `shared/` 做纯函数测试，store 用 fake form + fake timers。
3. 实现，保持改动最小；不要顺手重构无关模块。
4. 如果改了 `src/**`，跑 `pnpm build` 并提交 `lib/**` 的变化。
5. 更新 README / docs 索引 / feature 文档状态（涉及用户可见行为时）。
6. `pnpm check` 必须全绿；UI 改动在 dev profile 手工验收（见 docs/development.md 第 3.3 节）。
7. 提交信息用 Conventional Commits（`feat:`、`fix:`、`docs:`、`test:`、`chore:`），一次提交只做一件事。

## 新增 tweak 的最小清单

- [ ] `docs/features/yyyy-MM-dd-<name>.md`（目标/非目标/交互/验收）
- [ ] `src/shared/prefs.ts`：prefs 类型、默认值、范围、normalize、wire 字段、`TweakPrefsMap`、`TWEAK_UI`
- [ ] `src/host/index.ts`：每个 wire 字段一个 `.volatile()`
- [ ] `src/shared/<name>-css.ts`：纯函数生成样式
- [ ] `src/client/index.ts`：按启用状态应用样式
- [ ] 测试：prefs 漂移断言、CSS 文本、store/组件行为
- [ ] 文档：README 路线图、`docs/README.md`、feature 文档
- [ ] `pnpm check` + dev profile 验收

## 验收标准

- 三种模式与边界值正确；超出视口时保留边距；macOS 顶部安全区不被覆盖。
- 修改实时预览，重启后保持；「恢复默认」清空用户层。
- `default` 模式无样式节点；卸载后无残留。
- `<768px` 不接管；控制台无异常。
- `lib/` 与源码一致（CI 会检查）。

## 不要做

- 不要手改 `lib/`、不要提交 `node_modules/`。
- 不要为写设置页而 patch DSH 组件或依赖 hash 类名。
- 不要引入第二套存储、IPC 或 HTTP 契约。
- 不要在未验证的情况下声称某个 DSH 版本兼容；只写实测过的版本。
- 不要在主分支 force push；用 PR + CI。
