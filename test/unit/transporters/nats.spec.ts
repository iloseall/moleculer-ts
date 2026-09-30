import { describe, it, before, beforeEach, mock } from "../../helpers/test";
import expect from "../../helpers/expect";
import { autoMock, factoryMock, interopDefault } from "../../helpers/module-mock";

autoMock(require.resolve("nats"));
autoMock(require.resolve("nats/package.json"));

const ServiceBroker = interopDefault(require("../../../src/service-broker"));
const Transit = interopDefault(require("../../../src/transit"));
const P = require("../../../src/packets");
const C = require("../../../src/constants");
const { protectReject } = require("../../helpers/utils");
const natsPackage = interopDefault(require("nats/package.json"));
const Nats = interopDefault(require("nats"));
const NatsTransporter = interopDefault(require("../../../src/transporters/nats"));

// for Node 10 compatibility
global.globalThis = global;

// const lolex = require("@sinonjs/fake-timers");

describe("Tests Nats", () => {
	before(() => {
		Nats.connect = mock.fn(() => {
			return Promise.resolve({
				status: mock.fn(() =>
					[Promise.resolve({ type: "Mock Type", data: "Mock Data" })].values()
				),
				closed: mock.fn(() => Promise.resolve()),
				close: mock.fn(() => Promise.resolve()),
				flush: mock.fn(() => Promise.resolve()),
				subscribe: mock.fn(),
				publish: mock.fn()
			});
		});
	});

	describe("Test NatsTransporter constructor", () => {
		it("check constructor", () => {
			const transporter = new NatsTransporter();
			expect(transporter).toBeDefined();
			expect(transporter.opts).toEqual({ preserveBuffers: true, maxReconnectAttempts: -1 });
			expect(transporter.connected).toBe(false);
			expect(transporter.hasBuiltInBalancer).toBe(true);
			expect(transporter.client).toBeNull();
		});

		it("check constructor with string param", () => {
			const transporter = new NatsTransporter("nats://localhost");
			expect(transporter.opts).toEqual({
				preserveBuffers: true,
				maxReconnectAttempts: -1,
				url: "nats://localhost"
			});
		});

		it("check constructor with string param of multiple servers", () => {
			const transporter = new NatsTransporter(
				"nats://server1:4222,nats://server2:4222,nats://server3:4222"
			);
			expect(transporter.opts).toEqual({
				preserveBuffers: true,
				maxReconnectAttempts: -1,
				url: "nats://server1:4222,nats://server2:4222,nats://server3:4222"
			});
		});

		it("check constructor with options", () => {
			const opts = { host: "localhost", port: 1234 };
			const transporter = new NatsTransporter(opts);
			expect(transporter.opts).toEqual({
				host: "localhost",
				port: 1234,
				preserveBuffers: true,
				maxReconnectAttempts: -1
			});
		});

		it("check constructor with disabled preserveBuffers & maxReconnectAttempts", () => {
			const opts = { preserveBuffers: false, maxReconnectAttempts: 3 };
			const transporter = new NatsTransporter(opts);
			expect(transporter.opts).toEqual({ preserveBuffers: false, maxReconnectAttempts: 3 });
		});
	});

	describe("Test NatsTransporter connect & disconnect & reconnect", () => {
		const broker = new ServiceBroker({ logger: false });
		const transit = new Transit(broker);
		const msgHandler = mock.fn();
		let transporter;

		beforeEach(() => {
			transporter = new NatsTransporter(
				"nats://myuser:mypass@server1:4222,nats://server2:4222,nats://server3:4222"
			);
			transporter.init(transit, msgHandler);
		});

		it("check connect options servers", () => {
			const p = transporter
				.connect()
				.catch(protectReject)
				.then(() => {
					expect(transporter.client).toBeDefined();
					expect(transporter.client.status).toHaveBeenCalledTimes(1);
					expect(transporter.client.closed).toHaveBeenCalledTimes(1);
					expect(Nats.connect).toHaveBeenLastCalledWith({
						preserveBuffers: true,
						maxReconnectAttempts: -1,
						url: "nats://myuser:mypass@server1:4222,nats://server2:4222,nats://server3:4222",
						servers: ["server1:4222", "server2:4222", "server3:4222"],
						user: "myuser",
						pass: "mypass"
					});
				});

			return p;
		});

		it("check connect", () => {
			const p = transporter
				.connect()
				.catch(protectReject)
				.then(() => {
					expect(transporter.client).toBeDefined();
					expect(transporter.client.status).toHaveBeenCalledTimes(1);
					expect(transporter.client.closed).toHaveBeenCalledTimes(1);
				});

			return p;
		});

		it("check onConnected after connect", () => {
			transporter.onConnected = mock.fn(() => Promise.resolve());
			const p = transporter
				.connect()
				.catch(protectReject)
				.then(() => {
					expect(transporter.onConnected).toHaveBeenCalledTimes(1);
					expect(transporter.onConnected).toHaveBeenCalledWith();
				});

			// transporter._client.onCallbacks.connect(); // Trigger the `resolve`

			return p;
		});

		// it("check onConnected after reconnect", () => {
		// 	transporter.onConnected = mock.fn(() => Promise.resolve());

		// 	let p = transporter.connect().catch(protectReject).then(() => {
		// 		transporter.onConnected.mockClear();
		// 		transporter._client.onCallbacks.reconnect(); // Trigger the `resolve`
		// 		expect(transporter.onConnected).toHaveBeenCalledTimes(1);
		// 		expect(transporter.onConnected).toHaveBeenCalledWith(true);
		// 	});

		// 	transporter._client.onCallbacks.connect(); // Trigger the `resolve`

		// 	return p;
		// });

		it("check disconnect", () => {
			const p = transporter
				.connect()
				.catch(protectReject)
				.then(() => {
					const client = transporter.client;

					transporter
						.disconnect()
						.catch(protectReject)
						.then(() => {
							expect(client.flush).toHaveBeenCalledTimes(1);
							expect(client.close).toHaveBeenCalledTimes(1);
							expect(transporter.client).toBeNull();
						});
				});

			return p;
		});
	});

	describe("Test NatsTransporter subscribe & publish", () => {
		let transporter;

		beforeEach(() => {
			transporter = new NatsTransporter();
			transporter.init(
				new Transit(
					new ServiceBroker({ logger: false, namespace: "TEST", nodeID: "node-123" })
				)
			);

			const p = transporter.connect();
			// transporter._client.onCallbacks.connect(); // Trigger the `resolve`
			return p;
		});

		it("check subscribe", () => {
			let subCb;
			transporter.client.subscribe = mock.fn((name, { callback: cb }) => (subCb = cb));
			transporter.incomingMessage = mock.fn();

			transporter.subscribe("REQ", "node");

			expect(transporter.client.subscribe).toHaveBeenCalledTimes(1);
			expect(transporter.client.subscribe).toHaveBeenCalledWith("MOL-TEST.REQ.node", {
				callback: expect.any(Function)
			});

			// Test subscribe callback
			subCb(null, { data: '{ sender: "node1" }' });
			expect(transporter.incomingMessage).toHaveBeenCalledTimes(1);
			expect(transporter.incomingMessage).toHaveBeenCalledWith(
				"REQ",
				Buffer.from('{ sender: "node1" }')
			);
		});

		it("check subscribeBalancedRequest", () => {
			let subCb;
			transporter.client.subscribe = mock.fn((name, { opts, callback: cb }) => {
				subCb = cb;
				return 123;
			});
			transporter.incomingMessage = mock.fn();

			transporter.subscribeBalancedRequest("posts.find");

			expect(transporter.client.subscribe).toHaveBeenCalledTimes(1);
			expect(transporter.client.subscribe).toHaveBeenCalledWith("MOL-TEST.REQB.posts.find", {
				queue: "posts.find",
				callback: expect.any(Function)
			});

			// Test subscribe callback
			subCb(null, { data: '{ sender: "node1" }' });
			expect(transporter.incomingMessage).toHaveBeenCalledTimes(1);
			expect(transporter.incomingMessage).toHaveBeenCalledWith(
				"REQ",
				Buffer.from('{ sender: "node1" }')
			);
			expect(transporter.subscriptions).toEqual([123]);
		});

		describe("Test subscribeBalancedEvent", () => {
			it("check subscription & unsubscription", () => {
				let subCb;
				const subscriptionInstance = { unsubscribe: mock.fn() };
				transporter.client.subscribe = mock.fn((name, { opts, callback: cb }) => {
					subCb = cb;
					return subscriptionInstance;
				});
				transporter.incomingMessage = mock.fn();

				transporter.subscribeBalancedEvent("user.created", "mail");

				expect(transporter.client.subscribe).toHaveBeenCalledTimes(1);
				expect(transporter.client.subscribe).toHaveBeenCalledWith(
					"MOL-TEST.EVENTB.mail.user.created",
					{ queue: "mail", callback: expect.any(Function) }
				);

				// Test subscribe callback
				subCb(null, { data: '{ sender: "node1" }' });
				expect(transporter.incomingMessage).toHaveBeenCalledTimes(1);
				expect(transporter.incomingMessage).toHaveBeenCalledWith(
					"EVENT",
					Buffer.from('{ sender: "node1" }')
				);
				expect(transporter.subscriptions).toEqual([subscriptionInstance]);

				return transporter
					.unsubscribeFromBalancedCommands()
					.catch(protectReject)
					.then(() => {
						expect(transporter.subscriptions).toEqual([]);
						expect(subscriptionInstance.unsubscribe).toHaveBeenCalledTimes(1);
						expect(transporter.client.flush).toHaveBeenCalledTimes(1);
					});
			});

			it("check with '*' wildchar topic", () => {
				transporter.client.subscribe = mock.fn();

				transporter.subscribeBalancedEvent("user.*", "users");

				expect(transporter.client.subscribe).toHaveBeenCalledTimes(1);
				expect(transporter.client.subscribe).toHaveBeenCalledWith(
					"MOL-TEST.EVENTB.users.user.*",
					{ queue: "users", callback: expect.any(Function) }
				);
			});

			it("check with '**' wildchar topic", () => {
				transporter.client.subscribe = mock.fn();

				transporter.subscribeBalancedEvent("user.**", "users");

				expect(transporter.client.subscribe).toHaveBeenCalledTimes(1);
				expect(transporter.client.subscribe).toHaveBeenCalledWith(
					"MOL-TEST.EVENTB.users.user.>",
					{ queue: "users", callback: expect.any(Function) }
				);
			});

			it("check with '**' wildchar (as not last) topic", () => {
				transporter.client.subscribe = mock.fn();

				transporter.subscribeBalancedEvent("user.**.changed", "users");

				expect(transporter.client.subscribe).toHaveBeenCalledTimes(1);
				expect(transporter.client.subscribe).toHaveBeenCalledWith(
					"MOL-TEST.EVENTB.users.user.>",
					{ queue: "users", callback: expect.any(Function) }
				);
			});
		});

		it("check publish with target", () => {
			transporter.serialize = mock.fn(() => Buffer.from("json data"));
			// transporter.client.publish = mock.fn((topic, payload, resolve) => resolve());
			transporter.client.publish = mock.fn();
			const packet = new P.Packet(P.PACKET_INFO, "node2", {});
			return transporter
				.publish(packet)
				.catch(protectReject)
				.then(() => {
					expect(transporter.client.publish).toHaveBeenCalledTimes(1);
					expect(transporter.client.publish).toHaveBeenCalledWith(
						"MOL-TEST.INFO.node2",
						Buffer.from("json data")
					);

					expect(transporter.serialize).toHaveBeenCalledTimes(1);
					expect(transporter.serialize).toHaveBeenCalledWith(packet);
				});
		});

		it("check publish without target", () => {
			transporter.serialize = mock.fn(() => Buffer.from("json data"));
			// transporter.client.publish = mock.fn((topic, payload, resolve) => resolve());
			transporter.client.publish = mock.fn();
			const packet = new P.Packet(P.PACKET_INFO, null, {});
			return transporter
				.publish(packet)
				.catch(protectReject)
				.then(() => {
					expect(transporter.client.publish).toHaveBeenCalledTimes(1);
					expect(transporter.client.publish).toHaveBeenCalledWith(
						"MOL-TEST.INFO",
						Buffer.from("json data")
					);

					expect(transporter.serialize).toHaveBeenCalledTimes(1);
					expect(transporter.serialize).toHaveBeenCalledWith(packet);
				});
		});

		it("check publishBalancedEvent", () => {
			transporter.serialize = mock.fn(() => Buffer.from("json data"));
			// transporter.client.publish = mock.fn((topic, payload, resolve) => resolve());
			transporter.client.publish = mock.fn();
			const packet = new P.Packet(P.PACKET_EVENT, null, {
				event: "user.created",
				data: { id: 5 },
				groups: ["mail"]
			});
			return transporter
				.publishBalancedEvent(packet, "mail")
				.catch(protectReject)
				.then(() => {
					expect(transporter.client.publish).toHaveBeenCalledTimes(1);
					expect(transporter.client.publish).toHaveBeenCalledWith(
						"MOL-TEST.EVENTB.mail.user.created",
						Buffer.from("json data")
					);
					expect(transporter.serialize).toHaveBeenCalledTimes(1);
					expect(transporter.serialize).toHaveBeenCalledWith(packet);
				});
		});

		it("check publishBalancedRequest", () => {
			transporter.serialize = mock.fn(() => Buffer.from("json data"));
			// transporter.client.publish = mock.fn((topic, payload, resolve) => resolve());
			transporter.client.publish = mock.fn();
			const packet = new P.Packet(P.PACKET_REQUEST, null, {
				action: "posts.find"
			});
			return transporter
				.publishBalancedRequest(packet)
				.catch(protectReject)
				.then(() => {
					expect(transporter.client.publish).toHaveBeenCalledTimes(1);
					expect(transporter.client.publish).toHaveBeenCalledWith(
						"MOL-TEST.REQB.posts.find",
						Buffer.from("json data")
					);

					expect(transporter.serialize).toHaveBeenCalledTimes(1);
					expect(transporter.serialize).toHaveBeenCalledWith(packet);
				});
		});
	});
});
