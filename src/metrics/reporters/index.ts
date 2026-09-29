/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import { isObject, isString, isInheritedClass } from "../../utils";
import { BrokerOptionsError } from "../../errors";

import Base = require("./base");
import Console = require("./console");
import CSV = require("./csv");
import Event = require("./event");
import Datadog = require("./datadog");
import Prometheus = require("./prometheus");
import StatsD = require("./statsd");

const Reporters = {
	Base,
	Console,
	CSV,
	Event,
	Datadog,
	Prometheus,
	StatsD
};

function getByName(name: any) {
	/* istanbul ignore next */
	if (!name) return null;

	const n = Object.keys(Reporters).find(n => n.toLowerCase() == name.toLowerCase());
	if (n) return Reporters[n];
}

/**
 * Resolve reporter by name
 *
 * @param {Record<string,any>|string} opt
 * @returns {any}
 * @memberof ServiceBroker
 */
function resolve(opt: Record<string, any> | string): Base {
	if (isObject(opt) && isInheritedClass(opt, Reporters.Base)) {
		return opt as unknown as Base;
	} else if (isString(opt)) {
		const ReporterClass = getByName(opt);
		if (ReporterClass) return new ReporterClass();
	} else if (isObject(opt)) {
		const opt2 = opt as Record<string, any>;
		const ReporterClass = getByName(opt2.type);
		if (ReporterClass) return new ReporterClass(opt2.options);
		else
			throw new BrokerOptionsError(`Invalid metric reporter type '${opt2.type}'.`, {
				type: opt2.type
			});
	}

	throw new BrokerOptionsError(`Invalid metric reporter type '${opt}'.`, { type: opt });
}

function register(name: string, value: Base) {
	Reporters[name] = value;
}

export = Object.assign(Reporters, { resolve, register });
