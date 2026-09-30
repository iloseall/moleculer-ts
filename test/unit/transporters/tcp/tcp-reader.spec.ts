import { describe, it, beforeEach, mock } from "../../../helpers/test";
import expect from "../../../helpers/expect";
import { autoMock, factoryMock, interopDefault } from "../../../helpers/module-mock";

autoMock(require.resolve("net"));
factoryMock(require.resolve("../../../../src/transporters/tcp/parser"), () => {
	return mock.fn().mockImplementation(() => {
		const callbacks = {};
		const parser = {
			on: mock.fn((type, cb) => (callbacks[type] = cb)),
			__callbacks: callbacks
		};

		return parser;
	});
});

const { protectReject } = require("../../../helpers/utils");
const ServiceBroker = interopDefault(require("../../../../src/service-broker"));
const net = interopDefault(require("net"));
const TcpReader = interopDefault(require("../../../../src/transporters/tcp/tcp-reader"));

// const lolex = require("@sinonjs/fake-timers");

const broker = new ServiceBroker({ logger: false });

describe("Test TcpReader constructor", () => {
	it("check constructor", () => {
		const transporter = {
			logger: mock.fn(),
			broker
		};
		const opts = { port: 1234 };
		const reader = new TcpReader(transporter, opts);
		expect(reader).toBeDefined();
		expect(reader.transporter).toBe(transporter);
		expect(reader.opts).toBe(opts);

		expect(reader.sockets).toBeInstanceOf(Array);
		expect(reader.logger).toBe(transporter.logger);
	});
});

describe("Test TcpReader.listen", () => {
	let transporter, reader;

	let listenCb, serverErrorCb;
	const server = {
		on: mock.fn((type, cb) => (serverErrorCb = cb)),
		listen: mock.fn((type, cb) => (listenCb = cb)),
		address: mock.fn(() => ({ port: 5000 }))
	};

	let netCreateCB;
	net.createServer = mock.fn(cb => {
		netCreateCB = cb;
		return server;
	});

	beforeEach(() => {
		transporter = {
			getNode: mock.fn(() => null),
			getNodeAddress: mock.fn(() => "node-2-host"),
			sendHello: mock.fn(() => Promise.resolve()),
			logger: broker.logger,
			broker
		};

		reader = new TcpReader(transporter, { port: 1234 });
	});

	it("should create server & listen", () => {
		reader.onTcpClientConnected = mock.fn();

		const p = reader
			.listen()
			.catch(protectReject)
			.then(() => {
				expect(reader.server).toBe(server);

				expect(server.on).toHaveBeenCalledTimes(1);
				expect(server.on).toHaveBeenCalledWith("error", expect.any(Function));

				expect(server.listen).toHaveBeenCalledTimes(1);

				if (process.versions.node.split(".")[0] >= 8) {
					expect(server.listen).toHaveBeenCalledWith(
						{ port: 1234, exclusive: true },
						expect.any(Function)
					);
				} else {
					expect(server.listen).toHaveBeenCalledWith(1234, expect.any(Function));
				}

				expect(reader.opts.port).toBe(5000);
				expect(reader.connected).toBe(true);

				// Fire new connection event handler
				expect(reader.onTcpClientConnected).toHaveBeenCalledTimes(0);

				const socket = {};
				netCreateCB(socket);

				expect(reader.onTcpClientConnected).toHaveBeenCalledTimes(1);
				expect(reader.onTcpClientConnected).toHaveBeenCalledWith(socket);
			});

		listenCb();

		return p;
	});

	it("should reject on server error", () => {
		const p = reader
			.listen()
			.then(protectReject)
			.catch(err => {
				expect(err).toBeInstanceOf(Error);
				expect(err.message).toBe("Server error");
			});

		serverErrorCb(new Error("Server error"));

		return p;
	});
});

describe("Test TcpReader.onTcpClientConnected", () => {
	let transporter, socket, reader;

	beforeEach(() => {
		transporter = {
			getNode: mock.fn(() => null),
			getNodeAddress: mock.fn(() => "node-2-host"),
			sendHello: mock.fn(() => Promise.resolve()),
			logger: broker.logger,
			broker
		};

		const socketCallbacks = {};
		socket = {
			on: mock.fn((type, cb) => (socketCallbacks[type] = cb)),
			pipe: mock.fn(parser => (socket.parser = parser)),
			remoteAddress: "192.168.1.2",
			setNoDelay: mock.fn(),
			__callbacks: socketCallbacks
		};
		reader = new TcpReader(transporter, { maxPacketSize: 5000 });
	});

	it("should create parser and set event handlers", () => {
		reader.onTcpClientConnected(socket);

		expect(socket.on).toHaveBeenCalledTimes(2);
		expect(socket.on).toHaveBeenCalledWith("error", expect.any(Function));
		expect(socket.on).toHaveBeenCalledWith("close", expect.any(Function));

		expect(socket.setNoDelay).toHaveBeenCalledTimes(1);
		expect(socket.setNoDelay).toHaveBeenCalledWith(true);

		expect(socket.pipe).toHaveBeenCalledTimes(1);
		expect(socket.pipe).toHaveBeenCalledWith(socket.parser);
	});

	it("should call onIncomingMessage when parser has data", () => {
		transporter.onIncomingMessage = mock.fn();

		reader.onTcpClientConnected(socket);

		socket.parser.__callbacks.data("REQ", "message");

		expect(transporter.onIncomingMessage).toHaveBeenCalledTimes(1);
		expect(transporter.onIncomingMessage).toHaveBeenCalledWith("REQ", "message", socket);
	});

	it("should call closeSocket on parser error", () => {
		reader.closeSocket = mock.fn();

		reader.onTcpClientConnected(socket);

		const parserErr = new Error("Parser error");
		socket.parser.__callbacks.error(parserErr);

		expect(reader.closeSocket).toHaveBeenCalledTimes(1);
		expect(reader.closeSocket).toHaveBeenCalledWith(socket);
	});

	it("should call closeSocket on socket error", () => {
		reader.closeSocket = mock.fn();

		reader.onTcpClientConnected(socket);

		const socketErr = new Error("Socket error");
		socket.__callbacks.error(socketErr);

		expect(reader.closeSocket).toHaveBeenCalledTimes(1);
		expect(reader.closeSocket).toHaveBeenCalledWith(socket);
	});

	it("should call closeSocket on socket close", () => {
		reader.closeSocket = mock.fn();

		reader.onTcpClientConnected(socket);

		reader.closeSocket.mockClear();
		socket.__callbacks.close(true);

		expect(reader.closeSocket).toHaveBeenCalledTimes(1);
		expect(reader.closeSocket).toHaveBeenCalledWith(socket);
	});
});

describe("Test TcpReader.close", () => {
	let transporter, reader;

	beforeEach(() => {
		transporter = {
			getNode: mock.fn(() => null),
			getNodeAddress: mock.fn(() => "node-2-host"),
			sendHello: mock.fn(() => Promise.resolve()),
			logger: broker.logger,
			broker
		};

		reader = new TcpReader(transporter, { port: 1234 });
	});

	it("should close socket & remove from sockets list", () => {
		const destroy = mock.fn();
		reader.sockets.push({ id: 1, destroy });
		reader.sockets.push({ id: 2, destroy });
		reader.sockets.push({ id: 3, destroy });

		reader.closeSocket(reader.sockets[1]);

		expect(reader.sockets.length).toBe(2);
		expect(destroy).toHaveBeenCalledTimes(1);
		expect(reader.sockets.find(s => s.id == 2)).toBeUndefined();
	});

	it("should close server & all sockets", () => {
		const server = {
			listening: true,
			close: mock.fn()
		};
		reader.server = server;

		const destroy = mock.fn();
		reader.sockets.length = 0;
		reader.sockets.push({ destroy });
		reader.sockets.push({ destroy });
		reader.sockets.push({ destroy });

		reader.close();

		expect(server.close).toHaveBeenCalledTimes(1);
		expect(reader.sockets.length).toBe(0);
		expect(destroy).toHaveBeenCalledTimes(3);
	});
});
