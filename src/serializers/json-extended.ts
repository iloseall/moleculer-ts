/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

declare namespace JSONExtSerializer {
	export interface JSONExtSerializerOptionsCustomType {
		prefix: string;
		check: (v: any, key: string, obj: object) => boolean;
		serialize: (v: any, key: string, obj: object) => any;
		deserialize: (v: any, key: string) => any;
	}
	export interface JSONExtSerializerOptions {
		customs?: JSONExtSerializerOptionsCustomType[];
	}
}

import BaseSerializer from "./base";
//const { isDate } = require("../utils");
import { types } from "util";
const { isDate, isRegExp, isMap, isSet } = types;

const PREFIX_BIGINT = "[[BI]]";
const PREFIX_MAP = "[[MP]]";
const PREFIX_SET = "[[ST]]";
const PREFIX_DATE = "[[DT]]";
const PREFIX_BUFFER = "[[BF]]";
const PREFIX_REGEXP = "[[RE]]";
const PREFIX_ESCAPED_STRING = "[[ES]]";

/**
 * JSON Extended serializer for Moleculer
 *
 */
class JSONExtSerializer extends BaseSerializer {
	opts: JSONExtSerializer.JSONExtSerializerOptions;
	hasCustomTypes: boolean;
	/**
	 * Creates an instance of JSONExtSerializer.
	 *
	 * @param {JSONExtSerializerOptions} opts
	 * @memberof JSONExtSerializer
	 */
	constructor(opts) {
		super();

		/** @type {JSONExtSerializerOptions} */
		this.opts = opts || {};

		/** @type {boolean} */
		this.hasCustomTypes = this.opts?.customs?.length > 0;
	}

	/**
	 * JSON stringify replacer.
	 *
	 * @param {object} obj
	 * @param {String} key
	 * @param {any} value Already converted value
	 */
	replacer(obj, key, value) {
		if (value == null) return value;

		// Get the original value
		const v = obj[key];

		if (typeof v == "bigint") {
			return PREFIX_BIGINT + v;
		} else if (isDate(v)) {
			return PREFIX_DATE + v.valueOf();
		} else if (isMap(v)) {
			return PREFIX_MAP + this.serialize(Object.fromEntries(v));
		} else if (isSet(v)) {
			return PREFIX_SET + this.serialize(Array.from(v));
		} else if (isRegExp(v)) {
			return PREFIX_REGEXP + v.flags + "|" + v.source;
		} else if (Buffer.isBuffer(v)) {
			return PREFIX_BUFFER + v.toString("base64");
		} else if (this.hasCustomTypes) {
			for (const custom of this.opts.customs) {
				if (custom.check(v, key, obj)) {
					return "[[" + custom.prefix + "]]" + custom.serialize(v, key, obj);
				}
			}
		}

		// Escape plain strings that start with "[[" to avoid false positives during deserialization
		if (typeof value === "string" && value.charAt(0) === "[" && value.charAt(1) === "[") {
			return PREFIX_ESCAPED_STRING + value;
		}

		return value;
	}

	/**
	 * JSON.parse reviver.
	 *
	 * @param {String} key
	 * @param {any} value
	 */
	reviver(key, value) {
		if (typeof value === "string" && value.charAt(0) === "[" && value.charAt(1) === "[") {
			switch (value.slice(0, 6)) {
				case PREFIX_BIGINT:
					return BigInt(value.slice(6));
				case PREFIX_DATE:
					return new Date(Number(value.slice(6)));
				case PREFIX_MAP:
					return new Map(Object.entries(this.deserialize(value.slice(6))));
				case PREFIX_SET:
					return new Set(this.deserialize(value.slice(6)));
				case PREFIX_BUFFER:
					return Buffer.from(value.slice(6), "base64");
				case PREFIX_REGEXP: {
					const p = value.slice(6).split("|");
					const flags = p.shift();
					// eslint-disable-next-line security/detect-non-literal-regexp
					return new RegExp(p.join("|"), flags);
				}
				case PREFIX_ESCAPED_STRING:
					return value.slice(6);
				default: {
					if (this.hasCustomTypes) {
						for (const custom of this.opts.customs) {
							if (value.startsWith("[[" + custom.prefix + "]]")) {
								return custom.deserialize(
									value.slice(custom.prefix.length + 4),
									key
								);
							}
						}
					}
				}
			}
		}
		return value;
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
		const self = this;
		return Buffer.from(
			JSON.stringify(obj, function (key, value) {
				return self.replacer.call(self, this, key, value);
			})
		);
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
		const self = this;
		return JSON.parse(buf as string, function (key, value) {
			return self.reviver.call(self, key, value);
		});
	}
}

export = JSONExtSerializer;
