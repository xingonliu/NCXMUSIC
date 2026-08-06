# T-06 WindowChrome 与视觉材质验证报告

- 执行日期：2026-08-06
- 当前结论：`provisional-pass`；Windows 自绘窗口控制保持可用，macOS 原生交通灯参数已修正并加入自动化，macOS 真机视觉仍待设备验证
- 基线提交：本任务完成提交
- 关联架构：`docs/architecture/NcxMusic-Window-Chrome.md`

## 验证环境

| 项目 | 值 |
| --- | --- |
| 本地系统 | Windows 11 Pro 10.0.26200.8875 |
| Node.js | 22.22.2 |
| pnpm | 11.20.0 |
| Electron | 43.3.0 |
| electron-vite | 5.0.0 |

## 实现范围

- `src/main/window-chrome.ts`：集中生成主窗口参数，Windows 使用 `frame: false`，macOS 使用 `titleBarStyle: 'hidden'` 与 `trafficLightPosition`，并导出窗口快照读取函数。
- `src/main/index.ts`：主窗口创建改为复用平台参数函数，不改变现有 Windows 自绘按钮命令和状态发布逻辑。
- `tests/unit/window-chrome.test.ts`：覆盖 macOS 原生交通灯参数、Windows frameless 参数和 `WindowSnapshot` 只读状态形状。
- `scripts/run-window-chrome-spike.mjs` / `.github/workflows/quality.yml`：新增 WindowChrome 验证脚本并接入双平台 CI。

## 本地自动化结果

| 门禁 | 结果 |
| --- | --- |
| `node scripts/run-window-chrome-spike.mjs` | pass；WindowChrome 目标类型检查与单元测试通过 |
| `pnpm typecheck` | pass |
| `pnpm lint` | pass；Architecture boundaries OK |
| `pnpm test` | pass；23 files / 222 tests |

## 已验证的 T-06 条件

| 通过条件 | 状态 | 证据 |
| --- | --- | --- |
| Windows 自绘控制不被重写 | pass | Windows 分支仍为 `frame: false`；现有 Renderer `WindowControlGroup`、IPC 命令和快照发布未改动 |
| macOS 使用原生交通灯配置 | pass（参数层） | macOS 分支不再设置 `frame: false`，只设置 `titleBarStyle: 'hidden'` 和 `{ x: 24, y: 24 }` |
| Renderer 不仿制 macOS 交通灯 | pass | AppShell 仅在 macOS 显示安全区，窗口按钮组仍只在 Windows 渲染 |
| 最大化/全屏/焦点状态来源 | pass | `WindowSnapshot` 仍由 Main 的 BrowserWindow 事件发布，Renderer 不本地猜测 |
| CI 双平台持续验证 | pass（契约层） | `quality.yml` 在 Windows/macOS runners 执行 WindowChrome 验证脚本 |

## 尚未验证的 T-06 条件

1. macOS 真机原生交通灯 Hover、Option 点击、全屏进入/退出后的隐藏与恢复。
2. macOS 100%、125%、150%、200% 缩放、多显示器切换和左侧导航安全区像素对齐。
3. Windows 10/11 上 `Win+Z`、拖拽贴边和高缩放视觉需要继续由人工矩阵确认；当前未重做已可用的 Windows 控制。
4. Liquid Glass 在降低透明度、GPU 禁用和高对比度下的完整视觉截图矩阵未在本机补跑；本次按用户要求不新增窗口降级实现。

## 关联决策

见 [ADR-006：WindowChrome 平台参数与原生交通灯](../adr/ADR-006-T06-window-chrome.md)。
