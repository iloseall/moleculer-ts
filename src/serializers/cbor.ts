/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

declare namespace CborSerializer {
	export interface CborSerializerOptions {
		useRecords?: boolean;
		useTag259ForMaps?: boolean;
	}
}

import BaseSerializer = require("./base");
import _ = require("lodash");

/**
 * CBOR serializer for Moleculer
 *
 * https://github.com/kriszyp/cbor-x
 *
 */
class CborSerializer extends BaseSerializer {
	opts: CborSerializer.CborSerializerOptions;
	encoder: any;
	/**
	 * Creates an instance of CborSerializer.
	 *
	 * Available options:
	 * 	https://github.com/kriszyp/cbor-x#options
	 *
	 * @param {CborSerializerOptions} opts
	 *
	 * @memberof Serializer
	 */
	constructor(opts?: CborSerializer.CborSerializerOptions) {
		super(opts);
		/** @type {CborSerializerOptions} */
		this.opts = _.defaultsDeep(opts, { useRecords: false, useTag259ForMaps: false });
	}

	/**
	 * Initialize Serializer
	 *
	 * @param {any} broker
	 *
	 * @memberof Serializer
	 */
	init(broker) {
		super.init(broker);

		try {
			const Cbor = require("cbor-x");
			this.encoder = new Cbor.Encoder(this.opts);
		} catch (err) {
			/* istanbul ignore next */
			this.broker.fatal(
				"The 'cbor-x' package is missing! Please install it with 'npm install cbor-x --save' command!",
				err,
				true
			);
		}
	}

	/**
	 * Serializer a JS object to Buffer
	 *
	 * @param {any} obj
	 * @returns {Buffer}
	 *
	 * @memberof Serializer
	 */
	serialize(obj: any) {
		const res = this.encoder.encode(obj);
		return res;
	}

	/**
	 * Deserialize Buffer to JS object
	 *
	 * @param {Buffer} buf
	 * @returns {any}
	 *
	 * @memberof Serializer
	 */
	deserialize(buf: Buffer | string) {
		const res = this.encoder.decode(buf);
		return res;
	}
}

export = CborSerializer;
