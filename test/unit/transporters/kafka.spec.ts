import { describe, it, beforeEach, mock } from "../../helpers/test";
import expect from "../../helpers/expect";
import { autoMock, factoryMock, interopDefault } from "../../helpers/module-mock";

// Mock @platformatic/kafka before requiring it
const createFakeMetadata = topics => ({
	topics: new Map(
		topics.map(topic => [
			topic,
			{
				partitionsCount: 1,
				partitions: [{ leader: 0 }]
			}
		])
	)
});

const FakeKafkaAdmin = {
	close: mock.fn(() => Promise.resolve()),
	createTopics: mock.fn(() => Promise.resolve([])),
	listTopics: mock.fn(() => Promise.resolve([])),
	metadata: mock.fn(({ topics }) => Promise.resolve(createFakeMetadata(topics)))
};

const FakeKafkaProducer = {
	close: mock.fn(() => Promise.resolve()),
	send: mock.fn(() => Promise.resolve())
};

const consumerStreamHandlers = {};
const FakeKafkaStream = {
	on: mock.fn((event, cb) => {
		consumerStreamHandlers[event] = cb;
	}),
	close: mock.fn(() => Promise.resolve())
};

const FakeKafkaConsumer = {
	close: mock.fn(() => Promise.resolve()),
	consume: mock.fn(() => Promise.resolve(FakeKafkaStream))
};

const Producer = mock.fn(() => FakeKafkaProducer);
const Consumer = mock.fn(() => FakeKafkaConsumer);
const Admin = mock.fn(() => FakeKafkaAdmin);

// node:test has no hoisting: the mock is installed as soon as its fakes exist
// and before anything requires the transporter.
factoryMock(require.resolve("@platformatic/kafka"), () => ({
	Producer,
	Consumer,
	Admin
}));

const ServiceBroker = interopDefault(require("../../../src/service-broker"));
const Transit = interopDefault(require("../../../src/transit"));
const P = require("../../../src/packets");
const C = require("../../../src/constants");
const KafkaTransporter = interopDefault(require("../../../src/transporters/kafka"));

describe("Test KafkaTransporter constructor", () => {
	it("check constructor", () => {
		const transporter = new KafkaTransporter();
		expect(transporter).toBeDefined();
		expect(transporter.opts).toEqual({
			clientId: "moleculer-kafka",
			bootstrapBrokers: null,
			producer: {},
			consumer: {},
			admin: {},
			publish: {},
			publishMessage: {
				partition: 0
			}
		});
		expect(transporter.connected).toBe(false);
		expect(transporter.producer).toBeNull();
		expect(transporter.consumer).toBeNull();
	});

	it("check constructor with string param", () => {
		const transporter = new KafkaTransporter("localhost:9092");
		expect(transporter.opts).toEqual({
			clientId: "moleculer-kafka",
			bootstrapBrokers: ["localhost:9092"],
			producer: {},
			consumer: {},
			admin: {},
			publish: {},
			publishMessage: {
				partition: 0
			}
		});
	});

	it("check constructor with options", () => {
		const opts = {
			bootstrapBrokers: ["localhost:9092"],
			publishMessage: {
				partition: 1
			}
		};
		const transporter = new KafkaTransporter(opts);
		expect(transporter.opts).toEqual({
			clientId: "moleculer-kafka",
			bootstrapBrokers: ["localhost:9092"],
			producer: {},
			consumer: {},
			admin: {},
			publish: {},
			publishMessage: {
				partition: 1
			}
		});
	});

	it("check constructor with string bootstrapBrokers option", () => {
		const transporter = new KafkaTransporter({
			bootstrapBrokers: "localhost:9092"
		});
		expect(transporter.opts.bootstrapBrokers).toEqual(["localhost:9092"]);
	});
});

describe("Test KafkaTransporter connect & disconnect", () => {
	const broker = new ServiceBroker({ logger: false });
	const transit = new Transit(broker);
	const msgHandler = mock.fn();
	let transporter;

	beforeEach(() => {
		transporter = new KafkaTransporter({
			bootstrapBrokers: ["localhost:9092"],
			producer: {
				extraProp: 7
			}
		});
		transporter.init(transit, msgHandler);
	});

	it("check connect", async () => {
		await transporter.connect();
		expect(transporter.producer).toBeDefined();
		expect(transporter.admin).toBeDefined();

		expect(Producer).toHaveBeenCalledTimes(1);
		expect(Producer).toHaveBeenCalledWith({
			clientId: "moleculer-kafka",
			bootstrapBrokers: ["localhost:9092"],
			autocreateTopics: true,
			extraProp: 7
		});

		expect(Admin).toHaveBeenCalledTimes(1);
		expect(Admin).toHaveBeenCalledWith({
			clientId: "moleculer-kafka",
			bootstrapBrokers: ["localhost:9092"]
		});

		// Connection validation: listTopics should be called
		expect(FakeKafkaAdmin.listTopics).toHaveBeenCalled();
	});

	it("check connect - should broadcast error", async () => {
		broker.broadcastLocal = mock.fn();

		const origErr = new Error("Ups");
		transporter.onConnected = mock.fn(() => Promise.reject(origErr));
		try {
			await transporter.connect();
			expect(1).toBe(2);
		} catch (err) {
			expect(err).toBe(origErr);
			expect(transporter.producer).toBeDefined();

			expect(broker.broadcastLocal).toHaveBeenCalledTimes(1);
			expect(broker.broadcastLocal).toHaveBeenNthCalledWith(1, "$transporter.error", {
				error: origErr,
				module: "transporter",
				type: C.FAILED_PUBLISHER_ERROR
			});
		}
	});

	it("check onConnected after connect", () => {
		transporter.onConnected = mock.fn(() => Promise.resolve());
		const p = transporter.connect().then(() => {
			expect(transporter.onConnected).toHaveBeenCalledTimes(1);
			expect(transporter.onConnected).toHaveBeenCalledWith();
		});

		return p;
	});

	it("check disconnect", async () => {
		FakeKafkaStream.close.mockClear();
		await transporter.connect();
		await transporter.makeSubscriptions([
			{ cmd: "REQ", nodeID: "node" },
			{ cmd: "RES", nodeID: "node" }
		]);
		await transporter.disconnect();

		expect(FakeKafkaStream.close).toHaveBeenCalledTimes(1);
		expect(FakeKafkaAdmin.close).toHaveBeenCalledTimes(1);
		expect(FakeKafkaProducer.close).toHaveBeenCalledTimes(1);
		expect(FakeKafkaConsumer.close).toHaveBeenCalledTimes(1);
	});
});

describe("Test KafkaTransporter makeSubscriptions", () => {
	let transporter;
	let msgHandler;

	beforeEach(async () => {
		msgHandler = mock.fn();
		transporter = new KafkaTransporter({
			bootstrapBrokers: ["kafka-server:1234"],
			consumer: { extraProp: 5 }
		});
		transporter.init(
			new Transit(new ServiceBroker({ logger: false, namespace: "TEST", nodeID: "node-1" })),
			msgHandler
		);

		await transporter.connect();
		transporter.incomingMessage = mock.fn();

		transporter.admin.createTopics.mockClear();
	});

	it("check makeSubscriptions", async () => {
		Consumer.mockClear();
		FakeKafkaConsumer.consume.mockClear();
		transporter.admin.listTopics.mockClear();

		await transporter.makeSubscriptions([
			{ cmd: "REQ", nodeID: "node" },
			{ cmd: "RES", nodeID: "node" }
		]);

		expect(transporter.admin.listTopics).toHaveBeenCalledTimes(1);
		expect(transporter.admin.createTopics).toHaveBeenCalledTimes(1);
		expect(transporter.admin.createTopics).toHaveBeenCalledWith({
			topics: ["MOL-TEST.REQ.node", "MOL-TEST.RES.node"]
		});

		expect(Consumer).toHaveBeenCalledTimes(1);
		expect(Consumer).toHaveBeenCalledWith({
			clientId: "moleculer-kafka",
			bootstrapBrokers: ["kafka-server:1234"],
			groupId: transporter.broker.instanceID,
			extraProp: 5
		});

		expect(FakeKafkaConsumer.consume).toHaveBeenCalledTimes(1);
		expect(transporter.consumer).toBeDefined();

		consumerStreamHandlers.data({
			topic: "MOL.INFO.node-2",
			value: '{ ver: "3" }'
		});
		expect(transporter.incomingMessage).toHaveBeenCalledTimes(1);
		expect(transporter.incomingMessage).toHaveBeenCalledWith("INFO", '{ ver: "3" }');
	});

	it("check makeSubscriptions - should skip existing topics", async () => {
		Consumer.mockClear();
		FakeKafkaConsumer.consume.mockClear();
		transporter.admin.listTopics.mockClear();
		transporter.admin.createTopics.mockClear();

		// Mock listTopics to return one existing topic
		transporter.admin.listTopics = mock.fn(() => Promise.resolve(["MOL-TEST.REQ.node"]));

		await transporter.makeSubscriptions([
			{ cmd: "REQ", nodeID: "node" },
			{ cmd: "RES", nodeID: "node" }
		]);

		expect(transporter.admin.listTopics).toHaveBeenCalledTimes(1);
		expect(transporter.admin.createTopics).toHaveBeenCalledTimes(1);
		// Should only create the topic that doesn't exist
		expect(transporter.admin.createTopics).toHaveBeenCalledWith({
			topics: ["MOL-TEST.RES.node"]
		});

		expect(transporter.consumer).toBeDefined();

		// Reset mock
		transporter.admin.listTopics = mock.fn(() => Promise.resolve([]));
	});

	it("check makeSubscriptions - should skip creation when all topics exist", async () => {
		Consumer.mockClear();
		FakeKafkaConsumer.consume.mockClear();
		transporter.admin.listTopics.mockClear();
		transporter.admin.createTopics.mockClear();

		// Mock listTopics to return all topics as existing
		transporter.admin.listTopics = mock.fn(() =>
			Promise.resolve(["MOL-TEST.REQ.node", "MOL-TEST.RES.node"])
		);

		await transporter.makeSubscriptions([
			{ cmd: "REQ", nodeID: "node" },
			{ cmd: "RES", nodeID: "node" }
		]);

		expect(transporter.admin.listTopics).toHaveBeenCalledTimes(1);
		// Should not call createTopics when all topics exist
		expect(transporter.admin.createTopics).toHaveBeenCalledTimes(0);

		expect(transporter.consumer).toBeDefined();

		// Reset mock
		transporter.admin.listTopics = mock.fn(() => Promise.resolve([]));
	});

	it("check makeSubscriptions - should ignore TOPIC_ALREADY_EXISTS errors", async () => {
		transporter.broker.broadcastLocal = mock.fn();

		const origErr = new Error("Received response with error");
		origErr.errors = [
			{ apiId: "TOPIC_ALREADY_EXISTS", apiCode: 36 },
			{ apiId: "TOPIC_ALREADY_EXISTS", apiCode: 36 }
		];
		transporter.admin.createTopics = mock.fn(() => Promise.reject(origErr));

		await transporter.makeSubscriptions([
			{ cmd: "REQ", nodeID: "node" },
			{ cmd: "RES", nodeID: "node" }
		]);

		expect(transporter.broker.broadcastLocal).toHaveBeenCalledTimes(0);
		expect(transporter.consumer).toBeDefined();

		transporter.admin.createTopics = mock.fn(() => Promise.resolve([]));
	});

	it("check makeSubscriptions - should ignore nested TOPIC_ALREADY_EXISTS errors (2.x error shape)", async () => {
		transporter.broker.broadcastLocal = mock.fn();

		// @platformatic/kafka 2.x wraps the ResponseError in an extra
		// MultipleErrors("Creating topics failed.") layer
		const responseErr = new Error("Received response with error");
		responseErr.errors = [
			{ apiId: "TOPIC_ALREADY_EXISTS", apiCode: 36 },
			{ apiId: "TOPIC_ALREADY_EXISTS", apiCode: 36 }
		];
		const wrapperErr = new Error("Creating topics failed.");
		wrapperErr.errors = [responseErr];
		transporter.admin.createTopics = mock.fn(() => Promise.reject(wrapperErr));

		await transporter.makeSubscriptions([
			{ cmd: "REQ", nodeID: "node" },
			{ cmd: "RES", nodeID: "node" }
		]);

		expect(transporter.broker.broadcastLocal).toHaveBeenCalledTimes(0);
		expect(transporter.consumer).toBeDefined();

		transporter.admin.createTopics = mock.fn(() => Promise.resolve([]));
	});

	it("check makeSubscriptions - should throw if not all errors are TOPIC_ALREADY_EXISTS", async () => {
		transporter.broker.broadcastLocal = mock.fn();

		const origErr = new Error("Received response with error");
		origErr.errors = [
			{ apiId: "TOPIC_ALREADY_EXISTS", apiCode: 36 },
			{ apiId: "INVALID_PARTITIONS", apiCode: 37 }
		];
		transporter.admin.createTopics = mock.fn(() => Promise.reject(origErr));

		try {
			await transporter.makeSubscriptions([
				{ cmd: "REQ", nodeID: "node" },
				{ cmd: "RES", nodeID: "node" }
			]);
			expect(1).toBe(2);
		} catch (err) {
			expect(err).toBe(origErr);
			expect(transporter.broker.broadcastLocal).toHaveBeenCalledTimes(1);
			expect(transporter.broker.broadcastLocal).toHaveBeenCalledWith("$transporter.error", {
				error: origErr,
				module: "transporter",
				type: C.FAILED_TOPIC_CREATION
			});
		}

		transporter.admin.createTopics = mock.fn(() => Promise.resolve([]));
	});

	it("check makeSubscriptions - should broadcast an error", async () => {
		transporter.broker.broadcastLocal = mock.fn();

		const origErr = new Error("Ups");
		transporter.admin.createTopics = mock.fn(() => Promise.reject(origErr));

		try {
			await transporter.makeSubscriptions([
				{ cmd: "REQ", nodeID: "node" },
				{ cmd: "RES", nodeID: "node" }
			]);
			expect(1).toBe(2);
		} catch (err) {
			expect(err).toBe(origErr);
			expect(transporter.producer).toBeDefined();

			expect(transporter.broker.broadcastLocal).toHaveBeenCalledTimes(1);
			expect(transporter.broker.broadcastLocal).toHaveBeenCalledWith("$transporter.error", {
				error: origErr,
				module: "transporter",
				type: C.FAILED_TOPIC_CREATION
			});
		}

		transporter.admin.createTopics = mock.fn(() => Promise.resolve([]));
	});

	it("check makeSubscriptions - should broadcast a consumer error", async () => {
		transporter.broker.broadcastLocal = mock.fn();

		const origErr = new Error("Ups");
		FakeKafkaConsumer.consume = mock.fn(() => {
			throw origErr;
		});

		try {
			await transporter.makeSubscriptions([
				{ cmd: "REQ", nodeID: "node" },
				{ cmd: "RES", nodeID: "node" }
			]);
			expect(1).toBe(2);
		} catch (err) {
			expect(err).toBe(origErr);
			expect(transporter.broker.broadcastLocal).toHaveBeenCalledTimes(1);
			expect(transporter.broker.broadcastLocal).toHaveBeenCalledWith("$transporter.error", {
				error: origErr,
				module: "transporter",
				type: C.FAILED_CONSUMER_ERROR
			});
		}

		FakeKafkaConsumer.consume = mock.fn(() => Promise.resolve(FakeKafkaStream));
	});
});

describe("Test KafkaTransporter waitForTopicsReady", () => {
	let transporter;

	beforeEach(async () => {
		transporter = new KafkaTransporter({ bootstrapBrokers: ["kafka-server:1234"] });
		transporter.init(
			new Transit(new ServiceBroker({ logger: false, namespace: "TEST", nodeID: "node-1" })),
			mock.fn()
		);
		await transporter.connect();
	});

	it("should resolve when all topics have partition leaders", async () => {
		transporter.admin.metadata = mock.fn(({ topics }) =>
			Promise.resolve(createFakeMetadata(topics))
		);

		await transporter.waitForTopicsReady(["topic1", "topic2"]);

		expect(transporter.admin.metadata).toHaveBeenCalledTimes(1);
		expect(transporter.admin.metadata).toHaveBeenCalledWith({
			topics: ["topic1", "topic2"],
			forceUpdate: true
		});
	});

	it("should poll until the topic metadata becomes available", async () => {
		transporter.admin.metadata = mock
			.fn()
			.mockResolvedValueOnce(createFakeMetadata(["topic1"]))
			.mockResolvedValueOnce({
				topics: new Map([
					["topic1", { partitionsCount: 1, partitions: [{ leader: 0 }] }],
					["topic2", { partitionsCount: 1, partitions: [{ leader: -1 }] }]
				])
			})
			.mockResolvedValue(createFakeMetadata(["topic1", "topic2"]));

		await transporter.waitForTopicsReady(["topic1", "topic2"]);

		expect(transporter.admin.metadata).toHaveBeenCalledTimes(3);
	});

	it("should poll while the metadata request is rejected", async () => {
		transporter.admin.metadata = mock
			.fn()
			.mockRejectedValueOnce(new Error("Unknown topic"))
			.mockImplementation(({ topics }) => Promise.resolve(createFakeMetadata(topics)));

		await transporter.waitForTopicsReady(["topic1"]);

		expect(transporter.admin.metadata).toHaveBeenCalledTimes(2);
	});

	it("should give up after the timeout", async () => {
		transporter.logger.warn = mock.fn();
		transporter.admin.metadata = mock.fn(() => Promise.resolve({ topics: new Map() }));

		await transporter.waitForTopicsReady(["topic1"], 0);

		expect(transporter.admin.metadata).toHaveBeenCalledTimes(1);
		expect(transporter.logger.warn).toHaveBeenCalledTimes(1);
	});
});

describe("Test KafkaTransporter subscribe & publish", () => {
	let transporter;
	let msgHandler;

	beforeEach(async () => {
		msgHandler = mock.fn();
		transporter = new KafkaTransporter({
			bootstrapBrokers: ["kafka-server:1234"],
			publish: { extraProp: 5 },
			publishMessage: { partition: 2 }
		});
		transporter.init(
			new Transit(new ServiceBroker({ logger: false, namespace: "TEST", nodeID: "node1" })),
			msgHandler
		);
		transporter.serialize = mock.fn(() => Buffer.from("json data"));

		await transporter.connect();
	});

	it("check publish", async () => {
		transporter.producer.send.mockClear();
		const packet = new P.Packet(P.PACKET_INFO, "node2", { services: {} });
		await transporter.publish(packet);

		expect(transporter.producer.send).toHaveBeenCalledTimes(1);
		expect(transporter.producer.send).toHaveBeenCalledWith({
			messages: [
				{
					topic: "MOL-TEST.INFO.node2",
					value: Buffer.from("json data"),
					partition: 2
				}
			],
			extraProp: 5
		});

		expect(transporter.serialize).toHaveBeenCalledTimes(1);
		expect(transporter.serialize).toHaveBeenCalledWith(packet);
	});

	it("check publish - should broadcast a publisher error", async () => {
		transporter.broker.broadcastLocal = mock.fn();

		const origErr = new Error("Ups");
		FakeKafkaProducer.send = mock.fn(() => {
			throw origErr;
		});

		try {
			const packet = new P.Packet(P.PACKET_INFO, "node2", { services: {} });
			await transporter.publish(packet);
			expect(1).toBe(2);
		} catch (err) {
			expect(err).toBe(origErr);
			expect(transporter.broker.broadcastLocal).toHaveBeenCalledTimes(1);
			expect(transporter.broker.broadcastLocal).toHaveBeenCalledWith("$transporter.error", {
				error: origErr,
				module: "transporter",
				type: C.FAILED_PUBLISHER_ERROR
			});
		}

		FakeKafkaProducer.send = mock.fn(() => Promise.resolve());
	});
});
