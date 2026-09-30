import { describe, it, beforeEach, mock } from "../../../helpers/test";
import expect from "../../../helpers/expect";
import { autoMock, factoryMock, interopDefault } from "../../../helpers/module-mock";

autoMock(require.resolve("net"));

const ServiceBroker = interopDefault(require("../../../../src/service-broker"));
const P = require("../../../../src/packets");
const E = require("../../../../src/errors");
const { protectReject } = require("../../../helpers/utils");
const C = require("../../../../src/transporters/tcp/constants");
const net = interopDefault(require("net"));
const TcpWriter = interopDefault(require("../../../../src/transporters/tcp/tcp-writer"));

// const lolex = require("@sinonjs/fake-timers");

const broker = new ServiceBroker({ logger: false });

describe("Test TcpWriter constructor", () => {
	it("check constructor", () => {
		const transporter = {
			logger: mock.fn(),
			broker
		};
		const opts = { port: 1234 };
		const writer = new TcpWriter(transporter, opts);
		expect(writer).toBeDefined();
		expect(writer.transporter).toBe(transporter);
		expect(writer.opts).toBe(opts);

		expect(writer.sockets).toBeInstanceOf(Map);
		expect(writer.logger).toBe(transporter.logger);
	});
});

describe("Test TcpWriter.send", () => {
	let transporter, writer;
	const node = {
		id: "node-2",
		port: 2222
	};

	const socket = {
		write: mock.fn((payload, cb) => cb()),
		unref: mock.fn()
	};

	beforeEach(() => {
		transporter = {
			connect: mock.fn(() => Promise.resolve()),
			logger: broker.logger,
			broker
		};

		writer = new TcpWriter(transporter, {});
		writer.connect = mock.fn(() => Promise.resolve(socket));
	});

	it("should call connect if no socket", () => {
		return writer
			.send("node-2", P.PACKET_REQUEST, Buffer.from("data"))
			.catch(protectReject)
			.then(() => {
				expect(writer.connect).toHaveBeenCalledTimes(1);
				expect(writer.connect).toHaveBeenCalledWith(node.id);
				expect(socket.lastUsed).toBeDefined();
			});
	});

	it("should reject error and call removeSocket if write throw error", () => {
		writer.removeSocket = mock.fn();
		socket.write = mock.fn(() => {
			throw new Error("Write error");
		});
		return writer
			.send("node-2", P.PACKET_REQUEST, Buffer.from("data"))
			.then(protectReject)
			.catch(err => {
				expect(err).toBeInstanceOf(Error);

				expect(writer.removeSocket).toHaveBeenCalledTimes(1);
				expect(writer.removeSocket).toHaveBeenCalledWith("node-2");
			});
	});

	it("should not call connect & call write", () => {
		socket.write = mock.fn((data, cb) => cb());
		writer.sockets.set("node-2", socket);
		writer.connect.mockClear();

		return writer
			.send("node-2", C.PACKET_GOSSIP_REQ_ID, Buffer.from("data"))
			.catch(protectReject)
			.then(() => {
				expect(writer.connect).toHaveBeenCalledTimes(0);

				expect(socket.write).toHaveBeenCalledTimes(1);
				expect(socket.write).toHaveBeenCalledWith(
					Buffer.from([12, 0, 0, 0, 10, 6, 100, 97, 116, 97]),
					expect.any(Function)
				);
			});
	});
});

describe("Test TcpWriter.connect", () => {
	const broker = new ServiceBroker({ logger: false });
	let transporter, writer;
	const node = {
		id: "node-2",
		port: 2222
	};

	const socketCallbacks = {};
	const socket = {
		on: mock.fn((type, cb) => {
			socketCallbacks[type] = cb;
		}),
		unref: mock.fn(),
		setNoDelay: mock.fn()
	};

	let netConnectCB;
	net.connect = mock.fn((opts, cb) => {
		netConnectCB = cb;
		return socket;
	});

	beforeEach(() => {
		transporter = {
			getNode: mock.fn(() => null),
			getNodeAddress: mock.fn(() => "node-2-host"),
			sendHello: mock.fn(() => Promise.resolve()),
			logger: broker.logger,
			broker
		};

		writer = new TcpWriter(transporter, {});
	});

	it("should reject error if no node info", () => {
		return writer
			.connect("node-2")
			.then(protectReject)
			.catch(err => {
				expect(err).toBeInstanceOf(E.MoleculerError);
				expect(err.message).toBe("Missing node info for 'node-2'!");
			});
	});

	it("should connect & send sendHello", () => {
		writer.addSocket = mock.fn();
		transporter.getNode = mock.fn(() => node);
		transporter.sendHello = mock.fn(() => Promise.resolve());
		writer.manageConnections = mock.fn();
		writer.removeSocket = mock.fn();

		const p = writer
			.connect("node-2")
			.catch(protectReject)
			.then(s => {
				expect(socket).toBe(s);
				expect(socket.nodeID).toBe("node-2");
				expect(socket.lastUsed).toBeDefined();

				expect(socket.setNoDelay).toHaveBeenCalledTimes(1);
				expect(socket.setNoDelay).toHaveBeenCalledWith(true);

				expect(transporter.getNodeAddress).toHaveBeenCalledTimes(1);
				expect(transporter.getNodeAddress).toHaveBeenCalledWith(node);

				expect(writer.addSocket).toHaveBeenCalledTimes(1);
				expect(writer.addSocket).toHaveBeenCalledWith("node-2", socket, true);

				expect(transporter.sendHello).toHaveBeenCalledTimes(1);
				expect(transporter.sendHello).toHaveBeenCalledWith("node-2");

				expect(writer.manageConnections).toHaveBeenCalledTimes(0);

				expect(socket.on).toHaveBeenCalledTimes(2);
				expect(socket.on).toHaveBeenCalledWith("error", expect.any(Function));
				expect(socket.on).toHaveBeenCalledWith("end", expect.any(Function));

				expect(socket.unref).toHaveBeenCalledTimes(1);

				// Fire socket error
				writer.emit = mock.fn();

				socketCallbacks.error(new Error());

				expect(writer.removeSocket).toHaveBeenCalledTimes(1);
				expect(writer.removeSocket).toHaveBeenCalledWith("node-2");

				expect(writer.emit).toHaveBeenCalledTimes(1);
				expect(writer.emit).toHaveBeenCalledWith("error", expect.any(Error), "node-2");

				// Socket end
				writer.emit.mockClear();
				writer.removeSocket.mockClear();
				socketCallbacks.end();

				expect(writer.removeSocket).toHaveBeenCalledTimes(1);
				expect(writer.removeSocket).toHaveBeenCalledWith("node-2");

				expect(writer.emit).toHaveBeenCalledTimes(1);
				expect(writer.emit).toHaveBeenCalledWith("end", "node-2");
			});

		netConnectCB();

		return p;
	});

	it("should call manageConnections", () => {
		writer.addSocket = mock.fn();
		transporter.getNode = mock.fn(() => node);
		transporter.sendHello = mock.fn(() => Promise.resolve());
		writer.manageConnections = mock.fn();

		writer.opts.maxConnections = 3;
		writer.sockets.set(1, null);
		writer.sockets.set(2, null);
		writer.sockets.set(3, null);
		writer.sockets.set(4, null);
		writer.sockets.set(5, null);

		const p = writer
			.connect("node-2")
			.catch(protectReject)
			.then(() => {
				expect(writer.manageConnections).toHaveBeenCalledTimes(1);
			});

		netConnectCB();

		return p;
	});

	it("should reject if sendHello rejected", () => {
		transporter.getNode = mock.fn(() => node);
		transporter.sendHello = mock.fn(() => Promise.reject(new Error("Hello error")));

		const p = writer
			.connect("node-2")
			.then(protectReject)
			.catch(err => {
				expect(err).toBeInstanceOf(Error);
				expect(err.message).toBe("Hello error");
			});

		netConnectCB();

		return p;
	});

	it("should reject if connect throw exception", () => {
		transporter.getNode = mock.fn(() => node);
		net.connect = mock.fn(() => {
			throw new Error("Connection error");
		});

		return writer
			.connect("node-2")
			.then(protectReject)
			.catch(err => {
				expect(err).toBeInstanceOf(Error);
				expect(err.message).toBe("Connection error");
			});
	});
});

describe("Test TcpWriter.manageConnections", () => {
	const broker = new ServiceBroker({ logger: false });
	let transporter, writer;

	beforeEach(() => {
		transporter = {
			logger: broker.logger,
			broker
		};
	});

	it("should not call removeSocket", () => {
		writer = new TcpWriter(transporter, { maxConnections: 5 });
		writer.sockets.set("node-2", { lastUsed: 4 });
		writer.sockets.set("node-3", { lastUsed: 1 });
		writer.sockets.set("node-4", { lastUsed: 6 });

		writer.removeSocket = mock.fn();

		writer.manageConnections();

		expect(writer.sockets.size).toBe(3);
		expect(writer.removeSocket).toHaveBeenCalledTimes(0);
	});

	it("should call removeSocket", () => {
		writer = new TcpWriter(transporter, { maxConnections: 3 });
		writer.sockets.set("node-2", { lastUsed: 4 });
		writer.sockets.set("node-3", { lastUsed: 1 });
		writer.sockets.set("node-4", { lastUsed: 6 });
		writer.sockets.set("node-5", { lastUsed: 2 });
		writer.sockets.set("node-6", { lastUsed: 5 });

		writer.removeSocket = mock.fn();

		writer.manageConnections();

		expect(writer.sockets.size).toBe(5);
		expect(writer.removeSocket).toHaveBeenCalledTimes(2);
		expect(writer.removeSocket).toHaveBeenCalledWith("node-5");
		expect(writer.removeSocket).toHaveBeenCalledWith("node-3");
	});
});

describe("Test TcpWriter.addSocket & removeSocket", () => {
	const transporter = {
		logger: broker.logger,
		broker
	};
	const writer = new TcpWriter(transporter);

	it("should add socket", () => {
		expect(writer.sockets.size).toBe(0);

		writer.addSocket("node-2", { id: 1 });
		expect(writer.sockets.size).toBe(1);
	});

	it("should not add socket", () => {
		expect(writer.sockets.size).toBe(1);

		writer.addSocket("node-2", { id: 2 });
		expect(writer.sockets.size).toBe(1);
		expect(writer.sockets.get("node-2")).toEqual({ id: 1 });
	});

	it("should overwrite socket", () => {
		writer.sockets.get("node-2").destroyed = true;
		expect(writer.sockets.size).toBe(1);

		const s = { id: 3 };
		writer.addSocket("node-2", s);
		expect(writer.sockets.size).toBe(1);
		expect(writer.sockets.get("node-2")).toEqual({ id: 3 });
	});

	it("should overwrite socket with force", () => {
		writer.sockets.get("node-2").destroyed = false;
		expect(writer.sockets.size).toBe(1);

		const s = { id: 4 };
		writer.addSocket("node-2", s, true);
		expect(writer.sockets.size).toBe(1);
		expect(writer.sockets.get("node-2")).toEqual({ id: 4 });
	});

	it("should remove socket", () => {
		const s = {
			destroyed: true,
			destroy: mock.fn()
		};

		writer.addSocket("node-3", s);
		expect(writer.sockets.size).toBe(2);

		writer.removeSocket("node-3");
		expect(writer.sockets.size).toBe(1);
		expect(writer.sockets.get("node-3")).toBeUndefined();

		expect(s.destroy).toHaveBeenCalledTimes(0);
	});

	it("should destroy & remove socket", () => {
		const s = {
			destroyed: false,
			destroy: mock.fn()
		};

		writer.addSocket("node-3", s);
		expect(writer.sockets.size).toBe(2);

		writer.removeSocket("node-3");
		expect(writer.sockets.size).toBe(1);
		expect(writer.sockets.get("node-3")).toBeUndefined();

		expect(s.destroy).toHaveBeenCalledTimes(1);
	});
});

describe("Test TcpWriter.close", () => {
	const transporter = {
		logger: broker.logger,
		broker
	};
	const writer = new TcpWriter(transporter);

	const end = mock.fn();
	writer.addSocket("node-2", { destroyed: false, end });
	writer.addSocket("node-3", { destroyed: true, end });
	writer.addSocket("node-4", { destroyed: false, end });

	it("should remove all socket", () => {
		expect(writer.sockets.size).toBe(3);
		writer.close();
		expect(writer.sockets.size).toBe(0);

		expect(end).toHaveBeenCalledTimes(2);
	});
});
