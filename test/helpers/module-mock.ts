/**
 * Module mocking helpers, on top of jest's module registry.
 *
 * The specs resolve the mocked module themselves (`require.resolve`) and
 * `require()` it *after* the mock is registered, so these helpers simply
 * forward the resolved path to jest.
 */
import { jest } from "@jest/globals";

/**
 * `jest.mock(path)` without a factory: jest automocks the module (every export
 * becomes a mock function/class).
 */
export function autoMock(resolvedPath: string): void {
	jest.mock(resolvedPath);
}

/**
 * The automocked module without installing it – handy when a spec has to
 * hand-pick exports before the module under test is loaded.
 */
export function autoShape(resolvedPath: string): any {
	return jest.createMockFromModule(resolvedPath);
}

/** Install an explicit shape (`jest.mock(path, () => shape)`). */
export function installMock(resolvedPath: string, shape: any): void {
	jest.mock(resolvedPath, () => shape);
}

/**
 * `jest.mock(path, () => ({...}))`: the factory's return value becomes the
 * module. The shape is returned so the spec can patch it further.
 */
export function factoryMock(resolvedPath: string, factory: () => unknown): any {
	const shape = (factory() ?? {}) as Record<string, unknown>;
	jest.mock(resolvedPath, () => shape);
	return shape;
}

/** `require.resolve()` that keeps the raw specifier for unresolvable modules. */
export function resolveModule(specifier: string): string {
	try {
		return require.resolve(specifier);
	} catch {
		return specifier;
	}
}

/** `jest.requireActual()`: load the real module even when it is mocked. */
export function requireActual<T = any>(resolvedPath: string): T {
	return jest.requireActual(resolvedPath) as T;
}

/**
 * `require()` interop for modules that were transpiled from ESM: `import X from`
 * has to pick `module.exports.default`, while `export =` / plain CJS packages
 * are used as they are.
 */
export function interopDefault<T = any>(mod: any): T {
	return mod && mod.__esModule ? (mod.default ?? mod) : mod;
}
