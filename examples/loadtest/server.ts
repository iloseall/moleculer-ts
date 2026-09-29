import ServiceBroker from "../../src/service-broker";
import { padStart } from "lodash";
import type { TransporterType } from "../../src/service-broker";
import type { DiscovererType } from "../../src/registry/registry";

import os from "os";
const hostname = os.hostname();

const transporter = (process.env.TRANSPORTER || "TCP") as TransporterType;

let count = 0;
const sum = 0;
const maxTime = null;

// Create broker
const broker = new ServiceBroker({
	namespace: "loadtest",
	nodeID: process.argv[2] || hostname + "-server",
	transporter,
	logger: console,
	logLevel: "warn",
	//metrics: true,
	registry: {
		discoverer: (process.env.DISCOVERER || "Local") as DiscovererType
	}
});

broker.createService({
	name: "math",
	actions: {
		add(ctx) {
			count++;
			return Number(ctx.params.a) + Number(ctx.params.b);
		}
	}
});

broker.createService({
	name: "perf",
	actions: {
		reply(ctx) {
			count++;
			return ctx.params;
		}
	}
});
//broker.loadService(__dirname + "/../rest.service");

broker.start();

console.log(
	"Server started. nodeID: ",
	broker.nodeID,
	" TRANSPORTER:",
	transporter,
	" PID:",
	process.pid
);

setInterval(() => {
	if (count > 0) {
		console.log(
			broker.nodeID,
			":",
			padStart(Number(count.toFixed(0)).toLocaleString(), 8),
			"req/s"
		);
		count = 0;
	}
}, 1000);
