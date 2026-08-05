# Prompt 09：Phase 0 收口门禁

执行通用协议。本任务只审计和收口 Phase 0，不新增业务功能。

## 必读

- `NcxMusic-Technical-Spike-Plan.md` 全文。
- Prompt 01～08 的全部 Checkpoint、ADR、测试和实现。
- 系统架构及被 Spike 修改过的专题架构文档。

## 任务

逐项复跑 T-01～T-08 的可自动化验证，核对真实代码、打包产物、依赖版本、双平台证据与 Checkpoint。清除失败实验进入生产入口的残留，修正文档与实现漂移，但不得顺手进入 Phase 1。

T-01、T-02、T-03、T-05、T-06 必须为 `pass`；T-04、T-07、T-08 必须为 `pass` 或已有符合冻结产品约束的 fallback。任何硬门禁未满足则本 Gate 为 `block`。

## 交付

生成 Phase 0 总结 ADR、依赖版本清单、双平台验证矩阵和 `09-phase0-gate.md`。只有真实达到 `Foundation Ready` 才标记 `pass` 并解锁 Prompt 10。提交推送后停止。
