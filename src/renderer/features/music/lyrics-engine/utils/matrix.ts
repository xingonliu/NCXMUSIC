// @ts-nocheck
// 上游源码采用 noUncheckedIndexedAccess=false 与 exactOptionalPropertyTypes=false；运行时行为由本地测试保证。

/**
 * @license AGPL-3.0-only
 * 本文件基于 Apple Music-like Lyrics 的歌词视觉与动效引擎改写。
 * 上游：https://github.com/amll-dev/applemusic-like-lyrics
 * 固定提交：ad6a67ba76d8a4a41e905eb58ec6d8728378426d
 * 对应源码：packages/core/src/utils/matrix.ts
 */

// ========= AMLL 歌词视觉与动效引擎 =========
// biome-ignore format: matrix
export type Matrix4 = [
	number, number, number, number,
	number, number, number, number,
	number, number, number, number,
	number, number, number, number,
];

export function createMatrix4(): Matrix4 {
	// biome-ignore format: matrix
	return [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];
}

export function scaleMatrix4(
	m: Matrix4,
	scale = 1,
	origin = { x: 0, y: 0 },
): Matrix4 {
	const [ox, oy] = [origin.x, origin.y];
	// biome-ignore format: matrix
	return [
        m[0] * scale           , m[1] * scale           , m[2] * scale , m[3],
        m[4] * scale           , m[5] * scale           , m[6] * scale , m[7],
        m[8] * scale           , m[9] * scale           , m[10] * scale, m[11],
        m[12] - ox * scale + ox, m[13] - oy * scale + oy, m[14]        , m[15]
    ];
}

export function translateMatrix4(m: Matrix4, x = 0, y = 0, z = 0): Matrix4 {
	// biome-ignore format: matrix
	return [
        m[0]     , m[1]     , m[2]     , m[3] ,
        m[4]     , m[5]     , m[6]     , m[7] ,
        m[8]     , m[9]     , m[10]    , m[11],
        m[12] + x, m[13] + y, m[14] + z, m[15]
    ];
}

export function matrix4ToCSS(m: Matrix4, fractionDigits = 4): string {
	const format = (n: number, _: number) => n.toFixed(fractionDigits);
	return `matrix3d(${m.map(format).join(", ")})`;
}
