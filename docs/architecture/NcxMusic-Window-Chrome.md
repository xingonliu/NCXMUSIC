# NcxMusic 双平台 WindowChrome 架构

> 文档状态：Baseline 0.1
> 建立日期：2026-08-05
> 适用平台：Windows、macOS
> 参考原型：`D:\临时文件夹-xx\windows`、`D:\临时文件夹-xx\MacOS`

## 1. 决策

两个原型的视觉布局可以沿用，但窗口按钮不能沿用原型中只切换 CSS 状态的模拟逻辑。首版采用两套平台实现、同一套上层窗口状态契约：

- macOS：隐藏普通标题栏，使用系统原生交通灯并调整位置，不绘制 DOM 仿制按钮。
- Windows：在 Header 最右侧绘制合并的最小化、最大化/还原、关闭按钮组，经 Preload 类型化 IPC 调用 Main 中的 BrowserWindow。
- 普通和最大化状态保持窗口控件可见；全屏隐藏，指针 Hover 顶部感应区后通过渐变模糊与 Liquid Glass 临时显示。

这不是视觉不一致：两端共享 Header 高度、命中区、颜色、玻璃材质和状态反馈，但尊重 macOS 交通灯的系统行为，并在 Windows 保留产品所需的合并按钮造型。

## 2. macOS

BrowserWindow 使用 `titleBarStyle: 'hidden'` 保留原生窗口控制按钮，由创建参数 `trafficLightPosition` 或窗口就绪后的 `setWindowButtonPosition()` 对齐左侧导航顶区。位置值由双平台 UI Lab 在 100%、125%、150%、200% 缩放和普通/最大化/全屏状态下实测冻结。

Renderer 不接管交通灯的点击、Hover、辅助功能、窗口缩放或全屏语义。进入全屏时通过 `setWindowButtonVisibility(false)` 隐藏；顶部感应区触发时临时显示，离开后再次隐藏。普通状态始终显示。

原生交通灯所在区域不得覆盖拖动热区、导航按钮或可点击内容。导航布局必须预留按钮安全区，不能依赖透明元素拦截系统按钮。

## 3. Windows

Windows 不使用 `titleBarOverlay`，因为原生 Caption Buttons 的外观和布局无法满足当前合并按钮原型。Renderer 提供 `WindowControlGroup`：

| 按钮 | Renderer 命令 | Main 行为 |
| --- | --- | --- |
| 最小化 | `window.minimize` | `win.minimize()` |
| 最大化/还原 | `window.toggleMaximize` | 根据真实窗口状态调用 `win.maximize()` 或 `win.unmaximize()` |
| 关闭 | `window.requestClose` | 按“关闭窗口”设置隐藏主窗口并驻留系统托盘，或退出应用 |

中间按钮表示最大化/还原，不表示应用全屏。图标由 Main 推送的窗口快照驱动，不允许 Renderer 只切换本地 CSS 类猜测窗口状态。

自绘最大化按钮无法可靠提供 Windows 11 原生 Snap Layout Hover 面板。首版明确不仿制该系统 UI，也不调用私有 API；必须保留 `Win+Z`、拖拽窗口贴边和系统快捷键。若未来将 Hover Snap Layout 设为硬性需求，应切换到 Electron `titleBarOverlay` 并重新设计右侧 WindowChrome，而不是叠加第二套隐藏按钮。

## 4. 类型化桥接

Preload 只公开窗口领域命令和只读状态订阅：

```ts
type WindowCommand =
  | { type: 'window.minimize' }
  | { type: 'window.toggleMaximize' }
  | { type: 'window.requestClose' }
  | { type: 'window.toggleFullscreen' }

interface WindowSnapshot {
  platform: 'win32' | 'darwin'
  maximized: boolean
  fullscreen: boolean
  focused: boolean
}
```

每个命令使用固定 IPC Channel、Zod Schema 和显式返回结果。Renderer 不获得通用 `ipcRenderer.send`、BrowserWindow、`webContents` 或任意 Channel 调用能力。

Main 监听 maximize、unmaximize、enter-full-screen、leave-full-screen、focus、blur 等窗口事件并发布新快照。Renderer 重载后主动请求完整快照，不依赖丢失的增量事件恢复状态。

## 5. Drag Region 与布局

- WindowChrome 使用显式 `app-region: drag`；按钮、输入框、链接、菜单触发器及全部交互控件使用 `app-region: no-drag`。
- 双击可拖动 Header 区域遵循平台最大化/还原行为；交互控件区域不触发窗口拖动。
- Windows Header 右侧永久预留 WindowControlGroup 宽度，页面标题、搜索框和 Header Actions 不得进入该区域。
- macOS 左侧永久预留交通灯安全区；侧栏折叠不能移动或遮挡交通灯。
- 最大化与还原必须监听系统真实状态，包括快捷键、拖拽贴边和外部窗口管理器造成的变化。

## 6. Liquid Glass 与降级

WindowControlGroup、Header 浮动按钮和全屏顶部显现层使用统一 `glass-regular` 材质：半透明主题 Surface、背景模糊、细描边、顶部高光与轻阴影。关闭按钮 Hover 使用独立 Danger 语义；品牌红只表达主操作与选中态，不能代替危险语义。

玻璃效果不可用、GPU 降级、系统启用降低透明度或背景对比度不足时，回退到不透明 `surface-overlay`。回退只改变材质，不改变尺寸、命中区、层级、键盘操作或可访问名称。

## 7. 验收矩阵

至少覆盖：

- Windows 10、Windows 11；macOS 当前支持的最低版本与最新稳定版本。
- 100%、125%、150%、200% 显示缩放，多显示器和主屏切换。
- 普通、最大化、还原、全屏、退出全屏、最小化、失焦和重新聚焦。
- “关闭窗口 → 驻留系统托盘并继续播放”与“关闭窗口 → 退出应用”两种设置；前者不得让窗口继续占用任务栏。
- 托盘单击与“显示主窗口”、二次启动及 macOS 激活均恢复并聚焦现有主窗口；托盘“退出应用”进入完整退出流程。
- Windows `Win+Z`、拖拽贴边；macOS 原生交通灯 Hover、Option 点击和全屏行为。
- Header 拖动、双击、所有 no-drag 控件、键盘 Focus、可访问名称和减少动画/透明度降级。

任一按钮都必须等待 Main 的真实窗口状态事件后更新视觉，不以动画结束或本地点击作为成功依据。
