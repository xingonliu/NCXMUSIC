# Prompt 44：Phase 8 双平台打包、签名与安装

执行通用协议，只完成正式构建与安装链路。

## 必读

- Roadmap Phase 8、系统架构工具链、WindowChrome。
- 技术 Spike 的版本与双平台报告。
- 功能清单 PLT-001～010、SET-011。

## 任务

完善 electron-builder 生产配置、文件白名单、依赖裁剪、Windows NSIS、macOS DMG/ZIP、架构目标、原生模块 rebuild、图标/元数据和 CI Artifact。实现签名、公证、Gatekeeper 验证的 Secret 注入与无凭据本地 fallback。

在干净 Windows/macOS 环境执行安装、首次启动、升级覆盖、卸载、后台播放、原生模块、WindowChrome、登录 Session 和扩展进程 Smoke。首版不引入 updater。

## 验收

记录安装包哈希、体积、系统版本、签名/公证状态和 Smoke 结果。任一首版平台不能安装运行则 `block`。输出 Checkpoint 后停止。
