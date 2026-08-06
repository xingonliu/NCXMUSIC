export const zhCN = {
  app: {
    name: 'NcxMusic',
    caption: 'Agent 原生音乐客户端'
  },
  routes: {
    'routes.agent': 'AI 助手',
    'routes.albumDetail': '专辑详情',
    'routes.artistDetail': '艺人详情',
    'routes.discover': '发现音乐',
    'routes.immersiveLyrics': '沉浸歌词',
    'routes.likedSongs': '喜欢的音乐',
    'routes.login': '登录',
    'routes.onboarding': '首次引导',
    'routes.playbackDetail': '正在播放',
    'routes.playlistDetail': '歌单详情',
    'routes.profile': '个人资料',
    'routes.search': '搜索',
    'routes.searchResults': '搜索结果',
    'routes.settings': '设置'
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
  },
  player: {
    /** PlayerBar 区域的无障碍标签 */
    regionLabel: '播放控制',
    /** 未装载曲目时的占位文案 */
    emptyTrack: '未选择曲目',
    play: '播放',
    pause: '暂停',
    previous: '上一首',
    next: '下一首',
    volume: '音量',
    mute: '静音',
    unmute: '取消静音',
    progress: '播放进度',
    /** 关闭提示 */
    dismiss: '关闭提示',
    /** 音质降级时追加到音质标签后的后缀 */
    downgradedSuffix: '（已降级）',
    /** 播放模式，键与 PlayMode 一致 */
    mode: {
      loop: '列表循环',
      'loop-one': '单曲循环',
      shuffle: '随机播放'
    },
    /** 播放状态，键与 PlaybackStatus 一致 */
    status: {
      idle: '待播放',
      loading: '加载中',
      ready: '就绪',
      playing: '播放中',
      paused: '已暂停',
      buffering: '缓冲中',
      error: '播放失败'
    },
    /** 音质等级显示名，键与 MusicQualityLevel 一致 */
    quality: {
      standard: '标准',
      higher: '较高',
      exhigh: '极高',
      lossless: '无损',
      hires: 'Hi-Res',
      jyeffect: '高清环绕声',
      sky: '沉浸环绕声',
      dolby: '杜比全景声',
      jymaster: '超清母带'
    }
  }
} as const
