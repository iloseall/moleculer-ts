import { afterEach, beforeEach, describe, it, mock } from "../helpers/test";
import expect from "../helpers/expect";

import os from "os";
import getCpuUsage from "../../src/cpu-usage";

// Fake timers must be switched on inside the test: enabling them at module
// scope would also fake the timers the test runner itself relies on.
beforeEach(() => mock.useFakeTimers());
afterEach(() => mock.useRealTimers());

describe("getCpuUsage", () => {
	it("should report cpu usage", () => {
		os.cpus = mock
			.fn()
			.mockImplementationOnce(() => [
				{
					times: {
						user: 1,
						nice: 2,
						sys: 3,
						idle: 4,
						irq: 5
					}
				}
			])
			.mockImplementationOnce(() => [
				{
					times: {
						user: 2,
						nice: 3,
						sys: 4,
						idle: 5,
						irq: 6
					}
				}
			])
			.mockImplementationOnce(() => [
				{
					times: {
						user: 3,
						nice: 3,
						sys: 3,
						idle: 3,
						irq: 3
					}
				}
			]);

		const result = getCpuUsage(100);
		mock.runAllTimers();
		return expect(result).resolves.toEqual({ avg: 70, usages: [70] });
	});

	it("should return rejected promise on missing cpu data", () => {
		os.cpus = mock.fn().mockImplementationOnce(() => undefined);

		const result = getCpuUsage(100);
		mock.runAllTimers();
		return expect(result).rejects.toBeInstanceOf(Error);
	});
});
