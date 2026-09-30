import { describe, it } from "../../helpers/test";
import expect from "../../helpers/expect";

import ActionEndpoint from "../../../src/registry/endpoint-action";
import ServiceBroker from "../../../src/service-broker";

describe("Test ActionEndpoint", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	const node = { id: "server-1" };
	const service = { name: "test" };
	const action = { name: "test.hello" };
	let ep;

	it("should set properties", () => {
		ep = new ActionEndpoint(registry, broker, node, service, action);

		expect(ep).toBeDefined();
		expect(ep.registry).toBe(registry);
		expect(ep.broker).toBe(broker);
		expect(ep.node).toBe(node);
		expect(ep.service).toBe(service);
		expect(ep.action).toBe(action);

		expect(ep.isAvailable).toBe(true);
	});

	it("shoud update action", () => {
		const newAction = { name: "test.hello2" };

		ep.update(newAction);

		expect(ep.action).toBe(newAction);
	});
});
