/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import { isObject, isString, isInheritedClass } from "../utils";
import { BrokerOptionsError } from "../errors";

import Base = require("./base");
import Fake = require("./fake");
import NATS = require("./nats");
import MQTT = require("./mqtt");
import Redis = require("./redis");
import AMQP = require("./amqp");
import AMQP10 = require("./amqp10");
import Kafka = require("./kafka");
import TCP = require("./tcp");

const Transporters = {
	Base,
	Fake,
	NATS,
	MQTT,
	Redis,
	AMQP,
	AMQP10,
	Kafka,
	TCP
};

function getByName(name: any) {
	/* istanbul ignore next */
	if (!name) return null;

	const n = Object.keys(Transporters).find(n => n.toLowerCase() == name.toLowerCase());
	if (n) return Transporters[n];
}

/**
 * Resolve transporter by name
 *
 * @param {Record<string,any>|string} opt
 * @returns {any}
 */
function resolve(opt: Record<string, any> | string): Base {
	if (isObject(opt) && isInheritedClass(opt, Transporters.Base)) {
		return opt as unknown as Base;
	} else if (isString(opt)) {
		let TransporterClass = getByName(opt);
		if (TransporterClass) return new TransporterClass();

		if (opt.startsWith("nats://")) TransporterClass = Transporters.NATS;
		else if (opt.startsWith("mqtt://") || opt.startsWith("mqtts://"))
			TransporterClass = Transporters.MQTT;
		else if (opt.startsWith("redis://") || opt.startsWith("rediss://"))
			TransporterClass = Transporters.Redis;
		else if (opt.startsWith("amqp://") || opt.startsWith("amqps://"))
			TransporterClass = Transporters.AMQP;
		else if (opt.startsWith("amqp10://")) TransporterClass = Transporters.AMQP10;
		else if (opt.startsWith("kafka://")) TransporterClass = Transporters.Kafka;
		else if (opt.startsWith("tcp://")) TransporterClass = Transporters.TCP;

		if (TransporterClass) return new TransporterClass(opt);
		else throw new BrokerOptionsError(`Invalid transporter type '${opt}'.`, { type: opt });
	} else if (isObject(opt)) {
		const opt2 = opt as Record<string, any>;
		const TransporterClass = getByName(opt2.type || "NATS");

		if (TransporterClass) return new TransporterClass(opt2.options);
		else
			throw new BrokerOptionsError(`Invalid transporter type '${opt2.type}'.`, {
				type: opt2.type
			});
	}

	return null;
}

function register(name: string, value: Base) {
	Transporters[name] = value;
}

export = Object.assign(Transporters, { resolve, register });
