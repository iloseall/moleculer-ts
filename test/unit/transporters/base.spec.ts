import { describe, it, afterEach, mock } from "../../helpers/test";
import expect from "../../helpers/expect";

import ServiceBroker from "../../../src/service-broker";
import Transit from "../../../src/transit";
import { BrokerDisconnectedError } from "../../../src/errors";
import * as P from "../../../src/packets";
import BaseTransporter from "../../../src/transporters/base";
import { protectReject } from "../../helpers/utils";

describe("Test BaseTransporter", () => {
	it("check constructor", () => {
		const transporter = new BaseTransporter();
		expect(transporter).toBeDefined();
		expect(transporter.opts).toBeUndefined();
		expect(transporter.connected).toBe(false);
		expect(transporter.hasBuiltInBalancer).toBe(false);

		expect(transporter.init).toBeDefined();
		expect(transporter.connect).toBeDefined();
		expect(transporter.onConnected).toBeDefined();
		expect(transporter.disconnect).toBeDefined();
		expect(transporter.subscribe).toBeDefined();
		expect(transporter.subscribeBalancedRequest).toBeDefined();
		expect(transporter.subscribeBalancedEvent).toBeDefined();
		expect(transporter.unsubscribeFromBalancedCommands).toBeDefined();
		expect(transporter.prepublish).toBeDefined();
		expect(transporter.publish).toBeDefined();
		expect(transporter.publishBalancedEvent).toBeDefined();
		expect(transporter.publishBalancedRequest).toBeDefined();
		expect(transporter.serialize).toBeDefined();
		expect(transporter.deserialize).toBeDefined();
	});

	it("check constructor with options", () => {
		const opts = {};
		const transporter = new BaseTransporter(opts);
		expect(transporter).toBeDefined();
		expect(transporter.opts).toBe(opts);
	});

	it("check init", () => {
		const broker = new ServiceBroker({
			logger: false,
			namespace: "beta-test",
			nodeID: "server1"
		});
		const transporter = new BaseTransporter();
		const transit = new Transit(broker, transporter);
		const handler = mock.fn();
		const handler2 = mock.fn();

		transporter.init(transit, handler, handler2);
		expect(transporter.transit).toBe(transit);
		expect(transporter.broker).toBe(broker);
		expect(transporter.nodeID).toBe("server1");
		expect(transporter.prefix).toBe("MOL-beta-test");
		expect(transporter.logger).toBeDefined();
		expect(transporter.messageHandler).toBe(handler);
		expect(transporter.afterConnect).toBe(handler2);
	});

	it("check onConnected", () => {
		const transporter = new BaseTransporter();
		const afterConnect = mock.fn();

		expect(transporter.connected).toBe(false);

		transporter.init(null, null, afterConnect);

		transporter.onConnected();
		expect(transporter.connected).toBe(true);
		expect(afterConnect).toHaveBeenCalledTimes(1);

		afterConnect.mockClear();
		transporter.onConnected(true);
		expect(afterConnect).toHaveBeenCalledTimes(1);
		expect(afterConnect).toHaveBeenCalledWith(true);
	});

	it("check incomingMessage", () => {
		const transporter = new BaseTransporter();
		const p = {};
		transporter.deserialize = mock.fn(() => p);
		transporter.messageHandler = mock.fn();

		transporter.incomingMessage("MOL.DISCOVER", "msg");

		expect(transporter.deserialize).toHaveBeenCalledTimes(1);
		expect(transporter.deserialize).toHaveBeenCalledWith("MOL.DISCOVER", "msg");

		expect(transporter.messageHandler).toHaveBeenCalledTimes(1);
		expect(transporter.messageHandler).toHaveBeenCalledWith("MOL.DISCOVER", p);
	});

	it("check getTopicName", () => {
		const broker = new ServiceBroker({
			logger: false,
			namespace: "beta-test",
			nodeID: "server1"
		});
		const transporter = new BaseTransporter();
		new Transit(broker, transporter);

		expect(transporter.getTopicName("REQ")).toBe("MOL-beta-test.REQ");
		expect(transporter.getTopicName("REQ", "server-2")).toBe("MOL-beta-test.REQ.server-2");
	});

	it("should call subscribe with all topics", () => {
		const broker = new ServiceBroker({
			logger: false,
			namespace: "beta-test",
			nodeID: "server1"
		});
		const transporter = new BaseTransporter();
		new Transit(broker, transporter);
		transporter.subscribe = mock.fn(() => Promise.resolve());

		return transporter
			.makeSubscriptions([
				{ cmd: P.PACKET_DISCOVER },
				{ cmd: P.PACKET_DISCOVER, nodeID: "node1" }
			])
			.catch(protectReject)
			.then(() => {
				expect(transporter.subscribe).toHaveBeenCalledTimes(2);
				expect(transporter.subscribe).toHaveBeenCalledWith("DISCOVER", undefined);
				expect(transporter.subscribe).toHaveBeenCalledWith("DISCOVER", "node1");
			});
	});

	it("check makeBalancedSubscriptions if hasBuiltInBalancer = FALSE", () => {
		const broker = new ServiceBroker({
			logger: false,
			namespace: "beta-test",
			nodeID: "server1"
		});
		const transporter = new BaseTransporter();
		new Transit(broker, transporter);
		transporter.hasBuiltInBalancer = false;

		transporter.unsubscribeFromBalancedCommands = mock.fn(() => Promise.resolve());
		broker.getLocalNodeInfo = mock.fn(() => ({
			services: [
				{
					actions: {
						"posts.find": {},
						"posts.get": {}
					}
				},
				{
					name: "users",
					events: {
						"user.created": {},
						"user.updated": {}
					}
				},
				{
					// Empty
				}
			]
		}));

		transporter.subscribeBalancedEvent = mock.fn();
		transporter.subscribeBalancedRequest = mock.fn();

		return transporter
			.makeBalancedSubscriptions()
			.catch(protectReject)
			.then(() => {
				expect(transporter.unsubscribeFromBalancedCommands).toHaveBeenCalledTimes(0);
				expect(broker.getLocalNodeInfo).toHaveBeenCalledTimes(0);
				expect(transporter.subscribeBalancedRequest).toHaveBeenCalledTimes(0);
				expect(transporter.subscribeBalancedEvent).toHaveBeenCalledTimes(0);
			});
	});

	it("check makeBalancedSubscriptions if hasBuiltInBalancer = TRUE", () => {
		const broker = new ServiceBroker({
			logger: false,
			namespace: "beta-test",
			nodeID: "server1"
		});
		const transporter = new BaseTransporter();
		new Transit(broker, transporter);
		transporter.hasBuiltInBalancer = true;

		transporter.unsubscribeFromBalancedCommands = mock.fn(() => Promise.resolve());
		broker.getLocalNodeInfo = mock.fn(() => ({
			services: [
				{
					actions: {
						"posts.find": {},
						"posts.get": {}
					}
				},
				{
					name: "users",
					events: {
						"user.created": {},
						"user.updated": {}
					}
				},
				{
					// Empty
				}
			]
		}));

		transporter.subscribeBalancedEvent = mock.fn();
		transporter.subscribeBalancedRequest = mock.fn();

		return transporter
			.makeBalancedSubscriptions()
			.catch(protectReject)
			.then(() => {
				expect(transporter.unsubscribeFromBalancedCommands).toHaveBeenCalledTimes(1);

				expect(broker.getLocalNodeInfo).toHaveBeenCalledTimes(1);

				expect(transporter.subscribeBalancedRequest).toHaveBeenCalledTimes(2);
				expect(transporter.subscribeBalancedRequest).toHaveBeenCalledWith("posts.find");
				expect(transporter.subscribeBalancedRequest).toHaveBeenCalledWith("posts.get");

				expect(transporter.subscribeBalancedEvent).toHaveBeenCalledTimes(2);
				expect(transporter.subscribeBalancedEvent).toHaveBeenCalledWith(
					"user.created",
					"users"
				);
				expect(transporter.subscribeBalancedEvent).toHaveBeenCalledWith(
					"user.updated",
					"users"
				);
			});
	});

	describe("Test prepublish", () => {
		describe("Connected state", () => {
			const broker = new ServiceBroker({
				logger: false,
				namespace: "beta-test",
				nodeID: "server1"
			});
			const transporter = new BaseTransporter();
			transporter.connected = true;
			new Transit(broker, transporter);

			transporter.publish = mock.fn(() => Promise.resolve());
			transporter.publishBalancedEvent = mock.fn(() => Promise.resolve());
			transporter.publishBalancedRequest = mock.fn(() => Promise.resolve());

			afterEach(() => {
				transporter.publish.mockClear();
				transporter.publishBalancedEvent.mockClear();
				transporter.publishBalancedRequest.mockClear();
			});

			it("check with PACKET_EVENT with target without groups", () => {
				const packet = new P.Packet(P.PACKET_EVENT, "server-2", { event: "user.created" });
				return transporter
					.prepublish(packet)
					.catch(protectReject)
					.then(() => {
						expect(transporter.publish).toHaveBeenCalledTimes(1);
						expect(transporter.publishBalancedEvent).toHaveBeenCalledTimes(0);
						expect(transporter.publishBalancedRequest).toHaveBeenCalledTimes(0);
					});
			});

			it("check with PACKET_EVENT with target with groups", () => {
				const packet = new P.Packet(P.PACKET_EVENT, "server-2", {
					event: "user.created",
					data: null,
					groups: ["users", "payments"]
				});
				return transporter
					.prepublish(packet)
					.catch(protectReject)
					.then(() => {
						expect(transporter.publish).toHaveBeenCalledTimes(1);
						expect(transporter.publishBalancedEvent).toHaveBeenCalledTimes(0);
						expect(transporter.publishBalancedRequest).toHaveBeenCalledTimes(0);
					});
			});

			it("check with PACKET_EVENT without target", () => {
				const packet = new P.Packet(P.PACKET_EVENT, null, { event: "user.created" });
				return transporter
					.prepublish(packet)
					.catch(protectReject)
					.then(() => {
						expect(transporter.publish).toHaveBeenCalledTimes(1);
						expect(transporter.publishBalancedEvent).toHaveBeenCalledTimes(0);
						expect(transporter.publishBalancedRequest).toHaveBeenCalledTimes(0);
					});
			});

			it("check with PACKET_EVENT with target with groups", () => {
				const packet = new P.Packet(P.PACKET_EVENT, null, {
					event: "user.created",
					data: null,
					groups: ["users", "payments"]
				});
				return transporter
					.prepublish(packet)
					.catch(protectReject)
					.then(() => {
						expect(transporter.publish).toHaveBeenCalledTimes(0);
						expect(transporter.publishBalancedEvent).toHaveBeenCalledTimes(2);
						expect(transporter.publishBalancedRequest).toHaveBeenCalledTimes(0);
					});
			});

			it("check with PACKET_REQ without target", () => {
				const packet = new P.Packet(P.PACKET_REQUEST, null);
				return transporter
					.prepublish(packet)
					.catch(protectReject)
					.then(() => {
						expect(transporter.publish).toHaveBeenCalledTimes(0);
						expect(transporter.publishBalancedEvent).toHaveBeenCalledTimes(0);
						expect(transporter.publishBalancedRequest).toHaveBeenCalledTimes(1);
					});
			});

			it("check with PACKET_REQ with target", () => {
				const packet = new P.Packet(P.PACKET_REQUEST, "server-2");
				return transporter
					.prepublish(packet)
					.catch(protectReject)
					.then(() => {
						expect(transporter.publish).toHaveBeenCalledTimes(1);
						expect(transporter.publishBalancedEvent).toHaveBeenCalledTimes(0);
						expect(transporter.publishBalancedRequest).toHaveBeenCalledTimes(0);
					});
			});

			it("check with PACKET_PING", () => {
				const packet = new P.Packet(P.PACKET_PING, null);
				return transporter
					.prepublish(packet)
					.catch(protectReject)
					.then(() => {
						expect(transporter.publish).toHaveBeenCalledTimes(1);
						expect(transporter.publishBalancedEvent).toHaveBeenCalledTimes(0);
						expect(transporter.publishBalancedRequest).toHaveBeenCalledTimes(0);
					});
			});

			it("check with PACKET_RESPONSE", () => {
				const packet = new P.Packet(P.PACKET_RESPONSE, "server-2");
				return transporter
					.prepublish(packet)
					.catch(protectReject)
					.then(() => {
						expect(transporter.publish).toHaveBeenCalledTimes(1);
						expect(transporter.publishBalancedEvent).toHaveBeenCalledTimes(0);
						expect(transporter.publishBalancedRequest).toHaveBeenCalledTimes(0);
					});
			});

			it("check with PACKET_DISCOVER", () => {
				const packet = new P.Packet(P.PACKET_DISCOVER, null);
				return transporter
					.prepublish(packet)
					.catch(protectReject)
					.then(() => {
						expect(transporter.publish).toHaveBeenCalledTimes(1);
						expect(transporter.publishBalancedEvent).toHaveBeenCalledTimes(0);
						expect(transporter.publishBalancedRequest).toHaveBeenCalledTimes(0);
					});
			});

			it("check with PACKET_INFO", () => {
				const packet = new P.Packet(P.PACKET_INFO, "server-2");
				return transporter
					.prepublish(packet)
					.catch(protectReject)
					.then(() => {
						expect(transporter.publish).toHaveBeenCalledTimes(1);
						expect(transporter.publishBalancedEvent).toHaveBeenCalledTimes(0);
						expect(transporter.publishBalancedRequest).toHaveBeenCalledTimes(0);
					});
			});

			it("check with PACKET_DISCONNECT", () => {
				transporter.publish.mockClear();
				transporter.publishBalancedRequest.mockClear();

				const packet = new P.Packet(P.PACKET_DISCONNECT, null);
				return transporter
					.prepublish(packet)
					.catch(protectReject)
					.then(() => {
						expect(transporter.publish).toHaveBeenCalledTimes(1);
						expect(transporter.publishBalancedEvent).toHaveBeenCalledTimes(0);
						expect(transporter.publishBalancedRequest).toHaveBeenCalledTimes(0);
					});
			});

			it("check with PACKET_HEARTBEAT", () => {
				transporter.publish.mockClear();
				transporter.publishBalancedRequest.mockClear();

				const packet = new P.Packet(P.PACKET_HEARTBEAT, null);
				return transporter
					.prepublish(packet)
					.catch(protectReject)
					.then(() => {
						expect(transporter.publish).toHaveBeenCalledTimes(1);
						expect(transporter.publishBalancedEvent).toHaveBeenCalledTimes(0);
						expect(transporter.publishBalancedRequest).toHaveBeenCalledTimes(0);
					});
			});

			it("check with PACKET_PONG", () => {
				transporter.publish.mockClear();
				transporter.publishBalancedRequest.mockClear();

				const packet = new P.Packet(P.PACKET_PONG, null);
				return transporter
					.prepublish(packet)
					.catch(protectReject)
					.then(() => {
						expect(transporter.publish).toHaveBeenCalledTimes(1);
						expect(transporter.publishBalancedEvent).toHaveBeenCalledTimes(0);
						expect(transporter.publishBalancedRequest).toHaveBeenCalledTimes(0);
					});
			});
		});

		describe("Disconnected state", () => {
			const broker = new ServiceBroker({
				logger: false,
				namespace: "beta-test",
				nodeID: "server1"
			});
			const transporter = new BaseTransporter();
			transporter.connected = false;
			new Transit(broker, transporter);

			transporter.publish = mock.fn(() => Promise.resolve());
			transporter.publishBalancedEvent = mock.fn(() => Promise.resolve());
			transporter.publishBalancedRequest = mock.fn(() => Promise.resolve());

			afterEach(() => {
				transporter.publish.mockClear();
				transporter.publishBalancedEvent.mockClear();
				transporter.publishBalancedRequest.mockClear();
			});

			const expectBrokerDisconnectedError = err => {
				expect(err).toBeInstanceOf(BrokerDisconnectedError);
			};

			const expectNoPublishes = () => {
				expect(transporter.publish).toHaveBeenCalledTimes(0);
				expect(transporter.publishBalancedEvent).toHaveBeenCalledTimes(0);
				expect(transporter.publishBalancedRequest).toHaveBeenCalledTimes(0);
			};

			// Used as a .catch callback when there should be no error
			const expectNoError = () => {
				expect(true).toBe(false);
			};

			it("check with PACKET_EVENT with target without groups", () => {
				const packet = new P.Packet(P.PACKET_EVENT, "server-2", { event: "user.created" });
				return transporter
					.prepublish(packet)
					.catch(expectBrokerDisconnectedError)
					.then(expectNoPublishes);
			});

			it("check with PACKET_EVENT with target with groups", () => {
				const packet = new P.Packet(P.PACKET_EVENT, "server-2", {
					event: "user.created",
					data: null,
					groups: ["users", "payments"]
				});
				return transporter
					.prepublish(packet)
					.catch(expectBrokerDisconnectedError)
					.then(expectNoPublishes);
			});

			it("check with PACKET_EVENT without target", () => {
				const packet = new P.Packet(P.PACKET_EVENT, null, "user.created");
				return transporter
					.prepublish(packet)
					.catch(expectBrokerDisconnectedError)
					.then(expectNoPublishes);
			});

			it("check with PACKET_EVENT with target with groups", () => {
				const packet = new P.Packet(P.PACKET_EVENT, null, {
					event: "user.created",
					data: null,
					groups: ["users", "payments"]
				});
				return transporter
					.prepublish(packet)
					.catch(expectBrokerDisconnectedError)
					.then(expectNoPublishes);
			});

			it("check with PACKET_REQ without target", () => {
				const packet = new P.Packet(P.PACKET_REQUEST, null);
				return transporter
					.prepublish(packet)
					.catch(expectBrokerDisconnectedError)
					.then(expectNoPublishes);
			});

			it("check with PACKET_REQ with target", () => {
				const packet = new P.Packet(P.PACKET_REQUEST, "server-2");
				return transporter
					.prepublish(packet)
					.catch(expectBrokerDisconnectedError)
					.then(expectNoPublishes);
			});

			it("check with PACKET_PING", () => {
				const packet = new P.Packet(P.PACKET_PING, null);
				return transporter
					.prepublish(packet)
					.catch(expectBrokerDisconnectedError)
					.then(expectNoPublishes);
			});

			it("check with PACKET_RESPONSE", () => {
				const packet = new P.Packet(P.PACKET_RESPONSE, "server-2");
				return transporter.prepublish(packet).catch(expectNoError).then(expectNoPublishes);
			});

			it("check with PACKET_DISCOVER", () => {
				const packet = new P.Packet(P.PACKET_DISCOVER, null);
				return transporter.prepublish(packet).catch(expectNoError).then(expectNoPublishes);
			});

			it("check with PACKET_INFO", () => {
				const packet = new P.Packet(P.PACKET_INFO, "server-2");
				return transporter.prepublish(packet).catch(expectNoError).then(expectNoPublishes);
			});

			it("check with PACKET_DISCONNECT", () => {
				const packet = new P.Packet(P.PACKET_DISCONNECT, null);
				return transporter.prepublish(packet).catch(expectNoError).then(expectNoPublishes);
			});

			it("check with PACKET_HEARTBEAT", () => {
				const packet = new P.Packet(P.PACKET_HEARTBEAT, null);
				return transporter.prepublish(packet).catch(expectNoError).then(expectNoPublishes);
			});

			it("check with PACKET_PONG", () => {
				const packet = new P.Packet(P.PACKET_PONG, null);
				return transporter.prepublish(packet).catch(expectNoError).then(expectNoPublishes);
			});
		});
	});

	describe("Test serialize", () => {
		const broker = new ServiceBroker({
			logger: false,
			namespace: "beta-test",
			nodeID: "server1"
		});
		const transporter = new BaseTransporter();
		new Transit(broker, transporter);

		broker.serializer.serialize = mock.fn(() => "serialized");

		it("should set ver & sender in payload", () => {
			const packet = new P.Packet(P.PACKET_EVENT);
			expect(transporter.serialize(packet)).toBe("serialized");
			expect(broker.serializer.serialize).toHaveBeenCalledTimes(1);
			expect(broker.serializer.serialize).toHaveBeenCalledWith(
				{ sender: "server1", ver: "5" },
				P.PACKET_EVENT
			);
		});
	});

	describe("Test deserialize", () => {
		const broker = new ServiceBroker({
			logger: false,
			namespace: "beta-test",
			nodeID: "server1"
		});
		const transporter = new BaseTransporter();
		new Transit(broker, transporter);

		broker.serializer.deserialize = mock.fn(() => ({
			type: P.PACKET_INFO,
			msg: "deserialized"
		}));

		it("should call deserialize", () => {
			const msg = "incoming data";
			const packet = transporter.deserialize(P.PACKET_INFO, msg);
			expect(packet).toBeDefined();
			expect(packet.type).toBe("INFO");
			expect(packet.payload).toEqual({ msg: "deserialized", type: "INFO" });
			expect(broker.serializer.deserialize).toHaveBeenCalledTimes(1);
			expect(broker.serializer.deserialize).toHaveBeenCalledWith(
				"incoming data",
				P.PACKET_INFO
			);
		});
	});
});
