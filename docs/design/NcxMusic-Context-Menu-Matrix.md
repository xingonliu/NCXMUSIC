# NcxMusic 首版右键菜单矩阵

> 文档状态：Proposed 0.1（接管原则已确认，业务菜单内容待确认）
> 建立日期：2026-08-04
> 最后更新：2026-08-04
> 关联决策：D-713

## 1. 内容原则

右键菜单是已有操作的快捷入口，不是唯一入口，也不是把详情页所有按钮重新列一遍。

1. 顶部先放当前对象最常用的播放/打开动作。
2. 中部放队列、收藏、歌单和小 N 相关动作。
3. 导航与复制链接放在后部。
4. 删除、移除、取消收藏等破坏性动作放在最后一组。
5. 单层菜单尽量不超过 10 项；歌单选择、多个歌手和小 N 能力使用 Submenu。
6. 当前上下文不成立的操作直接隐藏；暂时不可用但用户需要知道存在的操作才 Disabled。

## 2. 统一菜单模型

```ts
interface ContextMenuItemModel {
  id: string
  label: string
  icon?: IconName
  shortcut?: string
  enabled: boolean
  checked?: boolean
  danger?: boolean
  children?: ContextMenuItemModel[]
  command: AppCommand
}

type ContextTarget =
  | EditableTextTarget
  | TextSelectionTarget
  | TrackTarget
  | QueueItemTarget
  | PlaylistTarget
  | AlbumTarget
  | ArtistTarget
  | AgentMessageTarget
  | ToolCardTarget
```

菜单模型只保存稳定 ID 和裁剪后的显示数据，不保存 Cookie、原始 API 对象、DOM 节点或执行函数。

## 3. 文本编辑

### 可编辑文本

按条件显示：

1. 拼写候选，最多 5 条。
2. 添加到词典。
3. 分隔线。
4. 撤销、重做。
5. 分隔线。
6. 剪切、复制、粘贴、粘贴为纯文本。
7. 删除、全选。

命令可用状态来自 Electron `context-menu` 参数和当前 Selection；执行由 Main 调用对应 `webContents` 编辑命令。密码和 Secret 输入框禁止复制当前值、搜索选中文本或进入日志。

### 普通文字选区

- 复制。
- 在 NcxMusic 中搜索选中文字：只在长度合理且不是 Secret/技术日志时显示。

没有选区的普通正文不显示菜单。

## 4. 歌曲与歌曲行

推荐顺序：

1. 立即播放。
2. 下一首播放：插入当前项之后，但不立即切歌。
3. 添加到队列末尾。
4. 分隔线。
5. 添加到歌单 → Submenu。
6. 收藏 / 取消收藏。
7. 交给小 N →“根据这首歌推荐”“介绍这首歌”。
8. 分隔线。
9. 查看歌手 → 多歌手时使用 Submenu。
10. 查看专辑。
11. 复制网易云歌曲链接。
12. 条件危险项：从当前歌单移除。

如果当前账户没有编辑目标歌单的权限，“从当前歌单移除”直接隐藏。VIP/付费状态不改变菜单结构，点击播放后的降级行为沿用播放器规则。

## 5. 播放队列项

- 立即播放。
- 移到下一首。
- 移到队列末尾。
- 查看歌手、查看专辑。
- 复制网易云歌曲链接。
- 分隔线。
- 从队列移除。

当前正在播放项不显示“移到下一首”。移除当前项沿用已确认的队列删除规则。

## 6. 歌单

通用项：

- 播放。
- 随机播放。
- 添加全部到当前队列末尾。
- 交给小 N →“分析这个歌单”“根据这个歌单推荐”。
- 置顶 / 取消置顶：只在侧栏资产上下文显示。
- 复制网易云歌单链接。

自建歌单条件项：

- 重命名。
- 删除歌单：末组 Danger，执行前使用 AlertDialog。

收藏歌单条件项：

- 取消收藏：末组 Danger；是否需要人类主动确认按后续具体交互规则决定。

“我喜欢的音乐”不显示重命名、删除或取消收藏。

## 7. 专辑与歌手

### 专辑

- 播放、随机播放、添加全部到队列。
- 收藏 / 取消收藏。
- 交给小 N →“介绍这张专辑”“推荐相似专辑”。
- 查看歌手。
- 复制网易云专辑链接。

### 歌手

- 播放热门歌曲。
- 收藏 / 取消收藏或关注 / 取消关注，最终文案按 API 实际语义确定。
- 交给小 N →“介绍这位歌手”“推荐相似歌手”。
- 复制网易云歌手链接。

## 8. 侧栏歌单入口

- 打开。
- 播放。
- 置顶 / 取消置顶。
- 自建歌单：重命名、删除。
- 收藏歌单：取消收藏。

侧栏菜单不重复显示“查看歌手/专辑”等与歌单入口无关的动作。

## 9. Agent 内容

### 用户消息

- 复制。
- 引用到输入框。

### 小 N 消息

- 复制。
- 引用到输入框。
- 对本条继续提问。

### ToolExecutionCard

- 复制结果摘要。
- 展开 / 收起技术详情。
- 定位关联歌曲、歌单或文件：只有稳定实体引用可用时显示。

首版不在右键菜单提供“重新执行工具”。重新执行可能重复写入、Shell 或安装副作用，必须由新的用户意图和正常 Tool Call 流程发起。

## 10. 空白区域、图片与链接

- 页面空白区域：不显示菜单。
- 普通封面图片：不显示“图片另存为”“复制图片地址”等浏览器项。
- NcxMusic 实体链接：打开对象、复制对应网易云链接。
- 外部链接：复制链接、使用系统默认浏览器打开；只接受通过 URL Allowlist 校验的 `https` 地址。

## 11. 生成与执行流程

```text
contextmenu
  → resolveContextTarget()
  → buildContextMenu(target, accountCapabilities, pageContext, playerState)
  → render with Ncx ContextMenu / Reka primitives
  → dispatch AppCommand
  → reuse the same Use Case as Button / Shortcut
```

文本编辑是特例：Main 从 Electron `webContents.context-menu` 事件取得拼写与编辑能力，生成带一次性 `contextRequestId` 的裁剪模型；Renderer 只返回已选 Command ID，Main 再执行对应编辑命令。任意字符串命令和通用 `webContents` API 都不得暴露给 Renderer。

## 12. 待确认

1. 是否采用本文件列出的歌曲、队列、歌单、专辑、歌手和 Agent 菜单内容。
2. “交给小 N”是否进入首版右键菜单，还是只保留在详情页入口。
3. 收藏歌单的“取消收藏”是否需要人类主动 AlertDialog。
