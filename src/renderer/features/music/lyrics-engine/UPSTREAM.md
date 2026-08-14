# AMLL 歌词视觉与动效引擎来源

本目录是 NcxMusic 内置的歌词视觉与动效引擎，不是对 `@applemusic-like-lyrics/*` 组件的运行时依赖。

- 上游项目：<https://github.com/amll-dev/applemusic-like-lyrics>
- 固定提交：`ad6a67ba76d8a4a41e905eb58ec6d8728378426d`
- 上游版本：`@applemusic-like-lyrics/core@0.5.2`
- 主要来源：`packages/core/src/lyric-player/**`、`packages/core/src/styles/**` 以及歌词引擎使用的 `packages/core/src/utils/**`
- 上游许可证：GNU Affero General Public License v3.0 only（AGPL-3.0-only）
- NcxMusic 改写日期：2026-08-14

## 本地改写

- 保留完整歌词时间轴、布局、滚动、弹簧、逐字动画、间奏、背景声、双声部和视口 DOM 管理行为。
- 将上游内部路径别名改为 NcxMusic 本地相对路径。
- 上游内部实现继续使用其 `noUncheckedIndexedAccess=false`、`exactOptionalPropertyTypes=false` 编译假设；NcxMusic 对外适配器和公共类型仍由项目严格配置检查，运行时行为由本地回归测试覆盖。
- 为歌词行、音节、声部和间奏 DOM 增加 `data-amll-*` 调试属性，不改变布局或动画计算。
- 由 NcxMusic 的 `LyricsPanel.vue` 直接创建并驱动 DOM 引擎，不使用上游 Vue/React 组件。
- 歌词获取和 LRC/YRC 解析继续使用 NcxMusic 现有实现，只在展示边界转换为引擎数据结构。
- 动态背景仍由 NcxMusic 的 `FluidMeshBackground.vue` 提供，不包含 AMLL 背景渲染器。

完整许可证文本见 [LICENSE.AMLL](./LICENSE.AMLL)。
