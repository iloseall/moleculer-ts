/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type ServiceBroker = require("../service-broker");

import BaseSerializer = require("./base");

/**
 * Notepack serializer for Moleculer
 *
 */
class NotepackSerializer extends BaseSerializer {
	codec: any;
	/**
	 * Initialize Serializer
	 *
	 * @param {any} broker
	 *
	 * @memberof Serializer
	 */
	init(broker: ServiceBroker) {
		super.init(broker);

		try {
			this.codec = require("notepack.io");
		} catch (err) {
			/* istanbul ignore next */
			this.broker.fatal(
				"The 'notepack.io' package is missing! Please install it with 'npm install notepack.io --save' command!",
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
		return this.codec.encode(obj);
	}

	/**
	 * Deserialize Buffer to JS object
	 *
	 * @param {Buffer|string} buf
	 * @returns {Object}
	 *
	 * @memberof Serializer
	 */
	deserialize(buf: Buffer | string) {
		return this.codec.decode(buf);
	}
}

export = NotepackSerializer;
