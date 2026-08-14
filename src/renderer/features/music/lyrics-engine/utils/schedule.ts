// @ts-nocheck
// 上游源码采用 noUncheckedIndexedAccess=false 与 exactOptionalPropertyTypes=false；运行时行为由本地测试保证。

/**
 * @license AGPL-3.0-only
 * 本文件基于 Apple Music-like Lyrics 的歌词视觉与动效引擎改写。
 * 上游：https://github.com/amll-dev/applemusic-like-lyrics
 * 固定提交：ad6a67ba76d8a4a41e905eb58ec6d8728378426d
 * 对应源码：packages/core/src/utils/schedule.ts
 */

// ========= AMLL 歌词视觉与动效引擎 =========
/**
 * @fileoverview
 * @see https://github.com/wilsonpage/fastdom/blob/master/fastdom.js
 */

interface Task<T> {
	task: () => T;
	resolve: (value: T) => void;
	reject: (reason?: unknown) => void;
}

// biome-ignore lint/suspicious/noExplicitAny: util functions
const measureTasks: Task<any>[] = [];
// biome-ignore lint/suspicious/noExplicitAny: util functions
const mutateTasks: Task<any>[] = [];
let scheduled = false;

function onFlush() {
	let tmp = mutateTasks.shift();
	while (tmp) {
		try {
			tmp.resolve(tmp.task());
		} catch (error) {
			tmp.reject(error);
		}
		tmp = mutateTasks.shift();
	}
	tmp = measureTasks.shift();
	while (tmp) {
		try {
			tmp.resolve(tmp.task());
		} catch (error) {
			tmp.reject(error);
		}
		tmp = measureTasks.shift();
	}
	scheduled = false;
}

function scheduleFlush() {
	if (!scheduled) {
		scheduled = true;
		requestAnimationFrame(onFlush);
	}
}

export function measure<T>(callback: () => T): Promise<T> {
	const task: Task<T> = {
		task: callback,
		resolve: () => {},
		reject: () => {},
	};
	const promise = new Promise<T>((resolve, reject) => {
		task.resolve = resolve;
		task.reject = reject;
	});
	measureTasks.push(task);
	scheduleFlush();
	return promise;
}

export function mutate(callback: () => void): Promise<unknown> {
	const task: Task<void> = {
		task: callback,
		resolve: () => {},
		reject: () => {},
	};
	const promise = new Promise((resolve, reject) => {
		task.resolve = resolve;
		task.reject = reject;
	});
	mutateTasks.push(task);
	scheduleFlush();
	return promise;
}
