import { describe, it } from "../../helpers/test";
import expect from "../../helpers/expect";

import Endpoint from "../../../src/registry/endpoint";
import ServiceBroker from "../../../src/service-broker";

describe("Test Endpoint", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	const node = { id: "server-1" };
	let ep;

	it("should set properties", () => {
		ep = new Endpoint(registry, broker, node);

		expect(ep).toBeDefined();
		expect(ep.registry).toBe(registry);
		expect(ep.broker).toBe(broker);
		expect(ep.id).toBe(node.id);
		expect(ep.node).toBe(node);
		expect(ep.local).toBe(false);
		expect(ep.state).toBe(true);

		expect(ep.isAvailable).toBe(true);
	});

	it("shoud unAvailable", () => {
		ep.state = false;
		expect(ep.isAvailable).toBe(false);
	});

	it("should create local ep", () => {
		const newNode = { id: broker.nodeID };
		const ep = new Endpoint(registry, broker, newNode);

		expect(ep).toBeDefined();
		expect(ep.registry).toBe(registry);
		expect(ep.broker).toBe(broker);
		expect(ep.id).toBe(newNode.id);
		expect(ep.node).toBe(newNode);
		expect(ep.local).toBe(true);
		expect(ep.state).toBe(true);

		expect(ep.isAvailable).toBe(true);
	});
});
