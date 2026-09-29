/*
 * moleculer
 * Copyright (c) 2019 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import ActionHook from "./action-hook";
import Cacher from "./cacher";
import Validator from "./validator";
import Bulkhead from "./bulkhead";
import ContextTracker from "./context-tracker";
import CircuitBreaker from "./circuit-breaker";
import Timeout from "./timeout";
import Retry from "./retry";
import Fallback from "./fallback";
import ErrorHandler from "./error-handler";
import Metrics from "./metrics";
import Tracing from "./tracing";

import Debounce from "./debounce";
import Throttle from "./throttle";

import HotReload from "./hot-reload";

import Encryption from "./transmit/encryption";
import Compression from "./transmit/compression";

import TransitLogger from "./debugging/transit-logger";
import ActionLogger from "./debugging/action-logger";

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
