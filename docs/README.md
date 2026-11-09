# 文档索引

- [开发指南](development.md)：环境、构建、调试 profile、新增 tweak、验收与发布。
- [设置窗口尺寸 — 需求设计](features/2026-11-09-settings-window-size.md)：第一个 tweak 的目标、模式规格与验收记录。
- [配置分组与左侧折叠导航 — 已实现（M1+M2）](features/2026-11-09-tweak-grouping.md)：按归属分组、组头淡化可折叠、组内切 tweak 的信息架构与交付切分。
- [插件架构设计](architecture/plugin-architecture.md)：双半架构、数据流、扩展模型与已知限制。
  - [ADR-0001：用 DSH settings 服务持久化偏好](architecture/decisions/0001-persist-prefs-in-dsh-settings.md)
  - [ADR-0002：设置面板尺寸三模式](architecture/decisions/0002-settings-panel-sizing-modes.md)
  - [ADR-0003：配置驱动的 tweak 表单](architecture/decisions/0003-config-driven-forms.md)

其他入口：[README](../README.md) · [贡献指南](../CONTRIBUTING.md) · [AGENTS.md](../AGENTS.md)

约定：

- `features/` 按 `yyyy-MM-dd-<title>.md` 命名，一篇文档对应一个可验收的需求。
- `architecture/` 放跨需求的整体设计；单个不可逆决策写进 `architecture/decisions/`。
- 文档与代码同批评审；实现偏离设计时先改文档再改代码。
