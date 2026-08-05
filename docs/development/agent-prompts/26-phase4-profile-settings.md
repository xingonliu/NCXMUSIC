# Prompt 26：Phase 4 个人信息与基础设置

执行通用协议，只完成当前音乐客户端已有能力对应的个人信息和设置。

## 必读

- Design System、Storage Architecture。
- 功能清单 MUS-010、SET-001/005/009～011、APP-008/010。
- `ncm.user_detail`、`ncm.user_account` 和相关公开资料 Endpoint 报告。

## 任务

先记录页面 Section 装配。实现正式账号个人信息页，只展示 API 明确字段；缺失性别/年龄保持未知。游客个人信息入口不可用。实现网易云账户、音质、关闭窗口、外观、存储与隐私基础、关于页；不实现尚未进入阶段的模型、小云、语音、Skill、MCP 设置。

设置页面隐藏通用 PlayerBar，配置必须 Schema 校验、持久化并有安全默认值。关于页无 updater，只提供版本、许可证占位和仓库入口。

## 验收

游客/登录、主题跟随、关闭行为、音质持久化、账户删除和路由可见性通过。输出 Checkpoint 后停止。
