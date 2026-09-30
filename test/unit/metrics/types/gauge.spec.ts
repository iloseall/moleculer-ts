import { describe, it, mock } from "../../../helpers/test";
import expect from "../../../helpers/expect";
import { autoMock, factoryMock, interopDefault } from "../../../helpers/module-mock";

autoMock(require.resolve("../../../../src/metrics/rates"));

const MetricRate = interopDefault(require("../../../../src/metrics/rates"));
const GaugeMetric = interopDefault(require("../../../../src/metrics/types/gauge"));

const rateUpdate = mock.fn();
const fakeRate = {
	update: rateUpdate,
	rate: 123
};
MetricRate.mockImplementation(() => fakeRate);

describe("Test Base Metric class", () => {
	const registry = {
		changed: mock.fn(),
		opts: {
			defaultAggregator: "sum"
		}
	};

	describe("Test Constructor", () => {
		it("should create with base options", () => {
			registry.changed.mockClear();
			const item = new GaugeMetric(
				{
					type: "gauge",
					name: "test.gauge"
				},
				registry
			);

			expect(item.registry).toBe(registry);
			expect(item.type).toBe("gauge");
			expect(item.name).toBe("test.gauge");
			expect(item.rate).toBeUndefined();

			expect(registry.changed).toHaveBeenCalledTimes(0);
		});

		it("should create with custom options", () => {
			registry.changed.mockClear();
			const item = new GaugeMetric(
				{
					type: "gauge",
					name: "test.gauge",
					rate: true
				},
				registry
			);

			expect(item.registry).toBe(registry);
			expect(item.type).toBe("gauge");
			expect(item.name).toBe("test.gauge");
			expect(item.rate).toBe(true);

			expect(registry.changed).toHaveBeenCalledTimes(0);
		});
	});

	describe("Test increment method", () => {
		const item = new GaugeMetric({ type: "gauge", name: "test.gauge" }, registry);
		mock.method(item, "set");

		it("should call set method", () => {
			item.set.mockClear();
			item.increment();
			expect(item.set).toHaveBeenCalledTimes(1);
			expect(item.set).toHaveBeenCalledWith(1, undefined, undefined);

			item.set.mockClear();
			const now = Date.now();
			item.increment({ a: 5 }, 3, now);
			expect(item.set).toHaveBeenCalledTimes(1);
			expect(item.set).toHaveBeenCalledWith(4, { a: 5 }, now);

			item.set.mockClear();
			item.increment();
			expect(item.set).toHaveBeenCalledTimes(1);
			expect(item.set).toHaveBeenCalledWith(5, undefined, undefined);
		});
	});

	describe("Test decrement method", () => {
		const item = new GaugeMetric({ type: "gauge", name: "test.gauge" }, registry);
		mock.method(item, "set");
		item.set(10);

		it("should call set method", () => {
			item.set.mockClear();
			item.decrement();
			expect(item.set).toHaveBeenCalledTimes(1);
			expect(item.set).toHaveBeenCalledWith(9, undefined, undefined);

			item.set.mockClear();
			const now = Date.now();
			item.decrement({ a: 5 }, 3, now);
			expect(item.set).toHaveBeenCalledTimes(1);
			expect(item.set).toHaveBeenCalledWith(6, { a: 5 }, now);

			item.set.mockClear();
			item.decrement();
			expect(item.set).toHaveBeenCalledTimes(1);
			expect(item.set).toHaveBeenCalledWith(5, undefined, undefined);
		});
	});

	describe("Test set, reset & resetAll method", () => {
		const item = new GaugeMetric(
			{ type: "gauge", name: "test.gauge", labelNames: ["a"], rate: true },
			registry
		);
		mock.method(item, "changed");

		it("should store a value", () => {
			MetricRate.mockClear();
			rateUpdate.mockClear();
			item.changed.mockClear();

			expect(item.values.size).toBe(0);
			item.set(3);
			expect(item.values.size).toBe(1);
			expect(item.values.get("")).toEqual({
				labels: {},
				timestamp: expect.any(Number),
				value: 3,
				rate: fakeRate
			});

			expect(MetricRate).toHaveBeenCalledTimes(1);
			expect(MetricRate).toHaveBeenCalledWith(item, item.values.get(""), 1);

			expect(rateUpdate).toHaveBeenCalledTimes(1);
			expect(rateUpdate).toHaveBeenCalledWith(3);

			expect(item.changed).toHaveBeenCalledTimes(1);
			expect(item.changed).toHaveBeenCalledWith(3, undefined, undefined);
		});

		it("should store a labeled value", () => {
			MetricRate.mockClear();
			rateUpdate.mockClear();
			item.changed.mockClear();
			expect(item.values.size).toBe(1);
			item.set(3, { a: 5 });
			expect(item.values.size).toBe(2);
			expect(item.values.get("5")).toEqual({
				labels: { a: 5 },
				timestamp: expect.any(Number),
				value: 3,
				rate: fakeRate
			});

			expect(MetricRate).toHaveBeenCalledTimes(1);
			expect(MetricRate).toHaveBeenCalledWith(item, item.values.get("5"), 1);

			expect(rateUpdate).toHaveBeenCalledTimes(1);
			expect(rateUpdate).toHaveBeenCalledWith(3);

			expect(item.changed).toHaveBeenCalledTimes(1);
			expect(item.changed).toHaveBeenCalledWith(3, { a: 5 }, undefined);
		});

		it("should update the labeled value", () => {
			MetricRate.mockClear();
			rateUpdate.mockClear();
			item.changed.mockClear();
			expect(item.values.size).toBe(2);
			item.set(8, { a: 5 }, 12345);
			expect(item.values.size).toBe(2);
			expect(item.values.get("5")).toEqual({
				labels: { a: 5 },
				timestamp: 12345,
				value: 8,
				rate: fakeRate
			});

			expect(MetricRate).toHaveBeenCalledTimes(0);

			expect(rateUpdate).toHaveBeenCalledTimes(1);
			expect(rateUpdate).toHaveBeenCalledWith(8);

			expect(item.changed).toHaveBeenCalledTimes(1);
			expect(item.changed).toHaveBeenCalledWith(8, { a: 5 }, 12345);
		});

		it("should reset the labeled value", () => {
			MetricRate.mockClear();
			rateUpdate.mockClear();
			item.changed.mockClear();
			item.reset({ a: 5 }, 23456);
			expect(item.values.get("5")).toEqual({
				labels: { a: 5 },
				timestamp: 23456,
				value: 0,
				rate: fakeRate
			});

			expect(MetricRate).toHaveBeenCalledTimes(0);

			expect(rateUpdate).toHaveBeenCalledTimes(1);
			expect(rateUpdate).toHaveBeenCalledWith(0);

			expect(item.changed).toHaveBeenCalledTimes(1);
			expect(item.changed).toHaveBeenCalledWith(0, { a: 5 }, 23456);
			expect(item.values.size).toBe(2);
		});

		it("should reset all values", () => {
			item.set(8, { a: 5 }, 12345); // restore value
			item.changed.mockClear();
			MetricRate.mockClear();
			rateUpdate.mockClear();

			item.resetAll(34567);
			expect(item.values.get("")).toEqual({
				labels: {},
				timestamp: 34567,
				value: 0,
				rate: fakeRate
			});
			expect(item.values.get("5")).toEqual({
				labels: { a: 5 },
				timestamp: 34567,
				value: 0,
				rate: fakeRate
			});

			expect(MetricRate).toHaveBeenCalledTimes(0);
			expect(rateUpdate).toHaveBeenCalledTimes(0);

			expect(item.changed).toHaveBeenCalledTimes(1);
			expect(item.changed).toHaveBeenCalledWith(null, null, 34567);
			expect(item.values.size).toBe(2);
		});
	});

	describe("Test generateSnapshot method", () => {
		const item = new GaugeMetric(
			{ type: "gauge", name: "test.gauge", labelNames: ["a"], rate: true },
			registry
		);

		item.set(3, null, 1111);
		item.set(4, { a: 1 }, 2222);
		item.set(5, { a: 5 }, 3333);
		item.set(6, { a: "John" }, 4444);

		it("should generate a snapshot", () => {
			expect(item.generateSnapshot()).toMatchSnapshot();
		});
	});
});
