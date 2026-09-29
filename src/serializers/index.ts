/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import { isObject, isString, isInheritedClass } from "../utils";
import { BrokerOptionsError } from "../errors";

import Serializer = require("./base");
import JSONSerializer = require("./json");
import JSONExtSerializer = require("./json-extended");
import MsgPackSerializer = require("./msgpack");
import NotepackSerializer = require("./notepack");
import CborSerializer = require("./cbor");

const Serializers = {
	Base: Serializer,
	JSON: JSONSerializer,
	JSONExt: JSONExtSerializer,
	MsgPack: MsgPackSerializer,
	Notepack: NotepackSerializer,
	CBOR: CborSerializer
};

function getByName(name: any) {
	/* istanbul ignore next */
	if (!name) return null;

	const n = Object.keys(Serializers).find(n => n.toLowerCase() == name.toLowerCase());
	if (n) return Serializers[n];
}

/**
 * Resolve serializer by name
 *
 * @param {Record<string,any>|string} opt
 * @returns {any}
 * @memberof ServiceBroker
 */
function resolve(opt: Record<string, any> | string | boolean): Serializer {
	if (isObject(opt) && isInheritedClass(opt, Serializers.Base)) {
		return opt as unknown as Serializer;
	} else if (isString(opt)) {
		const SerializerClass = getByName(opt);
		if (SerializerClass) return new SerializerClass();
		else throw new BrokerOptionsError(`Invalid serializer type '${opt}'.`, { type: opt });
	} else if (isObject(opt)) {
		const opt2 = opt as Record<string, any>;
		const SerializerClass = getByName(opt2.type || "JSON");
		if (SerializerClass) return new SerializerClass(opt2.options);
		else
			throw new BrokerOptionsError(`Invalid serializer type '${opt2.type}'.`, {
				type: opt2.type
			});
	}

	return new Serializers.JSON();
}

function register(name: string, value: Serializer) {
	Serializers[name] = value;
}

export = Object.assign(Serializers, { resolve, register });
