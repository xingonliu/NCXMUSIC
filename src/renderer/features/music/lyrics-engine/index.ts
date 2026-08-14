/**
 * @license AGPL-3.0-only
 * 本文件基于 Apple Music-like Lyrics 的歌词视觉与动效引擎改写。
 * 上游：https://github.com/amll-dev/applemusic-like-lyrics
 * 固定提交：ad6a67ba76d8a4a41e905eb58ec6d8728378426d
 * 对应源码：packages/core/src/lyric-player/index.ts
 */

// ========= AMLL 歌词视觉与动效引擎 =========
import { DomLyricPlayer } from "./dom/index.ts";

export * from "./base/consts.ts";
export * from "./base/index.ts";

export * from "./dom/index.ts";

export {
	/**
	 * 默认导出的歌词播放组件
	 */
	DomLyricPlayer as LyricPlayer,
};
