import { describe, it } from "../../helpers/test";
import expect from "../../helpers/expect";

import RandomStrategy from "../../../src/strategies/random";
import { extendExpect } from "../../helpers/utils";

extendExpect(expect);

describe("Test RandomStrategy", () => {
	it("test with empty opts", () => {
		const strategy = new RandomStrategy();

		const list = [{ a: "hello" }, { b: "world" }];

		expect(strategy.select(list)).toBeAnyOf(list);
		expect(strategy.select(list)).toBeAnyOf(list);
		expect(strategy.select(list)).toBeAnyOf(list);
	});
});
