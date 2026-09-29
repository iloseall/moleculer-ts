/*
 * moleculer
 * Copyright (c) 2019 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import ActionHook = require("./action-hook");
import Cacher = require("./cacher");
import Validator = require("./validator");
import Bulkhead = require("./bulkhead");
import ContextTracker = require("./context-tracker");
import CircuitBreaker = require("./circuit-breaker");
import Timeout = require("./timeout");
import Retry = require("./retry");
import Fallback = require("./fallback");
import ErrorHandler = require("./error-handler");
import Metrics = require("./metrics");
import Tracing = require("./tracing");

import Debounce = require("./debounce");
import Throttle = require("./throttle");

import HotReload = require("./hot-reload");

import Encryption = require("./transmit/encryption");
import Compression = require("./transmit/compression");

import TransitLogger = require("./debugging/transit-logger");
import ActionLogger = require("./debugging/action-logger");

const Middlewares = {
	ActionHook,
	Cacher,
	Validator,
	Bulkhead,
	ContextTracker,
	CircuitBreaker,
	Timeout,
	Retry,
	Fallback,
	ErrorHandler,
	Metrics,
	Tracing,

	Debounce,
	Throttle,

	HotReload,

	Transmit: {
		Encryption,
		Compression
	},

	Debugging: {
		TransitLogger,
		ActionLogger
	}
};

function register(name: string, value: any) {
	Middlewares[name] = value;
}

export = Object.assign(Middlewares, { register });
