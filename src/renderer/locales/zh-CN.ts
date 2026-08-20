export const zhCN = {
  app: {
    name: 'Ncxmusic',
    caption: 'Agent 原生音乐客户端'
  },
  routes: {
    'routes.agent': 'AI 助手',
    'routes.albumDetail': '专辑详情',
    'routes.artistDetail': '艺人详情',
    'routes.browse': '浏览',
    'routes.browseArtists': '歌手探索',
    'routes.browseCategories': '分类歌单',
    'routes.browseRankings': '排行榜',
    'routes.discover': '发现音乐',
    'routes.designSystemLab': '通用组件',
    'routes.likedSongs': '喜欢的音乐',
    'routes.login': '登录',
    'routes.onboarding': '首次引导',
    'routes.playlistDetail': '歌单详情',
    'routes.playerDetail': '播放详情',
    'routes.immersiveLyrics': '沉浸歌词',
    'routes.songDetail': '歌曲详情',
    'routes.profile': '个人资料',
    'routes.search': '搜索',
    'routes.searchResults': '搜索结果',
    'routes.songCollection': '歌曲集合',
    'routes.settings': '设置'
  },
  common: {
    cancel: '取消',
    close: '关闭',
    loading: '加载中',
    retry: '重试',
    unknownArtist: '未知歌手',
    unknownAlbum: '未知专辑'
  },
  errors: {
    protocolInvalidMessage: '应用收到的响应格式无效，请重试。',
    protocolVersionMismatch: '应用服务版本不匹配，请重启应用。',
    connectionReplaced: '服务连接已更新，请重试。',
    requestTimeout: '请求超时，请稍后重试。',
    requestCancelled: '请求已取消。',
    upstream: '上游服务返回错误，请稍后重试。',
    utilityUnavailable: '本地服务暂不可用，请稍后重试。',
    capabilityUnavailable: '当前能力不可用。',
    authRequired: '此操作需要先登录。',
    alreadyCompleted: '此操作已经完成，无需重复执行。',
    serviceUnavailable: '服务暂不可用，请稍后重试。',
    accountStale: '账户已切换，请刷新后重试。',
    policyDenied: '当前安全策略不允许此操作。',
    argumentsInvalid: '操作参数无效，请检查后重试。',
    notFound: '没有找到匹配内容。',
    providerTimeout: '模型服务响应超时，请稍后重试。',
    generic: '操作失败，请稍后重试。'
  },
  navigation: {
    discover: '发现音乐',
    browse: '浏览',
    search: '搜索',
    agent: '小云',
    designSystem: '通用组件',
    myMusic: '我的音乐',
    liked: '我喜欢',
    profile: '个人资料',
    settings: '设置'
  },
  music: {
    signin: {
      loginExpired: '登录已失效，请重新登录后签到。',
      alreadyCompleted: '今日已签到，无需重复操作。',
      serviceUnavailable: '签到服务暂不可用，请稍后再试。',
      rejected: '网易云未接受本次签到。',
      preparing: '账户正在准备写操作，请稍候。',
      loginRequired: '请先登录网易云账户。',
      signing: '正在签到…',
      succeeded: '签到成功。'
    },
    clipboard: {
      succeeded: '已复制到系统剪贴板。',
      failed: '无法写入系统剪贴板。'
    },
    search: {
      mismatch: '搜索响应类型不匹配。',
      loginForPlaylist: '请先登录网易云账户，再将歌曲添加到歌单。',
      playlistMismatch: '歌单响应类型不匹配。',
      liked: '已收藏《{song}》。',
      addedToPlaylist: '已将《{song}》添加到“{playlist}”。'
    }
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
      { name: 'Renderer', description: 'Vue、Router 与 Design System 单页应用组合根。' },
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
    /** 播放通知标题 */
    noticeTitle: '播放提示',
    /** 音质降级时追加到音质标签后的后缀 */
    downgradedSuffix: '（已降级）',
    /** 播放队列 */
    queue: '播放队列',
    queueTitle: '播放队列',
    queueEmpty: '播放队列暂无歌曲',
    clearQueue: '清空队列',
    removeTrack: '移出队列',
    nowPlaying: '正在播放',
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
