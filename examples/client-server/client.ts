/*
 * moleculer
 * Copyright (c) 2024 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

/**
 * Client-server example - client node.
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

import _ = require("lodash");
import kleur = require("kleur");
import ServiceBroker = require("../../src/service-broker");
import Context = require("../../src/context");
import { randomInt } from "../../src/utils";
import type { LogLevels } from "../../src/loggers/base";
import type { TransporterType } from "../../src/service-broker";
import type { ServiceSettingSchema } from "../../src/service";

const transporter = (process.env.TRANSPORTER || "TCP") as TransporterType;

// Create the broker
const broker = new ServiceBroker({
	namespace: "multi",
	nodeID: process.argv[2] || `client-${process.pid}`,
	transporter,
	// serializer: "CBOR",
	requestTimeout: 1000,

	circuitBreaker: {
		enabled: false
	},
	logger: { type: "Console" },
	logLevel: process.env.LOGLEVEL as LogLevels
});

// Local variables of the service (typed, unlike `(this as any).counter`)
interface LocalVars {
	counter: number;
}

broker.createService<ServiceSettingSchema, Record<string, any>, LocalVars>({
	name: "event-handler",
	events: {
		"$circuit-breaker.opened"(ctx) {
			broker.logger.warn(
				kleur.yellow().bold(`---  Circuit breaker opened on '${ctx.params.nodeID}'!`)
			);
		},

		"$circuit-breaker.half-opened"(ctx) {
			broker.logger.warn(
				kleur.green(`---  Circuit breaker half-opened on '${ctx.params.nodeID}'!`)
			);
		},

		"$circuit-breaker.closed"(ctx) {
			broker.logger.warn(
				kleur.green().bold(`---  Circuit breaker closed on '${ctx.params.nodeID}'!`)
			);
		}
	},

	started() {
		this.counter = 1;

		setInterval(() => {
			broker.logger.info(`>> Send echo event. Counter: ${this.counter}.`);
			broker.emit("echo.event", { counter: this.counter++ });
		}, 5000);
	}
});

let reqCount = 0;
let pendingReqs: number[] = [];

/** `broker.call` resolves with a pointer to the context it was sent with. */
type CallWithCtx<T> = Promise<T> & { ctx?: Context };

broker
	.start()
	.then(() => broker.repl())
	.then(() => broker.waitForServices("math"))
	.then(() => {
		setInterval(() => {
			let pendingInfo = "";
			if (pendingReqs.length > 10) {
				pendingInfo = ` [${pendingReqs.slice(0, 10).join(",")}] + ${
					pendingReqs.length - 10
				}`;
			} else if (pendingReqs.length > 0) {
				pendingInfo = ` [${pendingReqs.join(",")}]`;
			}

			const payload = { a: randomInt(0, 100), b: randomInt(0, 100), count: ++reqCount };
			pendingReqs.push(reqCount);

			const p = broker.call("math.add", payload) as CallWithCtx<{
				count: number;
				res: number;
			}>;

			if (p.ctx) {
				broker.logger.info(
					kleur.grey(
						`${reqCount}. Send request (${payload.a} + ${payload.b}) to ${
							p.ctx.nodeID ? p.ctx.nodeID : "some node"
						} (queue: ${broker.transit.pendingRequests.size})...`
					),
					kleur.yellow().bold(pendingInfo)
				);
			}

			p.then(({ count, res }) => {
				broker.logger.info(
					_.padEnd(`${count}. ${payload.a} + ${payload.b} = ${res}`, 20),
					`(from: ${p.ctx.nodeID})`
				);

				// Remove from pending
				if (pendingReqs.indexOf(count) !== -1)
					pendingReqs = pendingReqs.filter(n => n != count);
				else broker.logger.warn(kleur.red().bold(`Invalid coming request count: ${count}`));
			}).catch(err => {
				broker.logger.warn(
					kleur
						.red()
						.bold(
							_.padEnd(
								`${payload.count}. ${payload.a} + ${payload.b} = ERROR! ${err.message}`
							)
						)
				);
				if (pendingReqs.indexOf(payload.count) !== -1)
					pendingReqs = pendingReqs.filter(n => n != payload.count);
			});
		}, 1000);
	});
