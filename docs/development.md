# 开发指南

面向要改 `dsh-tweakit` 的贡献者和 AI agent。产品介绍见 [README](../README.md)，架构细节见 [插件架构](architecture/plugin-architecture.md)。

## 1. 环境与命令

要求 Node ≥ 22.6、pnpm 9。

```bash
pnpm install
pnpm check        # 提交前必跑：typecheck + lint + format:check + test + build
pnpm test         # Vitest 单元/组件测试
pnpm build        # 清理 lib/ 后生成 lib/host.js、lib/client.js、lib/types/**
pnpm build:watch  # 只监听并重建两个 bundle，不重新生成 d.ts
pnpm format       # Prettier
```

`pnpm check` 里的 `build` 会先清空 `lib/`，避免已删除源文件留下陈旧的 `.d.ts`。

## 2. 构建产物要提交

`lib/` **入库**，这是有意为之：用户通过 `dsh plugin add github:...` 安装时，DSH 直接使用仓库里的构建产物，不需要在用户机器上跑 prepare/build，也不受 pnpm「build scripts 需要 allowBuilds」的限制。

因此：

- 改完 `src/**` 必须跑 `pnpm build`，并把 `lib/**` 一起提交；
- 不要手改 `lib/`，它由 `scripts/build.mjs` + `tsc` 生成；
- CI 会跑 `pnpm check` 后检查 `git status --porcelain -- lib`，不干净就失败；
- `lib/types` 只声明类型；新增/删除源文件后必须重新 build，否则会残留旧声明。

构建形态：

| 产物 | 生成方式 | 说明 |
| --- | --- | --- |
| `lib/host.js` | esbuild，ESM | 所有裸导入 external，由 DSH 运行时解析 |
| `lib/client.js` | esbuild，CJS + ModuleLoader 外壳 | React / `@deepseek-ai/*` external，由浏览器模块表提供 |
| `lib/types/**` | `tsc --emitDeclarationOnly` | `exports` 里的 `types` 指向这里 |

## 3. 在 DSH 里调试

### 3.1 独立 profile（推荐）

不要直接在正在使用的 desktop profile 上验收。用一个独立 profile，避免影响当前会话：

首次先基于 web 模板创建 profile（已有同名 profile 时跳过；`--from-default-profile` 会重置同名 profile）：

```bash
dsh --profile tweakit-dev --from-default-profile web --dump-config >/dev/null
dsh plugin --profile tweakit-dev add -w file:"$PWD"
dsh --profile tweakit-dev
```

`--dump-config` 让命令创建/刷新 profile 后直接退出，不启动界面。只装插件而不建模板时，新 profile 只带 `dsh-base`，没有 web 界面。

`-w` 不能省：profile 目录本身是 pnpm workspace root，否则 pnpm 会拒绝把依赖加到根上。`file:` 安装的是**快照副本**，不是符号链接。改完代码、重新 `pnpm build` 后，要重新执行一次 `add`（或直接删除 profile 下的 `node_modules/dsh-tweakit` 再装）。

### 3.2 desktop profile

`desktop` profile 由 Electron 应用独占，应用运行时不要在外部用 CLI 改它。开发时可以用应用内的「插件」页安装；需要在外部安装时，先完全退出应用，并使用应用自带的 pnpm（系统 pnpm 可能因 store 版本不一致报 `ERR_PNPM_UNEXPECTED_STORE`）。

宿主半改动（`src/host/**`、`cordis.patch.yml`）可以通过给 profile 的 `cordis.patch.yml` 加/删一行注释触发 HMR；客户端半改动刷新页面即可。最稳妥的验证仍然是重启 `dsh`。

### 3.3 验收清单

- 打开 **设置 → 界面调整**，三种模式都能切换；
- `custom` 改宽高/边距，面板实时变化；
- 重启进程、换端口后仍是上次的值；
- 「恢复默认」后 profile 用户层对应配置行消失，面板回到 1360×1000；
- 切到 `default` 后 `<style data-dsh-tweakit-panel>` 被移除，面板回到 800×800；
- 视口宽度 < 768px 时不接管；
- 控制台无异常；
- 卸载插件后样式和 tab 都消失。

## 4. 架构约束

完整设计见 [插件架构](architecture/plugin-architecture.md)，这里只列改代码时最容易踩的硬规则：

1. **宿主保持薄**：`src/host/index.ts` 只做 `Config` 和 `settings.configure({ auto: false })`，不要加自建 HTTP 路由；持久化走官方 settings/configForms。
2. **客户端只通过公开服务**：`ctx.slots`、`ctx.configForms`、`ctx.locale`；对 DSH 包只允许 `import type`。
3. **`shared/` 无环境依赖**：不能 import DOM、Node、React、`@deepseek-ai/*`。
4. **单一事实来源**：默认值、范围、归一化、wire 映射只在 `src/shared/prefs.ts` 定义。
5. **持久化不用 localStorage / sessionStorage**：desktop 端口动态、origin 会变。
6. **样式只命中设置面板**：选择器是 `[role="dialog"][data-shortcut-modal="settings"]`，样式节点带 `data-dsh-tweakit-panel`，`<768px` 不注入。
7. **所有副作用有 disposer**：样式、监听、定时器都挂在 fiber effect 上，卸载/HMR 必须无残留。
8. **双语文案**：`i18n.ts` 提供 zh/en；字段文案在 `TWEAK_UI` 里，同样要双语。

## 5. 新增一个 tweak

以「字号」为例：

1. **需求文档**：新增 `docs/features/yyyy-MM-dd-typography.md`，写清目标、非目标、交互和验收标准；不可逆决策补 ADR。
2. **偏好模型**：在 `src/shared/prefs.ts` 里加 `TypographyPrefs`、默认值、范围、`normalize`、扁平 wire 字段（如 `typographyScale`），并在 `TweakPrefsMap` 与 `DEFAULT_PREFS` 注册。
3. **声明式字段**：在 `TWEAK_UI` 增加对应的 `TweakField[]`；字段 `field` 必须与 prefs 键一致。
4. **效果**：新建 `src/shared/typography-css.ts` 生成 CSS；在 `src/client/index.ts` 里按 tweak 启用时应用。
5. **宿主 Config**：为每个新 wire 字段加一个 `.volatile()` 字段。
6. **测试**：更新 `test/prefs.test.ts` 的漂移断言（字段集合 == prefs 键集合、wire 一一对应），给 CSS 生成器加纯函数测试。
7. **文档**：更新 README 的路线图/功能列表、`docs/README.md` 索引和 feature 文档状态。
8. **提交前**：`pnpm check`，并按第 3.3 节手工验收。

不需要改设置页骨架，也不需要新写 React 组件：`TweakForm` 已覆盖 `segmented` / `slider` / `number` / `switch` / `text` 五类字段；复杂可视化走 `TweakCard` 的 `extra` 逃生口。

## 6. 测试

| 文件 | 覆盖 |
| --- | --- |
| `test/prefs.test.ts` | 归一化、clamp、wire round-trip、默认值、字段漂移 |
| `test/panel-css.test.ts` | 三种模式的 CSS 文本与边界 |
| `test/store.test.ts` | 乐观更新、防抖、revision 冲突、回滚、unset 重置 |
| `test/style.test.ts` | 样式节点生命周期 |
| `test/section.test.tsx` | tab 渲染、控件交互、标记缺失提示 |

原则：纯逻辑优先放 `shared/` 并做纯函数测试；store 用 fake form + fake timers；组件测试只断言用户可见行为，不断言 class 名。

## 7. 发布与版本

- 版本号在 `package.json`，语义化递增；prefs 的 `version` 字段独立演进，旧值通过 `normalize` 兼容。
- 发布 GitHub 版本：更新版本号与文档 → `pnpm check` → 提交 → 打 tag（如 `v0.2.0`）→ push tag → 写 Release notes。
- 目前 `private: true`，不发布 npm；安装形态是 GitHub 仓库。若以后发 npm，需要补 `publishConfig` 并调整 `files`。
- `lib/` 必须与源码同批提交，CI 会校验。

## 8. 常见坑

- **与其它尺寸插件冲突**：多个插件都用 `!important` 改同一个面板时必须二选一。
- **`file:` 是快照**：改源码后不重新 add，看到的还是旧代码。
- **desktop profile 独占**：应用运行时外部 CLI 会被拒绝。
- **shell 标记变化**：`data-shortcut-modal="settings"` 是当前 shell 的标记；如果升级后样式失效，先看 tab 里的标记缺失提示。
- **陈旧 d.ts**：`pnpm build` 会先清理；不要绕过它直接 `tsc`。
- **多标签写冲突**：revision 不匹配时 store 会重播种并提示，不会静默覆盖。

## 9. 文档约定

- `docs/features/`：一篇文档对应一个可验收需求，文件名 `yyyy-MM-dd-<title>.md`。
- `docs/architecture/`：跨需求的整体设计；不可逆决策写进 `architecture/decisions/`。
- 文档与代码同批评审；实现偏离设计时，先改文档再改代码。
- 中文为主；命令、路径、类型名保留英文。
