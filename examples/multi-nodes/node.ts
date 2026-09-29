import _ from "lodash";
import cluster from "cluster";
import ServiceBroker from "../../src/service-broker";
import type { TransporterType } from "../../src/service-broker";
import type { DiscovererType } from "../../src/registry/registry";
import type { LogLevels } from "../../src/loggers/base";
import EventReporter from "../../src/metrics/reporters/event";

class ProcessEventMetricReporter extends EventReporter {
	sendEvent() {
		let list = this.registry.list({
			includes: this.opts.includes,
			excludes: this.opts.excludes
		});

		if (this.opts.onlyChanges) list = list.filter(metric => this.lastChanges.has(metric.name));

		if (list.length == 0) return;

		process.send({ event: "metrics", list });

		this.lastChanges.clear();
	}
}

function start(opts) {
	const transporter = (process.env.TRANSPORTER || "NATS") as TransporterType;

	// Create broker
	const broker = new ServiceBroker({
		namespace: process.env.NAMESPACE || "nodes",
		nodeID: opts.nodeID || "node-" + process.pid,
		transporter,
		logger: [
			"Console" /*, {
		type: "File",
		options: {
			// Logging level
			level: "info",
			// Folder path to save files. You can use {nodeID} & {namespace} variables.
			folder: "./logs",
			// Filename template. You can use {date}, {nodeID} & {namespace} variables.
			filename: "{nodeID}-{date}.log",
			// Line formatter. It can be "json", "short", "simple", "full", a `Function` or a template string like "{timestamp} {level} {nodeID}/{mod}: {msg}"
			formatter: "short"
		}
	}*/
		],
		logLevel: (process.env.LOGLEVEL || "warn") as LogLevels,
		metrics: {
			enabled: true,
			reporter: new ProcessEventMetricReporter({
				includes: "moleculer.transporter.packets.**"
			})
		},
		//heartbeatInterval: 10,
		//heartbeatTimeout: 3 * 60,
		registry: {
			discoverer: {
				type: (process.env.DISCOVERER || "Local") as DiscovererType,
				options: {
					serializer: process.env.DISCOVERER_SERIALIZER
				}
			}
		}
	});

	function sendUpdatedRegistry() {
		const nodes = {};
		broker.registry.nodes.toArray().forEach(node => {
			nodes[node.id] = _.pick(node, ["available", "seq"]);
		});

		//console.log(broker.nodeID, res);
		process.send({ event: "registry", nodes });
	}

	broker.localBus.on("$services.changed", () => sendUpdatedRegistry());
	//broker.localBus.on("$node.connected", () => sendUpdatedRegistry());
	broker.localBus.on("$node.disconnected", () => sendUpdatedRegistry());

	broker.start().then(() => {
		process.on("message", async (msg: any) => {
			if (msg.cmd == "stop") {
				await broker.stop();
				process.exit(0);
			}
		});
		process.send({
			event: "started",
			nodeID: broker.nodeID,
			tx: transporter,
			pid: process.pid
		});
	});
}

process.on("message", (msg: any) => {
	if (msg.cmd == "start") {
		start(msg);
	}
});
