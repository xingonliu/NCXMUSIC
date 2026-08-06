import { writeFile } from 'node:fs/promises'

// ─────────────────────────────────────────────────────────────────────────────
// 安全边界说明（必读）
//
// 本模块是整个代码库中唯一把网易云凭据以明文写入磁盘的位置，属于 ADR-002
// 「Cookie Store 是唯一持久来源」的**显式开发期例外**，仅用于 T-03 真实媒体
// 链路验证。约束如下，任何一条被破坏都必须立即移除本模块：
//
// 1. 只在 NCX_T03_SPIKE=1 时可被调用；生产代码路径不得导入本模块。
// 2. 目标文件固定为 .env.t03.local，已被 .gitignore 的 `.env.*` 规则排除，
//    并由 scripts/verify-auth-boundaries.mjs 主动扫描确认未进入版本库。
// 3. 写入的 MUSIC_U 是长期有效会话令牌，等价于账号访问权。验证完成后应执行
//    `pnpm t03:purge` 删除该文件并在网易云端退出该测试账号。
// 4. 不得被 Renderer、Preload、Utility 或任何业务模块读取。
// ─────────────────────────────────────────────────────────────────────────────

// ── 变量区 ──

/** 凭据 env 文件名；与 .gitignore 的 `.env.*` 规则和边界扫描脚本保持一致 */
export const T03_ENV_FILENAME = '.env.t03.local'

/** 写入文件时使用的权限位：仅所有者可读写（Windows 上由 ACL 近似实现） */
const OWNER_READ_WRITE = 0o600

/** 文件头警告，避免有人误以为这是可提交的普通配置 */
const FILE_HEADER = [
  '# ⚠️ 此文件包含明文网易云会话凭据，等价于测试账号的访问权。',
  '# ⚠️ 禁止提交、禁止分享、禁止用于正式账号。',
  '# ⚠️ 由 `pnpm t03:spike` 自动生成；验证结束后请执行 `pnpm t03:purge` 删除。',
  '#',
  '# 仅供 T-03 播放媒体链路验证使用。生产代码不读取本文件。'
].join('\n')

// ── 类型区 ──

/** 待写入的凭据材料 */
export interface T03CredentialMaterial {
  /** 完整 Cookie 头（包含 MUSIC_U 及其他网易云 Cookie） */
  cookieHeader: string
  /** 从 Cookie 头中提取的 MUSIC_U 值 */
  musicU: string
  /** 关联的数字账户 ID */
  accountId: string
}

// ── 函数区 ──

/**
 * 从完整 Cookie 头中提取 MUSIC_U 值。
 *
 * @param cookieHeader `name=value; name=value` 形式的 Cookie 头
 * @returns MUSIC_U 值；不存在时返回 undefined
 */
export function extractMusicU(cookieHeader: string): string | undefined {
  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=')
    if (separator <= 0) continue
    if (pair.slice(0, separator).trim() !== 'MUSIC_U') continue
    const value = pair.slice(separator + 1).trim()
    return value.length > 0 ? value : undefined
  }
  return undefined
}

/**
 * 把值转义为安全的 dotenv 单行值。
 *
 * Cookie 值不应含换行或引号，但仍然做一次防御性处理，
 * 避免异常值破坏文件结构或注入额外变量。
 *
 * @param value 原始值
 */
function toEnvValue(value: string): string {
  const sanitized = value.replace(/[\r\n]/gu, '')
  return `'${sanitized.replace(/'/gu, "'\\''")}'`
}

/**
 * 把 T-03 测试账号凭据写入明文 env 文件。
 *
 * @param filePath 目标绝对路径
 * @param material 凭据材料
 * @throws 若未处于 T-03 Spike 模式，直接拒绝写入
 */
export async function writeT03CredentialEnv(
  filePath: string,
  material: T03CredentialMaterial
): Promise<void> {
  // 运行期二次确认：即使被误导入，非 Spike 模式下也不会落盘
  if (process.env['NCX_T03_SPIKE'] !== '1') {
    throw new Error('拒绝写入凭据 env：当前不处于 T-03 Spike 模式。')
  }

  const body = [
    FILE_HEADER,
    '',
    `# 生成时间：${new Date().toISOString()}`,
    `# 账户 ID：${material.accountId}`,
    '',
    `NCX_T03_COOKIE_HEADER=${toEnvValue(material.cookieHeader)}`,
    `NCX_T03_MUSIC_U=${toEnvValue(material.musicU)}`,
    `NCX_T03_ACCOUNT_ID=${toEnvValue(material.accountId)}`,
    ''
  ].join('\n')

  await writeFile(filePath, body, { encoding: 'utf8', mode: OWNER_READ_WRITE })
}
