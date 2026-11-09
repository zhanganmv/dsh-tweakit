# 文档索引

- [设置窗口尺寸 — 需求设计](features/2026-11-09-settings-window-size.md)
- [插件架构设计](architecture/plugin-architecture.md)
  - [ADR-0001：用 DSH settings 服务持久化偏好](architecture/decisions/0001-persist-prefs-in-dsh-settings.md)
  - [ADR-0002：设置面板尺寸三模式](architecture/decisions/0002-settings-panel-sizing-modes.md)
  - [ADR-0003：配置驱动的 tweak 表单（评估）](architecture/decisions/0003-config-driven-forms.md)

约定：

- `features/` 按 `yyyy-MM-dd-<title>.md` 命名，一篇文档对应一个可验收的需求。
- `architecture/` 放跨需求的整体设计；单个不可逆决策写进 `architecture/decisions/`。
- 文档与代码同批评审；实现偏离设计时先改文档再改代码。