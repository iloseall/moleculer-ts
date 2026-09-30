import { describe, it, before, after, mock } from "../helpers/test";
import expect from "../helpers/expect";

import _ from "lodash";
import ServiceBroker from "../../src/service-broker";
import { MoleculerClientError } from "../../src/errors";
import { protectReject } from "../helpers/utils";

describe("Test health status methods", () => {
	const broker = new ServiceBroker({ logger: false, transporter: "fake", metrics: true });

	before(() => broker.start());
	after(() => broker.stop());

	it("should call getNodeList", () => {
		broker.registry.getNodeList = mock.fn();

		return broker
			.call("$node.list")
			.catch(protectReject)
			.then(() => {
				expect(broker.registry.getNodeList).toHaveBeenCalledTimes(1);
			});
	});

	it("should call getServiceList", () => {
		broker.registry.getServiceList = mock.fn();

		const opts = { skipInternal: true, withActions: true };
		return broker
			.call("$node.services", opts)
			.catch(protectReject)
			.then(res => {
				expect(broker.registry.getServiceList).toHaveBeenCalledTimes(1);
				expect(broker.registry.getServiceList).toHaveBeenCalledWith({
					grouping: true,
					onlyAvailable: false,
					onlyLocal: false,
					skipInternal: true,
					withActions: true,
					withEvents: false
				});
			});
	});

	it("should call getActionList", () => {
		broker.registry.getActionList = mock.fn();

		const opts = { skipInternal: true };
		return broker
			.call("$node.actions", opts)
			.catch(protectReject)
			.then(() => {
				expect(broker.registry.getActionList).toHaveBeenCalledTimes(1);
				expect(broker.registry.getActionList).toHaveBeenCalledWith({
					skipInternal: true,
					onlyAvailable: false,
					onlyLocal: false,
					withEndpoints: false
				});
			});
	});

	it("should call getEventList", () => {
		broker.registry.getEventList = mock.fn();

		const opts = { skipInternal: true };
		return broker
			.call("$node.events", opts)
			.catch(protectReject)
			.then(() => {
				expect(broker.registry.getEventList).toHaveBeenCalledTimes(1);
				expect(broker.registry.getEventList).toHaveBeenCalledWith({
					skipInternal: true,
					onlyAvailable: false,
					onlyLocal: false,
					withEndpoints: false
				});
			});
	});

	it("should call getHealthStatus", () => {
		broker.getHealthStatus = mock.fn();
		return broker
			.call("$node.health")
			.catch(protectReject)
			.then(() => {
				expect(broker.getHealthStatus).toHaveBeenCalledTimes(1);
			});
	});

	it("should return broker.options", () => {
		return broker
			.call("$node.options")
			.catch(protectReject)
			.then(res => {
				const opts = _.cloneDeep(broker.options);
				delete opts.circuitBreaker.check;
				delete opts.retryPolicy.check;
				expect(res).toEqual(opts);
			});
	});

	it("should call MetricsRegistry.list", () => {
		broker.metrics.list = mock.fn();

		const opts = { includes: "moleculer.**", excludes: ["process.**"], types: "info" };

		return broker
			.call("$node.metrics", opts)
			.catch(protectReject)
			.then(() => {
				expect(broker.metrics.list).toHaveBeenCalledTimes(1);
				expect(broker.metrics.list).toHaveBeenCalledWith({
					includes: "moleculer.**",
					excludes: ["process.**"],
					types: "info"
				});
			});
	});

	it("should throw error if metrics is disabled", () => {
		broker.isMetricsEnabled = mock.fn(() => false);
		broker.metrics.list = mock.fn();

		const opts = { includes: "moleculer.**", excludes: ["process.**"], types: "info" };

		return broker
			.call("$node.metrics", opts)
			.then(protectReject)
			.catch(err => {
				expect(err).toBeInstanceOf(MoleculerClientError);
				expect(err.name).toBe("MoleculerClientError");
				expect(err.type).toBe("METRICS_DISABLED");
				expect(err.code).toBe(400);
				expect(err.message).toBe("Metrics feature is disabled");

				expect(broker.metrics.list).toHaveBeenCalledTimes(0);
			});
	});
});
