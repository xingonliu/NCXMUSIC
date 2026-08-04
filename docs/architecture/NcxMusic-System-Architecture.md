# NcxMusic 系统架构基线

> 文档状态：Draft 0.1（架构访谈进行中）
> 建立日期：2026-08-04
> 最后更新：2026-08-04
> 用途：记录跨进程拓扑、源码组织、依赖方向和架构决策；具体业务行为以 PRD 和各领域文档为准

## 1. 已确认的架构决策

| 编号 | 决策 | 状态 |
| --- | --- | --- |
| A-001 | Electron 采用 Main + Preload + Renderer + Utility Process 拓扑；内部通信使用受限 IPC/MessagePort，不建 localhost/SSE 服务。 | 已确认 |
| A-002 | 首版使用单仓库、单应用包、模块化单体；不预先拆多个 workspace package。 | 已确认 |

## 2. 运行时拓扑

```text
Renderer（Vue / Pinia / AudioHost）
             │
             │ 类型化、Schema 校验的 IPC / MessagePort
             ▼
Preload Bridge ↔ Electron Main ↔ Utility Process
                  │                 ├─ Agent Runtime
                  │                 ├─ Policy / Approval
                  │                 ├─ Music API Service
                  │                 ├─ MCP / Dynamic Skill / Shell
                  │                 └─ Profile / Memory / Audit
                  └─ Window / Session / Credential / Supervisor
```

- Main 只拥有窗口、登录 Session、凭据、应用生命周期、全局快捷键和 Utility Process 监督能力，不承载 Agent 主循环或音乐业务。
- Preload 只暴露按用例命名的最小化方法和订阅函数，不暴露完整 `ipcRenderer`、Node.js 或通用任意通道。
- Renderer 持有 Vue UI、Pinia 读模型和唯一 HTMLAudioElement / PlaybackCoordinator，不获取 Cookie、Shell、文件系统或 NeteaseCloudMusicApiEnhanced 实例。
- Renderer 是单页面应用，业务页面全部通过 Vue Router 切换；二级路由由统一 PageHeader 提供返回动作，无有效应用内历史时使用路由声明的稳定父级回退，不通过重载或新建窗口模拟导航。
- Utility Process 直接引入 NeteaseCloudMusicApiEnhanced 作为本地依赖，并承载 Agent、确定性权限、MCP、Skill、Shell 与业务存储。
- Agent 播放命令通过 PlayerCommandGateway 送到 Renderer 根层常驻处理器，并等待真实执行回执；不调用 Vue/Pinia 函数。

## 3. 源码组织

```text
src/
├─ main/                    # Electron Main 组合根与平台能力
├─ preload/                 # contextBridge 与受限 IPC 适配
├─ renderer/                # Vue SPA、Pinia、AudioHost、Design System
├─ utility/                 # Utility Process 组合根与任务监督
├─ domains/
│  ├─ player/               # 播放状态、队列、命令与纯算法
│  ├─ music/                # 歌曲/歌单用例、统一实体与 Service Port
│  ├─ agent/                # 主循环、Tool 协调与上下文规则
│  ├─ security/             # 动作分类、策略函数与审批状态机
│  ├─ memory/               # 会话块、摘要、Working Memory
│  └─ profile/              # 基础信息、画像与变化计分
├─ shared/
│  ├─ contracts/            # 跨进程 DTO、命令、事件与快照
│  ├─ schemas/              # 运行时 Schema 与协议版本
│  └─ errors/               # 稳定错误码和裁剪后错误
└─ infrastructure/
   ├─ electron/             # IPC、MessagePort、Window、Session 适配
   ├─ netease/              # NeteaseCloudMusicApiEnhanced Adapter
   ├─ persistence/          # SQLite、文件快照、迁移与仓储实现
   ├─ credentials/          # 平台 Credential Vault 适配
   ├─ media/                # HTMLAudioElement / Media Session 副作用适配
   └─ shell/                # PowerShell / zsh 执行适配

tools/
└─ api-lab/                 # API First 脚本、脱敏样本与字段分析，不打进生产包
```

首版只保留一个根 `package.json` 和锁文件。目录数量不决定安装体积；生产打包体积由实际包含的运行时代码、依赖、Chromium/Electron、资源和源码映射决定。

## 4. 强制依赖方向

1. `domains/**` 不导入 Electron、Vue、Pinia、DOM、SQLite Driver、HTTP Client 或 NeteaseCloudMusicApiEnhanced；领域层只描述实体、用例、Port 和纯规则。
2. `shared/**` 不导入任何进程入口或基础设施；跨进程数据必须可结构化克隆，不传函数、DOM 对象、数据库句柄或原始敏感凭据。
3. `renderer/**` 不导入 `main/**`、`utility/**`、`infrastructure/netease`、`infrastructure/credentials`、`infrastructure/persistence` 或 `infrastructure/shell`。
4. `preload/**` 只导入 `shared/contracts`、`shared/schemas` 和最小 Electron API，不编写业务流程。
5. `main/**` 不执行 Agent 主循环、音乐 API 用例或数据分析；它只组装平台级 Adapter 和进程通道。
6. `utility/**` 不导入 Vue、Pinia、DOM 或 Renderer 实现；播放控制只能通过共享 `PlayerCommand` 契约进入 Renderer。
7. `infrastructure/**` 实现领域 Port，由各进程组合根注入；领域层不反向依赖具体 Adapter。

以 ESLint `no-restricted-imports`、路径边界测试和 CI 架构检查强制上述规则，不仅依赖代码评审约定。

## 5. 组合根

- `main/bootstrap` 创建窗口、Session、Credential Vault、快捷键、IPC Gateway 和 Utility Supervisor。
- `utility/bootstrap` 创建 Music Service、Agent Runtime、Policy Engine、MCP/Skill/Shell Manager 和持久化 Adapter。
- `renderer/bootstrap` 创建 Vue App、Pinia、AudioHost、PlayerCommandBridge 和只读快照订阅。
- `preload/index` 只完成通道包装、参数 Schema 校验和回调事件裁剪。

组合根之外禁止随意读取全局单例。需要全局寿命的对象由组合根创建一次，再显式注入使用方。

## 6. 未来拆分 workspace 的触发条件

只在至少出现一项明确需求时拆分内部 package：

- 某模块需要独立发布、独立版本或被第二个应用复用。
- 需要可独立缓存的构建/测试单元，且能显著改善 CI 时间。
- 依赖或运行时目标真正冲突，无法在单包内通过进程构建入口解决。
- 安全或供应链边界要求独立审计、签名或发布。

代码行数、目录数量或“看起来更专业”不是拆包理由。

## 7. 待续架构决策

1. A-003：构建、开发和打包工具链。
2. A-004：跨进程契约、Schema 版本和 MessagePort 重连。
3. A-005：SQLite、文件快照、Credential Vault 与账户数据边界。
4. A-006：手写 Agent Runtime 状态机、工具调度和任务限额。
5. A-007：Policy Engine、审批挂起/恢复和安全动作分类。
6. A-008：Dynamic Skill 隔离、MCP 生命周期与 Shell 执行边界。
7. A-009：记忆、画像和模型输入的存储/隐私架构。
8. A-010：ASR 技术路线、快捷键与语音任务生命周期。
