# 贡献指南

感谢愿意一起把 DSH 界面变得更好用。参与方式不限于写代码：报 Bug、提使用场景、改进文档、给候选 tweak 投票都算贡献。

## 报 Bug / 提建议

请开 [issue](https://github.com/zhanganmv/dsh-tweakit/issues/new)，并尽量附上：

- DSH 版本、操作系统、使用的 profile（web / desktop）；
- 复现步骤、期望行为、实际行为；
- 设置面板截图或录屏；控制台报错请贴完整文本。

提新 tweak 时，先说清**使用场景**（屏幕尺寸、工作流、为什么原生布局不够用），比直接给实现方案更有帮助。

## 开发

环境、命令、调试 profile、验收清单都在 [docs/development.md](docs/development.md)。仓库约定（尤其是架构硬规则）见 [AGENTS.md](AGENTS.md)。

提交前必须：

```bash
pnpm check
```

如果改了 `src/**`，跑 `pnpm build` 验证即可；`lib/` 不入库，发布时由 `prepack` 生成。

## Pull Request

- 从 `main` 切分支，一次 PR 只做一件事；
- 提交信息用 Conventional Commits（`feat:` / `fix:` / `docs:` / `test:` / `chore:`）；
- 行为变化要带测试；UI 变化附前后截图；
- 用户可见行为变化要同步更新 README、`docs/` 与 feature 文档；
- 等 CI 全绿再请求 review。

## 设计先行

新功能先在 `docs/features/` 写一篇可验收的需求文档；不可逆的技术选择补一篇 ADR（`docs/architecture/decisions/`）。实现偏离设计时，先改文档再改代码。

## 行为准则

保持友善、就事论事。对事不对人，不要求贡献者暴露隐私信息（token、账号、私人路径）。
