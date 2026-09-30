/**
 * Test-runner facade for the specs.
 *
 * The suite imports its runner helpers from here instead of using jest's
 * globals directly. That keeps every spec a plain TypeScript module (no ambient
 * globals, no `@types/jest`) and leaves a single place to adapt the runner API.
 *
 * Everything is forwarded to jest; `mock` bundles the jest APIs the specs use
 * under the `mock.*` namespace (`jest.fn`, `jest.spyOn`, fake timers, ...).
 */
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe as jestDescribe,
	expect,
	it as jestIt,
	jest
} from "@jest/globals";

/** jest calls them `beforeAll`/`afterAll`; the specs use jest's CJS names. */
export const before = beforeAll;
export const after = afterAll;
export { afterEach, afterAll, beforeEach, beforeAll, expect, jest };

type AnyFn = (...args: any[]) => any;

/** Loosely typed on purpose: specs use every jest overload (`.each`, timeouts). */
type DescribeApi = AnyFn & { skip: AnyFn; only: AnyFn; each: AnyFn };
type ItApi = AnyFn & { skip: AnyFn; only: AnyFn; todo: AnyFn; failing: AnyFn; each: AnyFn };

export const describe = jestDescribe as unknown as DescribeApi;
export const it = jestIt as unknown as ItApi;
export const test = it;
export const xit = it.skip;
export const xdescribe = describe.skip;
export const fit = it.only;
export const fdescribe = describe.only;

/**
 * `mock.*` – the jest APIs the specs use, grouped like node:test's tracker so
 * the two runners stay interchangeable.
 */
export const mock = {
	/** `jest.fn()` / `jest.fn(impl)`. */
	fn: (impl?: AnyFn) => (impl === undefined ? jest.fn() : jest.fn(impl)),

	/** `jest.spyOn()` – keeps the original implementation unless one is given. */
	method: (obj: any, name: string | symbol, impl?: AnyFn) => {
		const spy = jest.spyOn(obj, name as never);
		return impl === undefined ? spy : spy.mockImplementation(impl);
	},

	clearAllMocks: () => jest.clearAllMocks(),
	resetAllMocks: () => jest.resetAllMocks(),
	restoreAllMocks: () => jest.restoreAllMocks(),

	// fake timers
	useFakeTimers: () => jest.useFakeTimers(),
	useRealTimers: () => jest.useRealTimers(),
	advanceTimersByTime: (ms: number) => jest.advanceTimersByTime(ms),
	runAllTimers: () => jest.runAllTimers(),
	runOnlyPendingTimers: () => jest.runOnlyPendingTimers(),
	setSystemTime: (t: number | Date) => jest.setSystemTime(t),
	getTimerCount: () => jest.getTimerCount(),
	clearAllTimers: () => jest.clearAllTimers(),

	// module registry
	module: (path: string, factory?: () => unknown) =>
		factory ? jest.mock(path, factory) : jest.mock(path)
};
