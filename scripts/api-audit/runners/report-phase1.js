'use strict'
const path = require('path')
const { runPhaseReport } = require('../lib/phase-report.js')

const args = require('../lib/args.js')({
  rawDir: { type: 'string', required: true },
  runId: { type: 'string', required: true },
  reportDir: { type: 'string', required: true },
  packageVersion: { type: 'string', required: true },
  sessionDir: { type: 'string' },
  agentName: { type: 'string', default: 'opencode (DeepSeek 审计 Agent)' },
})

const STATUS = {
  'ncm.inner_version': { status: 'passed', blocker: null },
  'ncm.register_anonimous': { status: 'rate_limited', blocker: '匿名注册风控：成功路径已验证 1 次后被连续 code 400，退避后仍失败' },
  'ncm.register_xeapikey': { status: 'failed_stable', blocker: 'XEAPI-001：模块要求解密负载含 sk，服务器返回 publicKey/version/nextUpdateTime；xeapiSignKey 静态密钥回退引导可用' },
  'ncm.login_status': { status: 'partial', blocker: 'AUTH_ANON/USER 层缺样本；无参数接口无法满足每层 3 个有差异样本' },
  'ncm.user_account': { status: 'partial', blocker: 'AUTH_USER 缺失；uid 生产路径阻塞' },
  'ncm.user_detail': { status: 'partial', blocker: '缺 uid（需 AUTH_USER）；仅缺失必填负向' },
  'ncm.logout': { status: 'partial', blocker: 'AUTH_USER 缺失；仅未登录/无效 Cookie 负向' },
  'ncm.login_qr_key': { status: 'partial', blocker: '未完成扫码流程与更多登录层；unikey 一次性凭据仅本地保留' },
}

const FINDINGS = [
  ['register_xeapikey / XEAPI-001', '契约冲突', '服务器解密负载 {publicKey,version,nextUpdateTime} 无 sk，模块 100% 抛错；sk=xeapiSignKey 静态常量回退引导实测可用（inferred）', 'register_xeapikey.none.min.00{1,2,3}'],
  ['register_anonimous', '风控', '多次注册触发上游风控 code 400（无消息），退避 45s 仍失败；冷却后恢复', 'register_anonimous.none.*'],
  ['login_status / user_account', '无效 Cookie', 'AUTH_INVALID（截断/过期）与 AUTH_NONE 响应完全一致：{"code":200,"account":null,"profile":null}，无失效错误，静默回退未登录', 'login_status.inv.* / user_account.inv.*'],
  ['logout', '未登录', '无会话也返回 code 200（不报错）', 'logout.none.neg.001'],
  ['user_detail', '缺失必填', '缺 uid → {"code":400,"message":"参数错误"}', 'user_detail.none.neg.missing-uid.001'],
  ['login_qr_key', '轮换', 'unikey 每次调用轮换（UUID）；unikey 已入脱敏名单', 'login_qr_key.none.min.00{1,2}'],
]

runPhaseReport({
  phase: 1,
  specPath: path.join(__dirname, 'specs', 'phase1.json'),
  statusMap: STATUS,
  findings: FINDINGS,
  sectionNumbers: { manifest: 11, coverage: 10, failures: 4, diff: 2 },
  rawDir: path.join(args.rawDir, 'raw'),
  poolPath: path.join(args.rawDir, '03-fixture-pool.json'),
  runId: args.runId,
  reportDir: args.reportDir,
  packageVersion: args.packageVersion,
  sessionDir: args.sessionDir,
  agentName: args.agentName,
})
