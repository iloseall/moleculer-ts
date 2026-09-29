/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type { Server, Socket } from "net";

import net = require("net");
import EventEmitter = require("events");
import Parser = require("./parser");

/**
 * TCP Reader for TcpTransporter
 *
 * @class TcpReader
 * @extends {EventEmitter}
 */
class TcpReader extends EventEmitter {
	server: Server;
	opts: any;
	transporter: any;
	Promise: any;
	logger: any;
	sockets: any[];
	connected: boolean;
	/**
	 * Creates an instance of TcpReader.
	 *
	 * @param {any} transporter
	 * @param {any} opts
	 * @memberof TcpReader
	 */
	constructor(transporter: any, opts: any) {
		super();

		this.server = null;
		this.opts = opts;
		this.transporter = transporter;
		this.Promise = transporter.broker.Promise;
		this.logger = transporter.logger;

		this.sockets = [];
	}

	/**
	 * Listening a TCP port
	 *
	 * @returns {Promise}
	 * @memberof TcpReader
	 */
	listen(): Promise<any> {
		return new this.Promise((resolve, reject) => {
			const server = net.createServer(socket => this.onTcpClientConnected(socket));

			server.on("error", err => {
				this.logger.error("Server error.", err);

				if (reject) reject(err);
			});

			const h = { port: this.opts.port, exclusive: true };

			// Listening
			server.listen(h, () => {
				this.opts.port = (this.server.address() as import("net").AddressInfo).port;
				this.logger.info(`TCP server is listening on port ${this.opts.port}`);
				this.connected = true;

				resolve(this.opts.port);
				reject = null;
			});

			this.server = server;
		});
	}

	/**
	 * New TCP socket is received.
	 *
	 * @param {Socket} socket
	 * @memberof TcpReader
	 */
	onTcpClientConnected(socket: Socket) {
		this.sockets.push(socket);

		socket.setNoDelay(true);

		const address = socket.remoteAddress;
		//this.logger.info(address);
		this.logger.debug(`New TCP client connected from '${address}'`);

		const parser = new Parser(undefined, this.opts.maxPacketSize);
		socket.pipe(parser as any);

		parser.on("data", (type, message) => {
			//this.logger.info(`TCP data received from '${address}'. Type:`, type);
			//this.logger.info(message.toString());

			this.transporter.onIncomingMessage(type, message, socket);
		});

		parser.on("error", err => {
			this.logger.warn("Packet parser error!", err);
			this.closeSocket(socket);
		});

		socket.on("error", err => {
			this.logger.debug(`TCP client '${address}' error!`, err);
			this.closeSocket(socket);
		});

		socket.on("close", hadError => {
			this.logger.debug(`TCP client disconnected from '${address}'! Had error:`, !!hadError);
			this.closeSocket(socket);
		});

		this.emit("connect", socket);
	}

	/**
	 * Close a client socket
	 *
	 * @param {Socket} socket
	 */
	closeSocket(socket: Socket) {
		socket.destroy();

		this.sockets.splice(this.sockets.indexOf(socket), 1);
	}

	/**
	 * Close the TCP server.
	 *
	 * @memberof TcpReader
	 */
	close() {
		if (this.server && this.server.listening) {
			this.server.close();

			// Close all live sockets
			this.sockets.forEach(socket => socket.destroy());
			this.sockets = [];
		}
	}
}

export = TcpReader;
