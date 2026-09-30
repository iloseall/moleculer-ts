import { describe, it } from "../../helpers/test";
import expect from "../../helpers/expect";

import EventEndpoint from "../../../src/registry/endpoint-event";
import ServiceBroker from "../../../src/service-broker";

describe("Test EventEndpoint", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	const node = { id: "server-1" };
	const service = { name: "test" };
	const event = { name: "test.hello" };
	let ep;

	it("should set properties", () => {
		ep = new EventEndpoint(registry, broker, node, service, event);

		expect(ep).toBeDefined();
		expect(ep.registry).toBe(registry);
		expect(ep.broker).toBe(broker);
		expect(ep.node).toBe(node);
		expect(ep.service).toBe(service);
		expect(ep.event).toBe(event);

		expect(ep.isAvailable).toBe(true);
	});

	it("shoud update event", () => {
		const newEvent = { name: "test.hello2" };

		ep.update(newEvent);

		expect(ep.event).toBe(newEvent);
	});
});
