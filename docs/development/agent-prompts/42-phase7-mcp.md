# Prompt 42：Phase 7 MCP Client

执行通用协议，只实现冻结范围内的 MCP。

## 必读

- Extensions Architecture 的 MCP 章节。
- IPC Protocol、Agent Runtime。
- 功能清单 EXT-012～019、SET-007。
- 使用 Context7 核对 `@modelcontextprotocol/sdk` 当前稳定 v1.x 官方文档。

## 任务

实现 stdio 与 Streamable HTTP Transport、Server 配置新增/编辑/启停/测试/导入/脱敏导出、凭据引用、安装/更新/删除审批、配置指纹和变化重审。工具名固定 `mcp.<serverId>.<toolName>`，不能覆盖内置 Tool。

所有外部 MCP Tool Call 首版逐次审批，Annotations 只展示。stdio 按需启动、空闲 10 分钟关闭、崩溃最多重启 3 次；HTTP 显式连接/关闭。更新保留旧配置回滚，删除不碰外部数据。

## 禁止与验收

不实现、不回退、不展示旧 HTTP+SSE。验证恶意 Server、同名工具、配置变化、Secret 导出、审批零执行、崩溃和退出零孤儿进程。输出 Checkpoint 后停止。
