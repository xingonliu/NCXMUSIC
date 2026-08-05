# Prompt 41：Phase 7 Dynamic Skill

执行通用协议，只实现 Dynamic Skill，不实现 MCP。

## 必读

- `docs/architecture/NcxMusic-Extensions-Architecture.md` 的 Skill 章节。
- Agent Runtime、Storage Architecture。
- 功能清单 EXT-007～011、SEC-009、SET-008。

## 任务

实现 `appData/skills/<skill_name>/` 发现、`SKILL.md` YAML Frontmatter/Prompt 解析、本地文件夹/ZIP 导入、HTTPS Git 安装、启停、版本/来源/SHA-256、更新暂存校验、原子切换、上一版回滚和卸载 7 天回收。

JavaScript Tool 只能在独立 Skill Host 动态 import；不在线安装依赖、不执行 lifecycle、不支持 `.node`。新包默认禁用，小云发起安装/启用/更新必须 ApprovalCard，所有 Tool 仍过 PolicyGateway。

## 验收

损坏/恶意包、路径穿越、哈希变化、Host 崩溃、未知能力逐次审批、更新回滚和卸载测试通过；不宣称绝对安全沙箱。输出 Checkpoint 后停止。
