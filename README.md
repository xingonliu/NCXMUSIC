# Ncxmusic

Ncxmusic 是一个基于 Electron、Vue 3 和 TypeScript 的 Agent 原生桌面音乐客户端。项目目前已经具备网易云音乐账户、发现与资料库浏览、播放队列、沉浸播放、逐字歌词、系统媒体控制，以及 Agent、MCP、Skill、语音和安全设置等基础能力。

## 当前体验

- 沉浸播放页使用封面颜色驱动的流体网格动态背景，背景算法与空间氛围参考 Apple Music，并由 Ncxmusic 使用 PixiJS 独立实现。
- 歌词获取和 LRC/YRC 解析由 Ncxmusic 自己负责；逐字扫光、音节运动、当前行突出、弹簧滚动、间奏、背景声、双声部及长歌词视口管理参考 [Apple Music-like Lyrics（AMLL）](https://github.com/amll-dev/applemusic-like-lyrics) 的歌词视觉与动效实现。
- AMLL 歌词引擎以源码形式内置，不依赖其 Vue/React 组件；来源、固定提交、改写边界和许可证记录在 [歌词引擎上游说明](src/renderer/features/music/lyrics-engine/UPSTREAM.md) 中。
- 设置页提供面向普通用户的歌词翻译、当前歌词位置、动效强度、字号、字重和已唱歌词显示选项。
- 界面支持简体中文与英语即时切换并持久保存偏好；页面、组件、Toast、空状态和跨进程错误均纳入同一国际化覆盖审计，歌名、歌词、评论等外部内容保持原文。
- 全部可见圆角统一使用 60% 连续曲率 Squircle，并收敛到七级尺寸阶梯；实现与使用约束见 [Squircle 形状规范](docs/development/Squircle-Design-System.md)。
- 语音输入支持按需下载的本地 Zipformer/SenseVoice INT8、独立 OpenAI Transcriptions 兼容服务和当前对话模型三种来源；模型体积、内存预算、流式语义与多屏胶囊说明见 [语音识别架构](docs/development/Voice-Recognition.md)。

## 环境

- Node.js 22.22.x
- pnpm 11.20.0
- Windows 或 macOS

```powershell
pnpm install --frozen-lockfile
pnpm electron:install
pnpm dev
```

## 标准命令

| 命令 | 用途 |
| --- | --- |
| `pnpm electron:install` | 按当前平台和架构下载 Electron 运行时（二进制不再由 Electron 43 的安装脚本下载） |
| `pnpm dev` | 启动 Main、Preload、Renderer 与 Utility Process 开发环境 |
| `pnpm typecheck` | 检查 Node/Electron 与 Vue 两套 TypeScript 入口 |
| `pnpm i18n:audit` | 检查 Renderer 中尚未登记英语翻译的界面文案 |
| `pnpm lint` | 检查代码、样式和架构依赖边界 |
| `pnpm test` | 运行单元、契约和架构测试 |
| `pnpm test:e2e` | 运行 Playwright 端到端测试 |
| `pnpm build` | 生成 `out/` 生产构建 |
| `pnpm package` | 为当前平台生成未发布安装包 |

Windows 安装包使用引导式安装并允许更改安装目录；安装包、卸载器、快捷方式、任务栏重启入口与系统安装记录统一使用 `Ncxmusic` 名称和 `build/icon.ico` 图标。生成后应从 `release/Ncxmusic Setup <version>.exe` 安装验证，不要复用旧版本安装包。

## 源码结构

```text
src/
├─ main/             Electron Main 组合根与平台生命周期
├─ preload/          最小化 contextBridge
├─ renderer/         Vue SPA、Router 与 Design System
├─ utility/          Agent、Music Service 等本地运行时组合根
├─ input-hook/       全局按住说话的独立 Host 边界
├─ local-asr/        sherpa-onnx 本地识别独立进程
├─ domains/          纯领域规则与 Port
├─ shared/           跨进程契约、Schema 与安全错误
└─ infrastructure/   Electron、存储、网易云及外部能力适配

tests/
├─ unit/
├─ contract/
├─ component/
├─ integration/
├─ e2e/
└─ architecture/
```

产品、设计和架构约束以 `docs/` 下的非 API 基线文档为准；`docs/api/` 与 `scripts/api-audit/` 保持独立。第三方及衍生源码继续遵循各目录内记录的许可证与署名要求。
