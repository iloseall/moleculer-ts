import { describe, it, mock } from "../../helpers/test";
import expect from "../../helpers/expect";

import ServiceBroker from "../../../src/service-broker";
import { MoleculerError } from "../../../src/errors";
import Context from "../../../src/context";
import { protectReject } from "../../helpers/utils";

const Middleware = require("../../../src/middlewares").Fallback;

describe("Test FallbackMiddleware", () => {
	const broker = new ServiceBroker({ nodeID: "server-1", logger: false, transporter: "Fake" });
	const handler = mock.fn(() => Promise.resolve("Result"));
	const action = {
		name: "posts.find",
		handler,
		service: {
			fullName: "posts",
			logger: broker.getLogger(),
			someFallbackMethod: mock.fn(() => "Fallback response from method")
		}
	};
	const endpoint = {
		action,
		node: {
			id: broker.nodeID
		}
	};

	broker.isMetricsEnabled = mock.fn(() => true);
	broker.metrics.register = mock.fn();
	broker.metrics.increment = mock.fn();

	const mw = Middleware(broker);

	it("should register hooks", () => {
		expect(mw.created).toBeInstanceOf(Function);
		expect(mw.localAction).toBeInstanceOf(Function);
		expect(mw.remoteAction).toBeInstanceOf(Function);
	});

	it("should wrap handler", () => {
		const newHandler = mw.localAction.call(broker, handler, action);
		expect(newHandler).not.toBe(handler);
	});

	it("should register metrics", () => {
		mw.created(broker);
		expect(broker.metrics.register).toHaveBeenCalledTimes(1);
		expect(broker.metrics.register).toHaveBeenCalledWith({
			type: "counter",
			name: "moleculer.request.fallback.total",
			labelNames: ["service", "action"],
			description: "Number of fallbacked requests",
			rate: true
		});
	});

	it("should call fallback Function and return", () => {
		broker.metrics.increment.mockClear();
		action.fallback = mock.fn(() => "Fallback response");
		const error = new MoleculerError("Some error");
		const handler = mock.fn(() => Promise.reject(error));

		const newHandler = mw.localAction.call(broker, handler, action);
		const ctx = Context.create(broker, endpoint);

		return newHandler(ctx)
			.catch(protectReject)
			.then(res => {
				expect(res).toBe("Fallback response");

				expect(action.fallback).toHaveBeenCalledTimes(1);
				expect(action.fallback).toHaveBeenCalledWith(ctx, error);

				expect(broker.metrics.increment).toHaveBeenCalledTimes(1);
				expect(broker.metrics.increment).toHaveBeenCalledWith(
					"moleculer.request.fallback.total",
					{ service: "posts", action: "posts.find" }
				);
			});
	});

	it("should call fallback Function and return", () => {
		broker.metrics.increment.mockClear();
		action.fallback = "someFallbackMethod";
		const error = new MoleculerError("Some error");
		const handler = mock.fn(() => Promise.reject(error));

		const newHandler = mw.localAction.call(broker, handler, action);
		const ctx = Context.create(broker, endpoint);

		return newHandler(ctx)
			.catch(protectReject)
			.then(res => {
				expect(res).toBe("Fallback response from method");

				expect(action.service.someFallbackMethod).toHaveBeenCalledTimes(1);
				expect(action.service.someFallbackMethod).toHaveBeenCalledWith(ctx, error);

				expect(broker.metrics.increment).toHaveBeenCalledTimes(1);
				expect(broker.metrics.increment).toHaveBeenCalledWith(
					"moleculer.request.fallback.total",
					{ service: "posts", action: "posts.find" }
				);
			});
	});

	it("should return fallbackResponse (native type)", () => {
		broker.metrics.increment.mockClear();
		action.fallback = null;
		const error = new MoleculerError("Some error");
		const handler = mock.fn(() => Promise.reject(error));

		const newHandler = mw.localAction.call(broker, handler, action);
		const ctx = Context.create(broker, endpoint, null, {
			fallbackResponse: "fallback response"
		});

		return newHandler(ctx)
			.catch(protectReject)
			.then(res => {
				expect(res).toBe("fallback response");

				expect(broker.metrics.increment).toHaveBeenCalledTimes(1);
				expect(broker.metrics.increment).toHaveBeenCalledWith(
					"moleculer.request.fallback.total",
					{ action: "posts.find" }
				);
			});
	});

	it("should return fallbackResponse (function)", () => {
		broker.metrics.increment.mockClear();
		const error = new MoleculerError("Some error");
		const handler = mock.fn(() => Promise.reject(error));
		const fallbackResponse = mock.fn(() => "fallback response");

		const newHandler = mw.localAction.call(broker, handler, action);
		const ctx = Context.create(broker, endpoint, null, { fallbackResponse });
		expect(ctx.options.fallbackResponse).toBe(fallbackResponse);

		return newHandler(ctx)
			.catch(protectReject)
			.then(res => {
				expect(res).toBe("fallback response");
				expect(fallbackResponse).toHaveBeenCalledTimes(1);
				expect(fallbackResponse).toHaveBeenCalledWith(ctx, error);

				expect(broker.metrics.increment).toHaveBeenCalledTimes(1);
				expect(broker.metrics.increment).toHaveBeenCalledWith(
					"moleculer.request.fallback.total",
					{ action: "posts.find" }
				);
			});
	});
});
