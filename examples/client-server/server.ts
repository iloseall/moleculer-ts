/*
 * moleculer
 * Copyright (c) 2024 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

/**
 * Client-server example - server node.
 *
 * Terminal 1: `npm run demo:client-server:server`
 * Terminal 2: `npm run demo:client-server:client`
 *
 * The transporter can be changed with the `TRANSPORTER` env variable (default: TCP),
 * the log level with `LOGLEVEL`.
 *
 * NOTE: the event handler receives a single `Context` object (`ctx.params` is the payload,
 * `ctx.nodeID` is the sender node).
 */

import _ from "lodash";
import ServiceBroker from "../../src/service-broker";
import type { LogLevels } from "../../src/loggers/base";
import type { TransporterType } from "../../src/service-broker";

const transporter = (process.env.TRANSPORTER || "TCP") as TransporterType;

// Create the broker
const broker = new ServiceBroker({
	namespace: "multi",
	nodeID: process.argv[2] || `server-${process.pid}`,
	transporter,
	// serializer: "CBOR",

	logger: { type: "Console" },
	logLevel: process.env.LOGLEVEL as LogLevels
});

broker.createService({
	name: "math",
	actions: {
		add(ctx) {
			this.logger.info(
				_.padEnd(`${ctx.params.count}. Add ${ctx.params.a} + ${ctx.params.b}`, 20),
				`(from: ${ctx.nodeID})`
			);

			return {
				count: ctx.params.count,
				res: Number(ctx.params.a) + Number(ctx.params.b)
			};
		}
	},

	events: {
		"echo.event"(ctx) {
			this.logger.info(
				`<< MATH: Echo event received from ${ctx.nodeID}. Counter: ${ctx.params.counter}. Send reply...`
			);
			this.broker.emit("reply.event", ctx.params);
		}
	}
});

broker
	.start()
	.then(() => {
		setInterval(() => broker.broadcast("echo.broadcast"), 5 * 1000);
	})
	.then(() => broker.repl());
