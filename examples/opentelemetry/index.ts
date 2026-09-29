// Instead use `-r ./tracing.js` // require("./tracing");

import path from "path";

import ServiceBroker from "../../src/service-broker";
import type { BrokerOptions } from "../../src/service-broker";
import opentelemetryMiddleware from "./opentelemetry.middleware";
import { api } from "@opentelemetry/sdk-node";

const brokerOpts: BrokerOptions = {
	logger: console,
	logLevel: "info",
	transporter: "Redis",
	//cacher: "Redis",

	// Ddisable built-in metrics.
	metrics: {
		enabled: false
	},

	// Disable built-in tracing.
	tracing: {
		enabled: false
	},

	internalMiddlewares: false,

	// Register custom middlewares
	middlewares: [
		"ActionHook",
		"Validator",
		"Bulkhead",
		"Cacher",
		"ContextTracker",
		"CircuitBreaker",
		"Timeout",
		"Retry",
		"Fallback",
		"ErrorHandler",
		opentelemetryMiddleware,
		"Metrics",
		"Debounce",
		"Throttle"
	]
};

// Create broker
const broker = new ServiceBroker({
	nodeID: "otel-1",
	...brokerOpts
});

const broker2 = new ServiceBroker({
	nodeID: "otel-2",
	...brokerOpts
});

broker2.loadService(path.join(__dirname, "..", "post.service.ts"));
broker2.loadService(path.join(__dirname, "..", "user.service.ts"));

Promise.all([broker.start(), broker2.start()]).then(async () => {
	await broker.waitForServices("posts");

	const tracer = api.trace.getTracer("moleculer-otel");

	setInterval(async () => {
		tracer.startActiveSpan("doWork", async span => {
			console.log("Dowork...");
			await broker.call("posts.get", { id: 3 });

			span.end();
		});
	}, 2500);
});
