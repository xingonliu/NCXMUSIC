# Prompt 06：T-06 WindowChrome 与视觉材质

执行通用协议，只完成 Phase 0 T-06。

## 必读

- 技术验证计划 T-06。
- `docs/architecture/NcxMusic-Window-Chrome.md`。
- `docs/design/NcxMusic-Design-System.md` 中 WindowChrome、Token、Glass 与降级规则。

## 任务

建立独立窗口 Spike：macOS 使用隐藏标题栏下的原生交通灯；Windows 使用 Header 右侧自绘合并按钮和受限 Preload IPC。验证最小化、最大化/还原、关闭、拖动、双击、全屏隐藏、顶部 Hover 渐变模糊显示、亮暗主题、高 DPI、GPU 降级和系统降低透明度。

只实现验证所需 Token 和控件，不建设完整 AppShell 或业务页面。Windows 不仿制 Snap Layout Hover 面板，但必须保留 `Win+Z` 和贴边。

## 验收

两平台开发和打包构建都通过窗口行为矩阵；透明度不可用时回退 Surface。输出截图/环境记录、ADR 和 Checkpoint，然后停止。
