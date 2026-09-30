import { describe, it, mock } from "../../helpers/test";
import expect from "../../helpers/expect";
import { autoMock, factoryMock, interopDefault } from "../../helpers/module-mock";

autoMock(require.resolve("../../../src/strategies/round-robin"));

const Strategy = interopDefault(require("../../../src/strategies/round-robin"));
const { MoleculerError } = require("../../../src/errors");
const EndpointList = interopDefault(require("../../../src/registry/endpoint-list"));
const ActionEndpoint = interopDefault(require("../../../src/registry/endpoint-action"));
const ServiceBroker = interopDefault(require("../../../src/service-broker"));

describe("Test EndpointList constructor", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;
	const strategyOptions = { count: 5 };
	let list;

	it("should create a new list", () => {
		Strategy.mockClear();

		list = new EndpointList(
			registry,
			broker,
			"listName",
			"groupName",
			ActionEndpoint,
			Strategy,
			strategyOptions
		);

		expect(list).toBeDefined();
		expect(list.registry).toBe(registry);
		expect(list.broker).toBe(broker);
		expect(list.logger).toBe(registry.logger);
		expect(list.strategy).toBeInstanceOf(Strategy);
		expect(list.name).toBe("listName");
		expect(list.group).toBe("groupName");
		expect(list.internal).toBe(false);
		expect(list.EndPointFactory).toBe(ActionEndpoint);
		expect(list.endpoints).toBeInstanceOf(Array);
		expect(list.localEndpoints).toEqual([]);

		expect(Strategy).toHaveBeenCalledTimes(1);
		expect(Strategy).toHaveBeenCalledWith(registry, broker, strategyOptions);
	});

	it("should set internal flag", () => {
		const list = new EndpointList(
			registry,
			broker,
			"$listName",
			"groupName",
			ActionEndpoint,
			Strategy
		);

		expect(list).toBeDefined();
		expect(list.name).toBe("$listName");
		expect(list.internal).toBe(true);
	});
});

describe("Test EndpointList.add", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	const node = { id: "server-1" };
	const service = { name: "test" };
	const action = { name: "test.hello" };

	const list = new EndpointList(
		registry,
		broker,
		"listName",
		"groupName",
		ActionEndpoint,
		Strategy
	);

	const epUpdate = mock.fn();
	list.EndPointFactory = mock.fn((registry, broker, node, service, action) => ({
		local: false,
		update: epUpdate,
		node,
		service,
		action
	}));

	it("should add a new Endpoint", () => {
		expect(list.endpoints.length).toBe(0);

		const ep = list.add(node, service, action);

		expect(ep).toBeDefined();
		expect(list.EndPointFactory).toHaveBeenCalledTimes(1);
		expect(list.EndPointFactory).toHaveBeenCalledWith(registry, broker, node, service, action);
		expect(list.endpoints.length).toBe(1);
		expect(list.endpoints[0]).toBe(ep);
		expect(list.localEndpoints).toEqual([]);
	});

	it("should add a new local Endpoint", () => {
		const node2 = { id: "server-2" };
		list.EndPointFactory = mock.fn(() => ({ local: true }));

		const ep = list.add(node2, service, action);

		expect(ep).toBeDefined();
		expect(list.EndPointFactory).toHaveBeenCalledTimes(1);
		expect(list.EndPointFactory).toHaveBeenCalledWith(registry, broker, node2, service, action);
		expect(list.endpoints.length).toBe(2);
		expect(list.endpoints[1]).toBe(ep);
		expect(list.localEndpoints).toEqual([ep]);
		expect(list.hasLocal()).toBe(true);
	});

	it("should update action on existing endpoint", () => {
		list.EndPointFactory.mockClear();
		const action2 = { name: "test.hello2" };

		const ep = list.add(node, service, action2);

		expect(ep).toBeDefined();
		expect(list.EndPointFactory).toHaveBeenCalledTimes(0);
		expect(epUpdate).toHaveBeenCalledTimes(1);
		expect(epUpdate).toHaveBeenCalledWith(action2);
		expect(list.endpoints.length).toBe(2);
	});
});

describe("Test EndpointList.getFirst", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;
	const ep = {};
	const select = mock.fn(() => ep);

	const list = new EndpointList(
		registry,
		broker,
		"listName",
		"groupName",
		ActionEndpoint,
		Strategy
	);

	it("should return null if empty", () => {
		expect(list.getFirst()).toBeNull();
	});

	it("should return the first endpoint", () => {
		list.endpoints = [{ a: 5 }, { b: 10 }];
		expect(list.getFirst()).toBe(list.endpoints[0]);
	});
});

describe("Test EndpointList.select", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;
	const ep = {};
	const select = mock.fn(() => ep);
	const MockStrategy = function () {
		return {
			select
		};
	};

	const list = new EndpointList(
		registry,
		broker,
		"listName",
		"groupName",
		ActionEndpoint,
		MockStrategy
	);

	const arr = [{}, ep];
	const ctx = {};

	it("should call strategy select", () => {
		const res = list.select(arr, ctx);
		expect(res).toBe(ep);
		expect(select).toHaveBeenCalledTimes(1);
		expect(select).toHaveBeenCalledWith(arr, ctx);
	});

	it("should throw exception if select return with null", () => {
		list.strategy.select = mock.fn();
		expect(() => {
			list.select(arr);
		}).toThrow(MoleculerError);
	});
});

describe("Test EndpointList.next", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	let ep1, ep2, ep3, ep4;

	const node = { id: "node-1" };
	const service = { name: "test" };
	const action = { name: "test.hello" };
	const ctx = {};

	const list = new EndpointList(
		registry,
		broker,
		"listName",
		"groupName",
		ActionEndpoint,
		Strategy
	);

	list.select = mock.fn(() => ep1);

	it("should return null if no endpoints", () => {
		expect(list.endpoints.length).toBe(0);

		const ep = list.next(ctx);

		expect(ep).toBeNull();
		expect(list.select).toHaveBeenCalledTimes(0);
		expect(list.count()).toBe(0);
	});

	it("should return only one ep", () => {
		ep1 = list.add(node, service, action);

		expect(list.next(ctx)).toBe(ep1);
		expect(list.count()).toBe(1);

		expect(list.select).toHaveBeenCalledTimes(0);
	});
	it("should return null if only one is not available", () => {
		ep1.state = false;
		expect(list.next(ctx)).toBeNull();

		expect(list.select).toHaveBeenCalledTimes(0);

		ep1.state = true;
	});

	it("should return local item is preferLocal is true && local item is available", () => {
		ep2 = list.add({ id: "node-2" }, service, action);
		ep3 = list.add({ id: broker.nodeID }, service, action);
		ep4 = list.add({ id: "node-3" }, service, action);

		expect(list.count()).toBe(4);
		expect(ep3.local).toBe(true);
		expect(list.localEndpoints).toEqual([ep3]);

		expect(list.next(ctx)).toBe(ep3);
		expect(list.next(ctx)).toBe(ep3);
		expect(list.next(ctx)).toBe(ep3);

		expect(list.select).toHaveBeenCalledTimes(0);
	});

	it("should call select if no local ep", () => {
		ep3.state = false;

		expect(list.next(ctx)).toBe(ep1);

		expect(list.select).toHaveBeenCalledTimes(1);
		expect(list.select).toHaveBeenCalledWith([ep1, ep2, ep4], ctx);

		ep3.state = true;
	});

	it("should call select if no local ep", () => {
		list.select.mockClear();
		registry.opts.preferLocal = false;

		expect(list.next(ctx)).toBe(ep1);

		expect(list.select).toHaveBeenCalledTimes(1);
		expect(list.select).toHaveBeenCalledWith([ep1, ep2, ep3, ep4], ctx);
	});

	it("should find the first available ep", () => {
		list.select = mock.fn(() => ep4);

		ep1.state = false;
		ep2.state = false;
		ep3.state = false;
		ep4.state = true;

		expect(list.next(ctx)).toBe(ep4);
		expect(list.select).toHaveBeenCalledTimes(1);
		expect(list.select).toHaveBeenCalledWith([ep4], ctx);
	});

	it("should return null, if no available ep", () => {
		list.select.mockClear();

		ep1.state = false;
		ep2.state = false;
		ep3.state = false;
		ep4.state = false;

		expect(list.next(ctx)).toBeNull();
		expect(list.select).toHaveBeenCalledTimes(0);
	});

	it("should return null if internal & localEndpoint is not available", () => {
		list.select.mockClear();
		list.internal = true;

		expect(list.next(ctx)).toBe(null);
		expect(list.select).toHaveBeenCalledTimes(0);
	});

	it("should return always localEndpoint if internal", () => {
		list.select.mockClear();
		list.internal = true;

		ep3.state = true;

		expect(list.next(ctx)).toBe(ep3);
		expect(list.next(ctx)).toBe(ep3);
		expect(list.next(ctx)).toBe(ep3);

		expect(list.select).toHaveBeenCalledTimes(0);

		list.internal = false;
	});
});

describe("Test EndpointList.nextLocal", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	let ep1, ep3;

	const node = { id: broker.nodeID };
	const service = { name: "test" };
	const action = { name: "test.hello" };
	const ctx = {};

	const list = new EndpointList(
		registry,
		broker,
		"listName",
		"groupName",
		ActionEndpoint,
		Strategy
	);
	list.select = mock.fn(() => ep1);

	it("should return null if no endpoints", () => {
		expect(list.endpoints.length).toBe(0);

		const ep = list.nextLocal(ctx);

		expect(ep).toBeNull();
		expect(list.select).toHaveBeenCalledTimes(0);
		expect(list.count()).toBe(0);
		expect(list.localEndpoints.length).toBe(0);
	});

	it("should return only one ep", () => {
		ep1 = list.add(node, service, action);

		expect(list.nextLocal(ctx)).toBe(ep1);
		expect(list.count()).toBe(1);
		expect(list.localEndpoints.length).toBe(1);
	});

	it("should return null if only one is not available", () => {
		ep1.state = false;
		expect(list.nextLocal(ctx)).toBeNull();

		expect(list.select).toHaveBeenCalledTimes(0);

		ep1.state = true;
	});

	it("should call select if there are more ep", () => {
		list.add({ id: "node-2" }, service, action);
		ep3 = list.add(node, { name: "test2" }, action);
		list.add({ id: "node-3" }, service, action);

		expect(list.localEndpoints.length).toBe(2);
		expect(ep3.local).toBe(true);
		expect(list.localEndpoints).toEqual([ep1, ep3]);

		expect(list.nextLocal(ctx)).toBe(ep1);
		expect(list.select).toHaveBeenCalledTimes(1);
		expect(list.select).toHaveBeenCalledWith([ep1, ep3], ctx);
	});

	it("should find the first available ep", () => {
		list.select = mock.fn(() => ep3);

		ep1.state = false;
		ep3.state = true;

		expect(list.nextLocal(ctx)).toBe(ep3);
		expect(list.select).toHaveBeenCalledTimes(1);
		expect(list.select).toHaveBeenCalledWith([ep3], ctx);
	});

	it("should return null, if no available ep", () => {
		list.select = mock.fn();

		ep1.state = false;
		ep3.state = false;

		expect(list.nextLocal(ctx)).toBeNull();
		expect(list.select).toHaveBeenCalledTimes(0);
	});
});

describe("Test EndpointList.hasAvailable", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	const service = { name: "test" };
	const action = { name: "test.hello" };

	const list = new EndpointList(
		registry,
		broker,
		"listName",
		"groupName",
		ActionEndpoint,
		Strategy
	);

	const ep1 = list.add({ id: "node-1" }, service, action);
	const ep2 = list.add({ id: broker.nodeID }, service, action);

	it("should return the correct value", () => {
		expect(list.hasAvailable()).toBe(true);

		ep1.state = false;
		expect(list.hasAvailable()).toBe(true);

		ep2.state = false;
		expect(list.hasAvailable()).toBe(false);
	});
});

describe("Test EndpointList.hasLocal", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	const service = { name: "test" };
	const action = { name: "test.hello" };

	const list = new EndpointList(
		registry,
		broker,
		"listName",
		"groupName",
		ActionEndpoint,
		Strategy
	);

	list.add({ id: "node-1" }, service, action);
	list.add({ id: broker.nodeID }, service, action);

	it("should return the correct value", () => {
		expect(list.hasLocal()).toBe(true);

		list.localEndpoints = [];
		expect(list.hasLocal()).toBe(false);
	});
});

describe("Test EndpointList.getEndpointByNodeID", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	const service = { name: "test" };
	const action = { name: "test.hello" };

	const list = new EndpointList(
		registry,
		broker,
		"listName",
		"groupName",
		ActionEndpoint,
		Strategy
	);

	const ep1 = list.add({ id: "node-1" }, service, action);
	const ep2 = list.add({ id: broker.nodeID }, service, action);

	it("should return the correct ep", () => {
		expect(list.getEndpointByNodeID(broker.nodeID)).toBe(ep2);
		expect(list.getEndpointByNodeID("node-1")).toBe(ep1);
	});

	it("should return null", () => {
		ep1.state = false;
		expect(list.getEndpointByNodeID("node-1")).toBe(null);
		expect(list.getEndpointByNodeID("node-123")).toBe(null);
	});
});

describe("Test EndpointList.hasNodeID", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	const service = { name: "test" };
	const action = { name: "test.hello" };

	const list = new EndpointList(
		registry,
		broker,
		"listName",
		"groupName",
		ActionEndpoint,
		Strategy
	);

	list.add({ id: "node-1" }, service, action);
	list.add({ id: broker.nodeID }, service, action);

	it("should return the correct ep", () => {
		expect(list.hasNodeID(broker.nodeID)).toBe(true);
		expect(list.hasNodeID("node-1")).toBe(true);
		expect(list.hasNodeID("node-123")).toBe(false);
	});
});

describe("Test EndpointList.removeByService", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	const service1 = { name: "test" };
	const service2 = { name: "test2" };
	const action = { name: "test.hello" };

	const list = new EndpointList(
		registry,
		broker,
		"listName",
		"groupName",
		ActionEndpoint,
		Strategy
	);

	list.add({ id: "node-1" }, service1, action);
	list.add({ id: broker.nodeID }, service2, action);
	list.add({ id: "node-2" }, service1, action);

	it("should remove endpoints for service-1", () => {
		expect(list.count()).toBe(3);

		list.removeByService(service1);
		expect(list.count()).toBe(1);
		expect(list.hasNodeID(broker.nodeID)).toBe(true);
		expect(list.hasNodeID("node-1")).toBe(false);
		expect(list.hasNodeID("node-2")).toBe(false);
		expect(list.hasLocal()).toBe(true);

		list.removeByService(service2);
		expect(list.count()).toBe(0);
		expect(list.hasLocal()).toBe(false);
	});
});

describe("Test EndpointList.removeByNodeID", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	const service1 = { name: "test" };
	const service2 = { name: "test2" };
	const action = { name: "test.hello" };

	const list = new EndpointList(
		registry,
		broker,
		"listName",
		"groupName",
		ActionEndpoint,
		Strategy
	);

	list.add({ id: "node-1" }, service1, action);
	list.add({ id: broker.nodeID }, service2, action);

	it("should remove endpoints for service-1", () => {
		expect(list.count()).toBe(2);

		list.removeByNodeID("node-1");
		expect(list.count()).toBe(1);
		expect(list.hasNodeID(broker.nodeID)).toBe(true);
		expect(list.hasNodeID("node-1")).toBe(false);
		expect(list.hasLocal()).toBe(true);

		list.removeByNodeID(broker.nodeID);
		expect(list.count()).toBe(0);
		expect(list.hasLocal()).toBe(false);
	});
});

describe("Test EndpointList.setLocalEndpoints", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	const service1 = { name: "test" };
	const service2 = { name: "test2" };
	const action = { name: "test.hello" };

	const list = new EndpointList(
		registry,
		broker,
		"listName",
		"groupName",
		ActionEndpoint,
		Strategy
	);

	list.add({ id: "node-1" }, service1, action);
	const ep2 = list.add({ id: broker.nodeID }, service2, action);

	it("should remove endpoints for service-1", () => {
		expect(list.localEndpoints).toEqual([ep2]);
		list.localEndpoints = [];

		list.setLocalEndpoints();
		expect(list.localEndpoints).toEqual([ep2]);

		list.removeByNodeID(broker.nodeID);
		expect(list.localEndpoints).toEqual([]);
	});
});
