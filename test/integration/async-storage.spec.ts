import { describe, it } from "../helpers/test";
import expect from "../helpers/expect";

import AsyncStorage from "../../src/async-storage";

describe("Test Async Storage class", () => {
	it("should set broker & create store", () => {
		const broker = {};
		const storage = new AsyncStorage(broker);

		expect(storage.broker).toBe(broker);
		expect(storage.store).toBeInstanceOf(Map);
	});

	it("should store context for async thread", () => {
		const broker = {};
		const storage = new AsyncStorage(broker);
		// The store is keyed by `executionAsyncId()` and propagated by the async
		// hook. Under jest every callback reported asyncId 0 (so a promise chain
		// "just worked"); node:test runs with real async ids, where only the hook
		// can carry the entry over to a new async resource (e.g. a timer).
		storage.enable();

		const context = { a: 5 };

		return Promise.resolve().then(
			() =>
				new Promise<void>(resolve => {
					storage.setSessionData(context);
					// Same async context: readable right away...
					expect(storage.getSessionData()).toBe(context);

					// ...and after the hook carried it into the timer's context.
					setTimeout(() => {
						expect(storage.getSessionData()).toBe(context);
						storage.disable();
						resolve();
					}, 20);
				})
		);
	});
});
