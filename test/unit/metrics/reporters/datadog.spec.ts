import { describe, it, before, after, afterEach, mock } from "../../../helpers/test";
import expect from "../../../helpers/expect";

import os from "os";
import lolex from "@sinonjs/fake-timers";
import DatadogReporter from "../../../../src/metrics/reporters/datadog";
import ServiceBroker from "../../../../src/service-broker";
import MetricRegistry from "../../../../src/metrics/registry";

global.fetch = mock.fn(() => Promise.resolve({ statusText: "" }));

process.env.DATADOG_API_KEY = "datadog-api-key";

describe("Test Datadog Reporter class", () => {
	describe("Test Constructor", () => {
		it("should create with default options", () => {
			const reporter = new DatadogReporter();

			expect(reporter.opts).toEqual({
				includes: null,
				excludes: null,

				metricNamePrefix: null,
				metricNameSuffix: null,

				metricNameFormatter: null,
				labelNameFormatter: null,

				baseUrl: "https://api.datadoghq.com/api/",
				apiKey: "datadog-api-key",
				path: "/series",
				apiVersion: "v1",
				defaultLabels: expect.any(Function),
				host: os.hostname(),
				interval: 10
			});
		});

		it("should create with custom options", () => {
			const reporter = new DatadogReporter({
				metricNamePrefix: "mol-",
				metricNameSuffix: ".data",
				includes: "moleculer.**",
				excludes: ["moleculer.circuit-breaker.**", "moleculer.custom.**"],
				metricNameFormatter: () => {},
				labelNameFormatter: () => {},

				baseUrl: "https://api.custom-url.com/api/",
				apiKey: "12345",
				apiVersion: "v2",
				host: "custom-hostname",
				interval: 5
			});

			expect(reporter.opts).toEqual({
				metricNamePrefix: "mol-",
				metricNameSuffix: ".data",
				includes: ["moleculer.**"],
				excludes: ["moleculer.circuit-breaker.**", "moleculer.custom.**"],
				metricNameFormatter: expect.any(Function),
				labelNameFormatter: expect.any(Function),

				baseUrl: "https://api.custom-url.com/api/",
				apiKey: "12345",
				path: "/series",
				apiVersion: "v2",
				defaultLabels: expect.any(Function),
				host: "custom-hostname",
				interval: 5
			});
		});

		it("should throw error if apiKey is not defined", () => {
			expect(() => new DatadogReporter({ apiKey: "" })).toThrow(
				"Datadog API key is missing. Set DATADOG_API_KEY environment variable."
			);
		});
	});

	describe("Test init method", () => {
		let clock;
		let reporter;
		before(() => (clock = lolex.install()));
		after(() => clock.uninstall());
		afterEach(async () => {
			await reporter.stop();
		});

		it("should start timer", () => {
			const fakeBroker = {
				nodeID: "node-123",
				namespace: "test-ns"
			};
			const fakeRegistry = { broker: fakeBroker };
			reporter = new DatadogReporter({ interval: 5 });
			reporter.flush = mock.fn();
			reporter.init(fakeRegistry);

			expect(reporter.timer).toBeDefined();
			expect(reporter.flush).toHaveBeenCalledTimes(0);

			clock.tick(5500);

			expect(reporter.flush).toHaveBeenCalledTimes(1);
		});

		it("should generate defaultLabels", () => {
			const fakeBroker = {
				nodeID: "node-123",
				namespace: "test-ns"
			};
			const fakeRegistry = { broker: fakeBroker };
			reporter = new DatadogReporter({});
			reporter.init(fakeRegistry);

			expect(reporter.defaultLabels).toStrictEqual({
				namespace: "test-ns",
				nodeID: "node-123"
			});
		});

		it("should set static defaultLabels", () => {
			const fakeBroker = {};
			const fakeRegistry = { broker: fakeBroker };
			reporter = new DatadogReporter({
				defaultLabels: {
					a: 5,
					b: "John"
				}
			});
			reporter.init(fakeRegistry);

			expect(reporter.defaultLabels).toStrictEqual({
				a: 5,
				b: "John"
			});
		});
	});

	describe("Test flush method", () => {
		let reporter;
		afterEach(async () => {
			await reporter.stop();
		});

		it("should call generateDatadogSeries method but not fetch", async () => {
			const fakeBroker = {
				nodeID: "node-123",
				namespace: "test-ns"
			};
			const fakeRegistry = { broker: fakeBroker };
			reporter = new DatadogReporter({});
			reporter.init(fakeRegistry);

			reporter.generateDatadogSeries = mock.fn(() => []);

			await reporter.flush();

			expect(reporter.generateDatadogSeries).toHaveBeenCalledTimes(1);
			expect(fetch).toHaveBeenCalledTimes(0);
		});

		it("should call generateDatadogSeries method & fetch", async () => {
			const fakeBroker = {
				nodeID: "node-123",
				namespace: "test-ns"
			};
			const fakeRegistry = { broker: fakeBroker, logger: { debug: mock.fn() } };
			reporter = new DatadogReporter({ apiKey: "12345" });
			reporter.init(fakeRegistry);

			reporter.generateDatadogSeries = mock.fn(() => [{ a: 5 }, { a: 6 }]);

			await reporter.flush();

			expect(reporter.generateDatadogSeries).toHaveBeenCalledTimes(1);
			expect(fetch).toHaveBeenCalledTimes(1);
			expect(fetch).toHaveBeenCalledWith(
				"https://api.datadoghq.com/api/v1/series?api_key=12345",
				{
					body: '{"series":[{"a":5},{"a":6}]}',
					headers: {
						"Content-Type": "application/json"
					},
					method: "post"
				}
			);
		});
	});

	describe("Test generateDatadogSeries method", () => {
		let clock;
		let reporter;

		before(() => (clock = lolex.install({ now: 12345678000 })));
		after(() => clock.uninstall());
		afterEach(async () => {
			await reporter.stop();
		});

		const broker = new ServiceBroker({ logger: false, nodeID: "node-123" });
		const registry = new MetricRegistry(broker);

		after(async () => {
			await broker.stop();
		});

		it("should call generateDatadogSeries method but not fetch", () => {
			reporter = new DatadogReporter({
				host: "test-host",
				defaultLabels: {
					defLabel: 'def\\Value-"quote"'
				}
			});
			reporter.init(registry);

			registry.register({ name: "os.datetime.utc", type: "gauge" }).set(123456);
			registry.register({ name: "test.info", type: "info" }).set("Test Value");

			registry.register({ name: "test.counter", type: "counter", labelNames: ["action"] });
			registry.increment("test.counter", null, 5);
			registry.increment("test.counter", { action: "posts" }, 8);

			registry.register({ name: "test.gauge", type: "gauge", labelNames: ["action"] });
			registry.decrement("test.gauge", { action: "users" }, 8);

			registry.register({
				name: "test.histogram",
				type: "histogram",
				labelNames: ["action"],
				buckets: true,
				quantiles: true
			});
			registry.observe("test.histogram", 8, null);
			registry.observe("test.histogram", 2, null);
			registry.observe("test.histogram", 6, null);
			registry.observe("test.histogram", 2, null);

			registry.observe("test.histogram", 1, { action: "auth" });
			registry.observe("test.histogram", 3, { action: "auth" });
			registry.observe("test.histogram", 7, { action: "auth" });

			const res = reporter.generateDatadogSeries();

			expect(res).toMatchSnapshot();
		});
	});
});
