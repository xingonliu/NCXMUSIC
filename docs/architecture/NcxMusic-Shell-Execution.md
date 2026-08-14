# NcxMusic Shell Executor 与确定性安全基线

> 文档状态：Baseline 0.1
> 建立日期：2026-08-05
> 适用平台：Windows、macOS
> 关联决策：C-006、C-007、C-082、D-203、D-207

## 1. 目标与边界

Shell Tool 是小云正向注册的可选能力，不是 Renderer 的通用终端。模型只负责提出命令；是否允许自动执行、是否需要 ApprovalCard、参数能否进入执行器全部由确定性代码判断。

- 默认启用 Shell Tool 并使用 S1，任何命令执行前都审批；用户可以完全关闭 Tool。
- Windows 固定使用 `powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command`。
- macOS 固定使用 `/bin/zsh -f -c`，不加载用户启动脚本。
- 首版不提供交互式 TTY，不接受密码、二次验证或任意标准输入会话。
- Renderer 不获得 `child_process`、Shell、文件系统或通用 IPC；Shell Executor 位于 Utility Process，并通过专用 Process Supervisor 启动子进程。

## 2. Tool 契约

```ts
interface ExecuteShellInput {
  command: string
  workspaceId?: string
  cwd?: string // 相对已授权工作区的路径
  timeoutMs?: number
  purpose: string
}

interface ExecuteShellResult {
  status: 'succeeded' | 'failed' | 'cancelled' | 'timed_out' | 'rejected' | 'unavailable'
  exitCode: number | null
  signal: string | null
  durationMs: number
  stdout: string
  stderr: string
  stdoutTruncated: boolean
  stderrTruncated: boolean
}
```

模型不能传绝对工作目录或环境变量。`workspaceId` 只引用用户已经通过系统文件夹选择器授权的根目录；`cwd` 解析后必须位于该根目录内。没有已授权工作区时使用应用管理的空白工作区 `userData/shell/default-workspace/`。

默认超时 120 秒，允许请求 1～600 秒。超过默认值本身不改变安全等级，但必须在审批卡或 ToolExecutionCard 中明确显示。Shell 不透明重试；重试必须成为新的 Tool Call 和 `commandId`。

## 3. S1～S4 判定

| 等级 | 自动执行范围 | 其他情况 |
| --- | --- | --- |
| S1 | 无 | 所有可执行命令审批 |
| S2 | 严格只读模板、允许的参数、无复合语法 | 审批 |
| S3 | S2 + 已授权工作区内的常规编辑、格式化、构建和测试 | 删除、联网、安装、发布、工作区外访问均审批 |
| S4 | S3 + 已授权工作区内通过作用域审查的删除、联网和依赖安装 | 无法确定结构、目标或作用域时仍审批 |

安全等级只决定 `allow | ask`，不能扩大硬能力边界。未注册的 Shell Tool、未授权工作区、交互式提权、无法监督的外部 GUI、支付和凭据读取等能力返回 `CAPABILITY_UNAVAILABLE` 或 `POLICY_DENIED`，不能通过审批临时创造 Handler。

## 4. 分类器

判定顺序固定为：

```text
Schema 校验
  → 平台语法检查
  → 命令/子命令分类
  → 复合语法与动态展开检查
  → cwd 与路径作用域解析
  → 网络/写入/删除/进程启动标签
  → S 等级纯函数
  → allow | ask | deny
```

### Windows

使用 PowerShell 自带 Parser 生成 AST，不用正则表达式替代 Shell 解析。自动执行路径只接受分类器理解的 CommandAst、参数和值；动态 `Invoke-Expression`、脚本块拼接、反射、编码命令、运行时路径构造或无法静态确定的调用进入 `ask`，不能因为命令名称看似只读而放行。

### macOS

`zsh -n` 只负责语法有效性，不能证明安全。S2/S3/S4 自动执行使用 NcxMusic 的保守 Tokenizer 和命令模板；出现命令替换、变量间接展开、重定向、here document、后台执行或分类器不理解的复合语法时进入 `ask`。

管道和命令链只有在每个节点、连接符和数据方向都被分类器理解时才可自动执行。任何未知节点使整个 Tool Call 进入审批，不能只审查其中一段。

## 5. 初始命令模板

S2 初始只读范围保持小而明确：

- Windows：`Get-Location`、`Get-ChildItem`、`Get-Item`、`Get-Content`、`Test-Path`、`Select-String` 及经过约束的 `git status/diff/log/show`。
- macOS：`pwd`、`ls`、`stat`、`file`、`head`、`tail`、`wc`、`grep`、`rg`、受限 `find` 及经过约束的 `git status/diff/log/show`。
- 进程、网络、系统配置、环境变量和用户目录枚举不属于初始 S2 白名单，即使调用本身只读也进入审批。

S3 的写入模板只覆盖授权工作区内的创建、编辑、复制、移动、格式化、构建和测试。`git commit`、`git push`、包安装、下载、发布、删除和执行新下载文件不自动放行。

S4 可以自动放行已知包管理器和版本控制模板，但路径仍必须留在授权工作区，且远端、包源和参数结构必须可识别。未知可执行文件、任意脚本下载后执行和系统范围安装进入审批。

命令模板是代码和测试数据，不写入 Prompt；新增模板必须有正向、绕过、跨平台和路径逃逸测试。

## 6. 路径与工作区

- 工作区只能由用户通过原生文件夹选择器新增或移除，小云不能自行授权目录。
- 所有自动文件写入的最终目标都必须解析为已授权根目录的后代；根目录本身不能成为递归删除或移动目标。
- Windows 校验盘符、UNC、设备路径、junction 和大小写归一化；macOS 校验符号链接、挂载点和大小写差异。
- 分类器无法在执行前确定最终路径时进入审批；硬能力边界仍阻止已知的工作区逃逸。
- 相对路径以已验证的 `cwd` 解析，不以 Main、Utility Process、项目仓库或用户主目录作为隐式当前目录。

## 7. 环境与凭据

Shell 子进程不继承 Main/Utility Process 的完整 `process.env`。只构造运行平台所需的最小系统变量、受控 `PATH`、语言编码、应用管理的临时目录和包缓存目录。

网易云 Cookie、模型/MCP API Key、CI Secret、代理凭据和 Credential Vault 租约永远不进入 Shell 环境。需要外部服务凭据的未来能力必须使用独立、可审计的 Credential Reference 和专用 Tool，不能通过环境变量临时注入通用 Shell。

日志和 UI 在执行前、流式输出和结果持久化三个阶段使用同一脱敏器。命令可能含敏感字面量时，Action Journal 只保存脱敏命令、命令哈希、工作区 ID、分类标签和结果摘要。

## 8. 输出、取消与进程树

- stdout/stderr 分通道流式发送到 ToolExecutionCard，带递增 sequence 和背压；Renderer 不直接读取原生 Stream。
- 每个通道最多保留 1 MiB 内存，超限后停止累积并加入截断标记；发送给模型的最终结果最多 64 KiB，保留开头 16 KiB 与结尾 48 KiB。
- 原始完整输出默认不持久化；Action Journal 只保存裁剪摘要、退出码、耗时和截断状态。
- Process Supervisor 对 `exit`、`close` 与 `error` 使用同一个幂等终态结算函数；spawn 失败不能依赖可能不会出现的 `exit`。强杀后操作系统仍未回报事件时，必须在一个额外宽限期后返回既定的 `cancelled` 或 `timed_out`，禁止留下永久 pending 的 Promise。
- 取消先发送正常终止，2 秒后仍未退出则终止整个进程树。macOS 使用独立进程组；Windows 必须通过受监督的进程树机制验证所有后代都被回收，不能只结束顶层 PowerShell。
- 应用退出、账号切换、Utility Process 故障或 Turn 被新消息取代时，Agent 的 `AbortSignal` 必须传播到 Shell Executor，使活动 Shell Tool 进入明确取消终态，绝不自动重启或重放。

Windows 进程树终止与打包后行为属于 Phase 0 技术门禁；验证失败时首版 Shell Tool 保持关闭，而不是发布无法可靠取消的执行器。

## 9. 验收要求

- 每个 S 等级覆盖允许、审批和拒绝样本，权限变化即时生效。
- 覆盖命令替换、环境变量展开、编码命令、路径穿越、symlink/junction、UNC/设备路径、复合命令和引号绕过。
- S2 不产生文件、网络或外部进程副作用；S3 自动副作用不离开授权工作区。
- S4 仍无法访问凭据租约、创建交互式提权会话或绕过 Tool Registry。
- 超时、用户取消、Renderer 重载、Utility Process 故障和应用退出均回收完整进程树。
- ToolExecutionCard、模型结果、Action Journal 和开发日志都不能出现未脱敏凭据或超过输出上限的数据。
