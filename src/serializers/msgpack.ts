/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type ServiceBroker from "../service-broker";

import BaseSerializer from "./base";

/**
 * MessagePack serializer for Moleculer
 *
 * https://github.com/mcollina/msgpack5
 *
 */
class MsgPackSerializer extends BaseSerializer {
	msgpack: any;
	/**
	 * Initialize Serializer
	 *
	 * @param {ServiceBroker} broker
	 *
	 * @memberof Serializer
	 */
	init(broker: ServiceBroker) {
		super.init(broker);

		try {
			this.msgpack = require("msgpack5")();
		} catch (err) {
			/* istanbul ignore next */
			this.broker.fatal(
				"The 'msgpack5' package is missing! Please install it with 'npm install msgpack5 --save' command!",
				err,
				true
			);
		}
	}

	/**
	 * Serializer a JS object to Buffer
	 *
	 * @param {Object} obj
	 * @returns {Buffer}
	 *
	 * @memberof Serializer
	 */
	serialize(obj: any) {
		const res = this.msgpack.encode(obj);
		return res;
	}

	/**
	 * Deserialize Buffer to JS object
	 *
	 * @param {any} buf
	 * @returns {Object}
	 *
	 * @memberof Serializer
	 */
	deserialize(buf: Buffer | string) {
		const res = this.msgpack.decode(buf);
		return res;
	}
}

export = MsgPackSerializer;
