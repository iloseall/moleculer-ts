/**
 * `extendExpect()` (see `./utils.ts`) registers `toBeAnyOf` on jest's matcher
 * engine at runtime. This declaration teaches the type surface about it, so the
 * helper type gate (`npm run test:tscheck`) stays clean.
 *
 * Note: the second type parameter mirrors `expect`'s own parameter list, which
 * is required for interface declaration merging (it is intentionally unused).
 */
import "expect";

declare module "expect" {
	interface Matchers<R extends void | Promise<void>, T = unknown> {
		toBeAnyOf(expected: unknown[]): R;
	}
}
