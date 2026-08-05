# Prompt 45：Phase 8 性能、稳定性与无障碍硬化

执行通用协议，只做全功能质量硬化，不新增功能。

## 必读

- Roadmap 测试分层和 Phase 8。
- Design System、Player Domain、Agent Runtime、Voice、Shell。
- 全部 Phase Gate Checkpoint。

## 任务

定义并测量冷启动、常驻内存、CPU、长列表、封面缓存、Glass、播放、歌词、Agent 长输出、数据库、Shell/MCP 子进程和后台播放预算。修复泄漏、阻塞、竞态、无界缓存与崩溃恢复问题。

完成键盘导航、Focus Visible、对比度、ARIA、减少动画/透明度、缩放、高 DPI、中文长文案和紧凑窗口回归。执行长时间播放、快速切歌、网络抖动、Utility/Renderer 重启和磁盘不足故障注入。

## 验收

所有预算和回归有可重复命令/报告；不能达标的项目必须有产品允许的降级。输出 Checkpoint 后停止。
