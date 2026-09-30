import { describe, it, before, after, mock } from "../../helpers/test";
import expect from "../../helpers/expect";

import Registry from "../../../src/registry/registry";
import ServiceBroker from "../../../src/service-broker";
import Strategies from "../../../src/strategies";
import Discoverers from "../../../src/registry/discoverers";
import { protectReject } from "../../helpers/utils";

describe("Test Registry constructor", () => {
	const broker = new ServiceBroker({ logger: false });

	it("test properties", () => {
		const registry = new Registry(broker);

		expect(registry).toBeDefined();
		expect(registry.broker).toBe(broker);
		expect(registry.logger).toBeDefined();
		expect(registry.metrics).toBe(broker.metrics);

		expect(registry.opts).toEqual({
			preferLocal: true,
			stopDelay: 100,
			strategy: "RoundRobin",
			discoverer: "Local"
		});
		expect(registry.StrategyFactory).toBe(Strategies.RoundRobin);
		expect(registry.discoverer).toBeInstanceOf(Discoverers.Local);

		expect(registry.nodes).toBeDefined();
		expect(registry.services).toBeDefined();
		expect(registry.actions).toBeDefined();
		expect(registry.events).toBeDefined();
	});

	it("test different strategy", () => {
		const broker = new ServiceBroker({
			logger: false,
			registry: {
				strategy: "Random",
				preferLocal: false
			}
		});
		const registry = new Registry(broker);

		expect(registry.opts).toEqual({
			preferLocal: false,
			stopDelay: 100,
			strategy: "Random",
			discoverer: "Local"
		});
		expect(registry.StrategyFactory).toBe(Strategies.Random);
	});

	it("test different discoverer", async () => {
		const broker = new ServiceBroker({
			logger: false,
			registry: {
				discoverer: "Redis"
			}
		});
		const registry = new Registry(broker);

		expect(registry.opts).toEqual({
			preferLocal: true,
			stopDelay: 100,
			discoverer: "Redis",
			strategy: "RoundRobin"
		});
		expect(registry.discoverer).toBeInstanceOf(Discoverers.Redis);

		await registry.discoverer.stop();
		await broker.registry.stop();
	});

	it("should register metrics", () => {
		broker.isMetricsEnabled = mock.fn(() => true);
		mock.method(broker.metrics, "register");
		mock.method(broker.metrics, "set");

		const registry = new Registry(broker);

		expect(broker.metrics.register).toHaveBeenCalledTimes(8);
		expect(broker.metrics.set).toHaveBeenCalledTimes(5);

		expect(broker.metrics.set).toHaveBeenNthCalledWith(1, "moleculer.registry.nodes.total", 1);
		expect(broker.metrics.set).toHaveBeenNthCalledWith(
			2,
			"moleculer.registry.nodes.online.total",
			1
		);
		expect(broker.metrics.set).toHaveBeenNthCalledWith(
			3,
			"moleculer.registry.services.total",
			0
		);
		expect(broker.metrics.set).toHaveBeenNthCalledWith(
			4,
			"moleculer.registry.actions.total",
			0
		);
		expect(broker.metrics.set).toHaveBeenNthCalledWith(5, "moleculer.registry.events.total", 0);
	});
});

describe("Test Registry.init", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	it("should call discoverer.init", async () => {
		registry.discoverer.init = mock.fn();

		registry.init();

		expect(registry.discoverer.init).toBeCalledTimes(1);
		await registry.stop();
	});
});

describe("Test Registry.stop", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	it("should call discoverer.stop", async () => {
		registry.init();
		registry.discoverer.stop = mock.fn();

		registry.stop();

		expect(registry.discoverer.stop).toBeCalledTimes(1);
	});
});

describe("Test Registry.registerLocalService", () => {
	const broker = new ServiceBroker({ logger: false, internalServices: false });
	const registry = broker.registry;
	const seq = registry.nodes.localNode.seq;

	const service = {};

	registry.services.add = mock.fn(() => service);
	registry.registerActions = mock.fn();
	registry.registerEvents = mock.fn();
	registry.regenerateLocalRawInfo = mock.fn();
	registry.updateMetrics = mock.fn();
	broker.servicesChanged = mock.fn();

	it("should call register methods", () => {
		const svc = {
			name: "users",
			version: 2,
			settings: {},
			metadata: {},
			actions: {},
			events: []
		};

		registry.registerLocalService(svc);

		expect(registry.services.add).toHaveBeenCalledTimes(1);
		expect(registry.services.add).toHaveBeenCalledWith(registry.nodes.localNode, svc, true);

		expect(registry.registerActions).toHaveBeenCalledTimes(1);
		expect(registry.registerActions).toHaveBeenCalledWith(
			registry.nodes.localNode,
			service,
			svc.actions
		);

		expect(registry.registerEvents).toHaveBeenCalledTimes(1);
		expect(registry.registerEvents).toHaveBeenCalledWith(
			registry.nodes.localNode,
			service,
			svc.events
		);

		expect(registry.nodes.localNode.seq).toBe(seq);

		expect(registry.localNodeInfoInvalidated).toBe("seq");

		expect(broker.servicesChanged).toHaveBeenCalledTimes(1);
		expect(broker.servicesChanged).toHaveBeenCalledWith(true);

		expect(registry.updateMetrics).toHaveBeenCalledTimes(1);
	});

	it("should not call register methods, but increment seq", () => {
		registry.services.add.mockClear();
		registry.registerActions.mockClear();
		registry.registerEvents.mockClear();
		registry.regenerateLocalRawInfo.mockClear();
		registry.updateMetrics = mock.fn();

		broker.servicesChanged.mockClear();

		const svc = {
			name: "users",
			version: 2,
			settings: {},
			metadata: {}
		};

		return broker
			.start()
			.catch(protectReject)
			.then(() => {
				expect(registry.regenerateLocalRawInfo).toHaveBeenCalledTimes(0);

				// Register the svc
				registry.registerLocalService(svc);

				expect(registry.services.add).toHaveBeenCalledTimes(1);
				expect(registry.services.add).toHaveBeenCalledWith(
					registry.nodes.localNode,
					svc,
					true
				);

				expect(registry.registerActions).toHaveBeenCalledTimes(0);

				expect(registry.registerEvents).toHaveBeenCalledTimes(0);

				expect(registry.localNodeInfoInvalidated).toBe("seq");

				expect(broker.servicesChanged).toHaveBeenCalledTimes(1);
				expect(broker.servicesChanged).toHaveBeenCalledWith(true);

				expect(registry.updateMetrics).toHaveBeenCalledTimes(1);
			});
	});
});

describe("Test Registry.registerServices", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	broker.isMetricsEnabled = mock.fn(() => true);
	mock.method(broker.metrics, "set");

	const node = { id: "node-11" };

	const serviceItem = {
		update: mock.fn()
	};

	registry.services.get = mock.fn(() => null);
	registry.services.add = mock.fn(() => serviceItem);
	registry.unregisterService = mock.fn();
	registry.registerActions = mock.fn();
	registry.unregisterAction = mock.fn();
	registry.registerEvents = mock.fn();
	registry.unregisterEvent = mock.fn();
	broker.servicesChanged = mock.fn();
	registry.updateMetrics = mock.fn();

	it("should call services.add", () => {
		const service = {
			name: "users",
			version: 2,
			settings: { a: 5 },
			actions: {
				"users.find"() {},
				"users.get"() {}
			},
			events: {
				"user.created"() {},
				"user.removed"() {}
			}
		};

		registry.registerServices(node, [service]);

		expect(registry.services.add).toHaveBeenCalledTimes(1);
		expect(registry.services.add).toHaveBeenCalledWith(node, service, false);
		expect(serviceItem.update).toHaveBeenCalledTimes(0);

		expect(registry.registerActions).toHaveBeenCalledTimes(1);
		expect(registry.registerActions).toHaveBeenCalledWith(node, serviceItem, service.actions);

		expect(registry.unregisterAction).toHaveBeenCalledTimes(0);

		expect(registry.registerEvents).toHaveBeenCalledTimes(1);
		expect(registry.registerEvents).toHaveBeenCalledWith(node, serviceItem, service.events);

		expect(registry.unregisterEvent).toHaveBeenCalledTimes(0);

		expect(registry.unregisterService).toHaveBeenCalledTimes(0);

		expect(broker.servicesChanged).toHaveBeenCalledTimes(1);
		expect(broker.servicesChanged).toHaveBeenCalledWith(false);

		expect(registry.updateMetrics).toHaveBeenCalledTimes(1);
	});

	it("should update service, actions & events", () => {
		const serviceItem = {
			name: "users",
			fullName: "v2.users",
			version: 2,
			metadata: {},
			node,
			update: mock.fn(),
			equals: mock.fn(() => false),
			actions: {
				"users.find"() {},
				"users.get"() {}
			},
			events: {
				"user.created"() {},
				"user.removed"() {}
			}
		};
		registry.services.get = mock.fn(() => serviceItem);
		registry.services.add.mockClear();
		registry.unregisterService.mockClear();
		registry.registerActions.mockClear();
		registry.unregisterAction.mockClear();
		registry.registerEvents.mockClear();
		registry.unregisterEvent.mockClear();
		registry.updateMetrics = mock.fn();
		broker.servicesChanged.mockClear();

		const service = {
			name: "users",
			fullName: "v2.users",
			version: 2,
			settings: { b: 3 },
			metadata: { priority: 3 },
			actions: {
				"users.find"() {},
				"users.remove"() {}
			},
			events: {
				"user.created"() {},
				"user.deleted"() {}
			}
		};

		registry.registerServices(node, [service]);

		expect(registry.services.add).toHaveBeenCalledTimes(0);

		expect(registry.services.get).toHaveBeenCalledTimes(1);
		expect(registry.services.get).toHaveBeenCalledWith("v2.users", node.id);

		expect(serviceItem.update).toHaveBeenCalledTimes(1);
		expect(serviceItem.update).toHaveBeenCalledWith(service);

		expect(registry.registerActions).toHaveBeenCalledTimes(1);
		expect(registry.registerActions).toHaveBeenCalledWith(node, serviceItem, service.actions);

		expect(registry.unregisterAction).toHaveBeenCalledTimes(1);
		expect(registry.unregisterAction).toHaveBeenCalledWith(node, "users.get");

		expect(registry.registerEvents).toHaveBeenCalledTimes(1);
		expect(registry.registerEvents).toHaveBeenCalledWith(node, serviceItem, service.events);

		expect(registry.unregisterEvent).toHaveBeenCalledTimes(1);
		expect(registry.unregisterEvent).toHaveBeenCalledWith(node, "user.removed");

		expect(registry.unregisterService).toHaveBeenCalledTimes(0);

		expect(broker.servicesChanged).toHaveBeenCalledTimes(1);
		expect(broker.servicesChanged).toHaveBeenCalledWith(false);

		expect(registry.updateMetrics).toHaveBeenCalledTimes(1);

		// For next test
		registry.services.services.push(serviceItem);
	});

	it("should remove old service", () => {
		registry.services.get = mock.fn();
		registry.services.add.mockClear();
		registry.unregisterService.mockClear();
		registry.updateMetrics = mock.fn();
		broker.servicesChanged.mockClear();

		const service = {
			name: "posts"
		};

		registry.registerServices(node, [service]);

		expect(registry.unregisterService).toHaveBeenCalledTimes(1);
		expect(registry.unregisterService).toHaveBeenCalledWith("v2.users", "node-11");

		expect(broker.servicesChanged).toHaveBeenCalledTimes(1);
		expect(broker.servicesChanged).toHaveBeenCalledWith(false);

		expect(registry.updateMetrics).toHaveBeenCalledTimes(1);
	});
});

describe("Test Registry.unregisterService & unregisterServicesByNode", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;
	const seq = registry.nodes.localNode.seq;

	registry.services.remove = mock.fn();
	registry.services.removeAllByNodeID = mock.fn();
	registry.regenerateLocalRawInfo = mock.fn();

	before(() => broker.start());
	after(() => broker.stop());

	it("should call services remove method", () => {
		registry.regenerateLocalRawInfo.mockClear();

		registry.unregisterService("v2.posts", "node-11");

		expect(registry.services.remove).toHaveBeenCalledTimes(1);
		expect(registry.services.remove).toHaveBeenCalledWith("v2.posts", "node-11");

		expect(registry.nodes.localNode.seq).toBe(seq);
		expect(registry.regenerateLocalRawInfo).toHaveBeenCalledTimes(0);
	});

	it("should call services remove method with local nodeID", () => {
		registry.regenerateLocalRawInfo.mockClear();
		registry.services.remove.mockClear();
		registry.nodes.localNode.services.push({ name: "posts", version: 2, fullName: "v2.posts" });
		expect(registry.nodes.localNode.services.length).toBe(2);

		registry.unregisterService("v2.posts");

		expect(registry.nodes.localNode.services.length).toBe(1);

		expect(registry.services.remove).toHaveBeenCalledTimes(1);
		expect(registry.services.remove).toHaveBeenCalledWith("v2.posts", broker.nodeID);

		expect(registry.localNodeInfoInvalidated).toBe("seq");
	});

	it("should call services removeAllByNodeID method", () => {
		registry.regenerateLocalRawInfo.mockClear();
		registry.services.removeAllByNodeID.mockClear();

		registry.unregisterServicesByNode("node-2");

		expect(registry.services.removeAllByNodeID).toHaveBeenCalledTimes(1);
		expect(registry.services.removeAllByNodeID).toHaveBeenCalledWith("node-2");
	});
});

describe("Test Registry.registerActions", () => {
	const broker = new ServiceBroker({ logger: false, transporter: "Fake" });
	const registry = broker.registry;

	registry.actions.add = mock.fn();
	const service = {
		addAction: mock.fn()
	};
	const node = { id: "node-11" };

	broker.middlewares.wrapHandler = mock.fn();
	broker.transit.request = mock.fn();

	it("should call actions add & service addAction methods", () => {
		registry.registerActions(node, service, {
			"users.find": { name: "users.find", handler: mock.fn() },
			"users.save": { name: "users.save", handler: mock.fn() }
		});

		expect(registry.actions.add).toHaveBeenCalledTimes(2);
		expect(registry.actions.add).toHaveBeenCalledWith(node, service, { name: "users.find" });
		expect(registry.actions.add).toHaveBeenCalledWith(node, service, { name: "users.save" });

		expect(service.addAction).toHaveBeenCalledTimes(2);
		expect(service.addAction).toHaveBeenCalledWith({ name: "users.find" });
		expect(service.addAction).toHaveBeenCalledWith({ name: "users.save" });

		expect(broker.middlewares.wrapHandler).toHaveBeenCalledTimes(2);
		expect(broker.middlewares.wrapHandler).toHaveBeenCalledWith(
			"remoteAction",
			expect.any(Function),
			{ name: "users.find", handler: expect.any(Function), service }
		);
		expect(broker.middlewares.wrapHandler).toHaveBeenCalledWith(
			"remoteAction",
			expect.any(Function),
			{ name: "users.save", handler: expect.any(Function), service }
		);
	});

	it("should not call actions add & service addAction methods if has visibility", () => {
		registry.actions.add.mockClear();
		service.addAction.mockClear();
		broker.middlewares.wrapHandler.mockClear();
		registry.checkActionVisibility = mock.fn(() => false);

		registry.registerActions(node, service, {
			"users.find": { name: "users.find", handler: mock.fn() },
			"users.save": { name: "users.save", handler: mock.fn() }
		});

		expect(registry.checkActionVisibility).toHaveBeenCalledTimes(2);
		expect(registry.checkActionVisibility).toHaveBeenCalledWith(
			{ name: "users.save", handler: expect.any(Function) },
			node
		);
		expect(registry.checkActionVisibility).toHaveBeenCalledWith(
			{ name: "users.find", handler: expect.any(Function) },
			node
		);

		expect(registry.actions.add).toHaveBeenCalledTimes(0);
		expect(service.addAction).toHaveBeenCalledTimes(0);
		expect(broker.middlewares.wrapHandler).toHaveBeenCalledTimes(0);
	});
});

describe("Test Registry.checkActionVisibility", () => {
	const broker = new ServiceBroker({ logger: false, transporter: "Fake" });
	const registry = broker.registry;

	it("check if not set visibility", () => {
		expect(registry.checkActionVisibility({}, { local: true })).toBe(true);
		expect(registry.checkActionVisibility({}, { local: false })).toBe(true);
	});

	it("check if set visibility to 'published'", () => {
		expect(registry.checkActionVisibility({ visibility: "published" }, { local: true })).toBe(
			true
		);
		expect(registry.checkActionVisibility({ visibility: "published" }, { local: false })).toBe(
			true
		);
	});

	it("check if set visibility to 'public'", () => {
		expect(registry.checkActionVisibility({ visibility: "public" }, { local: true })).toBe(
			true
		);
		expect(registry.checkActionVisibility({ visibility: "public" }, { local: false })).toBe(
			true
		);
	});

	it("check if set visibility to 'protected'", () => {
		expect(registry.checkActionVisibility({ visibility: "protected" }, { local: true })).toBe(
			true
		);
		expect(registry.checkActionVisibility({ visibility: "protected" }, { local: false })).toBe(
			false
		);
	});

	it("check if set visibility to 'private'", () => {
		expect(registry.checkActionVisibility({ visibility: "private" }, { local: true })).toBe(
			false
		);
		expect(registry.checkActionVisibility({ visibility: "private" }, { local: false })).toBe(
			false
		);
	});
});

describe("Test Registry.unregisterAction", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	registry.actions.remove = mock.fn();

	it("should call actions remove method", () => {
		registry.unregisterAction({ id: "node-11" }, "posts.find");

		expect(registry.actions.remove).toHaveBeenCalledTimes(1);
		expect(registry.actions.remove).toHaveBeenCalledWith("posts.find", "node-11");
	});
});

describe("Test Registry.registerEvents", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	registry.events.add = mock.fn();
	const service = {
		addEvent: mock.fn()
	};
	const node = { id: "node-11", local: true };

	broker.middlewares.wrapHandler = mock.fn();

	it("should call events add & service addEvent methods", () => {
		registry.registerEvents(node, service, {
			"user.created": { name: "user.created", handler: mock.fn() },
			"user.removed": { name: "user.removed", handler: mock.fn() }
		});

		expect(registry.events.add).toHaveBeenCalledTimes(2);
		expect(registry.events.add).toHaveBeenCalledWith(node, service, { name: "user.created" });
		expect(registry.events.add).toHaveBeenCalledWith(node, service, { name: "user.removed" });

		expect(service.addEvent).toHaveBeenCalledTimes(2);
		expect(service.addEvent).toHaveBeenCalledWith({ name: "user.created" });
		expect(service.addEvent).toHaveBeenCalledWith({ name: "user.removed" });

		expect(broker.middlewares.wrapHandler).toHaveBeenCalledTimes(2);
		expect(broker.middlewares.wrapHandler).toHaveBeenCalledWith(
			"localEvent",
			expect.any(Function),
			{ name: "user.created" }
		);
		expect(broker.middlewares.wrapHandler).toHaveBeenCalledWith(
			"localEvent",
			expect.any(Function),
			{ name: "user.removed" }
		);
	});
});

describe("Test Registry.unregisterEvent", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	registry.events.remove = mock.fn();

	it("should call events remove method", () => {
		registry.unregisterEvent({ id: "node-11" }, "posts.find");

		expect(registry.events.remove).toHaveBeenCalledTimes(1);
		expect(registry.events.remove).toHaveBeenCalledWith("posts.find", "node-11");
	});
});

describe("Test Registry.regenerateLocalRawInfo", () => {
	const broker = new ServiceBroker({ logger: false, nodeID: "node-1", metadata: { a: 5 } });
	const registry = broker.registry;
	const localNode = registry.nodes.localNode;

	const svc1 = {
		name: "svc1",
		prop: {}
	};

	const svc2 = {
		name: "svc2",
		prop: {}
	};

	// Make some circular references
	svc1.prop.a = svc1;

	registry.services.getLocalNodeServices = mock.fn(() => [svc1, svc2]);

	it("should not call registry getLocalNodeServices if broker is not started", () => {
		broker.started = false;
		expect(registry.regenerateLocalRawInfo()).toEqual({
			client: localNode.client,
			config: {},
			hostname: localNode.hostname,
			ipList: localNode.ipList,
			instanceID: localNode.instanceID,
			metadata: localNode.metadata,
			port: null,
			seq: 1,
			services: []
		});

		expect(registry.services.getLocalNodeServices).toHaveBeenCalledTimes(0);
	});

	it("should increment seq even if broker has NOT started yet", () => {
		registry.services.getLocalNodeServices.mockClear();
		broker.started = false;
		expect(registry.regenerateLocalRawInfo(true)).toEqual({
			client: localNode.client,
			config: {},
			hostname: localNode.hostname,
			ipList: localNode.ipList,
			instanceID: localNode.instanceID,
			metadata: localNode.metadata,
			port: null,
			seq: 2,
			services: [
				{
					name: "svc1",
					prop: {}
				},
				{
					name: "svc2",
					prop: {}
				}
			]
		});

		expect(registry.services.getLocalNodeServices).toHaveBeenCalledTimes(1);
	});

	it("should call registry getLocalNodeServices and return with local rawInfo", () => {
		registry.services.getLocalNodeServices.mockClear();
		broker.started = true;
		expect(registry.regenerateLocalRawInfo()).toEqual({
			client: localNode.client,
			config: {},
			hostname: localNode.hostname,
			instanceID: localNode.instanceID,
			metadata: localNode.metadata,
			ipList: localNode.ipList,
			port: null,
			seq: 2,
			services: [
				{
					name: "svc1",
					prop: {}
				},
				{
					name: "svc2",
					prop: {}
				}
			]
		});

		expect(registry.services.getLocalNodeServices).toHaveBeenCalledTimes(1);
		expect(registry.services.getLocalNodeServices).toHaveBeenCalledWith();
	});
});

describe("Test Registry.getLocalNodeInfo", () => {
	const broker = new ServiceBroker({ logger: false, nodeID: "node-1" });
	const registry = broker.registry;
	const localNode = registry.nodes.localNode;
	const rawInfo = { a: 5 };
	localNode.rawInfo = null;

	registry.regenerateLocalRawInfo = mock.fn(() => rawInfo);

	it("should call registry.regenerateLocalRawInfo if no rawInfo", () => {
		registry.localNodeInfoInvalidated = true;

		expect(registry.getLocalNodeInfo()).toBe(rawInfo);

		expect(registry.regenerateLocalRawInfo).toHaveBeenCalledTimes(1);
		expect(registry.regenerateLocalRawInfo).toHaveBeenCalledWith(false);
	});

	it("should not call registry.regenerateLocalRawInfo if has rawInfo", () => {
		registry.regenerateLocalRawInfo.mockClear();
		localNode.rawInfo = rawInfo;
		expect(registry.getLocalNodeInfo()).toBe(rawInfo);

		expect(registry.regenerateLocalRawInfo).toHaveBeenCalledTimes(0);
	});

	it("should call registry.regenerateLocalRawInfo if has rawInfo && force", () => {
		registry.regenerateLocalRawInfo.mockClear();
		localNode.rawInfo = rawInfo;
		expect(registry.getLocalNodeInfo(true)).toBe(rawInfo);

		expect(registry.regenerateLocalRawInfo).toHaveBeenCalledTimes(1);
		expect(registry.regenerateLocalRawInfo).toHaveBeenCalledWith(false);
	});
});

describe("Test Registry.getNodeInfo", () => {
	const broker = new ServiceBroker({ logger: false, nodeID: "node-1" });
	const registry = broker.registry;
	const node = { id: "node-11", rawInfo: { services: [] } };

	registry.nodes.get = mock.fn(() => node);
	registry.getLocalNodeInfo = mock.fn(() => node.rawInfo);

	it("should call registry.nodes.get method and return with rawInfo", () => {
		const res = registry.getNodeInfo("node-11");

		expect(res).toBe(node.rawInfo);

		expect(registry.nodes.get).toHaveBeenCalledTimes(1);
		expect(registry.nodes.get).toHaveBeenCalledWith("node-11");
	});

	it("should call registry.nodes.get method and getLocalNodeInfo", () => {
		registry.nodes.get = mock.fn(() => ({ local: true }));

		const res = registry.getNodeInfo("node-1");

		expect(res).toBe(node.rawInfo);

		expect(registry.nodes.get).toHaveBeenCalledTimes(1);
		expect(registry.nodes.get).toHaveBeenCalledWith("node-1");

		expect(registry.getLocalNodeInfo).toHaveBeenCalledTimes(1);
		expect(registry.getLocalNodeInfo).toHaveBeenCalledWith();
	});

	it("should call registry.nodes.get method and getLocalNodeInfo", () => {
		registry.nodes.get = mock.fn();

		const res = registry.getNodeInfo("node-2");

		expect(res).toBeNull();

		expect(registry.nodes.get).toHaveBeenCalledTimes(1);
		expect(registry.nodes.get).toHaveBeenCalledWith("node-2");
	});
});

describe("Test Registry.processNodeInfo", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	registry.nodes.processNodeInfo = mock.fn();

	it("should call registry.nodes.processNodeInfo method", () => {
		const payload = {};
		registry.processNodeInfo(payload);

		expect(registry.nodes.processNodeInfo).toHaveBeenCalledTimes(1);
		expect(registry.nodes.processNodeInfo).toHaveBeenCalledWith(payload);
	});
});

describe("Test Registry.getNodeList", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	registry.nodes.list = mock.fn();

	it("should call registry.nodes.list method", () => {
		const opts = {};
		registry.nodes.list(opts);

		expect(registry.nodes.list).toHaveBeenCalledTimes(1);
		expect(registry.nodes.list).toHaveBeenCalledWith(opts);
	});
});

describe("Test Registry.getServiceList", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	registry.services.list = mock.fn();

	it("should call registry.services.list method", () => {
		const opts = {};
		registry.getServiceList(opts);

		expect(registry.services.list).toHaveBeenCalledTimes(1);
		expect(registry.services.list).toHaveBeenCalledWith(opts);
	});
});

describe("Test Registry.getActionList", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	registry.actions.list = mock.fn();

	it("should call registry.actions.list method", () => {
		const opts = {};
		registry.getActionList(opts);

		expect(registry.actions.list).toHaveBeenCalledTimes(1);
		expect(registry.actions.list).toHaveBeenCalledWith(opts);
	});
});

describe("Test Registry.getEventList", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	registry.events.list = mock.fn();

	it("should call registry.events.list method", () => {
		const opts = {};
		registry.getEventList(opts);

		expect(registry.events.list).toHaveBeenCalledTimes(1);
		expect(registry.events.list).toHaveBeenCalledWith(opts);
	});
});

describe("Test Registry.getNodeRawList", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	registry.nodes.toArray = mock.fn(() => [{ rawInfo: { a: 5 } }, { rawInfo: { b: 10 } }]);

	it("should call registry.events.list method", () => {
		expect(registry.getNodeRawList()).toEqual([{ a: 5 }, { b: 10 }]);

		expect(registry.nodes.toArray).toHaveBeenCalledTimes(1);
		expect(registry.nodes.toArray).toHaveBeenCalledWith();
	});
});

describe("Test Registry.hasService", () => {
	const broker = new ServiceBroker({ logger: false });
	const registry = broker.registry;

	registry.services.has = mock.fn();

	it("should call registry.services.has method", () => {
		registry.hasService("v2.posts");

		expect(registry.services.has).toHaveBeenCalledTimes(1);
		expect(registry.services.has).toHaveBeenCalledWith("v2.posts", undefined);
	});

	it("should call registry.services.has method with nodeID", () => {
		registry.services.has.mockClear();
		registry.hasService("v2.posts", "node-123");

		expect(registry.services.has).toHaveBeenCalledTimes(1);
		expect(registry.services.has).toHaveBeenCalledWith("v2.posts", "node-123");
	});
});
