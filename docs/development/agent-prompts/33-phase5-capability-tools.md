# Prompt 33：Phase 5 写操作与全 API 能力工具

执行通用协议，只补齐首版小云音乐 Tool 能力。

## 必读

- Agent Runtime、API Playbook。
- `01-api-inventory.json`、`09-capability-candidates.md`、全部被注册能力的 Endpoint 报告。
- 功能清单 TOL-001～006、MUS-008～012、SEC-009/011。

## 任务

完成 10 个核心业务 Tool，覆盖搜索播放、播放器、歌单、收藏/喜欢、评论、歌手探索、账户辅助、画像/记忆入口。实现 `find_music_api_capabilities` 和只接受能力 ID + 类型化参数的 `call_music_api`；禁止任意 path 转发。

把全部已审计且非支付 API 登记为只读/写入/风险/登录态明确的 Capability；blocked/failed/deprecated 只能作为不可用事实，不伪装可调用。写操作和低频能力必须经过 PolicyGateway、实体解析、幂等与真实错误归一化。

## 验收

收藏、取消、歌单操作、评论、签到、拒绝、登录不足、API blocked 和冷门能力检索 E2E 通过。支付能力不存在于 Registry、Prompt 和 UI。输出 Checkpoint 后停止。
