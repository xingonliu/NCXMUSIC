# Prompt 11：Phase 1 Design System

执行通用协议，只完成 Design System 基础，不装配业务页面。

## 必读

- `docs/design/NcxMusic-Design-System.md`。
- `docs/architecture/NcxMusic-Window-Chrome.md`。
- 功能清单 UI-001～016、PLT-002～008。

## 任务

实现颜色、间距、圆角、阴影、描边、模糊、字体、动效、尺寸和层级 Token。把 Reka UI 严格封装在指定 Primitive 边界；建立 `@lucide/vue` Icon Registry。

按文档实现 Button、IconButton、Input、表单基础、Tooltip、Menu、ContextMenu、Toast、Dialog、AlertDialog、Drawer、Popover、ScrollArea、Skeleton、Loading/Empty/Error/Retry。实现亮暗主题、跟随系统、减少动画和透明度降级。

建立不进入生产导航的 UI Lab，覆盖状态、尺寸、键盘、长中文、紧凑窗口、高 DPI 和失败情形。

## 验收

业务示例只能从 Design System 公共入口导入，不能直接导入 Reka UI 或写任意颜色/Z-Index。组件测试、可访问性基础和视觉截图通过。输出 Checkpoint 后停止。
