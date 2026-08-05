export const zhCN = {
  app: {
    name: 'NcxMusic',
    caption: '工程基线'
  },
  foundation: {
    eyebrow: 'Foundation 0.1',
    title: '项目结构已就绪',
    description: '四进程入口、领域边界、设计系统目录和质量工具链已经建立。',
    layersLabel: '已初始化的工程层级',
    ready: 'READY',
    runtime: {
      name: 'Runtime 通道',
      generation: 'Utility Generation',
      ping: 'Ping 延迟',
      requests: '已处理请求'
    },
    layers: [
      { name: 'Electron', description: 'Main、Preload 与 Utility Process 独立入口。' },
      { name: 'Renderer', description: 'Vue、Router 与 Pinia 单页应用组合根。' },
      { name: 'Contracts', description: '共享 Schema、DTO 与安全错误边界。' },
      { name: 'Quality', description: 'TypeScript、ESLint、Stylelint、Vitest 与 Playwright。' }
    ]
  }
} as const
