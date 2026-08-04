# 07-MULTIVARIABLE-DIFF（Phase 0）

runId：`RUN-2026-08-04-P0-PROVISIONAL`

Phase 0 无运行样本，无多变量差异可比。自 Phase 1 起每完成一个接口写入该接口报告 §8，本文件在 Phase 15 汇总。

## 2. Phase 1 多变量差异（RUN-2026-08-04-P0-PROVISIONAL）

| 接口 | 维度 | 结论 | 证据 |
| --- | --- | --- | --- |
| login_status / user_account | AUTH_NONE vs AUTH_INVALID | **无结构差异**：无效/截断 Cookie 静默回退未登录，无失效错误码 | `{"code":200,"account":null,"profile":null}` 三态一致 |
| login_status | AUTH_NONE vs AUTH_ANON | 未执行：游客会话被风控（blocked_by_prerequisite） | register_anonimous 400 |
| register_anonimous | 重复注册 | 风控：连续 400（首日多次注册触发） | 3× code 400 |
| logout | 未登录/无效 Cookie | 均返回 code 200（无会话也成功） | `{"code":200}` |
| login_qr_key | 重复调用 | unikey 每次轮换（UUID） | 2 样本不同值 |
| user_detail | 缺失必填 uid | code 400 参数错误 | `{"code":400,"message":"参数错误"}` |
## 2. Phase 1 多变量差异（RUN-2026-08-04-P0-PROVISIONAL）

| 接口 | 维度 | 结论 | 证据 |
| --- | --- | --- | --- |
| login_status / user_account | AUTH_NONE vs AUTH_INVALID | **无结构差异**：无效/截断 Cookie 静默回退未登录，无失效错误码 | `{"code":200,"account":null,"profile":null}` 三态一致 |
| login_status | AUTH_NONE vs AUTH_ANON | 未执行：游客会话被风控（blocked_by_prerequisite） | register_anonimous 400 |
| register_anonimous | 重复注册 | 风控：连续 400（首日多次注册触发） | 3× code 400 |
| logout | 未登录/无效 Cookie | 均返回 code 200（无会话也成功） | `{"code":200}` |
| login_qr_key | 重复调用 | unikey 每次轮换（UUID） | 2 样本不同值 |
| user_detail | 缺失必填 uid | code 400 参数错误 | `{"code":400,"message":"参数错误"}` |
## 2. Phase 1 多变量差异（RUN-2026-08-04-P0-PROVISIONAL）

| 接口 | 维度 | 结论 | 证据 |
| --- | --- | --- | --- |
| login_status / user_account | AUTH_NONE vs AUTH_INVALID | **无结构差异**：无效/截断 Cookie 静默回退未登录，无失效错误码 | `{"code":200,"account":null,"profile":null}` 三态一致 |
| login_status | AUTH_NONE vs AUTH_ANON | 未执行：游客会话被风控（blocked_by_prerequisite） | register_anonimous 400 |
| register_anonimous | 重复注册 | 风控：连续 400（首日多次注册触发） | 3× code 400 |
| logout | 未登录/无效 Cookie | 均返回 code 200（无会话也成功） | `{"code":200}` |
| login_qr_key | 重复调用 | unikey 每次轮换（UUID） | 2 样本不同值 |
| user_detail | 缺失必填 uid | code 400 参数错误 | `{"code":400,"message":"参数错误"}` |
## 2. Phase 1 多变量差异（RUN-2026-08-04-P0-PROVISIONAL）

| 接口 | 维度 | 结论 | 证据 |
| --- | --- | --- | --- |
| login_status / user_account | AUTH_NONE vs AUTH_INVALID | **无结构差异**：无效/截断 Cookie 静默回退未登录，无失效错误码 | `{"code":200,"account":null,"profile":null}` 三态一致 |
| login_status | AUTH_NONE vs AUTH_ANON | 未执行：游客会话被风控（blocked_by_prerequisite） | register_anonimous 400 |
| register_anonimous | 重复注册 | 风控：连续 400（首日多次注册触发） | 3× code 400 |
| logout | 未登录/无效 Cookie | 均返回 code 200（无会话也成功） | `{"code":200}` |
| login_qr_key | 重复调用 | unikey 每次轮换（UUID） | 2 样本不同值 |
| user_detail | 缺失必填 uid | code 400 参数错误 | `{"code":400,"message":"参数错误"}` |
## 2. Phase 1 多变量差异（RUN-2026-08-04-P0-PROVISIONAL）

| 接口 | 维度 | 结论 | 证据 |
| --- | --- | --- | --- |
| login_status / user_account | AUTH_NONE vs AUTH_INVALID | **无结构差异**：无效/截断 Cookie 静默回退未登录，无失效错误码 | `{"code":200,"account":null,"profile":null}` 三态一致 |
| login_status | AUTH_NONE vs AUTH_ANON | 未执行：游客会话被风控（blocked_by_prerequisite） | register_anonimous 400 |
| register_anonimous | 重复注册 | 风控：连续 400（首日多次注册触发） | 3× code 400 |
| logout | 未登录/无效 Cookie | 均返回 code 200（无会话也成功） | `{"code":200}` |
| login_qr_key | 重复调用 | unikey 每次轮换（UUID） | 2 样本不同值 |
| user_detail | 缺失必填 uid | code 400 参数错误 | `{"code":400,"message":"参数错误"}` |