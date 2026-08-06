import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  ShellPolicyClassifier,
  tokenizeShellCommand,
  type PowerShellAstInspector,
  type ZshSyntaxChecker
} from '../../src/infrastructure/shell/policy-classifier'
import { ShellWorkspaceRegistry } from '../../src/infrastructure/shell/workspace-registry'

// ─────────────────────────────────────────────────────────────────────────────
// 测试夹具区
// ─────────────────────────────────────────────────────────────────────────────

const workspaceRoot = resolve('D:/code/NCXMUSIC')
const workspace = new ShellWorkspaceRegistry({
  defaultWorkspaceRoot: workspaceRoot,
  workspaces: [{ id: 'repo', rootPath: workspaceRoot }]
})

const passingPowerShellInspector: PowerShellAstInspector = {
  inspect: async (command) => ({
    syntaxOk: true,
    commands: [tokenizeShellCommand(command)[0] ?? ''],
    hasUnsafeAst: false
  })
}

const safeZshChecker: ZshSyntaxChecker = {
  check: async () => ({ ok: true })
}

/** 构造 Windows Shell 策略分类器。 */
function windowsClassifier(level: 'S1' | 'S2' | 'S3' | 'S4'): ShellPolicyClassifier {
  return new ShellPolicyClassifier({
    platform: 'win32',
    safetyLevel: level,
    workspaceRegistry: workspace,
    powershellAstInspector: passingPowerShellInspector
  })
}

/** 构造 macOS Shell 策略分类器。 */
function macClassifier(level: 'S1' | 'S2' | 'S3' | 'S4'): ShellPolicyClassifier {
  return new ShellPolicyClassifier({
    platform: 'darwin',
    safetyLevel: level,
    workspaceRegistry: workspace,
    zshSyntaxChecker: safeZshChecker
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Tokenizer
// ─────────────────────────────────────────────────────────────────────────────

describe('Shell tokenizer', () => {
  it('保留 Windows 反斜杠路径并处理引号字面量', () => {
    expect(tokenizeShellCommand('Get-Content "docs\\a b.md"')).toEqual([
      'Get-Content',
      'docs\\a b.md'
    ])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Windows 分类
// ─────────────────────────────────────────────────────────────────────────────

describe('Windows Shell policy classifier', () => {
  it('S2 自动放行只读 PowerShell 模板', async () => {
    await expect(
      windowsClassifier('S2').classify({
        command: 'Get-ChildItem src',
        workspaceId: 'repo',
        purpose: '列出源码目录'
      })
    ).resolves.toMatchObject({ action: 'allow', tags: ['read'], executable: 'get-childitem' })
  })

  it('S1 对所有命令进入审批，不自动执行', async () => {
    await expect(
      windowsClassifier('S1').classify({
        command: 'Get-Location',
        workspaceId: 'repo',
        purpose: '读取当前目录'
      })
    ).resolves.toMatchObject({ action: 'ask' })
  })

  it('PowerShell AST 中的复合或动态语法进入审批', async () => {
    const classifier = new ShellPolicyClassifier({
      platform: 'win32',
      safetyLevel: 'S4',
      workspaceRegistry: workspace,
      powershellAstInspector: {
        inspect: async () => ({ syntaxOk: true, commands: ['Get-Item'], hasUnsafeAst: true })
      }
    })

    await expect(
      classifier.classify({ command: 'Get-Item src; Get-Item docs', workspaceId: 'repo', purpose: '复合命令' })
    ).resolves.toMatchObject({ action: 'ask' })
  })

  it('拒绝编码命令和疑似凭据字面量', async () => {
    await expect(
      windowsClassifier('S4').classify({
        command: 'powershell.exe -EncodedCommand ZABpAHIA',
        workspaceId: 'repo',
        purpose: '编码命令'
      })
    ).resolves.toMatchObject({ action: 'deny' })

    await expect(
      windowsClassifier('S4').classify({
        command: 'Get-Content cookie=MUSIC_U_secret',
        workspaceId: 'repo',
        purpose: '凭据泄漏'
      })
    ).resolves.toMatchObject({ action: 'deny' })
  })

  it('拒绝 cwd 和路径参数逃逸授权工作区', async () => {
    await expect(
      windowsClassifier('S2').classify({
        command: 'Get-Content ..\\secret.txt',
        workspaceId: 'repo',
        purpose: '读取外部路径'
      })
    ).resolves.toMatchObject({ action: 'deny' })

    await expect(
      windowsClassifier('S2').classify({
        command: 'Get-Location',
        workspaceId: 'repo',
        cwd: '..',
        purpose: '逃逸 cwd'
      })
    ).resolves.toMatchObject({ action: 'deny' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// macOS 分类
// ─────────────────────────────────────────────────────────────────────────────

describe('macOS Shell policy classifier', () => {
  it('S2 自动放行只读 zsh 模板', async () => {
    await expect(
      macClassifier('S2').classify({ command: 'ls src', workspaceId: 'repo', purpose: '列出源码' })
    ).resolves.toMatchObject({ action: 'allow', executable: 'ls', tags: ['read'] })
  })

  it('命令替换、变量展开、管道、重定向和后台执行进入审批', async () => {
    for (const command of ['ls $(pwd)', 'ls $HOME', 'ls src | wc', 'ls src > out.txt', 'ls src &']) {
      await expect(
        macClassifier('S4').classify({ command, workspaceId: 'repo', purpose: '动态语法' })
      ).resolves.toMatchObject({ action: 'ask' })
    }
  })

  it('find 禁止副作用谓词，rm 根目录目标被硬拒绝', async () => {
    await expect(
      macClassifier('S4').classify({ command: 'find src -delete', workspaceId: 'repo', purpose: '删除查找结果' })
    ).resolves.toMatchObject({ action: 'ask' })

    await expect(
      macClassifier('S4').classify({ command: 'rm .', workspaceId: 'repo', purpose: '删除根目录' })
    ).resolves.toMatchObject({ action: 'deny' })
  })

  it('包管理器构建测试为 S3，安装发布为 S4', async () => {
    await expect(
      macClassifier('S3').classify({ command: 'pnpm test', workspaceId: 'repo', purpose: '测试' })
    ).resolves.toMatchObject({ action: 'allow', tags: ['test'] })

    await expect(
      macClassifier('S3').classify({ command: 'pnpm install', workspaceId: 'repo', purpose: '安装依赖' })
    ).resolves.toMatchObject({ action: 'ask', tags: ['install', 'network', 'write'] })
  })
})
