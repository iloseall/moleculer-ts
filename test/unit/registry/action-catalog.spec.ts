import { describe, it, mock } from "../../helpers/test";
import expect from "../../helpers/expect";

import ActionCatalog from "../../../src/registry/action-catalog";
import EndpointList from "../../../src/registry/endpoint-list";
import ActionEndpoint from "../../../src/registry/endpoint-action";
import ServiceBroker from "../../../src/service-broker";

const Strategy = require("../../../src/strategies").RoundRobin;
const CpuStrategy = require("../../../src/strategies").CpuUsage;

describe("Test ActionCatalog constructor", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	it("test constructor", () => {
		const catalog = new ActionCatalog(registry, broker, Strategy);

		expect(catalog).toBeDefined();
		expect(catalog.registry).toBe(registry);
		expect(catalog.broker).toBe(broker);
		expect(catalog.logger).toBe(registry.logger);
		expect(catalog.StrategyFactory).toBe(Strategy);
		expect(catalog.actions).toBeInstanceOf(Map);
		expect(catalog.EndpointFactory).toBe(ActionEndpoint);
	});
});

describe("Test ActionCatalog methods", () => {
	const broker = new ServiceBroker({ logger: false });
	const catalog = new ActionCatalog(broker.registry, broker, Strategy);
	let list;
	const service = { name: "test" };

	it("should create an EndpointList and add to 'actions'", () => {
		const node = { id: "server-1" };
		const action = { name: "test.hello" };

		expect(catalog.actions.size).toBe(0);

		list = catalog.add(node, service, action);

		expect(catalog.actions.size).toBe(1);
		expect(list).toBeInstanceOf(EndpointList);

		expect(catalog.isAvailable("test.hello")).toBe(true);
		expect(catalog.isAvailable("test.hi")).toBe(false);
	});

	it("should not create a new EndpointList just add new node", () => {
		const node = { id: "server-2" };
		const service = {};
		const action = { name: "test.hello" };

		list.add = mock.fn();

		const res = catalog.add(node, service, action);

		expect(catalog.actions.size).toBe(1);
		expect(res).toBe(list);

		expect(list.add).toHaveBeenCalledTimes(1);
		expect(list.add).toHaveBeenCalledWith(node, service, action);
	});

	it("should return the list", () => {
		expect(catalog.get("test.hello")).toBe(list);
		expect(catalog.get("not.found")).toBeUndefined();
	});

	it("should call list.removeByNodeID", () => {
		list.removeByNodeID = mock.fn();

		catalog.remove("test.hello", "server-2");
		expect(list.removeByNodeID).toHaveBeenCalledTimes(1);
		expect(list.removeByNodeID).toHaveBeenCalledWith("server-2");

		list.removeByNodeID.mockClear();
		catalog.remove("not-found", "server-2");
		expect(list.removeByNodeID).toHaveBeenCalledTimes(0);
	});

	it("should call list.removeByService", () => {
		const service2 = { name: "echo" };
		const list2 = catalog.add(broker.registry.nodes.localNode, service2, {
			name: "echo.reply",
			cache: true
		});

		list.removeByService = mock.fn();
		list2.removeByService = mock.fn();

		catalog.removeByService(service2);
		expect(list.removeByService).toHaveBeenCalledTimes(1);
		expect(list.removeByService).toHaveBeenCalledWith(service2);
		expect(list2.removeByService).toHaveBeenCalledTimes(1);
		expect(list2.removeByService).toHaveBeenCalledWith(service2);
	});

	it("should return with action list", () => {
		let res = catalog.list({});
		expect(res).toEqual([
			{
				action: {
					name: "test.hello"
				},
				available: true,
				count: 1,
				hasLocal: false,
				name: "test.hello"
			},
			{
				action: {
					name: "echo.reply",
					cache: true
				},
				available: true,
				count: 1,
				hasLocal: true,
				name: "echo.reply"
			}
		]);

		res = catalog.list({ onlyLocal: true, skipInternal: true });
		expect(res).toEqual([
			{
				action: {
					cache: true,
					name: "echo.reply"
				},
				available: true,
				count: 1,
				hasLocal: true,
				name: "echo.reply"
			}
		]);

		catalog.get("test.hello").hasAvailable = mock.fn(() => false);
		res = catalog.list({ withEndpoints: true, onlyAvailable: true });
		expect(res).toEqual([
			{
				action: {
					name: "echo.reply",
					cache: true
				},
				available: true,
				count: 1,
				endpoints: [
					{
						available: true,
						nodeID: broker.registry.nodes.localNode.id,
						state: true
					}
				],
				hasLocal: true,
				name: "echo.reply"
			}
		]);
	});
});

describe("Test ActionCatalog add method", () => {
	const broker = new ServiceBroker({ logger: false });
	const catalog = new ActionCatalog(broker.registry, broker, Strategy);
	let list;
	const service = { name: "test" };

	it("should create an EndpointList and add to 'actions'", () => {
		const node = { id: "server-1" };
		const action = { name: "test.hello" };

		list = catalog.add(node, service, action);

		expect(list).toBeInstanceOf(EndpointList);
		expect(list.strategy).toBeInstanceOf(Strategy);
		expect(list.strategy.opts).toEqual({});
	});

	it("should create an EndpointList with custom strategy", () => {
		const node = { id: "server-1" };
		const action = {
			name: "test.welcome",
			strategy: "CpuUsage",
			strategyOptions: { sampleCount: 6 }
		};

		list = catalog.add(node, service, action);

		expect(list).toBeInstanceOf(EndpointList);
		expect(list.strategy).toBeInstanceOf(CpuStrategy);
		expect(list.strategy.opts).toEqual({ sampleCount: 6, lowCpuUsage: 10 });
	});
});
