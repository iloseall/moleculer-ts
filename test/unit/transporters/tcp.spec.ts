import { describe, it, beforeEach, mock } from "../../helpers/test";
import expect from "../../helpers/expect";
import { autoMock, factoryMock, interopDefault } from "../../helpers/module-mock";

autoMock(require.resolve("fs"));
autoMock(require.resolve("../../../src/transporters/tcp/tcp-reader"));
autoMock(require.resolve("../../../src/transporters/tcp/tcp-writer"));
autoMock(require.resolve("../../../src/transporters/tcp/udp-broadcaster"));

const fs = interopDefault(require("fs"));
const TcpReader = interopDefault(require("../../../src/transporters/tcp/tcp-reader"));
const TcpWriter = interopDefault(require("../../../src/transporters/tcp/tcp-writer"));
const UdpServer = interopDefault(require("../../../src/transporters/tcp/udp-broadcaster"));
const ServiceBroker = interopDefault(require("../../../src/service-broker"));
const Transit = interopDefault(require("../../../src/transit"));
const P = require("../../../src/packets");
const E = require("../../../src/errors");
const { protectReject } = require("../../helpers/utils");
const TcpTransporter = interopDefault(require("../../../src/transporters/tcp"));

// const lolex = require("@sinonjs/fake-timers");

TcpReader.mockImplementation(() => {
	return {
		listen: mock.fn()
	};
});

TcpWriter.mockImplementation(() => {
	const callbacks = {};
	return {
		on: mock.fn((name, cb) => {
			callbacks[name] = cb;
		}),
		__callbacks: callbacks
	};
});

UdpServer.mockImplementation(() => {
	const callbacks = {};
	return {
		on: mock.fn((name, cb) => {
			callbacks[name] = cb;
		}),
		__callbacks: callbacks,
		bind: mock.fn()
	};
});

describe("Test TcpTransporter constructor", () => {
	it("check constructor", () => {
		const transporter = new TcpTransporter();
		expect(transporter).toBeDefined();
		expect(transporter.opts).toEqual({
			udpDiscovery: true,
			udpReuseAddr: true,
			udpMaxDiscovery: 0,
			udpBindAddress: null,
			udpPort: 4445,
			udpPeriod: 30,
			udpMulticast: "239.0.0.0",
			udpMulticastTTL: 1,
			udpBroadcast: false,
			port: null,
			urls: null,
			useHostname: true,
			gossipPeriod: 2,
			maxConnections: 32,
			maxPacketSize: 1 * 1024 * 1024
		});
		expect(transporter.connected).toBe(false);
		expect(transporter.hasBuiltInBalancer).toBe(false);

		expect(transporter.reader).toBeNull();
		expect(transporter.writer).toBeNull();
		expect(transporter.udpServer).toBeNull();
		expect(transporter.gossipTimer).toBeNull();
	});

	// it("check constructor with string param", () => {
	// 	let transporter = new TcpTransporter("nats://localhost");
	// 	expect(transporter.opts).toEqual();
	// });

	it("check constructor with options", () => {
		const opts = {
			udpDiscovery: false,
			udpBindAddress: "10.0.0.4",
			port: 5555,
			udpBroadcast: true
		};
		const transporter = new TcpTransporter(opts);
		expect(transporter.opts).toEqual({
			udpDiscovery: false,
			udpReuseAddr: true,
			udpMaxDiscovery: 0,
			udpBindAddress: "10.0.0.4",
			udpPort: 4445,
			udpPeriod: 30,
			udpBroadcast: true,
			udpMulticast: "239.0.0.0",
			udpMulticastTTL: 1,
			port: 5555,
			urls: null,
			useHostname: true,
			gossipPeriod: 2,
			maxConnections: 32,
			maxPacketSize: 1 * 1024 * 1024
		});
	});
});

describe("Test TcpTransporter init", () => {
	const broker = new ServiceBroker({ logger: false, transporter: "fake" });
	const transporter = new TcpTransporter({});

	it("check init", () => {
		broker.registry.discoverer.disableHeartbeat = mock.fn();
		transporter.init(broker.transit, mock.fn(), mock.fn());

		expect(transporter.registry).toBe(broker.registry);
		expect(transporter.nodes).toBe(broker.registry.nodes);
		expect(broker.registry.discoverer.disableHeartbeat).toHaveBeenCalledTimes(1);
	});
});

describe("Test TcpTransporter connect & disconnect & reconnect", () => {
	const broker = new ServiceBroker({ logger: false });
	const transit = new Transit(broker);
	const msgHandler = mock.fn();
	let transporter;

	beforeEach(() => {
		transporter = new TcpTransporter({ port: 1234 });
		transporter.init(transit, msgHandler);

		transporter.startTcpServer = mock.fn();
		transporter.startUdpServer = mock.fn();
		transporter.startTimers = mock.fn();
		transporter.stopTimers = mock.fn();
		transporter.loadUrls = mock.fn();
	});

	it("check connect", () => {
		transporter.onConnected = mock.fn(() => Promise.resolve());
		broker.registry.regenerateLocalRawInfo = mock.fn();

		const p = transporter
			.connect()
			.catch(protectReject)
			.then(() => {
				expect(transporter.connected).toBe(true);
				expect(transporter.startTcpServer).toHaveBeenCalledTimes(1);
				expect(transporter.startUdpServer).toHaveBeenCalledTimes(1);
				expect(transporter.startTimers).toHaveBeenCalledTimes(1);

				expect(broker.registry.nodes.localNode.port).toBe(1234);

				expect(broker.registry.regenerateLocalRawInfo).toHaveBeenCalledTimes(1);

				expect(transporter.onConnected).toHaveBeenCalledTimes(1);
				expect(transporter.loadUrls).toHaveBeenCalledTimes(0);
			});

		return p;
	});

	it("check connect with loadUrls", () => {
		transporter.onConnected = mock.fn(() => Promise.resolve());
		transporter.opts.urls = [];

		const p = transporter
			.connect()
			.catch(protectReject)
			.then(() => {
				expect(transporter.connected).toBe(true);
				expect(transporter.startTcpServer).toHaveBeenCalledTimes(1);
				expect(transporter.startUdpServer).toHaveBeenCalledTimes(1);
				expect(transporter.startTimers).toHaveBeenCalledTimes(1);

				expect(broker.registry.nodes.localNode.port).toBe(1234);

				expect(transporter.onConnected).toHaveBeenCalledTimes(1);
				expect(transporter.loadUrls).toHaveBeenCalledTimes(1);
			});

		return p;
	});

	it("check disconnect", () => {
		transporter.reader = { close: mock.fn() };
		transporter.writer = { close: mock.fn() };
		transporter.udpServer = { close: mock.fn() };

		return transporter
			.connect()
			.catch(protectReject)
			.then(() => {
				transporter.disconnect();
				expect(transporter.connected).toBe(false);
				expect(transporter.stopTimers).toHaveBeenCalledTimes(1);
				expect(transporter.reader.close).toHaveBeenCalledTimes(1);
				expect(transporter.writer.close).toHaveBeenCalledTimes(1);
				expect(transporter.udpServer.close).toHaveBeenCalledTimes(1);
			});
	});
});

describe("Test TcpTransporter getLocalNodeInfo & getNodeInfo", () => {
	const broker = new ServiceBroker({ logger: false });
	const transit = new Transit(broker);
	const msgHandler = mock.fn();
	const transporter = new TcpTransporter({ port: 1234 });
	transporter.init(transit, msgHandler);

	it("should return nodes.localNode", () => {
		expect(transporter.getLocalNodeInfo()).toBe(transporter.nodes.localNode);
	});

	it("should return with selected node", () => {
		const node = {};
		transporter.nodes.get = mock.fn(() => node);
		expect(transporter.getNodeInfo("node-2")).toBe(node);
		expect(transporter.nodes.get).toHaveBeenCalledTimes(1);
		expect(transporter.nodes.get).toHaveBeenCalledWith("node-2");
	});
});

describe("Test TcpTransporter subscribe & publish", () => {
	let transporter;

	beforeEach(() => {
		transporter = new TcpTransporter();
		transporter.init(
			new Transit(new ServiceBroker({ logger: false, namespace: "TEST", nodeID: "node-123" }))
		);

		transporter.writer = {
			send: mock.fn(() => Promise.resolve())
		};

		transporter.startTcpServer = mock.fn();
		transporter.startUdpServer = mock.fn();
		transporter.startTimers = mock.fn();
		transporter.stopTimers = mock.fn();

		transporter.serialize = mock.fn(() => Buffer.from("json data"));

		return transporter.connect();
	});

	it("should send packet with target", () => {
		const packet = new P.Packet(P.PACKET_EVENT, "node2", {});
		return transporter
			.publish(packet)
			.catch(protectReject)
			.then(() => {
				expect(transporter.writer.send).toHaveBeenCalledTimes(1);
				expect(transporter.writer.send).toHaveBeenCalledWith(
					"node2",
					1,
					Buffer.from("json data")
				);

				expect(transporter.serialize).toHaveBeenCalledTimes(1);
				expect(transporter.serialize).toHaveBeenCalledWith(packet);
			});
	});

	it("should call disconnect if can't send packet", () => {
		transporter.serialize.mockClear();
		transporter.writer.send = mock.fn(() => Promise.reject());
		transporter.nodes.disconnected = mock.fn();

		const packet = new P.Packet(P.PACKET_EVENT, "node2", {});
		return transporter
			.publish(packet)
			.then(protectReject)
			.catch(() => {
				expect(transporter.writer.send).toHaveBeenCalledTimes(1);
				expect(transporter.writer.send).toHaveBeenCalledWith(
					"node2",
					1,
					Buffer.from("json data")
				);

				expect(transporter.nodes.disconnected).toHaveBeenCalledTimes(1);
				expect(transporter.nodes.disconnected).toHaveBeenCalledWith("node2", true);
			});
	});

	it("should not send without target", () => {
		transporter.serialize.mockClear();
		transporter.writer.send.mockClear();

		const packet = new P.Packet(P.PACKET_EVENT, null, {});
		return transporter
			.publish(packet)
			.catch(protectReject)
			.then(() => {
				expect(transporter.writer.send).toHaveBeenCalledTimes(0);
				expect(transporter.serialize).toHaveBeenCalledTimes(0);
			});
	});

	it("should not send declined packets", () => {
		transporter.serialize.mockClear();
		transporter.writer.send.mockClear();

		const packet = new P.Packet(P.PACKET_DISCOVER);
		return transporter
			.publish(packet)
			.catch(protectReject)
			.then(() => {
				expect(transporter.writer.send).toHaveBeenCalledTimes(0);
				expect(transporter.serialize).toHaveBeenCalledTimes(0);
			});
	});
});

describe("Test TcpTransporter nodes functions", () => {
	const broker = new ServiceBroker({ logger: false, namespace: "TEST", nodeID: "node-123" });
	const transit = new Transit(broker);
	let transporter;

	beforeEach(() => {
		transporter = new TcpTransporter();
		transporter.init(transit);

		transporter.startTcpServer = mock.fn();
		transporter.startUdpServer = mock.fn();
		transporter.startTimers = mock.fn();
		transporter.stopTimers = mock.fn();

		return transporter.connect();
	});

	it("should create an offline node", () => {
		expect(transporter.nodes.toArray().length).toBe(1);

		const node = transporter.addOfflineNode("node-123", "10.20.30.40", 12345);
		expect(node.id).toBe("node-123");
		expect(node.local).toBe(false);
		expect(node.hostname).toBe("10.20.30.40");
		expect(node.ipList).toEqual(["10.20.30.40"]);
		expect(node.port).toBe(12345);
		expect(node.available).toBe(false);
		expect(node.seq).toBe(0);
		expect(node.offlineSince).toBeDefined();

		expect(transporter.getNode("node-123")).toBe(node);
	});

	it("check getNodeAddress method", () => {
		const node = transporter.addOfflineNode("node-123", "10.20.30.40", 12345);
		node.udpAddress = "udp-address";
		node.hostname = "server-host";

		expect(transporter.getNodeAddress(node)).toBe("udp-address");

		node.udpAddress = null;
		expect(transporter.getNodeAddress(node)).toBe("server-host");

		transporter.opts.useHostname = false;
		expect(transporter.getNodeAddress(node)).toBe("10.20.30.40");

		transporter.opts.useHostname = true;
		node.hostname = null;
		expect(transporter.getNodeAddress(node)).toBe("10.20.30.40");

		node.ipList = [];
		expect(transporter.getNodeAddress(node)).toBeNull();
	});
});

describe("Test TcpTransporter startTcpServer", () => {
	const broker = new ServiceBroker({ logger: false, namespace: "TEST", nodeID: "node-123" });
	const transit = new Transit(broker);
	let transporter;

	beforeEach(() => {
		transporter = new TcpTransporter();
		transporter.init(transit);
	});

	it("check startTcpServer", () => {
		transporter.startTcpServer();

		expect(TcpWriter).toHaveBeenCalledTimes(1);
		expect(TcpWriter).toHaveBeenCalledWith(transporter, transporter.opts);

		expect(TcpReader).toHaveBeenCalledTimes(1);
		expect(TcpReader).toHaveBeenCalledWith(transporter, transporter.opts);

		expect(transporter.writer.on).toHaveBeenCalledTimes(2);
		expect(transporter.writer.on).toHaveBeenCalledWith("error", expect.any(Function));
		expect(transporter.writer.on).toHaveBeenCalledWith("end", expect.any(Function));

		expect(transporter.reader.listen).toHaveBeenCalledTimes(1);
		expect(transporter.reader.listen).toHaveBeenCalledWith();
	});

	it("check writer error handler", () => {
		transporter.startTcpServer();
		transporter.nodes.disconnected = mock.fn();

		transporter.writer.__callbacks.error(null, "node-2");

		expect(transporter.nodes.disconnected).toHaveBeenCalledTimes(1);
		expect(transporter.nodes.disconnected).toHaveBeenCalledWith("node-2", false);
	});

	it("check writer end handler", () => {
		transporter.startTcpServer();
		transporter.nodes.disconnected = mock.fn();

		transporter.writer.__callbacks.end("node-2");

		expect(transporter.nodes.disconnected).toHaveBeenCalledTimes(1);
		expect(transporter.nodes.disconnected).toHaveBeenCalledWith("node-2", false);
	});
});

describe("Test TcpTransporter startUdpServer", () => {
	const broker = new ServiceBroker({ logger: false, namespace: "TEST", nodeID: "node-123" });
	const transit = new Transit(broker);
	let transporter;

	beforeEach(() => {
		transporter = new TcpTransporter();
		transporter.init(transit);
	});

	it("check startUdpServer", () => {
		transporter.startUdpServer();

		expect(UdpServer).toHaveBeenCalledTimes(1);
		expect(UdpServer).toHaveBeenCalledWith(transporter, transporter.opts);

		expect(transporter.udpServer.on).toHaveBeenCalledTimes(1);
		expect(transporter.udpServer.on).toHaveBeenCalledWith("message", expect.any(Function));

		expect(transporter.udpServer.bind).toHaveBeenCalledTimes(1);
		expect(transporter.udpServer.bind).toHaveBeenCalledWith();
	});

	it("check UDP server message handler if new node", () => {
		transporter.startUdpServer();
		transporter.nodes.get = mock.fn(() => null);
		const node = {};
		transporter.addOfflineNode = mock.fn(() => node);

		transporter.udpServer.__callbacks.message("node-2", "10.20.30.40", 12345);

		expect(node.udpAddress).toBe("10.20.30.40");

		expect(transporter.nodes.get).toHaveBeenCalledTimes(1);
		expect(transporter.nodes.get).toHaveBeenCalledWith("node-2");

		expect(transporter.addOfflineNode).toHaveBeenCalledTimes(1);
		expect(transporter.addOfflineNode).toHaveBeenCalledWith("node-2", "10.20.30.40", 12345);
	});

	it("check UDP server message handler if offline node", () => {
		transporter.startUdpServer();

		const node = { ipList: [], available: false };
		transporter.nodes.get = mock.fn(() => node);
		transporter.addOfflineNode = mock.fn(() => node);

		transporter.udpServer.__callbacks.message("node-2", "10.20.30.40", 12345);

		expect(node.hostname).toBe("10.20.30.40");
		expect(node.ipList).toEqual(["10.20.30.40"]);
		expect(node.port).toBe(12345);
		expect(node.udpAddress).toBe("10.20.30.40");

		expect(transporter.nodes.get).toHaveBeenCalledTimes(1);
		expect(transporter.nodes.get).toHaveBeenCalledWith("node-2");

		expect(transporter.addOfflineNode).toHaveBeenCalledTimes(0);
	});

	it("check UDP server message handler if available node", () => {
		transporter.startUdpServer();

		const node = { ipList: [], available: true, hostname: "old", port: 1000 };
		transporter.nodes.get = mock.fn(() => node);
		transporter.addOfflineNode = mock.fn(() => node);

		transporter.udpServer.__callbacks.message("node-2", "10.20.30.40", 12345);

		expect(node.hostname).toBe("old");
		expect(node.ipList).toEqual([]);
		expect(node.port).toBe(1000);
		expect(node.udpAddress).toBe("10.20.30.40");

		expect(transporter.nodes.get).toHaveBeenCalledTimes(1);
		expect(transporter.nodes.get).toHaveBeenCalledWith("node-2");

		expect(transporter.addOfflineNode).toHaveBeenCalledTimes(0);
	});
});

describe("Test TcpTransporter startUdpServer", () => {
	const broker = new ServiceBroker({ logger: false, namespace: "TEST", nodeID: "node-123" });
	const transit = new Transit(broker);
	let transporter;
	const promUpdateLocalInfo = Promise.resolve();
	const fakeNode = {
		updateLocalInfo: mock.fn(() => promUpdateLocalInfo)
	};

	beforeEach(() => {
		transporter = new TcpTransporter();
		transporter.init(transit);
		transporter.getLocalNodeInfo = mock.fn(() => fakeNode);
		transporter.sendGossipRequest = mock.fn();
	});

	it("check startTimers", () => {
		expect(transporter.gossipTimer).toBeNull();
		transporter.startTimers();
		expect(transporter.gossipTimer).toBeDefined();
		transporter.stopTimers(); // clean up handle
	});

	it("check timer callback", async () => {
		mock.useFakeTimers();
		transporter.startTimers();

		mock.advanceTimersByTime(2500);

		await promUpdateLocalInfo;

		expect(transporter.getLocalNodeInfo).toBeCalledTimes(1);
		expect(fakeNode.updateLocalInfo).toBeCalledTimes(1);
		expect(fakeNode.updateLocalInfo).toBeCalledWith(broker.getCpuUsage);

		expect(transporter.sendGossipRequest).toBeCalledTimes(1);

		transporter.stopTimers(); // clean up handle
	});

	it("check stopTimers", () => {
		transporter.startTimers();
		expect(transporter.gossipTimer).toBeDefined();
		transporter.stopTimers();
		expect(transporter.gossipTimer).toBeNull();
	});
});

describe("Test TcpTransporter loadUrls", () => {
	const broker = new ServiceBroker({ logger: false, namespace: "TEST", nodeID: "node-123" });
	const transit = new Transit(broker);

	function createTransporter(opts) {
		const transporter = new TcpTransporter(opts);
		transporter.init(transit);
		transporter.logger.warn = mock.fn();
		transporter.addOfflineNode = mock.fn();

		return transporter.loadUrls().then(() => transporter);
	}

	it("check with null", () => {
		return createTransporter({
			urls: null
		})
			.catch(protectReject)
			.then(transporter => {
				expect(transporter.addOfflineNode).toHaveBeenCalledTimes(0);
				expect(transporter.logger.warn).toHaveBeenCalledTimes(0);
				// expect(transporter.nodes.disableOfflineNodeRemoving).toBe(false);
			});
	});

	it("check with empty string", () => {
		return createTransporter({
			urls: ""
		})
			.catch(protectReject)
			.then(transporter => {
				expect(transporter.addOfflineNode).toHaveBeenCalledTimes(0);
				expect(transporter.logger.warn).toHaveBeenCalledTimes(0);
				// expect(transporter.nodes.disableOfflineNodeRemoving).toBe(false);
			});
	});

	it("check with empty array", () => {
		return createTransporter({
			urls: []
		})
			.catch(protectReject)
			.then(transporter => {
				expect(transporter.addOfflineNode).toHaveBeenCalledTimes(0);
				expect(transporter.logger.warn).toHaveBeenCalledTimes(0);
				// expect(transporter.nodes.disableOfflineNodeRemoving).toBe(false);
			});
	});

	it("check with string", () => {
		return createTransporter({
			urls: "tcp://192.168.0.1:5001/node-1, tcp://192.168.0.2:5002/node-2,192.168.0.3:5003/node-3,tcp://192.168.0.4:5004,tcp://192.168.0.123:5123/node-123,192.168.0.5/node-5",
			port: 1234
		})
			.catch(protectReject)
			.then(transporter => {
				expect(transporter.addOfflineNode).toHaveBeenCalledTimes(3);
				expect(transporter.addOfflineNode).toHaveBeenCalledWith(
					"node-1",
					"192.168.0.1",
					5001
				);
				expect(transporter.addOfflineNode).toHaveBeenCalledWith(
					"node-2",
					"192.168.0.2",
					5002
				);
				expect(transporter.addOfflineNode).toHaveBeenCalledWith(
					"node-3",
					"192.168.0.3",
					5003
				);

				expect(transporter.logger.warn).toHaveBeenCalledTimes(2);
				expect(transporter.logger.warn).toHaveBeenCalledWith(
					"Invalid endpoint URL. Missing nodeID. URL:",
					"192.168.0.4:5004"
				);
				expect(transporter.logger.warn).toHaveBeenCalledWith(
					"Invalid endpoint URL. Missing port. URL:",
					"192.168.0.5/node-5"
				);

				expect(transporter.opts.port).toBe(1234);
				// expect(transporter.nodes.disableOfflineNodeRemoving).toBe(true);
			});
	});

	it("check with connection string", () => {
		return createTransporter(
			"tcp://192.168.0.1:5001/node-1, tcp://192.168.0.2:5002/node-2,192.168.0.3:5003/node-3,tcp://192.168.0.4:5004,tcp://192.168.0.123:5123/node-123,192.168.0.5/node-5"
		)
			.catch(protectReject)
			.then(transporter => {
				expect(transporter.addOfflineNode).toHaveBeenCalledTimes(3);
				expect(transporter.addOfflineNode).toHaveBeenCalledWith(
					"node-1",
					"192.168.0.1",
					5001
				);
				expect(transporter.addOfflineNode).toHaveBeenCalledWith(
					"node-2",
					"192.168.0.2",
					5002
				);
				expect(transporter.addOfflineNode).toHaveBeenCalledWith(
					"node-3",
					"192.168.0.3",
					5003
				);

				expect(transporter.logger.warn).toHaveBeenCalledTimes(2);
				expect(transporter.logger.warn).toHaveBeenCalledWith(
					"Invalid endpoint URL. Missing nodeID. URL:",
					"192.168.0.4:5004"
				);
				expect(transporter.logger.warn).toHaveBeenCalledWith(
					"Invalid endpoint URL. Missing port. URL:",
					"192.168.0.5/node-5"
				);

				expect(transporter.opts.port).toBe(5123);
				// expect(transporter.nodes.disableOfflineNodeRemoving).toBe(true);
			});
	});

	it("check with array", () => {
		return createTransporter({
			urls: [
				"tcp://192.168.0.1:5001/node-1",
				"tcp://192.168.0.2:5002/node-2",
				"192.168.0.3:5003/node-3",
				"tcp://192.168.0.4:5004",
				"tcp://192.168.0.123:5123/node-123",
				"192.168.0.5/node-5"
			]
		})
			.catch(protectReject)
			.then(transporter => {
				expect(transporter.addOfflineNode).toHaveBeenCalledTimes(3);
				expect(transporter.addOfflineNode).toHaveBeenCalledWith(
					"node-1",
					"192.168.0.1",
					5001
				);
				expect(transporter.addOfflineNode).toHaveBeenCalledWith(
					"node-2",
					"192.168.0.2",
					5002
				);
				expect(transporter.addOfflineNode).toHaveBeenCalledWith(
					"node-3",
					"192.168.0.3",
					5003
				);

				expect(transporter.logger.warn).toHaveBeenCalledTimes(2);
				expect(transporter.logger.warn).toHaveBeenCalledWith(
					"Invalid endpoint URL. Missing nodeID. URL:",
					"192.168.0.4:5004"
				);
				expect(transporter.logger.warn).toHaveBeenCalledWith(
					"Invalid endpoint URL. Missing port. URL:",
					"192.168.0.5/node-5"
				);

				// expect(transporter.nodes.disableOfflineNodeRemoving).toBe(true);
			});
	});

	it("check with object", () => {
		return createTransporter({
			urls: {
				"node-1": "tcp://192.168.0.1:5001",
				"node-2": "tcp://192.168.0.2:5002",
				"node-3": "192.168.0.3:5003",
				"node-4": "tcp://192.168.0.4:5004",
				"node-123": "tcp://192.168.0.123:5123",
				"node-5": "192.168.0.5"
			}
		})
			.catch(protectReject)
			.then(transporter => {
				expect(transporter.addOfflineNode).toHaveBeenCalledTimes(4);
				expect(transporter.addOfflineNode).toHaveBeenCalledWith(
					"node-1",
					"192.168.0.1",
					5001
				);
				expect(transporter.addOfflineNode).toHaveBeenCalledWith(
					"node-2",
					"192.168.0.2",
					5002
				);
				expect(transporter.addOfflineNode).toHaveBeenCalledWith(
					"node-3",
					"192.168.0.3",
					5003
				);
				expect(transporter.addOfflineNode).toHaveBeenCalledWith(
					"node-4",
					"192.168.0.4",
					5004
				);

				expect(transporter.logger.warn).toHaveBeenCalledTimes(1);
				expect(transporter.logger.warn).toHaveBeenCalledWith(
					"Invalid endpoint URL. Missing port. URL:",
					"192.168.0.5/node-5"
				);

				// expect(transporter.nodes.disableOfflineNodeRemoving).toBe(true);
			});
	});

	describe("check with file path", () => {
		it("should parse txt file", () => {
			fs.readFileSync = mock.fn(
				() =>
					"tcp://192.168.0.1:5001/node-1\ntcp://192.168.0.2:5002/node-2\n\n192.168.0.3:5003/node-3\ntcp://192.168.0.4:5004\ntcp://192.168.0.123:5123/node-123\n192.168.0.5/node-5\n"
			);

			return createTransporter({
				urls: "file://./registry/nodes.txt"
			})
				.catch(protectReject)
				.then(transporter => {
					expect(fs.readFileSync).toHaveBeenCalledTimes(1);
					expect(fs.readFileSync).toHaveBeenCalledWith("./registry/nodes.txt");

					expect(transporter.addOfflineNode).toHaveBeenCalledTimes(3);
					expect(transporter.addOfflineNode).toHaveBeenCalledWith(
						"node-1",
						"192.168.0.1",
						5001
					);
					expect(transporter.addOfflineNode).toHaveBeenCalledWith(
						"node-2",
						"192.168.0.2",
						5002
					);
					expect(transporter.addOfflineNode).toHaveBeenCalledWith(
						"node-3",
						"192.168.0.3",
						5003
					);

					expect(transporter.logger.warn).toHaveBeenCalledTimes(2);
					expect(transporter.logger.warn).toHaveBeenCalledWith(
						"Invalid endpoint URL. Missing nodeID. URL:",
						"192.168.0.4:5004"
					);
					expect(transporter.logger.warn).toHaveBeenCalledWith(
						"Invalid endpoint URL. Missing port. URL:",
						"192.168.0.5/node-5"
					);

					// expect(transporter.nodes.disableOfflineNodeRemoving).toBe(true);
				});
		});

		it("should parse json file", () => {
			fs.readFileSync = mock.fn(() => {
				return `
[
				"tcp://192.168.0.1:5001/node-1",
				"tcp://192.168.0.2:5002/node-2",
				"192.168.0.3:5003/node-3",
				"tcp://192.168.0.4:5004",
				"tcp://192.168.0.123:5123/node-123",
				"192.168.0.5/node-5"
]
`;
			});

			return createTransporter({
				urls: "file://./registry/nodes.json"
			})
				.catch(protectReject)
				.then(transporter => {
					expect(fs.readFileSync).toHaveBeenCalledTimes(1);
					expect(fs.readFileSync).toHaveBeenCalledWith("./registry/nodes.json");

					expect(transporter.addOfflineNode).toHaveBeenCalledTimes(3);
					expect(transporter.addOfflineNode).toHaveBeenCalledWith(
						"node-1",
						"192.168.0.1",
						5001
					);
					expect(transporter.addOfflineNode).toHaveBeenCalledWith(
						"node-2",
						"192.168.0.2",
						5002
					);
					expect(transporter.addOfflineNode).toHaveBeenCalledWith(
						"node-3",
						"192.168.0.3",
						5003
					);

					expect(transporter.logger.warn).toHaveBeenCalledTimes(2);
					expect(transporter.logger.warn).toHaveBeenCalledWith(
						"Invalid endpoint URL. Missing nodeID. URL:",
						"192.168.0.4:5004"
					);
					expect(transporter.logger.warn).toHaveBeenCalledWith(
						"Invalid endpoint URL. Missing port. URL:",
						"192.168.0.5/node-5"
					);

					// expect(transporter.nodes.disableOfflineNodeRemoving).toBe(true);
				});
		});
	});
});

describe("Test TcpTransporter onIncomingMessage", () => {
	const broker = new ServiceBroker({ logger: false, namespace: "TEST", nodeID: "node-123" });
	const transit = new Transit(broker);
	let transporter;

	beforeEach(() => {
		transporter = new TcpTransporter();
		transporter.init(transit);

		transporter.processGossipHello = mock.fn();
		transporter.processGossipRequest = mock.fn();
		transporter.processGossipResponse = mock.fn();
		transporter.incomingMessage = mock.fn();
	});

	it("should call processGossipHello", () => {
		const socket = {};
		transporter.onIncomingMessage(P.PACKET_GOSSIP_HELLO, "message", socket);

		expect(transporter.processGossipHello).toHaveBeenCalledTimes(1);
		expect(transporter.processGossipHello).toHaveBeenCalledWith("message", socket);
	});

	it("should call processGossipRequest", () => {
		transporter.onIncomingMessage(P.PACKET_GOSSIP_REQ, "message");

		expect(transporter.processGossipRequest).toHaveBeenCalledTimes(1);
		expect(transporter.processGossipRequest).toHaveBeenCalledWith("message");
	});

	it("should call processGossipResponse", () => {
		transporter.onIncomingMessage(P.PACKET_GOSSIP_RES, "message");

		expect(transporter.processGossipResponse).toHaveBeenCalledTimes(1);
		expect(transporter.processGossipResponse).toHaveBeenCalledWith("message");
	});

	it("should call incomingMessage", () => {
		transporter.onIncomingMessage(P.PACKET_REQUEST, "message");

		expect(transporter.incomingMessage).toHaveBeenCalledTimes(1);
		expect(transporter.incomingMessage).toHaveBeenCalledWith(P.PACKET_REQUEST, "message");

		transporter.onIncomingMessage(P.PACKET_EVENT, "message 2");

		expect(transporter.incomingMessage).toHaveBeenCalledTimes(2);
		expect(transporter.incomingMessage).toHaveBeenCalledWith(P.PACKET_EVENT, "message 2");
	});
});

describe("Test Gossip methods", () => {
	const broker = new ServiceBroker({ logger: false, namespace: "TEST", nodeID: "node-1" });
	const transit = new Transit(broker);
	let transporter;

	beforeEach(() => {
		transporter = new TcpTransporter();
		transporter.init(transit);
	});

	describe("Test onIncomingMessage", () => {
		it("should call processGossipHello", () => {
			const msg = {};
			const socket = {};
			transporter.processGossipHello = mock.fn();

			transporter.onIncomingMessage(P.PACKET_GOSSIP_HELLO, msg, socket);

			expect(transporter.processGossipHello).toHaveBeenCalledTimes(1);
			expect(transporter.processGossipHello).toHaveBeenCalledWith(msg, socket);
		});

		it("should call processGossipRequest", () => {
			const msg = {};
			transporter.processGossipRequest = mock.fn();

			transporter.onIncomingMessage(P.PACKET_GOSSIP_REQ, msg);

			expect(transporter.processGossipRequest).toHaveBeenCalledTimes(1);
			expect(transporter.processGossipRequest).toHaveBeenCalledWith(msg);
		});

		it("should call processGossipResponse", () => {
			const msg = {};
			transporter.processGossipResponse = mock.fn();

			transporter.onIncomingMessage(P.PACKET_GOSSIP_RES, msg);

			expect(transporter.processGossipResponse).toHaveBeenCalledTimes(1);
			expect(transporter.processGossipResponse).toHaveBeenCalledWith(msg);
		});

		it("should call incomingMessage", () => {
			const msg = {};
			transporter.incomingMessage = mock.fn();

			transporter.onIncomingMessage(P.PACKET_REQUEST, msg);
			expect(transporter.incomingMessage).toHaveBeenCalledTimes(1);
			expect(transporter.incomingMessage).toHaveBeenCalledWith(P.PACKET_REQUEST, msg);

			transporter.onIncomingMessage(P.PACKET_EVENT, msg);
			expect(transporter.incomingMessage).toHaveBeenCalledTimes(2);
			expect(transporter.incomingMessage).toHaveBeenCalledWith(P.PACKET_EVENT, msg);
		});
	});

	describe("Test sendHello", () => {
		it("should throw error if nodeID is unknown", () => {
			transporter.getNode = mock.fn();

			return transporter
				.sendHello("node-xy")
				.then(protectReject)
				.catch(err => {
					expect(err).toBeInstanceOf(E.MoleculerServerError);
					expect(err.message).toBe("Missing node info for 'node-xy'");
				});
		});

		it("should publish a HELLO packet", () => {
			transporter.getNode = mock.fn(() => ({
				id: "node-2",
				ipList: ["192.168.1.2"]
			}));
			transporter.publish = mock.fn(() => Promise.resolve());
			transporter.getNodeAddress = mock.fn(() => "node-1-host");

			transporter.sendHello("node-2");

			expect(transporter.publish).toHaveBeenCalledTimes(1);
			expect(transporter.publish).toHaveBeenCalledWith({
				type: "GOSSIP_HELLO",
				target: "node-2",
				payload: {
					host: "node-1-host",
					port: null
				}
			});
		});
	});

	describe("Test processGossipHello", () => {
		it("should create as offline node", () => {
			transporter.addOfflineNode = mock.fn();
			transporter.nodes.get = mock.fn();
			transporter.deserialize = mock.fn(() => ({
				payload: {
					sender: "node-2",
					host: "node-2-host",
					port: 5555
				}
			}));

			transporter.processGossipHello("message");

			expect(transporter.deserialize).toHaveBeenCalledTimes(1);
			expect(transporter.deserialize).toHaveBeenCalledWith(P.PACKET_GOSSIP_HELLO, "message");

			expect(transporter.nodes.get).toHaveBeenCalledTimes(1);
			expect(transporter.nodes.get).toHaveBeenCalledWith("node-2");

			expect(transporter.addOfflineNode).toHaveBeenCalledTimes(1);
			expect(transporter.addOfflineNode).toHaveBeenCalledWith("node-2", "node-2-host", 5555);
		});

		it("should not create as offline node if already exists", () => {
			transporter.addOfflineNode = mock.fn();
			transporter.nodes.get = mock.fn(() => ({}));
			transporter.deserialize = mock.fn(() => ({
				payload: {
					sender: "node-2",
					host: "node-2-host",
					port: 5555
				}
			}));

			transporter.processGossipHello("message");

			expect(transporter.nodes.get).toHaveBeenCalledTimes(1);
			expect(transporter.nodes.get).toHaveBeenCalledWith("node-2");

			expect(transporter.addOfflineNode).toHaveBeenCalledTimes(0);
		});
	});

	describe("Test sendGossipToRandomEndpoint", () => {
		const endpoints = [{ id: "node-1" }, { id: "node-2" }, { id: "node-3" }, { id: "node-4" }];

		const data = {
			a: 5
		};

		it("should not publish if no endpoint", () => {
			transporter.publish = mock.fn(() => Promise.resolve());

			transporter.sendGossipToRandomEndpoint(data, []);

			expect(transporter.publish).toHaveBeenCalledTimes(0);
		});

		it("should select a random endpoint and publish", () => {
			Math.random = mock.fn(() => 0.6);
			transporter.publish = mock.fn(() => Promise.resolve());

			transporter.sendGossipToRandomEndpoint(data, endpoints);

			expect(transporter.publish).toHaveBeenCalledTimes(1);
			expect(transporter.publish).toHaveBeenCalledWith({
				type: "GOSSIP_REQ",
				target: "node-3",
				payload: {
					a: 5
				}
			});
		});
	});

	describe("Test sendGossipRequest", () => {
		beforeEach(() => {
			Math.random = mock.fn(() => 0);
			transporter.sendGossipToRandomEndpoint = mock.fn();
		});

		it("should send nothing, if no other nodes", () => {
			transporter.nodes.toArray = mock.fn(() => [{ id: "node-1", local: true }]);

			transporter.sendGossipRequest();

			expect(transporter.sendGossipToRandomEndpoint).toHaveBeenCalledTimes(0);
		});

		it("should send info to online node", () => {
			const nodes = [
				{ id: "node-1", local: true, available: true, seq: 5, cpu: 12, cpuSeq: 2 },
				{ id: "node-2", local: false, available: true, seq: 3 }
			];
			transporter.nodes.toArray = mock.fn(() => nodes);

			transporter.sendGossipRequest();

			expect(transporter.sendGossipToRandomEndpoint).toHaveBeenCalledTimes(1);
			expect(transporter.sendGossipToRandomEndpoint).toHaveBeenCalledWith(
				{
					online: {
						"node-1": [5, 2, 12],
						"node-2": [3, 0, 0]
					}
				},
				[nodes[1]]
			);
		});

		it("should send info to offline node", () => {
			const nodes = [
				{ id: "node-1", local: true, available: true, seq: 5, cpu: 12, cpuSeq: 2 },
				{ id: "node-2", local: false, available: false, seq: 4 }
			];
			transporter.nodes.toArray = mock.fn(() => nodes);

			transporter.sendGossipRequest();

			expect(transporter.sendGossipToRandomEndpoint).toHaveBeenCalledTimes(1);
			expect(transporter.sendGossipToRandomEndpoint).toHaveBeenCalledWith(
				{
					online: {
						"node-1": [5, 2, 12]
					},
					offline: {
						"node-2": 4
					}
				},
				[nodes[1]]
			);
		});

		it("should send info to online & offline nodes", () => {
			const nodes = [
				{ id: "node-1", local: true, available: true, seq: 10, cpu: 11, cpuSeq: 100 },
				{ id: "node-2", local: false, available: true, seq: 20, cpu: 22, cpuSeq: 200 },
				{ id: "node-3", local: false, available: true, seq: 30, cpu: 33, cpuSeq: 300 },
				{ id: "node-4", local: false, available: false, seq: 40, cpu: 44, cpuSeq: 400 },
				{ id: "node-5", local: false, available: false, seq: 50, cpu: 55, cpuSeq: 500 }
			];
			transporter.nodes.toArray = mock.fn(() => nodes);

			transporter.sendGossipRequest();

			expect(transporter.sendGossipToRandomEndpoint).toHaveBeenCalledTimes(2);
			expect(transporter.sendGossipToRandomEndpoint).toHaveBeenCalledWith(
				{
					online: {
						"node-1": [10, 100, 11],
						"node-2": [20, 200, 22],
						"node-3": [30, 300, 33]
					},
					offline: {
						"node-4": 40,
						"node-5": 50
					}
				},
				[nodes[1], nodes[2]]
			);
			expect(transporter.sendGossipToRandomEndpoint).toHaveBeenCalledWith(
				{
					online: {
						"node-1": [10, 100, 11],
						"node-2": [20, 200, 22],
						"node-3": [30, 300, 33]
					},
					offline: {
						"node-4": 40,
						"node-5": 50
					}
				},
				[nodes[3], nodes[4]]
			);
		});
	});

	describe("Test processGossipRequest", () => {
		beforeEach(() => {
			Math.random = mock.fn(() => 0);
			transporter.deserialize = mock.fn((type, msg) => msg);
			transporter.publish = mock.fn(() => Promise.resolve());
			transporter.nodes.get = mock.fn(() => ({ id: "node-2" }));
			transporter.nodes.disconnected = mock.fn(() => null);
			transporter.registry.getNodeInfo = mock.fn(id => ({ info: id }));
		});

		it("should update local info and send new node info", () => {
			const nodes = [
				{ id: "node-1", local: true, available: true, seq: 10, cpu: 11, cpuSeq: 100 },
				{ id: "node-2", local: false, available: true, seq: 20, cpu: 22, cpuSeq: 200 },
				{ id: "node-3", local: false, available: true, seq: 30, cpu: 33, cpuSeq: 300 },
				{ id: "node-4", local: false, available: false, seq: 40, cpu: 44, cpuSeq: 400 },
				{ id: "node-5", local: false, available: false, seq: 50, cpu: 55, cpuSeq: 500 },
				{ id: "node-6", local: false, available: false, seq: 60, cpu: 66, cpuSeq: 600 }
			];
			transporter.nodes.toArray = mock.fn(() => nodes);

			transporter.processGossipRequest({
				sender: "node-2",
				payload: {
					online: {
						"node-1": [15, 100, 11], // Local - do nothing
						"node-2": [18, 180, 10], // We got older info, send newer
						"node-5": [48, 500, 55], // We got older info, send it is offline
						"node-6": [66, 606, 6], // We got newer info, but we think it is offline, skip
						"node-7": [70, 700, 77] // We don't know it, skip
					},
					offline: {
						"node-4": 41, // Newer seq
						"node-3": 33, // Newer seq, Gone to offline, we change it to offline
						"node-8": 88 // We don't know it, skip
					}
				}
			});

			expect(transporter.registry.getNodeInfo).toHaveBeenCalledTimes(1);
			expect(transporter.registry.getNodeInfo).toHaveBeenCalledWith("node-2");

			expect(transporter.nodes.disconnected).toHaveBeenCalledTimes(1);
			expect(transporter.nodes.disconnected).toHaveBeenCalledWith("node-3", false);
			expect(nodes[2].seq).toBe(33);

			expect(transporter.publish).toHaveBeenCalledTimes(1);
			expect(transporter.publish).toHaveBeenCalledWith({
				type: "GOSSIP_RES",
				target: "node-2",
				payload: {
					online: {
						"node-2": [{ info: "node-2" }, 200, 22]
					},
					offline: {
						"node-5": 50
					}
				}
			});
		});

		it("should update local info and send new node info and inc our seq", () => {
			const heartbeat = mock.fn();
			const nodes = [
				{ id: "node-1", local: true, available: true, seq: 1, cpu: 11, cpuSeq: 100 },
				{
					id: "node-2",
					local: false,
					available: true,
					seq: 20,
					cpu: 22,
					cpuSeq: 200,
					heartbeat
				},
				{ id: "node-3", local: false, available: true, seq: 30, cpu: 33, cpuSeq: 300 },
				{ id: "node-4", local: false, available: false, seq: 40, cpu: 44, cpuSeq: 400 },
				{ id: "node-5", local: false, available: false, seq: 50, cpu: 55, cpuSeq: 500 },
				{ id: "node-6", local: false, available: false, seq: 60, cpu: 66, cpuSeq: 600 },
				{ id: "node-7", local: false, available: true, seq: 70, cpu: null, cpuSeq: null },
				{ id: "node-8", local: false, available: true, seq: 80, cpu: 88, cpuSeq: 800 }
			];
			transporter.nodes.toArray = mock.fn(() => nodes);
			transporter.nodes.get = mock.fn(() => ({ id: "node-10" }));
			transporter.registry.getNodeInfo = mock.fn(id => ({ info: id }));
			transporter.registry.getLocalNodeInfo = mock.fn(() => ({ info: "node-1" }));

			transporter.processGossipRequest({
				sender: "node-10",
				payload: {
					online: {
						"node-2": [20, 220, 25], // We got newer CPU info, update local
						"node-3": [30, 300, 33], // No changes, skip
						// No node-7, send back with info
						"node-8": [80, 777, 77] // Whet got older CPU info, send back newer
					},
					offline: {
						"node-1": 33, // Local - inc seq & send we are online
						// No "node-4", send back
						// No "node-5", send back
						"node-6": 60 // No changes, skip
					}
				}
			});

			// Local Seq Incremented
			expect(nodes[0].seq).toBe(34);

			expect(transporter.registry.getNodeInfo).toHaveBeenCalledTimes(1);
			expect(transporter.registry.getNodeInfo).toHaveBeenCalledWith("node-7");

			expect(transporter.registry.getLocalNodeInfo).toHaveBeenCalledTimes(1);
			expect(transporter.registry.getLocalNodeInfo).toHaveBeenCalledWith(true);

			// Update 'node-2'
			expect(heartbeat).toHaveBeenCalledTimes(1);
			expect(heartbeat).toHaveBeenCalledWith({ cpu: 25, cpuSeq: 220 });

			expect(transporter.nodes.disconnected).toHaveBeenCalledTimes(0);

			expect(transporter.publish).toHaveBeenCalledTimes(1);
			expect(transporter.publish).toHaveBeenCalledWith({
				type: "GOSSIP_RES",
				target: "node-10",
				payload: {
					online: {
						"node-1": [{ info: "node-1" }, 100, 11],
						"node-7": [{ info: "node-7" }, 0, 0],
						"node-8": [800, 88]
					},
					offline: {
						"node-4": 40,
						"node-5": 50
					}
				}
			});
		});
	});

	describe("Test processGossipResponse", () => {
		beforeEach(() => {
			Math.random = mock.fn(() => 0);
			transporter.deserialize = mock.fn((type, msg) => msg);
			transporter.nodes.disconnected = mock.fn();
			transporter.nodes.processNodeInfo = mock.fn();
		});

		it("should update local info and send new node info", () => {
			const heartbeat = mock.fn();
			const nodes = [
				// Online nodes
				{ id: "node-1", local: true, available: true, seq: 10, cpu: 11, cpuSeq: 100 },
				{ id: "node-2", local: false, available: true, seq: 20, cpu: 22, cpuSeq: 200 },
				{ id: "node-3", local: false, available: true, seq: 30, cpu: 33, cpuSeq: 300 },
				{ id: "node-4", local: false, available: true, seq: 40, cpu: 44, cpuSeq: 400 },
				{
					id: "node-5",
					local: false,
					available: true,
					seq: 50,
					cpu: 55,
					cpuSeq: 500,
					heartbeat
				},
				//{ id: "node-6", local: false, available: true, seq: 60, cpu: 66, cpuSeq: 600 },

				// Offline nodes
				{ id: "node-7", local: false, available: false, seq: 70, cpu: 77, cpuSeq: 700 },
				{ id: "node-8", local: false, available: false, seq: 80, cpu: 88, cpuSeq: 800 },
				{ id: "node-9", local: false, available: false, seq: 90, cpu: 99, cpuSeq: 900 },
				{ id: "node-10", local: false, available: true, seq: 100, cpu: 100, cpuSeq: 1000 }
			];
			transporter.nodes.toArray = mock.fn(() => nodes);
			transporter.nodes.get = mock.fn(id => nodes.find(n => n.id == id));

			transporter.processGossipResponse({
				sender: "node-2",
				payload: {
					online: {
						"node-1": [{ seq: 15 }, 100, 11], // Local - skip
						"node-2": [{ seq: 18 }, 180, 10], // We got older info, skip
						"node-5": [550, 5], // We got only new CPU info, update
						"node-6": [{ seq: 66 }, 660, 6], // We got newer info from unknow node, update
						"node-7": [{ seq: 77 }] // We got only new info from offline node, update
					},
					offline: {
						"node-8": 88, // We got newer seq, update
						"node-9": 33, // We got older seq, skip
						"node-10": 101, // We got newer seq from online node, disconnect and save seq
						"node-11": 110 // Unknow node, skip
					}
				}
			});

			// Update 'node-5' cpu
			expect(heartbeat).toHaveBeenCalledTimes(1);
			expect(heartbeat).toHaveBeenCalledWith({ cpu: 5, cpuSeq: 550 });

			// Update 'node-6' & 'node-7'
			expect(transporter.nodes.processNodeInfo).toHaveBeenCalledTimes(2);
			expect(transporter.nodes.processNodeInfo).toHaveBeenCalledWith({
				sender: "node-6",
				seq: 66
			});
			expect(transporter.nodes.processNodeInfo).toHaveBeenCalledWith({
				sender: "node-7",
				seq: 77
			});

			// Update 'node-8' seq
			expect(nodes[6].seq).toBe(88);

			// Disconnect 'node-10'
			expect(transporter.nodes.disconnected).toHaveBeenCalledTimes(1);
			expect(transporter.nodes.disconnected).toHaveBeenCalledWith("node-10", false);
			expect(nodes[8].seq).toBe(101);
		});
	});
});
