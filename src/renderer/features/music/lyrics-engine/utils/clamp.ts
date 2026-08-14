// @ts-nocheck
// 上游源码采用 noUncheckedIndexedAccess=false 与 exactOptionalPropertyTypes=false；运行时行为由本地测试保证。

/**
 * @license AGPL-3.0-only
 * 本文件基于 Apple Music-like Lyrics 的歌词视觉与动效引擎改写。
 * 上游：https://github.com/amll-dev/applemusic-like-lyrics
 * 固定提交：ad6a67ba76d8a4a41e905eb58ec6d8728378426d
 * 对应源码：packages/core/src/utils/clamp.ts
 */

// ========= AMLL 歌词视觉与动效引擎 =========
export function clamp(x: number, min: number, max: number): number {
	return Math.min(Math.max(x, min), max);
}

export function clamp01(x: number): number {
	return clamp(x, 0, 1);
}

export function clampPositive(x: number): number {
	return Math.max(0, x);
}
