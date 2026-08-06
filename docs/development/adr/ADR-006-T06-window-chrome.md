# ADR-006：WindowChrome 平台参数与原生交通灯

- 状态：Accepted；Windows 自绘控制保持不变，macOS 改为保留原生交通灯的隐藏标题栏配置
- 日期：2026-08-06
- 对应 Spike：T-06

## 背景

T-06 要验证 Windows 自绘窗口按钮和 macOS 原生交通灯能共用同一上层窗口状态契约。Windows 当前窗口控制已经可用，风险点集中在 macOS：如果主窗口全平台使用 `frame: false`，即使同时传入 `titleBarStyle: 'hidden'` 和 `trafficLightPosition`，也可能偏离“隐藏标题栏但保留系统交通灯”的设计目标。

## 决策

1. **按平台生成 BrowserWindow 参数。** Windows 继续使用 `frame: false` 支持 Renderer 自绘最小化、最大化/还原和关闭按钮；macOS 不再设置 `frame: false`，只设置 `titleBarStyle: 'hidden'` 与固定 `trafficLightPosition`。
2. **WindowSnapshot 保持单一契约。** Main 仍发布 `platform`、`maximized`、`fullscreen` 和 `focused`，Renderer 由真实窗口事件驱动视觉，不在本地猜测最大化状态。
3. **macOS 不绘制仿制交通灯。** Renderer 只保留 `ncx-traffic-safe-area` 安全区，点击、Hover、Option 点击、全屏语义和可访问性都交给系统按钮。
4. **自动化先锁参数，不伪造真机视觉。** WindowChrome 验证脚本校验 macOS/Windows 参数分支和窗口快照形状；macOS 真机交通灯位置、全屏显隐和高缩放视觉仍需要在 macOS 设备或 CI 产物上执行。

## 结果

- 主窗口参数抽到 `src/main/window-chrome.ts`，便于无 Electron GUI 环境下测试平台分支。
- `tests/unit/window-chrome.test.ts` 确认 macOS 没有 `frame: false`，且保留 `titleBarStyle: 'hidden'` 与 `{ x: 24, y: 24 }` 交通灯位置；Windows 分支仍保持 `frame: false`。
- CI 质量矩阵新增 `node scripts/run-window-chrome-spike.mjs`，会在 Windows 与 macOS runners 上持续执行参数契约验证。

## 未关闭项

macOS 真实交通灯 Hover、Option 点击、全屏进入/退出、100%～200% 缩放、多显示器位置和降低透明度视觉仍需在真实 macOS 桌面环境记录；本次不新增窗口降级实现，也不重做 Windows 已可用的自绘窗口控制。
