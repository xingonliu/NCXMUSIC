# Prompt 31：Phase 5 核心 Tools 与实体解析

执行通用协议，只完成只读搜索、播放控制和消歧主链路。

## 必读

- Agent Runtime、IPC Protocol、Player Domain。
- API Inventory、参数血缘和标准实体相关报告。
- 功能清单 TOL-001～007、AGT-005/008/013/014、PLY-022。

## 任务

建立 Tool Registry、Schema、Scheduler、冲突域和结构化结果。先实现智能搜索/获取候选、当前上下文实体解析、搜索结果实体解析和 PlayerCommandGateway；播放命令必须等待 Renderer PlaybackCoordinator 的真实回执。

实体 ID 只能来自标准实体、当前播放、页面上下文或 Tool 结果，不能让模型猜。唯一/明显领先可直接解析，候选接近时产出等待 SelectionCard 的结构化需求，本任务暂不实现卡片。

## 验收

小云可完成搜索并播放、暂停、切歌、调音量和集合播放；并行只读最多 4 个，播放副作用串行；轻提示明确来自小云。输出 Checkpoint 后停止。
