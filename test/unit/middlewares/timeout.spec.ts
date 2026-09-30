import { describe, it, mock } from "../../helpers/test";
import expect from "../../helpers/expect";

import ServiceBroker from "../../../src/service-broker";
import { RequestTimeoutError } from "../../../src/errors";
import Context from "../../../src/context";
import { protectReject } from "../../helpers/utils";
import lolex from "@sinonjs/fake-timers";

const Middleware = require("../../../src/middlewares").Timeout;

describe("Test TimeoutMiddleware", () => {
	const broker = new ServiceBroker({ nodeID: "server-1", logger: false });
	const handler = mock.fn(() => Promise.resolve("Result"));
	const action = {
		name: "posts.find",
		service: {
			fullName: "posts"
		},
		handler
	};
	const endpoint = {
		action,
		id: broker.nodeID
	};

	broker.isMetricsEnabled = mock.fn(() => true);
	broker.metrics.register = mock.fn();
	broker.metrics.increment = mock.fn();

	const mw = Middleware(broker);

	it("should register hooks", () => {
		expect(mw.localAction).toBeInstanceOf(Function);
		expect(mw.remoteAction).toBeInstanceOf(Function);
	});

	it("should wrap handler", () => {
		broker.options.metrics = true;

		const newHandler = mw.localAction.call(broker, handler, action);
		expect(newHandler).not.toBe(handler);
	});

	it("should register metrics", () => {
		mw.created(broker);
		expect(broker.metrics.register).toHaveBeenCalledTimes(1);
		expect(broker.metrics.register).toHaveBeenCalledWith({
			type: "counter",
			name: "moleculer.request.timeout.total",
			labelNames: ["service", "action"],
			description: "Number of timed out requests",
			rate: true
		});
	});

	it("should not be timeout if requestTimeout is 0", () => {
		broker.metrics.increment.mockClear();
		broker.options.requestTimeout = 0;
		const newHandler = mw.localAction.call(broker, handler, action);

		const ctx = Context.create(broker, endpoint);

		return newHandler(ctx)
			.catch(protectReject)
			.then(res => {
				expect(res).toBe("Result");
				expect(ctx.options.timeout).toBe(0);
				expect(handler).toHaveBeenCalledTimes(1);

				expect(broker.metrics.increment).toHaveBeenCalledTimes(0);
			});
	});

	it("should handle timeout from global setting", () => {
		const clock = lolex.install();

		broker.metrics.increment.mockClear();
		broker.options.requestTimeout = 5000;

		const handler = mock.fn(() => broker.Promise.delay(10 * 1000));
		const newHandler = mw.localAction.call(broker, handler, action);

		const ctx = Context.create(broker, endpoint);

		const p = newHandler(ctx);

		clock.tick(5500);

		return p.then(protectReject).catch(err => {
			expect(ctx.startHrTime).toBeDefined();
			expect(ctx.options.timeout).toBe(5000);
			expect(handler).toHaveBeenCalledTimes(1);

			expect(broker.metrics.increment).toHaveBeenCalledTimes(1);
			expect(broker.metrics.increment).toHaveBeenCalledWith(
				"moleculer.request.timeout.total",
				{ service: "posts", action: "posts.find" }
			);

			expect(err).toBeInstanceOf(Error);
			expect(err).toBeInstanceOf(RequestTimeoutError);
			expect(err.message).toBe(
				"Request is timed out when call 'posts.find' action on 'server-1' node."
			);
			expect(err.data).toEqual({ action: "posts.find", nodeID: "server-1" });

			clock.uninstall();
		});
	});

	it("should handle timeout from action setting", () => {
		const clock = lolex.install();

		broker.metrics.increment.mockClear();
		broker.options.requestTimeout = 5000;
		action.timeout = 4000;

		const handler = mock.fn(() => broker.Promise.delay(10 * 1000));
		const newHandler = mw.localAction.call(broker, handler, action);

		const ctx = Context.create(broker, endpoint);

		const p = newHandler(ctx);

		clock.tick(5500);

		return p.then(protectReject).catch(err => {
			expect(ctx.startHrTime).toBeDefined();
			expect(ctx.options.timeout).toBe(4000);
			expect(handler).toHaveBeenCalledTimes(1);

			expect(broker.metrics.increment).toHaveBeenCalledTimes(1);
			expect(broker.metrics.increment).toHaveBeenCalledWith(
				"moleculer.request.timeout.total",
				{ service: "posts", action: "posts.find" }
			);

			expect(err).toBeInstanceOf(Error);
			expect(err).toBeInstanceOf(RequestTimeoutError);
			expect(err.message).toBe(
				"Request is timed out when call 'posts.find' action on 'server-1' node."
			);
			expect(err.data).toEqual({ action: "posts.find", nodeID: "server-1" });

			clock.uninstall();
		});
	});

	it("should handle timeout from Context setting", () => {
		const clock = lolex.install();

		broker.metrics.increment.mockClear();
		broker.options.requestTimeout = 5000;
		action.timeout = 4000;

		const handler = mock.fn(() => broker.Promise.delay(10 * 1000));
		const newHandler = mw.localAction.call(broker, handler, action);

		const ctx = Context.create(broker, endpoint);
		ctx.options.timeout = 2000;

		const p = newHandler(ctx);

		clock.tick(5500);

		return p.then(protectReject).catch(err => {
			expect(ctx.startHrTime).toBeDefined();
			expect(ctx.options.timeout).toBe(2000);
			expect(handler).toHaveBeenCalledTimes(1);

			expect(broker.metrics.increment).toHaveBeenCalledTimes(1);
			expect(broker.metrics.increment).toHaveBeenCalledWith(
				"moleculer.request.timeout.total",
				{ service: "posts", action: "posts.find" }
			);

			expect(err).toBeInstanceOf(Error);
			expect(err).toBeInstanceOf(RequestTimeoutError);
			expect(err.message).toBe(
				"Request is timed out when call 'posts.find' action on 'server-1' node."
			);
			expect(err.data).toEqual({ action: "posts.find", nodeID: "server-1" });

			clock.uninstall();
		});
	});

	it("should don't touch other errors", () => {
		broker.metrics.increment.mockClear();
		const err = new Error("Some error");
		const handler = mock.fn(() => Promise.reject(err));

		const newHandler = mw.localAction.call(broker, handler, action);

		const ctx = Context.create(broker, endpoint);

		return newHandler(ctx)
			.then(protectReject)
			.catch(res => {
				expect(ctx.options.timeout).toBe(4000);
				expect(res).toBe(err);

				expect(broker.metrics.increment).toHaveBeenCalledTimes(0);
			});
	});
});
