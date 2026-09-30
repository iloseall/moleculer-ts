import { describe, it, beforeEach, mock } from "../../helpers/test";
import expect from "../../helpers/expect";
import { autoMock, factoryMock, interopDefault } from "../../helpers/module-mock";

autoMock(require.resolve("rhea-promise"));

const ServiceBroker = interopDefault(require("../../../src/service-broker"));
const Transit = interopDefault(require("../../../src/transit"));
const P = require("../../../src/packets");
const { protectReject } = require("../../helpers/utils");
const rhea = interopDefault(require("rhea-promise"));
const Amqp10Transporter = interopDefault(require("../../../src/transporters/amqp10"));

rhea.Container.prototype.createConnection = mock.fn(() => new rhea.Connection());

rhea.Connection.prototype.open = mock.fn(() => Promise.resolve(new rhea.Connection()));
rhea.Connection.prototype._connection = {
	setMaxListeners: mock.fn()
};
rhea.Connection.prototype.createReceiver = mock.fn(() => Promise.resolve(new rhea.Receiver()));
rhea.Connection.prototype.createAwaitableSender = mock.fn(() =>
	Promise.resolve(new rhea.AwaitableSender())
);

rhea.Connection.prototype.createSession = mock.fn(() => Promise.resolve(new rhea.Session()));
rhea.Session.prototype._session = {
	setMaxListeners: mock.fn()
};

rhea.Receiver.prototype.close = mock.fn(() => Promise.resolve());
rhea.AwaitableSender.send = mock.fn(() => Promise.resolve());

describe("Test AmqpTransporter constructor", () => {
	it("check constructor with string param", () => {
		const transporter = new Amqp10Transporter("amqp10://localhost");
		// console.log(new rhea.Container().createConnection().open());
		expect(transporter).toBeDefined();
		expect(transporter.opts).toEqual({
			url: "amqp10://localhost",
			prefetch: 1,
			eventTimeToLive: null,
			heartbeatTimeToLive: null,
			messageOptions: {},
			queueOptions: {},
			connectionOptions: {},
			topicOptions: {},
			topicPrefix: "topic://"
		});
		expect(transporter.connected).toBe(false);
		expect(transporter.hasBuiltInBalancer).toBe(true);
		expect(transporter.connection).toBeNull();
		expect(transporter.receivers).toHaveLength(0);
	});

	it("check constructor with options", () => {
		const opts = {
			url: "amqp10://admin:admin@localhost:5672",
			prefetch: 3,
			eventTimeToLive: 10000,
			heartbeatTimeToLive: 30000,
			messageOptions: { ttl: 1 },
			queueOptions: { source: { dynamic: true } }
		};
		const transporter = new Amqp10Transporter(opts);
		expect(transporter.opts).toEqual(opts);
	});
});

describe("Test AmqpTransporter connect & disconnect", () => {
	const broker = new ServiceBroker({ logger: false });
	const transit = new Transit(broker);
	const msgHandler = mock.fn();
	let transporter;

	beforeEach(() => {
		transporter = new Amqp10Transporter({ url: "amqp10://localhost", prefetch: 3 });
		transporter.init(transit, msgHandler);
	});

	it("check connect", () => {
		return transporter
			.connect()
			.catch(protectReject)
			.then(() => {
				expect(transporter.connection).toBeDefined();
				expect(transporter.connected).toEqual(true);
				// expect(transporter.connection.on).toHaveBeenCalledTimes(4);
				// expect(transporter.connection.on).toHaveBeenCalledWith("error", expect.any(Function));
				// expect(transporter.connection.on).toHaveBeenCalledWith("close", expect.any(Function));
				// expect(transporter.connection.on).toHaveBeenCalledWith("blocked", expect.any(Function));
				// expect(transporter.connection.on).toHaveBeenCalledWith("unblocked", expect.any(Function));
			});
	});

	it("check failed connect", () => {
		rhea.Connection.prototype.open = mock.fn(() => Promise.reject());

		return transporter
			.connect()
			.catch(protectReject)
			.then(() => {
				expect(transporter.connection).toBeNull();
				expect(transporter.connected).toEqual(false);
				rhea.Connection.prototype.open = mock.fn(() =>
					Promise.resolve(new rhea.Connection())
				);
			});
	});

	it("check onConnected after connect", () => {
		transporter.onConnected = mock.fn(() => Promise.resolve());
		return transporter
			.connect()
			.catch(protectReject)
			.then(() => {
				expect(transporter.onConnected).toHaveBeenCalledTimes(1);
				expect(transporter.onConnected).toHaveBeenCalledWith();
			});
	});

	it("check disconnect", () => {
		transporter.receivers = [new rhea.Receiver(), new rhea.Receiver()];
		return transporter
			.connect()
			.catch(protectReject)
			.then(() => {
				const conCloseCb = transporter.connection.close;
				const receivers = transporter.receivers;
				transporter
					.disconnect()
					.catch(protectReject)
					.then(() => {
						expect(transporter.connection).toBeNull();
						expect(transporter.receivers).toHaveLength(0);

						expect(conCloseCb).toHaveBeenCalledTimes(1);

						for (const receiver of receivers) {
							expect(receiver.close).toHaveBeenCalledTimes(1);
						}
					});
			});
	});
});

describe("Test AmqpTransporter message handler", () => {
	let transporter;
	let msgHandler;
	let broker;

	beforeEach(() => {
		broker = new ServiceBroker({
			logger: false,
			namespace: "TEST",
			nodeID: "node",
			internalServices: false
		});
		msgHandler = mock.fn();
		transporter = new Amqp10Transporter({ url: "amqp10://localhost" });
		transporter.init(new Transit(broker), msgHandler);
		transporter.incomingMessage = mock.fn();
		return transporter.connect();
	});

	it("should not call delivery.accept", () => {
		const cb = transporter._consumeCB("REQ", false);

		const msg = {
			message: { body: "msg" },
			delivery: { accept: mock.fn(), reject: mock.fn() }
		};
		cb(msg);

		expect(transporter.incomingMessage).toHaveBeenCalledTimes(1);
		expect(transporter.incomingMessage).toHaveBeenCalledWith("REQ", msg.message.body);

		expect(msg.delivery.accept).toHaveBeenCalledTimes(0);
		expect(msg.delivery.reject).toHaveBeenCalledTimes(0);
	});

	it("should call delivery.accept sync", () => {
		const cb = transporter._consumeCB("REQ", true);

		const msg = {
			message: { body: "msg" },
			delivery: { accept: mock.fn(), reject: mock.fn() }
		};
		cb(msg);

		expect(transporter.incomingMessage).toHaveBeenCalledTimes(1);
		expect(transporter.incomingMessage).toHaveBeenCalledWith("REQ", msg.message.body);
		expect(msg.delivery.accept).toHaveBeenCalledTimes(1);
		expect(msg.delivery.reject).toHaveBeenCalledTimes(0);
	});

	it("should call delivery.accept async", () => {
		transporter.incomingMessage = mock.fn(() => Promise.resolve());

		const cb = transporter._consumeCB("REQ", true);

		const msg = {
			message: { body: "msg" },
			delivery: { accept: mock.fn(), reject: mock.fn() }
		};
		cb(msg).then(() => {
			expect(transporter.incomingMessage).toHaveBeenCalledTimes(1);
			expect(transporter.incomingMessage).toHaveBeenCalledWith("REQ", msg.message.body);
			expect(msg.delivery.accept).toHaveBeenCalledTimes(1);
			expect(msg.delivery.reject).toHaveBeenCalledTimes(0);
		});
	});

	it("should call delivery.reject", () => {
		transporter.incomingMessage = mock.fn(() => Promise.reject());

		const cb = transporter._consumeCB("REQ", true);

		const msg = {
			message: { body: "msg" },
			delivery: { accept: mock.fn(), reject: mock.fn() }
		};

		return cb(msg)
			.catch(protectReject)
			.then(() => {
				expect(transporter.incomingMessage).toHaveBeenCalledTimes(1);
				expect(msg.delivery.reject).toHaveBeenCalledTimes(1);
				expect(msg.delivery.accept).toHaveBeenCalledTimes(0);
			});
	});
});

describe("Test AmqpTransporter subscribe", () => {
	let transporter;
	let msgHandler;
	let broker;

	beforeEach(() => {
		if (transporter) transporter.disconnect();

		broker = new ServiceBroker({
			logger: false,
			namespace: "TEST",
			nodeID: "node",
			internalServices: false
		});
		msgHandler = mock.fn();
		transporter = new Amqp10Transporter({ url: "amqp10://localhost" });
		transporter.init(new Transit(broker), msgHandler);
		transporter.incomingMessage = mock.fn();
		return transporter.connect();
	});

	it("check RES subscription", () => {
		return transporter
			.subscribe("RES", "node")
			.catch(protectReject)
			.then(() => {
				expect(transporter.connection.createReceiver).toHaveBeenCalledTimes(1);
				expect(transporter.connection.createReceiver).toHaveBeenCalledWith(
					expect.objectContaining({ source: { address: "MOL-TEST.RES.node" } })
				);

				expect(transporter.receivers[0].addCredit).toHaveBeenCalledTimes(1);
				expect(transporter.receivers[0].on).toHaveBeenCalledTimes(10);
				expect(transporter.receivers[0].on).toHaveBeenCalledWith(
					"message",
					expect.any(Function)
				);

				const consumeCb = transporter.receivers[0].on.mock.calls[9][1];
				const delivery = { accept: mock.fn(), reject: mock.fn() };
				consumeCb({ message: { body: Buffer.from("data") }, delivery });

				expect(transporter.incomingMessage).toHaveBeenCalledTimes(1);
				expect(delivery.accept).toHaveBeenCalledTimes(0);
			});
	});

	it("check INFO.nodeID subscription", () => {
		return transporter
			.subscribe("INFO", "node")
			.catch(protectReject)
			.then(() => {
				expect(transporter.connection.createReceiver).toHaveBeenCalledTimes(1);
				expect(transporter.connection.createReceiver).toHaveBeenCalledWith(
					expect.objectContaining({ source: { address: "MOL-TEST.INFO.node" } })
				);

				expect(transporter.receivers[0].addCredit).toHaveBeenCalledTimes(1);
				expect(transporter.receivers[0].on).toHaveBeenCalledTimes(12);
				expect(transporter.receivers[0].on).toHaveBeenCalledWith(
					"message",
					expect.any(Function)
				);

				const consumeCb = transporter.receivers[0].on.mock.calls[11][1];
				const delivery = { accept: mock.fn(), reject: mock.fn() };
				consumeCb({ message: { body: Buffer.from("data") }, delivery });

				expect(transporter.incomingMessage).toHaveBeenCalledTimes(1);
				expect(delivery.accept).toHaveBeenCalledTimes(0);
			});
	});

	it("check REQ.nodeID subscription", () => {
		return transporter
			.subscribe("REQ", "node")
			.catch(protectReject)
			.then(() => {
				expect(transporter.connection.createReceiver).toHaveBeenCalledTimes(1);
				expect(transporter.connection.createReceiver).toHaveBeenCalledWith(
					expect.objectContaining({ source: { address: "MOL-TEST.REQ.node" } })
				);

				expect(transporter.receivers[0].addCredit).toHaveBeenCalledTimes(1);
				expect(transporter.receivers[0].on).toHaveBeenCalledTimes(14);
				expect(transporter.receivers[0].on).toHaveBeenCalledWith(
					"message",
					expect.any(Function)
				);

				const consumeCb = transporter.receivers[0].on.mock.calls[13][1];
				const delivery = { accept: mock.fn(), reject: mock.fn() };
				consumeCb({ message: { body: Buffer.from("data") }, delivery });

				expect(transporter.incomingMessage).toHaveBeenCalledTimes(1);
				expect(delivery.accept).toHaveBeenCalledTimes(1);
			});
	});

	it("check EVENT subscription", () => {
		return transporter
			.subscribe("EVENT", "node")
			.catch(protectReject)
			.then(() => {
				expect(transporter.connection.createReceiver).toHaveBeenCalledTimes(1);
				expect(transporter.connection.createReceiver).toHaveBeenCalledWith(
					expect.objectContaining({ source: { address: "MOL-TEST.EVENT.node" } })
				);

				expect(transporter.receivers[0].addCredit).toHaveBeenCalledTimes(1);
				expect(transporter.receivers[0].on).toHaveBeenCalledTimes(16);
				expect(transporter.receivers[0].on).toHaveBeenCalledWith(
					"message",
					expect.any(Function)
				);

				const consumeCb = transporter.receivers[0].on.mock.calls[15][1];
				const delivery = { accept: mock.fn(), reject: mock.fn() };
				consumeCb({ message: { body: Buffer.from("data") }, delivery });

				expect(transporter.incomingMessage).toHaveBeenCalledTimes(1);
				expect(delivery.accept).toHaveBeenCalledTimes(0);
			});
	});

	["DISCOVER", "DISCONNECT", "INFO", "HEARTBEAT"].forEach((type, i) => {
		it(`check ${type} subscription`, () => {
			return transporter
				.subscribe(type)
				.catch(protectReject)
				.then(() => {
					expect(transporter.connection.createReceiver).toHaveBeenCalledTimes(1);
					expect(transporter.connection.createReceiver).toHaveBeenCalledWith(
						expect.objectContaining({ source: { address: `topic://MOL-TEST.${type}` } })
					);

					expect(transporter.receivers[0].on).toHaveBeenCalledTimes(18 + i * 2);
					expect(transporter.receivers[0].on).toHaveBeenCalledWith(
						"message",
						expect.any(Function)
					);

					const consumeCb = transporter.receivers[0].on.mock.calls[17 + i * 2][1];
					const delivery = { accept: mock.fn(), reject: mock.fn() };
					consumeCb({ message: { body: Buffer.from("data") }, delivery });

					expect(transporter.incomingMessage).toHaveBeenCalledTimes(1);
					expect(delivery.accept).toHaveBeenCalledTimes(0);
				});
		});
	});

	it("check subscribeBalancedRequest", () => {
		return transporter
			.subscribeBalancedRequest("posts.find")
			.catch(protectReject)
			.then(() => {
				expect(transporter.connection.createReceiver).toHaveBeenCalledTimes(1);
				expect(transporter.connection.createReceiver).toHaveBeenCalledWith(
					expect.objectContaining({ source: { address: "MOL-TEST.REQB.posts.find" } })
				);

				expect(transporter.receivers[0].on).toHaveBeenCalledTimes(26);
				expect(transporter.receivers[0].on).toHaveBeenCalledWith(
					"message",
					expect.any(Function)
				);

				const consumeCb = transporter.receivers[0].on.mock.calls[25][1];
				const delivery = { accept: mock.fn(), reject: mock.fn() };
				consumeCb({ message: { body: Buffer.from("data") }, delivery });

				expect(transporter.incomingMessage).toHaveBeenCalledTimes(1);
				expect(delivery.accept).toHaveBeenCalledTimes(1);
			});
	});

	it("check subscribeBalancedEvent", () => {
		return transporter
			.subscribeBalancedEvent("cache.clear", "posts")
			.catch(protectReject)
			.then(() => {
				expect(transporter.connection.createReceiver).toHaveBeenCalledTimes(1);
				expect(transporter.connection.createReceiver).toHaveBeenCalledWith(
					expect.objectContaining({
						source: { address: "MOL-TEST.EVENTB.posts.cache.clear" }
					})
				);

				expect(transporter.receivers[0].on).toHaveBeenCalledTimes(28);
				expect(transporter.receivers[0].on).toHaveBeenCalledWith(
					"message",
					expect.any(Function)
				);

				const consumeCb = transporter.receivers[0].on.mock.calls[27][1];
				const delivery = { accept: mock.fn(), reject: mock.fn() };
				consumeCb({ message: { body: Buffer.from("data") }, delivery });

				expect(transporter.incomingMessage).toHaveBeenCalledTimes(1);
				expect(delivery.accept).toHaveBeenCalledTimes(1);
			});
	});
});

describe("Test AmqpTransporter publish", () => {
	let transporter;
	let msgHandler;

	beforeEach(() => {
		msgHandler = mock.fn();
		transporter = new Amqp10Transporter({ url: "amqp10://localhost" });
		transporter.init(
			new Transit(new ServiceBroker({ logger: false, namespace: "TEST" })),
			msgHandler
		);
		transporter.serialize = mock.fn(() => Buffer.from("json data"));
		return transporter.connect();
	});

	it("check publish with target", () => {
		const packet = new P.Packet(P.PACKET_INFO, "node2", {});
		return transporter
			.publish(packet)
			.catch(protectReject)
			.then(() => {
				return transporter.connection.createAwaitableSender.mock.results[0].value.then(
					sender => {
						expect(transporter.connection.createAwaitableSender).toHaveBeenCalledTimes(
							1
						);
						expect(transporter.connection.createAwaitableSender).toHaveBeenCalledWith(
							expect.objectContaining({ target: { address: "MOL-TEST.INFO.node2" } })
						);
						expect(sender.send).toHaveBeenCalledTimes(1);
						expect(sender.send).toHaveBeenCalledWith(
							expect.objectContaining({ body: Buffer.from("json data") })
						);
					}
				);
			});
	});

	it("check publish without target", () => {
		const packet = new P.Packet(P.PACKET_INFO, null, {});
		return transporter
			.publish(packet)
			.catch(protectReject)
			.then(() => {
				return transporter.connection.createAwaitableSender.mock.results[0].value.then(
					sender => {
						expect(transporter.connection.createAwaitableSender).toHaveBeenCalledTimes(
							1
						);
						expect(transporter.connection.createAwaitableSender).toHaveBeenCalledWith(
							expect.objectContaining({
								target: { address: "topic://MOL-TEST.INFO" }
							})
						);
						expect(sender.send).toHaveBeenCalledTimes(1);
						expect(sender.send).toHaveBeenCalledWith(
							expect.objectContaining({ body: Buffer.from("json data") })
						);
					}
				);
			});
	});

	it("check publishBalancedEvent", () => {
		const packet = new P.Packet(P.PACKET_EVENT, null, {
			event: "user.created",
			data: { id: 5 },
			groups: ["mail"]
		});
		return transporter
			.publishBalancedEvent(packet, "mail")
			.catch(protectReject)
			.then(() => {
				return transporter.connection.createAwaitableSender.mock.results[0].value.then(
					sender => {
						expect(transporter.connection.createAwaitableSender).toHaveBeenCalledTimes(
							1
						);
						expect(transporter.connection.createAwaitableSender).toHaveBeenCalledWith(
							expect.objectContaining({
								target: { address: "MOL-TEST.EVENTB.mail.user.created" }
							})
						);
						expect(sender.send).toHaveBeenCalledTimes(1);
						expect(sender.send).toHaveBeenCalledWith(
							expect.objectContaining({ body: Buffer.from("json data") })
						);
						expect(transporter.serialize).toHaveBeenCalledTimes(1);
						expect(transporter.serialize).toHaveBeenCalledWith(packet);
					}
				);
			});
	});

	it("check publishBalancedRequest", () => {
		const packet = new P.Packet(P.PACKET_REQUEST, null, {
			action: "posts.find"
		});
		return transporter
			.publishBalancedRequest(packet)
			.catch(protectReject)
			.then(() => {
				return transporter.connection.createAwaitableSender.mock.results[0].value.then(
					sender => {
						expect(transporter.connection.createAwaitableSender).toHaveBeenCalledTimes(
							1
						);
						expect(transporter.connection.createAwaitableSender).toHaveBeenCalledWith(
							expect.objectContaining({
								target: { address: "MOL-TEST.REQB.posts.find" }
							})
						);
						expect(sender.send).toHaveBeenCalledTimes(1);
						expect(sender.send).toHaveBeenCalledWith(
							expect.objectContaining({ body: Buffer.from("json data") })
						);
						expect(transporter.serialize).toHaveBeenCalledTimes(1);
						expect(transporter.serialize).toHaveBeenCalledWith(packet);
					}
				);
			});
	});
});
