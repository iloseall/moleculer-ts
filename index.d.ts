// --- SERVICE BROKER ---

import ServiceBroker = require("./dist/service-broker");
import type {
	BrokerOptions,
	CallingOptions,
	TransporterConfig,
	CacherConfig,
	SerializerConfig,
	ReplOptions,
	NodeHealthStatus,
	MCallCallingOptions
} from "./dist/service-broker";

// --- SERVICE ---

import Service = require("./dist/service");
import type {
	ActionSchema,
	ActionHooks,
	ActionHandler,
	ActionParams,
	ActionVisibility,
	ActionParamTypes,
	ActionCacheOptions,
	EventSchema,
	EventSchemas,
	ServiceHooks,
	ServiceHooksAfter,
	ServiceSearchObj,
	ServiceSchema,
	ServiceSettingSchema,
	ServiceAction,
	ServiceActions,
	ServiceMethods
} from "./dist/service";

// --- CONTEXT ---

import Context = require("./dist/context");

// --- TRANSIT ---

import Transit = require("./dist/transit");
import * as Packet from "./dist/packets";

// --- RUNNER ---

import Runner = require("./dist/runner");
import type { RunnerFlags } from "./dist/runner";

// --- ERRORS ---

import * as Errors from "./dist/errors";

// --- UTILS ---

import * as Utils from "./dist/utils";

// --- CONSTANTS ---

import type {
	CIRCUIT_CLOSE,
	CIRCUIT_HALF_OPEN,
	CIRCUIT_HALF_OPEN_WAIT,
	CIRCUIT_OPEN
} from "./dist/constants";

// --- CACHERS ---

import * as Cachers from "./dist/cachers";

// --- LOGGERS ---

import * as Loggers from "./dist/loggers";
import type { LogLevels } from "./dist/loggers/base";
import type { Logger, LoggerConfig } from "./dist/logger-factory";

// --- METRICS ---

import * as MetricTypes from "./dist/metrics/types";
import * as MetricReporters from "./dist/metrics/reporters";
import MetricRegistry = require("./dist/metrics/registry");
import * as METRIC from "./dist/metrics/constants";

// --- MIDDLEWARES ---

import type { CallMiddlewareHandler, Middleware } from "./dist/middleware";

// --- SERVICE REGISTRY ---

import Registry = require("./dist/registry");

import type EndpointList = require("./dist/registry/endpoint-list");
import type Endpoint = require("./dist/registry/endpoint");
import type ActionEndpoint = require("./dist/registry/endpoint-action");
import type EventEndpoint = require("./dist/registry/endpoint-event");

import * as Discoverers from "./dist/registry/discoverers";

// --- SERIALIZERS ---

import * as Serializers from "./dist/serializers";

// --- STRATEGIES ---

import * as Strategies from "./dist/strategies";

// --- TRACING ---

import type { Tracer, Span, TracerOptions } from "./dist/tracing";
import * as TracerExporters from "./dist/tracing/exporters";

// --- TRANSPORTERS ---

import * as Transporters from "./dist/transporters";

// --- VALIDATORS ---

import * as Validators from "./dist/validators";
import type { ValidatorNames } from "./dist/validators/base";

declare namespace Moleculer {
	export {
		ServiceBroker,
		BrokerOptions,
		CallingOptions,
		TransporterConfig,
		CacherConfig,
		SerializerConfig,
		ReplOptions,
		NodeHealthStatus,
		MCallCallingOptions
	};

	export {
		Service,
		ActionSchema,
		ActionHooks,
		ActionHandler,
		ActionParams,
		ActionVisibility,
		ActionParamTypes,
		ActionCacheOptions,
		EventSchema,
		EventSchemas,
		ServiceHooks,
		ServiceHooksAfter,
		ServiceSearchObj,
		ServiceSchema,
		ServiceSettingSchema,
		ServiceAction,
		ServiceActions,
		ServiceMethods
	};

	export { Context };

	export { Transit, Packet };

	export { Runner, RunnerFlags };

	export { Errors };

	export { Utils };

	export { CIRCUIT_CLOSE, CIRCUIT_HALF_OPEN, CIRCUIT_HALF_OPEN_WAIT, CIRCUIT_OPEN };

	export const MOLECULER_VERSION: string;
	export const PROTOCOL_VERSION: string;
	export const INTERNAL_MIDDLEWARES: string[];

	export { Cachers };

	export { Loggers, Logger, LoggerConfig, LogLevels };

	export { MetricTypes, MetricReporters, MetricRegistry, METRIC };

	export { CallMiddlewareHandler, Middleware };

	export { Registry, Discoverers, EndpointList, Endpoint, ActionEndpoint, EventEndpoint };

	export { Serializers };

	export { Strategies };

	export { Tracer, Span, TracerOptions, TracerExporters };

	export { Transporters };

	export { Validators, ValidatorNames };
}

export = Moleculer;
