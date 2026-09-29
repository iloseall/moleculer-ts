/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import BaseSerializer from "./base";

/**
 * JSON serializer for Moleculer
 *
 */
class JSONSerializer extends BaseSerializer {
	/**
	 * Creates an instance of JSONSerializer.
	 *
	 * @memberof JSONSerializer
	 */
	constructor() {
		super();
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
		return Buffer.from(JSON.stringify(obj));
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
		return JSON.parse(buf as string);
	}
}

export = JSONSerializer;
