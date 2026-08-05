# Prompt 12：Phase 1 AppShell 与统一布局

执行通用协议，只完成应用外壳、路由和布局契约。

## 必读

- 系统架构、WindowChrome、IPC Protocol。
- Design System 的 PageHeader、WindowChrome 和布局章节。
- 功能清单 APP-001～010、PLT-002～008。

## 任务

实现 Vue Router、根层 AppShell、常驻 AudioHost 占位宿主、RouterView、左侧上中下导航骨架、PlayerSafeArea、PageShell、统一 PageHeader 返回语义、Section Contract/Registry 和路由 `playerBar` 元数据。当前只使用假数据展示结构，不创建最终页面 Section 清单。

把 T-06 WindowChrome 正式接入：macOS 原生交通灯、Windows 合并按钮、drag/no-drag、全屏 Hover Glass、紧凑阈值和不透明回退。实现 Renderer 重载后的连接握手与 Utility Snapshot 恢复入口。

## 禁止与验收

不实现真实音乐数据、播放器 UI、小云或完整业务页面。两平台窗口行为、路由回退、键盘导航、PlayerBar 占位可见性和紧凑布局通过组件/E2E。输出 Checkpoint 后停止。
