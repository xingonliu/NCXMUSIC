// @ts-nocheck
// 上游源码采用 noUncheckedIndexedAccess=false 与 exactOptionalPropertyTypes=false；运行时行为由本地测试保证。

/**
 * @license AGPL-3.0-only
 * 本文件基于 Apple Music-like Lyrics 的歌词视觉与动效引擎改写。
 * 上游：https://github.com/amll-dev/applemusic-like-lyrics
 * 固定提交：ad6a67ba76d8a4a41e905eb58ec6d8728378426d
 * 对应源码：packages/core/src/utils/is-cjk.ts
 */

// ========= AMLL 歌词视觉与动效引擎 =========
export const isCJK = (char: string): boolean => {
	return /^[\p{Unified_Ideograph}\u0800-\u9FFC]+$/u.test(char);
};
