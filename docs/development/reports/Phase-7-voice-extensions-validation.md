# Phase 7 语音、Shell、Dynamic Skill 与 MCP 验证

> 执行日期：2026-08-11
> 结论：`pass`
> 对应路线图：Phase 7

## 1. 范围结论

Phase 7 已覆盖 VOC-001～012、EXT-001～019 与 SET-006～008。实现沿用既有进程边界：Main 管理全局快捷键、权限、设置与加密配置；Utility 管理 ASR、Shell、Skill Host 和 MCP Client；Renderer 只接收严格快照并发出用户操作；InputHookHost 只上报匹配组合键的状态；每个 JavaScript Skill 使用独立 Host。

| 范围 | 实现结果 |
| --- | --- |
| VOC-001～012 | 全局/应用内按住说话、冲突和权限状态、内存录音、20% 临时降音、当前 Provider 云端 ASR 与输入回填 |
| EXT-001～006 | 既有跨平台 Shell 执行、工作区授权、S1～S4 分类、输出流、取消与进程树监督接入 Agent |
| EXT-007～013 | Skill 四类来源、严格包校验、默认禁用、独立 Host、启停、更新、单版本回滚和 7 天回收 |
| EXT-014～019 | MCP 双传输、配置/Secret、真实 Tool 发现与重批、逐次审批、按需连接和生命周期监督 |
| SET-006～008 | 语音、扩展和 Shell 授权工作区设置面板 |

## 2. 语音输入

- 默认全局组合键为 `Alt+Space`。Main 先用 Electron `globalShortcut` 检测占用，再启动 `uiohook-napi` InputHookHost；Host 只向 Main 上报匹配组合键的 `pressed`、`released` 与故障状态，Alt 或 Space 任一松开都会结束本次 generation。
- 快捷键冲突、Hook 失败或系统权限不足会禁用全局入口并保留小云 Composer 内的按住麦克风按钮。设置页展示当前绑定、冲突、输入监控/辅助功能与麦克风状态，并提供系统权限入口。
- Renderer 使用 `MediaRecorder` 只在内存聚合音频；ASR 成功、失败、取消或超时均清零 `Uint8Array` 并释放 Blob/Stream 引用，不写入聊天、SQLite、缓存或日志。
- 聆听时显示“聆听中”浮层，并通过独立 Audio Focus generation 把实际输出临时降为原值的 20%；松手后不覆盖期间发生的暂停、切歌或音量变更。
- Utility 仅调用当前 Provider 的 ASR Capability。未配置或模型不支持时在上传前阻断并给出明确反馈；成功文本进入 Agent 输入，不实现 TTS。

## 3. Shell 产品化

- Agent 新增模型可见 `execute_shell`，复用 Phase 0 的 Windows PowerShell/macOS zsh 执行器、策略分类器、输出字节上限、进程树终止与取消语义，不创建第二套执行路径。
- Shell 仍由唯一的 CommandSafetyControl 控制 S1～S4；S1 为默认值。审批继续复用 Agent 的 ApprovalCard，工具卡实时区分 stdout/stderr，不把 Shell 输出伪装成普通模型文本。
- 设置页可选择、移除用户授权工作区；Classifier 只接受 Workspace Registry 内的解析路径，危险参数、EncodedCommand、未授权路径和不可解析命令保持拒绝或要求审批。
- 应用退出由 Utility Supervisor 统一停止 Shell、Skill Host 与 MCP 连接；既有 Shell 监督测试覆盖取消、超时、进程树与有限输出。

## 4. Dynamic Skill

- 支持扫描 AppData Skill 目录，从本地文件夹、ZIP 或 HTTPS Git staging 导入。Git 安装记录解析后的 commit；新发现和新安装一律为 `disabled`。
- `SKILL.md` 使用严格 YAML Frontmatter；名称、版本、入口、Prompt、Tool Schema、文件数量和总大小均有限制。符号链接/路径逃逸、`.node`、lifecycle script、平台二进制和缺失入口的损坏包会在执行前拒绝。
- 首版不运行 npm/pnpm 安装，不执行 `postinstall`/`prepare`，只允许包内已审计的纯 JavaScript ESM。每个启用 Skill 启动独立 Host，并使用 Node 权限模型作为纵深防御；崩溃、超时或 Schema 错误只停用当前 Skill。
- 显式更新先完成 staging 校验和内容哈希，再原子切换；失败保留旧版本。只保留一个上一版本供回滚；卸载先撤销工具并移入应用内 `.trash`，保留 7 天。
- 设置页直接操作使用显式按钮；由小云发起的安装、启用、更新和卸载仍进入现有 ApprovalCard。无法映射到内置能力的 Skill Tool 每次调用都要求审批。

## 5. MCP

- 生产依赖锁定 `@modelcontextprotocol/sdk@1.30.0`，只构造官方 `StdioClientTransport` 与 `StreamableHTTPClientTransport`。配置 Schema 和导入器均拒绝旧 SSE，stdio 的 `latest` 浮动版本也会拒绝。
- Main 使用 `safeStorage` 加密环境变量和 Header 值；Renderer、公开快照、日志和导出文档只包含名称。导入支持常见 `.mcp.json` 与 NcxMusic 格式，先展示待导入 Server、Transport 和默认禁用状态，再显式确认写入。
- 工具只以 `mcp.<serverId>.<toolName>` 注册。首次连接、配置指纹变化或实际 `tools/list` 名称/描述/Schema 变化都会禁用 Server 并要求重新批准，MCP annotations 不能改变本地策略。
- 所有外部 MCP Tool Call 都绑定新的 ApprovalCard。集成测试验证拒绝时底层零执行、批准时只执行当前调用一次，不因前一次批准获得后续免审。
- Server 只在测试或调用时连接，无进行中调用时空闲 10 分钟关闭。意外退出采用 1/2/5 秒退避，最多连续重启 3 次；只有稳定运行 5 分钟或用户改变配置指纹才重置预算，中断调用不会自动重放。
- 禁用、更新、删除和应用退出会显式关闭 Client/Transport；Streamable HTTP 同时终止 Session。删除只移除 NcxMusic 配置、加密 Secret 与应用内缓存，不触碰外部服务数据。

## 6. 安全与故障验证

本阶段新增或扩展的主要证据：

- `tests/unit/phase7-voice-runtime.test.ts`：未配置 Provider 时上传前拒绝并清零音频、空/超限录音拒绝、公开状态最小化；
- `tests/unit/phase7-extensions.test.ts`：Secret 加密落盘与无 Secret 导出、工具变化重批、旧 SSE/浮动版本拒绝、Skill 默认禁用/更新/回滚/回收及恶意包拒绝；
- `tests/integration/phase7-agent-approval.test.ts`：MCP 逐次审批的零执行拒绝与单次批准绑定；
- 既有 InputHook Contract/Matcher、Provider Protocol、Shell Executor/Classifier/Output/Supervisor 和 Agent Policy 套件全量回归；
- 构建产物合约新增 `skillHost.js` 入口检查，Electron Smoke 继续覆盖 Utility 重启与退出清理。

最终门禁：

- `pnpm typecheck`：通过；
- `pnpm lint`：通过，0 个错误，架构边界通过；现有 Vue 模板规则共报告 545 个非阻断 warning；
- `pnpm test`：68 个文件通过、1 个文件按环境跳过；435 项通过、6 项跳过；
- `pnpm test:e2e`：10/10 通过；
- `pnpm smoke:build`：Build Artifact Contract 与 Electron Build Smoke 通过，包含 Main、Utility、InputHookHost 与 SkillHost 构建入口。

## 7. 已知边界

- 自动化使用 Provider、进程和扩展夹具，未向真实云端 ASR 上传录音，也未连接用户的第三方 MCP Server；因此不把第三方服务可用性、Token 费用、限流或数据处理行为计入本阶段结论。
- 当前环境完成 Windows 构建与 Electron Smoke，但没有替代 Phase 8 的干净 Windows/macOS 签名安装包验证。macOS 辅助功能/输入监控授权、权限撤销、睡眠唤醒、公证身份，以及双平台连续 200 次实体按键测试仍需实机矩阵。
- Skill Host 的进程与权限边界用于故障和凭据隔离，不是绝对安全沙箱。第三方 JavaScript 仍是用户选择运行的本地代码，设置页保留相应披露。
- 首版不实现 TTS、Skill 市场、自动更新、运行时依赖安装、原生 Skill 模块、旧 MCP HTTP+SSE 或删除第三方系统数据。
