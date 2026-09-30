/**
 * Shared test helpers, migrated from `test/unit/utils.js`.
 * Usage in specs: `const { protectReject } = require("../helpers/utils");`
 */
import expect from "./expect";

export function protectReject(err: unknown): void {
	if (err && (err as Error).stack) {
		console.error(err);
		console.error((err as Error).stack);
	} else {
		console.error(new Error("Protect reject called with: " + err));
	}

	expect(err).toBe(true);
}

export function extendExpect(e: typeof expect): void {
	e.extend({
		toBeAnyOf(this: any, received: unknown, expected: unknown[]) {
			let pass = false;
			for (const item of expected) {
				if (received === item) {
					pass = true;
					break;
				}
			}

			const list = expected.map(item => String(item)).join(", ");
			const message = `Expected ${String(received)} to be any of [${list}]`;
			return { pass, message: () => message };
		}
	});
}
