import { describe, it, beforeEach, mock } from "../../helpers/test";
import expect from "../../helpers/expect";
import { autoMock, factoryMock, interopDefault } from "../../helpers/module-mock";

autoMock(require.resolve("mqtt"));

const ServiceBroker = interopDefault(require("../../../src/service-broker"));
const Transit = interopDefault(require("../../../src/transit"));
const MqttTransporter = interopDefault(require("../../../src/transporters/mqtt"));
const P = require("../../../src/packets");
const C = require("../../../src/constants");
const { protectReject } = require("../../helpers/utils");
// `src/transporters/mqtt` does `require("mqtt").connect(...)`, so the patch has
// to land on the module exports themselves (not on `default`).
const MQTT = require("mqtt");

MQTT.connect = mock.fn(() => {
	const onCallbacks = {};
	return {
		on: mock.fn((event, cb) => (onCallbacks[event] = cb)),
		end: mock.fn(),
		subscribe: mock.fn((topic, opts = {}, cb) =>
			cb(undefined, [{ topic, qos: opts.qos ? opts.qos : 0 }])
		),
		publish: mock.fn((topic, data, opts, cb) => cb()),

		onCallbacks
	};
});

describe("Test MqttTransporter constructor", () => {
	it("check constructor", () => {
		const transporter = new MqttTransporter();
		expect(transporter).toBeDefined();
		expect(transporter.opts).toBeUndefined();
		expect(transporter.connected).toBe(false);
		expect(transporter.client).toBeNull();
	});

	it("check constructor with string param", () => {
		const transporter = new MqttTransporter("mqtt://localhost");
		expect(transporter.opts).toEqual("mqtt://localhost");
	});

	it("check constructor with options", () => {
		const opts = { host: "localhost", port: 1234, qos: 1, topicSeparator: "/" };
		const transporter = new MqttTransporter(opts);
		expect(transporter.opts).toBe(opts);
	});
});

describe("Test MqttTransporter connect & disconnect", () => {
	const broker = new ServiceBroker({ logger: false });
	const transit = new Transit(broker);
	const msgHandler = mock.fn();
	let transporter;

	beforeEach(() => {
		transporter = new MqttTransporter();
		transporter.init(transit, msgHandler);
	});

	it("check connect", () => {
		const p = transporter.connect().then(() => {
			expect(transporter.client).toBeDefined();
			expect(transporter.client.on).toHaveBeenCalledTimes(5);
			expect(transporter.client.on).toHaveBeenCalledWith("connect", expect.any(Function));
			expect(transporter.client.on).toHaveBeenCalledWith("error", expect.any(Function));
			expect(transporter.client.on).toHaveBeenCalledWith("reconnect", expect.any(Function));
			expect(transporter.client.on).toHaveBeenCalledWith("close", expect.any(Function));
			expect(transporter.client.on).toHaveBeenCalledWith("message", expect.any(Function));
		});

		transporter._client.onCallbacks.connect(); // Trigger the `resolve`

		return p;
	});

	it("check connect - should broadcast error", () => {
		broker.broadcastLocal = mock.fn();

		const p = transporter.connect().catch(() => {
			expect(transporter._client).toBeDefined();

			expect(broker.broadcastLocal).toHaveBeenCalledTimes(1);
			expect(broker.broadcastLocal).toHaveBeenNthCalledWith(1, "$transporter.error", {
				error: new Error("Ups"),
				module: "transporter",
				type: C.CLIENT_ERROR
			});
		});

		// Trigger an error
		const error = new Error("Ups");
		transporter._client.onCallbacks.error(error);

		return p;
	});

	it("check onConnected after connect", () => {
		transporter.onConnected = mock.fn(() => Promise.resolve());
		const p = transporter.connect().then(() => {
			expect(transporter.onConnected).toHaveBeenCalledTimes(1);
			expect(transporter.onConnected).toHaveBeenCalledWith();
		});

		transporter._client.onCallbacks.connect(); // Trigger the `resolve`

		return p;
	});

	it("check disconnect", () => {
		const p = transporter.connect().then(() => {
			const cb = transporter.client.end;
			transporter.disconnect();
			expect(transporter.client).toBeNull();
			expect(cb).toHaveBeenCalledTimes(1);
		});

		transporter._client.onCallbacks.connect(); // Trigger the `resolve`

		return p;
	});
});

describe("Test MqttTransporter subscribe & publish", () => {
	let transporter;
	let msgHandler;

	beforeEach(() => {
		transporter = new MqttTransporter();
		msgHandler = mock.fn();
		transporter.serialize = mock.fn(() => Buffer.from("json data"));
		transporter.incomingMessage = mock.fn();

		transporter.init(
			new Transit(new ServiceBroker({ logger: false, namespace: "TEST", nodeID: "node1" })),
			msgHandler
		);

		const p = transporter.connect();
		transporter._client.onCallbacks.connect(); // Trigger the `resolve`
		return p;
	});

	it("check subscribe", () => {
		transporter.client.subscribe.mockClear();
		transporter.subscribe("REQ", "node");

		expect(transporter.client.subscribe).toHaveBeenCalledTimes(1);
		expect(transporter.client.subscribe).toHaveBeenCalledWith(
			"MOL-TEST.REQ.node",
			{ qos: 0 },
			expect.any(Function)
		);
	});

	it("check incoming message handler", () => {
		// Test subscribe callback
		transporter.client.onCallbacks.message("MOL-TEST.event.name", "incoming data");
		expect(transporter.incomingMessage).toHaveBeenCalledTimes(1);
		expect(transporter.incomingMessage).toHaveBeenCalledWith("event", "incoming data");
	});

	it("check publish", () => {
		transporter.client.publish.mockClear();

		const packet = new P.Packet(P.PACKET_INFO, "node2", { services: {} });
		return transporter
			.publish(packet)
			.catch(protectReject)
			.then(() => {
				expect(transporter.client.publish).toHaveBeenCalledTimes(1);
				expect(transporter.client.publish).toHaveBeenCalledWith(
					"MOL-TEST.INFO.node2",
					Buffer.from("json data"),
					{ qos: 0 },
					expect.any(Function)
				);

				expect(transporter.serialize).toHaveBeenCalledTimes(1);
				expect(transporter.serialize).toHaveBeenCalledWith(packet);
			});
	});
});

describe("Test MqttTransporter subscribe & publish with different QoS", () => {
	let transporter;
	let msgHandler;

	beforeEach(() => {
		transporter = new MqttTransporter({ qos: 1 });
		msgHandler = mock.fn();
		transporter.serialize = mock.fn(() => "json data");
		transporter.incomingMessage = mock.fn();

		transporter.init(
			new Transit(new ServiceBroker({ logger: false, namespace: "TEST", nodeID: "node1" })),
			msgHandler
		);

		const p = transporter.connect();
		transporter._client.onCallbacks.connect(); // Trigger the `resolve`
		return p;
	});

	it("check subscribe", () => {
		return transporter
			.subscribe("REQ", "node")
			.catch(protectReject)
			.then(() => {
				expect(transporter.client.subscribe).toHaveBeenCalledTimes(1);
				expect(transporter.client.subscribe).toHaveBeenCalledWith(
					"MOL-TEST.REQ.node",
					{ qos: 1 },
					expect.any(Function)
				);
			});
	});

	it("check publish", () => {
		const packet = new P.Packet(P.PACKET_INFO, "node2", { services: {} });
		return transporter
			.publish(packet)
			.catch(protectReject)
			.then(() => {
				expect(transporter.client.publish).toHaveBeenCalledTimes(1);
				expect(transporter.client.publish).toHaveBeenCalledWith(
					"MOL-TEST.INFO.node2",
					"json data",
					{ qos: 1 },
					expect.any(Function)
				);
			});
	});

	it("check subscribe fail", () => {
		transporter.client.subscribe.mockImplementationOnce((topic, opts, cb) => cb("error"));
		return expect(transporter.subscribe("REQ", "node")).rejects.toBe("error");
	});

	it("check publish fail", () => {
		transporter.client.publish.mockImplementationOnce((topic, data, opts, cb) => cb("error"));

		const packet = new P.Packet(P.PACKET_INFO, "node2", { services: {} });
		return expect(transporter.publish(packet)).rejects.toBe("error");
	});
});

describe("Test MqttTransporter subscribe & publish with different topicSeparator", () => {
	let transporter;
	let msgHandler;

	beforeEach(() => {
		transporter = new MqttTransporter({ topicSeparator: "/" });
		msgHandler = mock.fn();
		transporter.serialize = mock.fn(() => Buffer.from("json data"));
		transporter.incomingMessage = mock.fn();

		transporter.init(
			new Transit(new ServiceBroker({ logger: false, namespace: "TEST", nodeID: "node1" })),
			msgHandler
		);

		const p = transporter.connect();
		transporter._client.onCallbacks.connect(); // Trigger the `resolve`
		return p;
	});

	it("check subscribe", () => {
		transporter.client.subscribe.mockClear();
		transporter.subscribe("REQ", "node");

		expect(transporter.client.subscribe).toHaveBeenCalledTimes(1);
		expect(transporter.client.subscribe).toHaveBeenCalledWith(
			"MOL-TEST/REQ/node",
			{ qos: 0 },
			expect.any(Function)
		);
	});

	it("check incoming message handler", () => {
		// Test subscribe callback
		transporter.client.onCallbacks.message("MOL-TEST/event/name", "incoming data");
		expect(transporter.incomingMessage).toHaveBeenCalledTimes(1);
		expect(transporter.incomingMessage).toHaveBeenCalledWith("event", "incoming data");
	});

	it("check publish", () => {
		transporter.client.publish.mockClear();

		const packet = new P.Packet(P.PACKET_INFO, "node2", { services: {} });
		return transporter
			.publish(packet)
			.catch(protectReject)
			.then(() => {
				expect(transporter.client.publish).toHaveBeenCalledTimes(1);
				expect(transporter.client.publish).toHaveBeenCalledWith(
					"MOL-TEST/INFO/node2",
					Buffer.from("json data"),
					{ qos: 0 },
					expect.any(Function)
				);

				expect(transporter.serialize).toHaveBeenCalledTimes(1);
				expect(transporter.serialize).toHaveBeenCalledWith(packet);
			});
	});
});
