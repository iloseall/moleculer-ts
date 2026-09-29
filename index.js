/*
 * moleculer
 * Copyright (c) 2024 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

"use strict";

const {
	CIRCUIT_CLOSE,
	CIRCUIT_HALF_OPEN,
	CIRCUIT_HALF_OPEN_WAIT,
	CIRCUIT_OPEN
} = require("./dist/constants");

/**
 * !!! PLEASE NOTE !!!
 *
 * !! If you update this file, don't forget to update the same in the index.mjs file.
 */

module.exports = {
	ServiceBroker: require("./dist/service-broker"),
	Loggers: require("./dist/loggers"),
	Service: require("./dist/service"),
	Context: require("./dist/context"),

	Cachers: require("./dist/cachers"),

	Transporters: require("./dist/transporters"),
	Serializers: require("./dist/serializers"),
	Strategies: require("./dist/strategies"),
	Validators: require("./dist/validators"),
	TracerExporters: require("./dist/tracing/exporters"),
	MetricTypes: require("./dist/metrics/types"),
	MetricReporters: require("./dist/metrics/reporters"),
	METRIC: require("./dist/metrics/constants"),

	Transit: require("./dist/transit"),

	Registry: require("./dist/registry"),
	Discoverers: require("./dist/registry/discoverers"),

	Middlewares: require("./dist/middlewares"),

	Errors: require("./dist/errors"),

	Runner: require("./dist/runner"),
	Utils: require("./dist/utils"),

	CIRCUIT_CLOSE,
	CIRCUIT_HALF_OPEN,
	CIRCUIT_HALF_OPEN_WAIT,
	CIRCUIT_OPEN,

	MOLECULER_VERSION: require("./dist/service-broker").MOLECULER_VERSION,
	PROTOCOL_VERSION: require("./dist/service-broker").PROTOCOL_VERSION,
	INTERNAL_MIDDLEWARES: require("./dist/service-broker").INTERNAL_MIDDLEWARES
};
