import { describe, it, before, after, afterEach, mock } from "../../helpers/test";
import expect from "../../helpers/expect";
import { autoShape, factoryMock, installMock, interopDefault } from "../../helpers/module-mock";

// `path` / `fs/promises` get an explicit mock shape: `mock.module` hands out a
// fresh copy per `require()`, so the spec has to assert on the *shared* shape
// object (which holds the very same mock functions the logger receives).
const pathShape = {
	...autoShape(require.resolve("path")),
	join: mock.fn((...args: string[]) => args.join("/")),
	resolve: mock.fn((...args: string[]) => args.join("/"))
};
installMock(require.resolve("path"), pathShape);

const fsShape = autoShape(require.resolve("fs/promises"));
installMock(require.resolve("fs/promises"), fsShape);

// `utils.makeDirs` is patched by replacing the whole module in the require
// cache: transpiled exports are non-writable getters. It has to happen before
// `src/loggers/file` is loaded, because that module binds the utils exports at
// load time.
const utilsPath = require.resolve("../../../src/utils");
const utils = { ...require(utilsPath), makeDirs: mock.fn() };
require.cache[utilsPath].exports = utils;

// The spec works with the shared shape objects, not with another `require()`
// copy – the mock functions are the ones the logger actually calls.
const path: any = pathShape;
const fs: any = fsShape;

const os = interopDefault(require("os"));
const FileLogger = interopDefault(require("../../../src/loggers/file"));
const ServiceBroker = interopDefault(require("../../../src/service-broker"));
const LoggerFactory = interopDefault(require("../../../src/logger-factory"));
const lolex = interopDefault(require("@sinonjs/fake-timers"));

const broker = new ServiceBroker({ logger: false, nodeID: "node-123", namespace: "test-ns" });

describe("Test File logger class", () => {
	let logger;
	afterEach(async () => {
		await logger.stop();
	});

	describe("Test Constructor", () => {
		it("should create with default options", () => {
			logger = new FileLogger();

			expect(logger.opts).toEqual({
				autoPadding: false,
				colors: false,
				createLogger: null,
				level: "info",
				folder: "./logs",
				filename: "moleculer-{date}.log",
				formatter: "full",
				objectPrinter: null,
				moduleColors: false,
				eol: os.EOL,
				interval: 1 * 1000
			});

			expect(logger.queue).toEqual([]);
			expect(logger.currentFilename).toBeNull();
			expect(logger.fs).toBeNull();
		});

		it("should create with custom options", () => {
			logger = new FileLogger({
				createLogger: mock.fn(),
				level: "debug",
				folder: "/my-log",
				filename: "moleculer-{ns}-{date}.json",
				formatter: "{timestamp} {level} {nodeID}/{mod}: {msg}",
				eol: "/",
				interval: 5 * 1000
			});

			expect(logger.opts).toEqual({
				autoPadding: false,
				colors: false,
				createLogger: expect.any(Function),
				level: "debug",
				folder: "/my-log",
				filename: "moleculer-{ns}-{date}.json",
				formatter: "{timestamp} {level} {nodeID}/{mod}: {msg}",
				objectPrinter: null,
				moduleColors: false,
				eol: "/",
				interval: 5 * 1000
			});
		});
	});

	describe("Test init method", () => {
		const loggerFactory = new LoggerFactory(broker);

		it("should init the logger", () => {
			logger = new FileLogger();

			logger.init(loggerFactory);

			expect(logger.logFolder).toBe("./logs");
			expect(logger.timer).toBeDefined();
		});

		it("should init the logger with custom options", () => {
			utils.makeDirs.mockClear();

			logger = new FileLogger({
				folder: "/logs/{namespace}/{nodeID}",
				interval: 0
			});

			logger.init(loggerFactory);

			expect(logger.logFolder).toBe("/logs/test-ns/node-123");
			expect(logger.timer).toBeNull();

			expect(utils.makeDirs).toHaveBeenCalledTimes(1);
			expect(utils.makeDirs).toHaveBeenCalledWith("/logs/test-ns/node-123");
		});
	});

	describe("Test stop method", () => {
		const loggerFactory = new LoggerFactory(broker);

		it("should create a default logger", async () => {
			logger = new FileLogger();

			logger.init(loggerFactory);

			expect(logger.timer).toBeDefined();
			logger.flush = mock.fn();

			await logger.stop();

			expect(logger.flush).toHaveBeenCalledTimes(1);
			expect(logger.timer).toBeNull();
		});
	});

	describe("Test getFilename method", () => {
		const loggerFactory = new LoggerFactory(broker);

		let clock;

		before(() => {
			clock = lolex.install();
		});

		after(() => {
			clock.uninstall();
		});

		it("should return interpolated filename", () => {
			logger = new FileLogger();

			logger.init(loggerFactory);

			expect(logger.getFilename()).toBe("./logs/moleculer-1970-01-01.log");
		});
	});

	describe("Test getLogHandler method", () => {
		const loggerFactory = new LoggerFactory(broker);
		let clock;

		before(() => {
			clock = lolex.install();
		});

		after(() => {
			clock.uninstall();
		});

		it("should create a child logger", () => {
			logger = new FileLogger({ level: "trace" });
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
				"[1970-01-01T00:00:00.000Z] FATAL node-1/MY-SERVICE: message { a: 5 }",
				"[1970-01-01T00:00:00.000Z] ERROR node-1/MY-SERVICE: message { a: 5 }",
				"[1970-01-01T00:00:00.000Z] WARN  node-1/MY-SERVICE: message { a: 5 }",
				"[1970-01-01T00:00:00.000Z] INFO  node-1/MY-SERVICE: message { a: 5 }",
				"[1970-01-01T00:00:00.000Z] DEBUG node-1/MY-SERVICE: message { a: 5 }",
				"[1970-01-01T00:00:00.000Z] TRACE node-1/MY-SERVICE: message { a: 5 }"
			]);

			expect(logger.flush).toHaveBeenCalledTimes(0);
		});

		it("should not call console if level is lower", () => {
			logger = new FileLogger({ level: "info" });
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
				"[1970-01-01T00:00:00.000Z] FATAL node-1/MY-SERVICE: message { a: 5 }",
				"[1970-01-01T00:00:00.000Z] ERROR node-1/MY-SERVICE: message { a: 5 }",
				"[1970-01-01T00:00:00.000Z] WARN  node-1/MY-SERVICE: message { a: 5 }",
				"[1970-01-01T00:00:00.000Z] INFO  node-1/MY-SERVICE: message { a: 5 }"
			]);
		});

		it("should not create child logger if level is null", () => {
			logger = new FileLogger();
			logger.init(loggerFactory);

			logger.getLogLevel = mock.fn();

			const logHandler = logger.getLogHandler({ mod: "my-service", nodeID: "node-1" });
			expect(logHandler).toBeNull();
			expect(logger.getLogLevel).toHaveBeenCalledTimes(1);
			expect(logger.getLogLevel).toHaveBeenCalledWith("my-service");
		});

		it("should not create child logger if bindings is null", () => {
			logger = new FileLogger();
			logger.init(loggerFactory);

			logger.getLogLevel = mock.fn();

			const logHandler = logger.getLogHandler();
			expect(logHandler).toBeNull();
			expect(logger.getLogLevel).toHaveBeenCalledTimes(0);
		});

		it("should call flush if not interval", () => {
			logger = new FileLogger({ level: "trace", interval: 0 });
			logger.init(loggerFactory);
			logger.flush = mock.fn();

			const logHandler = logger.getLogHandler({ mod: "my-service", nodeID: "node-1" });
			expect(logHandler).toBeInstanceOf(Function);

			logHandler("fatal", ["message", { a: 5 }]);
			logHandler("error", ["message", { a: 5 }]);

			expect(logger.queue).toEqual([
				"[1970-01-01T00:00:00.000Z] FATAL node-1/MY-SERVICE: message { a: 5 }",
				"[1970-01-01T00:00:00.000Z] ERROR node-1/MY-SERVICE: message { a: 5 }"
			]);

			expect(logger.flush).toHaveBeenCalledTimes(2);
		});
	});

	describe("Test flush method", () => {
		const loggerFactory = new LoggerFactory(broker);

		let clock;

		before(() => {
			clock = lolex.install();
		});

		after(() => {
			clock.uninstall();
		});

		it("should do nothing if queue is empty", () => {
			logger = new FileLogger({ level: "trace", interval: 0 });
			logger.init(loggerFactory);

			logger.renderRow = mock.fn();
			fs.appendFile.mockClear();

			logger.flush();

			expect(logger.renderRow).toHaveBeenCalledTimes(0);
			expect(fs.appendFile).toHaveBeenCalledTimes(0);
		});

		it("should render rows and call appendFile", async () => {
			logger = new FileLogger({ level: "trace", eol: "\n" });
			logger.init(loggerFactory);

			const logHandler = logger.getLogHandler({ mod: "my-service", nodeID: "node-1" });
			logHandler("fatal", ["message", { a: 5 }]);
			logHandler("error", ["message", { a: 5 }]);

			logger.formatter = mock.fn(() => "rendered");
			// Reuse the shared mock (the logger holds the very same function);
			// a fresh `mock.fn()` here would never be called by the logger.
			fs.appendFile.mockImplementation(() => Promise.resolve());

			await logger.flush();

			expect(fs.appendFile).toHaveBeenCalledTimes(1);
			expect(fs.appendFile).toHaveBeenCalledWith(
				"./logs/moleculer-1970-01-01.log",
				"[1970-01-01T00:00:00.000Z] FATAL node-1/MY-SERVICE: message { a: 5 }\n[1970-01-01T00:00:00.000Z] ERROR node-1/MY-SERVICE: message { a: 5 }\n"
			);
		});

		it("should call flush after interval", () => {
			logger = new FileLogger({ level: "trace", interval: 2000 });
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
