# Prompt 16：Phase 2 Music Service 与 API-A

执行通用协议，只建设只读 Music Service 和标准实体层。

## 必读

- 系统架构、IPC Protocol、存储架构。
- API Playbook、`01-api-inventory.json`、`03-parameter-lineage.json`、`04-field-dictionary.json`。
- 当前任务涉及的 song、artist、album、playlist、user 生产者 Endpoint 报告。
- 功能清单 DAT-001、DAT-005～007。

## 任务

在 Utility 内嵌锁定版本的 NeteaseCloudMusicApiEnhanced，建立类型化 Music Gateway、请求取消、超时、错误归一化、缓存入口和账户 generation。实现 song/artist/album/playlist/user 标准实体、来源/新鲜度字段合并和全局实体池；上游原始响应只能停留在 Adapter。

先覆盖账户、歌曲、歌手、专辑、歌单的 API-A 只读能力，不做播放 URL、写操作或通用 Gateway。为所有标准实体建立契约样本和字段未知处理。

## 验收

Renderer 只读取标准实体；相同实体重复字段按确定性规则合并；超时/取消/登录态/缓存命中有测试。输出 Checkpoint 后停止。
