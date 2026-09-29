/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import { isObject, isString, isInheritedClass } from "../../utils";
import { BrokerOptionsError } from "../../errors";

import Base from "./base";
import Console from "./console";
import Datadog from "./datadog";
// import DatadogSimple = require("./datadog-simple");
import Event from "./event";
import Jaeger from "./jaeger";
import Zipkin from "./zipkin";
import NewRelic from "./newrelic";

const Exporters = {
	Base,
	Console,
	Datadog,
	// DatadogSimple,
	Event,
	Jaeger,
	Zipkin,
	NewRelic
};

function getByName(name: any) {
	/* istanbul ignore next */
	if (!name) return null;

	const n = Object.keys(Exporters).find(n => n.toLowerCase() == name.toLowerCase());
	if (n) return Exporters[n];
}

/**
 * Resolve exporter by name
 *
 * @param {Record<string,any>|string} opt
 * @returns {any}
 * @memberof ServiceBroker
 */
function resolve(opt: Record<string, any> | string): Base {
	if (isObject(opt) && isInheritedClass(opt, Exporters.Base)) {
		return opt as unknown as Base;
	} else if (isString(opt)) {
		const ExporterClass = getByName(opt);
		if (ExporterClass) return new ExporterClass();
		else throw new BrokerOptionsError(`Invalid tracing exporter type '${opt}'.`, { type: opt });
	} else if (isObject(opt)) {
		const opt2 = opt as Record<string, any>;
		const ExporterClass = getByName(opt2.type);
		if (ExporterClass) return new ExporterClass(opt2.options);
		else
			throw new BrokerOptionsError(`Invalid tracing exporter type '${opt2.type}'.`, {
				type: opt2.type
			});
	}

	throw new BrokerOptionsError(`Invalid tracing exporter type '${opt}'.`, { type: opt });
}

function register(name: string, value: Base) {
	Exporters[name] = value;
}

export = Object.assign(Exporters, { resolve, register });
