/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import { BrokerOptionsError } from "../../errors";

import Base = require("./base");
import Counter = require("./counter");
import Gauge = require("./gauge");
import Histogram = require("./histogram");
import Info = require("./info");

const Types = {
	Base,
	Counter,
	Gauge,
	Histogram,
	Info
};

/**
 * Get MetricType class by name.
 *
 * @param {String} name
 */
function getByName(name: string) {
	/* istanbul ignore next */
	if (!name) return null;

	const n = Object.keys(Types).find(n => n.toLowerCase() == name.toLowerCase());
	if (n) return Types[n];
}

/**
 * Resolve metric type by name
 *
 * @param {string} type
 * @returns {BaseMetric}
 * @memberof ServiceBroker
 */
function resolve(type: string): typeof Base {
	const TypeClass = getByName(type);
	if (!TypeClass) throw new BrokerOptionsError(`Invalid metric type '${type}'.`, { type });

	return TypeClass;
}

/**
 * Register a custom metric types
 * @param {string} name
 * @param {BaseMetric} value
 */
function register(name: string, value: typeof Base) {
	Types[name] = value;
}

export = Object.assign(Types, { resolve, register });
