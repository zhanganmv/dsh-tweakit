# ADR-0001：用 DSH settings 服务持久化 tweakit 偏好

| 项目 | 内容 |
| --- | --- |
| 状态 | Accepted（0.1.0 实现；传输层已迁移到 configForms） |
| 日期 | 2026-11-09 |
| 决策者 | dsh-tweakit 维护者 |
| 关联 | [插件架构](../plugin-architecture.md)、[需求设计](../../features/2026-11-09-settings-window-size.md) |

## 背景

`dsh-tweakit` 需要保存少量用户偏好（设置面板的模式、宽、高、边距）。候选方案有三个约束：

1. **必须跨重启生效**。桌面端 GUI 由本机 web 服务提供，监听端口是动态分配的（本次运行是 `127.0.0.1:62427`），localStorage 按 origin 隔离，重启后大概率丢失。
2. **不能引入第二套存储约定**。DSH 已经有一套用户设置文档（profile 用户层 / `cordis.patch.yml`），插件自己再写 JSON 文件会增加备份、清理、迁移的负担。
3. **要能防止并发覆盖**。同一浏览器的多个标签可能同时编辑，后写者不能静默覆盖先写者。

DSH 0.2.x 的 `settings` 服务提供了恰好需要的能力：以 profile entry id 为命名空间、读取插件 `Config` 的 `.volatile()` 字段、带 revision 的 `update()`、写入 profile 用户层。`dsh-better-sidebar` 已经在用这条链路（`settings.get` / `settings.update` 宿主方法 + 自己的 fenced 路由）。

## 决策

1. **命名空间 = Loader entry id**：`dsh-tweakit`（由 `cordis.patch.yml` 定义）。
2. **Config 使用扁平 volatile 字段**：每个偏好一个 `.volatile()` 字段（如 `settingsPanelWidth`），schema 来自 DSH 提供的 `@deepseek-ai/schemastery`。扁平是为了让 patch、revision、profile YAML 都保持最简。
3. **宿主半调用 `settings.configure({ auto: false })`**：本插件自带设置页，不在“设置 → 插件”里重复生成表单。
4. **客户端不直接使用 settings RPC**：第三方命名空间不在 RPC 白名单内。宿主半注册 `GET/POST /tweakit/api/prefs`，在进程内调用 `ctx.settings.update(ns, patch, expectedRevision)`。
5. **写入沿用官方 fence**：`ConfigForm.mutate(ops, expectedRevision)` 由 settings RPC 承载认证与 revision 守卫，不再有自建路由需要 fence。
6. **降级**：命名空间 `status === 'unavailable'` 时客户端禁用控件并提示；没有第二条存储链路。

## 后果

正面：

- 配置写进 profile 用户层，应用重启、端口变化、profile 备份都自然覆盖；
- 复用 schema 校验、revision 守卫、用户层合并，无自研存储；
- 字段可被 DSH 的原生配置工具看到/编辑（即使 `auto: false`，profile YAML 仍是可读的事实来源）；
- 与 DSH 的升级路径一致。

负面：

- 必须提供宿主半与一条 HTTP 路由（约 100 行），比 localStorage 重；
- 依赖 settings 服务存在（Web/Desktop 组合默认满足）；
- 扁平字段名会随 tweak 增多而变长，需要命名约定；
- 写入会修改 profile 用户层，用户手动编辑 YAML 与 UI 写入共享同一个 revision 语义。

## 备选方案

| 方案 | 为什么不选 |
| --- | --- |
| localStorage | 端口/origin 变化即丢；无法用于重启保持 |
| 插件私有 JSON（`$DSH_HOME/storages/...`） | 可行但引入第二套存储约定；缺少 schema/revision；备份与迁移要自己维护 |
| 直接改 profile YAML（`configEditor.edit`） | 绕过 settings 服务等于重写一遍校验与 revision 逻辑 |
| settings RPC 直连 | 第三方命名空间不在白名单，无法使用 |
| 启动注入 + 只读配置 | 只能读不能写，无法满足 tab 内实时调整 |

## 参考

- DSH `dsh-settings` 服务与 `settings.update` 语义（0.2.1-rc.3）。
- `dsh-better-sidebar` 的 `settings.get` / `settings.update` 宿主方法（本机 `~/.dsh/profiles/desktop/node_modules/dsh-better-sidebar/src/index.ts`）。

## 更新记录

- **2026-11-09（P0/P2）**：在 `tweakit-dev` profile 实测 `ctx.configForms` 对第三方命名空间可用（读快照、`set`/`mutate` 写、revision 递增、profile 用户层落盘）。据此删除自建 `/tweakit/api/prefs` 路由、`src/host/route.ts`、`src/client/api.ts` 与对应测试，客户端 store 改为基于 `ConfigForm` 的乐观预览 + 防抖 `mutate` + `unset` 重置。其余决定（命名空间、volatile 字段、`auto:false`、profile 用户层）保持不变。
