import { describe, it, before, after, afterEach, mock } from "../../helpers/test";
import expect from "../../helpers/expect";

import DatadogLogger from "../../../src/loggers/datadog";
import ServiceBroker from "../../../src/service-broker";
import LoggerFactory from "../../../src/logger-factory";
import lolex from "@sinonjs/fake-timers";
import os from "os";

global.fetch = mock.fn(() => Promise.resolve({ statusText: "" }));

process.env.DATADOG_API_KEY = "datadog-api-key";

const broker = new ServiceBroker({ logger: false, nodeID: "node-123", namespace: "test-ns" });

describe("Test Datadog logger class", () => {
	describe("Test Constructor", () => {
		it("should create with default options", () => {
			const logger = new DatadogLogger();

			expect(logger.opts).toEqual({
				createLogger: null,
				level: "info",
				url: "https://http-intake.logs.datadoghq.com/api/v2/logs/",
				apiKey: "datadog-api-key",
				ddSource: "moleculer",
				env: undefined,
				hostname: os.hostname(),
				objectPrinter: null,
				interval: 10 * 1000
			});

			expect(logger.queue).toEqual([]);
			expect(logger.timer).toBeNull();
		});

		it("should create with custom options", () => {
			const logger = new DatadogLogger({
				createLogger: mock.fn(),
				level: "debug",
				ddSource: "my-app",
				env: "production",
				hostname: "my-host",
				objectPrinter: mock.fn(),
				interval: 30 * 1000
			});

			expect(logger.opts).toEqual({
				createLogger: expect.any(Function),
				level: "debug",
				url: "https://http-intake.logs.datadoghq.com/api/v2/logs/",
				apiKey: "datadog-api-key",
				ddSource: "my-app",
				env: "production",
				hostname: "my-host",
				objectPrinter: expect.any(Function),
				interval: 30 * 1000
			});
		});

		it("should throw error if apiKey is not defined", () => {
			expect(() => new DatadogLogger({ apiKey: "" })).toThrow(
				"Datadog API key is missing. Set DATADOG_API_KEY environment variable."
			);
		});
	});

	describe("Test init method", () => {
		const loggerFactory = new LoggerFactory(broker);
		let logger;

		afterEach(async () => {
			await logger.stop();
		});

		it("should init the logger", () => {
			logger = new DatadogLogger();
			logger.init(loggerFactory);

			expect(logger.objectPrinter).toBeDefined();
			expect(logger.timer).toBeDefined();
		});

		it("should init the logger with custom options", () => {
			logger = new DatadogLogger({
				interval: 0
			});
			logger.init(loggerFactory);

			expect(logger.timer).toBeNull();
		});

		it("should use custom objectPrinter", () => {
			const objectPrinter = mock.fn();
			logger = new DatadogLogger({
				objectPrinter
			});

			logger.init(loggerFactory);

			expect(logger.objectPrinter).toBe(objectPrinter);
		});
	});

	describe("Test stop method", () => {
		const loggerFactory = new LoggerFactory(broker);

		it("should create a default logger", async () => {
			const logger = new DatadogLogger();

			logger.init(loggerFactory);

			expect(logger.timer).toBeDefined();
			logger.flush = mock.fn();

			await logger.stop();

			expect(logger.flush).toHaveBeenCalledTimes(1);
			expect(logger.timer).toBeNull();
		});
	});

	describe("Test getTags method", () => {
		const loggerFactory = new LoggerFactory(broker);
		let logger;

		afterEach(async () => {
			await logger.stop();
		});

		it("should return tags from row", () => {
			logger = new DatadogLogger({
				env: "production"
			});

			logger.init(loggerFactory);

			expect(
				logger.getTags({
					bindings: {
						nodeID: "my-node",
						ns: "namespace",
						svc: "users"
					}
				})
			).toBe("env:production,nodeID:my-node,namespace:namespace,service:users");
		});
	});

	describe("Test getLogHandler method", () => {
		const loggerFactory = new LoggerFactory(broker);
		let clock;
		let logger;

		before(() => {
			clock = lolex.install();
		});

		after(() => {
			clock.uninstall();
		});

		afterEach(async () => {
			await logger.stop();
		});

		it("should create a child logger", () => {
			logger = new DatadogLogger({ level: "trace" });
			logger.init(loggerFactory);
			logger.flush = mock.fn();

			const logHandler = logger.getLogHandler({ mod: "my-service", nodeID: "node-1" });
			expect(logHandler).toBeInstanceOf(Function);

			logHandler("fatal", ["message", { a: 5 }]);
			logHandler("error", ["message", { a: 5 }]);
			logHandler("warn", ["message", { a: 5 }]);
			logHandler("info", ["message", { a: 5 }]);
			logHandler("debug", ["message", { a: 5 }]);
			logHandler("trace", ["message", { a: 5 }]);

			expect(logger.queue).toEqual([
				{
					level: "fatal",
					msg: "message { a: 5 }",
					bindings: { mod: "my-service", nodeID: "node-1" },
					ts: 0
				},
				{
					level: "error",
					msg: "message { a: 5 }",
					bindings: { mod: "my-service", nodeID: "node-1" },
					ts: 0
				},
				{
					level: "warn",
					msg: "message { a: 5 }",
					bindings: { mod: "my-service", nodeID: "node-1" },
					ts: 0
				},
				{
					level: "info",
					msg: "message { a: 5 }",
					bindings: { mod: "my-service", nodeID: "node-1" },
					ts: 0
				},
				{
					level: "debug",
					msg: "message { a: 5 }",
					bindings: { mod: "my-service", nodeID: "node-1" },
					ts: 0
				},
				{
					level: "trace",
					msg: "message { a: 5 }",
					bindings: { mod: "my-service", nodeID: "node-1" },
					ts: 0
				}
			]);

			expect(logger.flush).toHaveBeenCalledTimes(0);
		});

		it("should not call console if level is lower", () => {
			logger = new DatadogLogger({ level: "info" });
			logger.init(loggerFactory);
			logger.flush = mock.fn();

			const logHandler = logger.getLogHandler({ mod: "my-service", nodeID: "node-1" });
			expect(logHandler).toBeInstanceOf(Function);

			logHandler("fatal", ["message", { a: 5 }]);
			logHandler("error", ["message", { a: 5 }]);
			logHandler("warn", ["message", { a: 5 }]);
			logHandler("info", ["message", { a: 5 }]);
			logHandler("debug", ["message", { a: 5 }]);
			logHandler("trace", ["message", { a: 5 }]);

			expect(logger.queue).toEqual([
				{
					level: "fatal",
					msg: "message { a: 5 }",
					bindings: { mod: "my-service", nodeID: "node-1" },
					ts: 0
				},
				{
					level: "error",
					msg: "message { a: 5 }",
					bindings: { mod: "my-service", nodeID: "node-1" },
					ts: 0
				},
				{
					level: "warn",
					msg: "message { a: 5 }",
					bindings: { mod: "my-service", nodeID: "node-1" },
					ts: 0
				},
				{
					level: "info",
					msg: "message { a: 5 }",
					bindings: { mod: "my-service", nodeID: "node-1" },
					ts: 0
				}
			]);
		});

		it("should not create child logger if level is null", () => {
			logger = new DatadogLogger();
			logger.init(loggerFactory);

			logger.getLogLevel = mock.fn();

			const logHandler = logger.getLogHandler({ mod: "my-service", nodeID: "node-1" });
			expect(logHandler).toBeNull();
			expect(logger.getLogLevel).toHaveBeenCalledTimes(1);
			expect(logger.getLogLevel).toHaveBeenCalledWith("my-service");
		});

		it("should not create child logger if bindings is null", () => {
			logger = new DatadogLogger();
			logger.init(loggerFactory);

			logger.getLogLevel = mock.fn();

			const logHandler = logger.getLogHandler();
			expect(logHandler).toBeNull();
			expect(logger.getLogLevel).toHaveBeenCalledTimes(0);
		});

		it("should call flush if not interval", () => {
			logger = new DatadogLogger({ level: "trace", interval: 0 });
			logger.init(loggerFactory);
			logger.flush = mock.fn();

			const logHandler = logger.getLogHandler({ mod: "my-service", nodeID: "node-1" });
			expect(logHandler).toBeInstanceOf(Function);

			logHandler("fatal", ["message", { a: 5 }]);
			logHandler("error", ["message", { a: 5 }]);

			expect(logger.queue).toEqual([
				{
					ts: 0,
					level: "fatal",
					msg: "message { a: 5 }",
					bindings: { nodeID: "node-1", mod: "my-service" }
				},
				{
					ts: 0,
					level: "error",
					msg: "message { a: 5 }",
					bindings: { nodeID: "node-1", mod: "my-service" }
				}
			]);

			expect(logger.flush).toHaveBeenCalledTimes(2);
		});
	});

	describe("Test flush method", () => {
		const loggerFactory = new LoggerFactory(broker);

		let clock;
		let logger;

		before(() => {
			clock = lolex.install();
		});

		after(() => {
			clock.uninstall();
		});

		afterEach(async () => {
			await logger.stop();
		});

		it("should do nothing if queue is empty", () => {
			logger = new DatadogLogger({ level: "trace", interval: 0 });
			logger.init(loggerFactory);

			fetch.mockClear();

			logger.flush();

			expect(fetch).toHaveBeenCalledTimes(0);
		});

		it("should render rows and call appendFile", () => {
			logger = new DatadogLogger({ level: "trace", eol: "\n", hostname: "my-host" });
			logger.init(loggerFactory);

			const logHandler = logger.getLogHandler({ mod: "my-service", nodeID: "node-1" });
			logHandler("fatal", ["message", { a: 5 }]);
			logHandler("error", ["message", { a: 5 }]);

			fetch.mockClear();

			logger.flush();

			expect(fetch).toHaveBeenCalledTimes(1);
			expect(fetch).toHaveBeenCalledWith(
				"https://http-intake.logs.datadoghq.com/api/v2/logs/",
				{
					method: "post",
					headers: {
						"Content-Type": "application/json",
						"DD-API-KEY": "datadog-api-key"
					},
					body: '[{"timestamp":0,"level":"fatal","message":"message { a: 5 }","nodeID":"node-1","ddsource":"moleculer","ddtags":"env:,nodeID:node-1,namespace:undefined","hostname":"my-host"},{"timestamp":0,"level":"error","message":"message { a: 5 }","nodeID":"node-1","ddsource":"moleculer","ddtags":"env:,nodeID:node-1,namespace:undefined","hostname":"my-host"}]'
				}
			);
		});

		it("should call flush after interval", () => {
			logger = new DatadogLogger({ level: "trace", interval: 2000 });
			logger.init(loggerFactory);
			logger.flush = mock.fn();

			const logHandler = logger.getLogHandler({ mod: "my-service", nodeID: "node-1" });
			logHandler("fatal", ["message", { a: 5 }]);
			logHandler("error", ["message", { a: 5 }]);

			expect(logger.flush).toHaveBeenCalledTimes(0);

			clock.tick(2100);

			expect(logger.flush).toHaveBeenCalledTimes(1);
		});
	});
});
