/*
 * moleculer
 * Copyright (c) 2025 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import { EventEmitter2 } from "eventemitter2";
import type { ContextParentSpan } from "./context";
import type BaseCacher from "./cachers/base";
import type BaseLogger from "./loggers/base";
import type { LogLevels, LoggerOptions } from "./loggers/base";
import type { Logger, LoggerConfig } from "./logger-factory";
import type { MetricRegistryOptions } from "./metrics/registry";
import type { Middleware, MiddlewareCallHandlerOptions } from "./middleware";
import type ServiceRegistry from "./registry";
import type BaseSerializer from "./serializers/base";
import type { BulkheadOptions, ServiceSchema, ServiceSettingSchema } from "./service";
import type { TracerOptions } from "./tracing/tracer";
import type BaseTransporter from "./transporters/base";
import type BaseValidator from "./validators/base";
import type { ValidatorNames, ValidatorOptions } from "./validators/base";
import type Context from "./context";
import type ActionEndpoint from "./registry/endpoint-action";
import type EventEndpoint from "./registry/endpoint-event";
import type Service from "./service";
import type Runner from "./runner";
import type { ServiceDependency } from "./service";
import type { TcpTransporterOptions } from "./transporters/tcp";
import type { NatsTransporterOptions } from "./transporters/nats";
import type { AmqpTransporterOptions } from "./transporters/amqp";
import type { Amqp10TransporterOptions } from "./transporters/amqp10";
import type { MqttTransporterOptions } from "./transporters/mqtt";
import type { KafkaTransporterOptions } from "./transporters/kafka";
import type { RedisTransporterOptions } from "./transporters/redis";
import type { MemoryCacherOptions } from "./cachers/memory";
import type { MemoryLRUCacherOptions } from "./cachers/memory-lru";
import type { RedisCacherOptions } from "./cachers/redis";
import type { JSONExtSerializerOptions } from "./serializers/json-extended";
import type { CborSerializerOptions } from "./serializers/cbor";
import type ServiceItem from "./registry/service-item";
import type { UserInfo } from "os";
import type { MoleculerError, Regenerator as ErrorRegenerator } from "./errors";
import type { Readable } from "stream";

declare namespace ServiceBroker {
	type BrokerSyncLifecycleHandler = (broker: ServiceBroker) => void;
	type BrokerAsyncLifecycleHandler = (broker: ServiceBroker) => void | Promise<void>;

	interface BrokerErrorHandlerInfoAction {
		ctx: Context;
		service: Context["service"];
		action: Context["action"];
	}
	interface BrokerErrorHandlerInfoBroker {
		actionName: string;
		params: unknown;
		opts: CallingOptions;
		nodeId?: string;
	}
	type BrokerErrorHandlerInfo = BrokerErrorHandlerInfoAction | BrokerErrorHandlerInfoBroker;
	type BrokerErrorHandler = (
		this: ServiceBroker,
		err: Error,
		info: BrokerErrorHandlerInfo
	) => void;

	type TransporterConfig =
		| {
				type: "AMQP";
				options?: AmqpTransporterOptions;
		  }
		| {
				type: "AMQP10";
				options?: Amqp10TransporterOptions;
		  }
		| {
				type: "Fake";
		  }
		| {
				type: "Kafka";
				options?: KafkaTransporterOptions;
		  }
		| {
				type: "MQTT";
				options?: MqttTransporterOptions;
		  }
		| {
				type: "NATS";
				options?: NatsTransporterOptions;
		  }
		| {
				type: "Redis";
				options?: RedisTransporterOptions;
		  }
		| {
				type: "TCP";
				options?: TcpTransporterOptions;
		  };

	type TransporterType = TransporterConfig["type"];

	type CacherConfig =
		| {
				type: "Memory";
				options?: MemoryCacherOptions;
		  }
		| {
				type: "MemoryLRU";
				options?: MemoryLRUCacherOptions;
		  }
		| {
				type: "Redis";
				options?: RedisCacherOptions;
		  };

	type CacherType = CacherConfig["type"];

	type SerializerConfig =
		| {
				type: "JSON";
		  }
		| {
				type: "JSONExt";
				options?: JSONExtSerializerOptions;
		  }
		| {
				type: "MsgPack";
		  }
		| {
				type: "Notepack";
		  }
		| {
				type: "CBOR";
				options?: CborSerializerOptions;
		  };

	type SerializerType = SerializerConfig["type"];

	export interface BrokerOptions {
		namespace?: string | null;
		nodeID?: string | null;

		logger?:
			| BaseLogger<LoggerOptions>
			| Console
			| LoggerConfig
			| (LoggerConfig | string)[]
			| string
			| boolean
			| null;
		logLevel?: LogLevels | LogLevelConfig | null;

		transporter?: BaseTransporter | TransporterType | TransporterConfig | null;
		requestTimeout?: number;
		retryPolicy?: RetryPolicyOptions;

		contextParamsCloning?: boolean;
		maxCallLevel?: number;
		heartbeatInterval?: number;
		heartbeatTimeout?: number;

		tracking?: BrokerTrackingOptions;

		disableBalancer?: boolean;

		registry?: ServiceRegistry.RegistryOptions;

		circuitBreaker?: BrokerCircuitBreakerOptions;

		bulkhead?: BulkheadOptions;

		transit?: Transit.TransitOptions;

		uidGenerator?: () => string;

		errorHandler?: BrokerErrorHandler | null;

		cacher?: boolean | BaseCacher<any> | CacherType | CacherConfig | null;
		serializer?: BaseSerializer | SerializerType | SerializerConfig | null;
		validator?: boolean | BaseValidator | ValidatorNames | ValidatorOptions | null;
		errorRegenerator?: ErrorRegenerator | null;

		metrics?: boolean | MetricRegistryOptions;
		tracing?: boolean | TracerOptions;

		internalServices?:
			| boolean
			| {
					$node: Partial<ServiceSchema>;
			  };
		internalMiddlewares?: boolean;

		dependencyInterval?: number;
		dependencyTimeout?: number;

		hotReload?: boolean | HotReloadOptions;

		middlewares?: (Middleware | string)[];

		replOptions?: ReplOptions | null;

		metadata?: Record<string, any>;

		ServiceFactory?: typeof Service;
		ContextFactory?: typeof Context;
		Promise?: PromiseConstructor;

		created?: BrokerSyncLifecycleHandler;
		started?: BrokerAsyncLifecycleHandler;
		stopped?: BrokerAsyncLifecycleHandler;

		skipProcessEventRegistration?: boolean;
		maxSafeObjectSize?: number | null;
	}

	export interface ReplCustomCommand {
		command: string;
		description?: string | null;
		alias?: string | string[] | null;
		allowUnknownParams?: boolean | null;
		parse?: Function | null;
		options?: Array<{
			option?: string | null;
			description?: string | null;
		}>;
		action: (broker: ServiceBroker, args: string[], helpers: any) => Promise<void> | void;
	}

	export interface ReplOptions {
		customCommands?: ReplCustomCommand[];
		delimiter?: string;
	}

	export interface BrokerCircuitBreakerOptions {
		enabled?: boolean;
		threshold?: number;
		windowTime?: number;
		minRequestCount?: number;
		halfOpenTime?: number;
		check?: CheckRetryable;
	}

	export interface PongResponse {
		nodeID: string;
		elapsedTime: number;
		timeDiff: number;
	}

	export interface PongResponses {
		[name: string]: PongResponse;
	}

	export interface HotReloadOptions {
		modules?: string[];
	}

	export interface LogLevelConfig {
		[module: string]: boolean | LogLevels;
	}

	export interface BrokerTrackingOptions {
		enabled?: boolean;
		shutdownTimeout?: number;
	}

	export interface NodeHealthStatus {
		cpu: {
			load1: number;
			load5: number;
			load15: number;
			cores: number;
			utilization: number;
		};
		mem: {
			free: number;
			total: number;
			percent: number;
		};
		os: {
			uptime: number;
			type: string;
			release: string;
			hostname: string;
			arch: string;
			platform: string;
			user: UserInfo<string> | {};
		};
		process: {
			pid: NodeJS.Process["pid"];
			memory: NodeJS.MemoryUsage;
			uptime: number;
			argv: string[];
		};
		client: {
			type: string;
			version: string;
			langVersion: NodeJS.Process["version"];
		};
		net: {
			ip: string[];
		};
		time: {
			now: number;
			iso: string;
			utc: string;
		};
	}

	export type CheckRetryable = (err: MoleculerError | Error) => boolean;

	export interface RetryPolicyOptions {
		enabled?: boolean;
		retries?: number;
		delay?: number;
		maxDelay?: number;
		factor?: number;
		check?: CheckRetryable;
	}

	export type FallbackHandler = (ctx: Context, err: MoleculerError) => Promise<any>;
	export type FallbackResponse = string | number | Record<string, any>;
	export type FallbackResponseHandler = (ctx: Context, err: MoleculerError) => Promise<any>;

	export interface CallingOptions {
		timeout?: number | null;
		retries?: number | null;
		fallbackResponse?: FallbackResponse | FallbackResponse[] | FallbackResponseHandler;
		nodeID?: string;
		meta?: Record<string, any>;
		parentSpan?: ContextParentSpan;
		parentCtx?: Context;
		requestID?: string;
		tracking?: boolean;
		paramsCloning?: boolean;
		caller?: string;
		headers?: Record<string, any>;
		stream?: Readable;
		ctx?: Context;
	}

	export interface MCallCallingOptions extends CallingOptions {
		settled?: boolean;
	}

	export interface CallDefinition<P extends Record<string, any> = Record<string, any>> {
		action: string;
		params: P;
	}

	export interface MCallDefinition<
		P extends Record<string, any> = Record<string, any>
	> extends CallDefinition<P> {
		options?: CallingOptions;
	}
}

import _ from "lodash";
import { globSync } from "glob";
import path from "path";
import { format } from "util";

import Transit from "./transit";
import Registry from "./registry";
import * as E from "./errors";
import * as utils from "./utils";
import LoggerFactory from "./logger-factory";
import Validators from "./validators";
//const AsyncStorage 			= require("./async-storage");

import Cachers from "./cachers";
import Transporters from "./transporters";
import Serializers from "./serializers";
import * as Errors from "./errors";
import * as H from "./health";
import MiddlewareHandler from "./middleware";
import cpuUsage from "./cpu-usage";

import MetricRegistry from "./metrics/registry";
import { METRIC } from "./metrics";
import Tracer from "./tracing/tracer";
import * as C from "./constants";

/**
 * Default broker options
 *
 * @type {BrokerOptions}
 */
const defaultOptions = {
	namespace: "",
	nodeID: null,

	logger: true,
	logLevel: null,

	transporter: null, //"TCP",

	errorRegenerator: null,

	requestTimeout: 0 * 1000,
	retryPolicy: {
		enabled: false,
		retries: 5,
		delay: 100,
		maxDelay: 1000,
		factor: 2,
		// @ts-ignore
		check: err => err && !!err.retryable
	},

	contextParamsCloning: false,
	maxCallLevel: 0,
	heartbeatInterval: 10,
	heartbeatTimeout: 30,

	tracking: {
		enabled: false,
		shutdownTimeout: 5000
	},

	disableBalancer: false,

	registry: {
		strategy: "RoundRobin",
		preferLocal: true,
		stopDelay: 100,
		discoverer: "Local"
	},

	circuitBreaker: {
		enabled: false,
		threshold: 0.5,
		windowTime: 60,
		minRequestCount: 20,
		halfOpenTime: 10 * 1000,
		// @ts-ignore
		check: err => err && err.code >= 500
	},

	bulkhead: {
		enabled: false,
		concurrency: 10,
		maxQueueSize: 100
	},

	transit: {
		maxQueueSize: 50 * 1000, // 50k ~ 400MB,
		maxChunkSize: 256 * 1024, // 256KB
		disableReconnect: false,
		disableVersionCheck: false,
		serviceChangedDebounceTime: 1000
	},

	uidGenerator: null,

	errorHandler: null,

	cacher: null,
	serializer: null,

	validator: true,

	metrics: { enabled: false },
	tracing: { enabled: false },

	internalServices: true,
	internalMiddlewares: true,

	dependencyInterval: 1000,
	dependencyTimeout: 0,

	hotReload: false,

	middlewares: null,

	replOptions: null,

	metadata: {},

	skipProcessEventRegistration: false,

	/**
	 * Maximum size of objects that can be serialized
	 *
	 * On serialization process, check each object property size (based on length or size property value)
	 * and trim it, if object size bigger than maxSafeObjectSize value
	 *
	 * @type {(number|null)}
	 */
	maxSafeObjectSize: null
	// ServiceFactory: null,
	// ContextFactory: null
	// Promise: null
};

const INTERNAL_MIDDLEWARES = [
	"ActionHook",
	"Validator",
	"Bulkhead",
	"Cacher",
	"ContextTracker",
	"CircuitBreaker",
	"Timeout",
	"Retry",
	"Fallback",
	"ErrorHandler",
	"Tracing",
	"Metrics",
	"Debounce",
	"Throttle"
];

/**
 * Service broker class
 *
 * @class ServiceBroker
 */
class ServiceBroker {
	loggerFactory: LoggerFactory;
	_closeFn: any;
	static MOLECULER_VERSION: string;
	static PROTOCOL_VERSION: string;
	static INTERNAL_MIDDLEWARES: string[];
	static defaultOptions: ServiceBroker.BrokerOptions;
	MOLECULER_VERSION: string;
	PROTOCOL_VERSION: string;
	options: ServiceBroker.BrokerOptions;
	Promise: PromiseConstructor;
	ServiceFactory: typeof Service;
	ContextFactory: typeof Context;
	namespace: string;
	metadata: Record<string, any>;
	nodeID: string;
	instanceID: string;
	logger: Logger;
	services: Service[];
	localBus: EventEmitter2;
	metrics: MetricRegistry;
	middlewares: MiddlewareHandler;
	registry: ServiceRegistry;
	cacher?: BaseCacher<any>;
	serializer?: BaseSerializer;
	validator?: BaseValidator;
	errorRegenerator?: ErrorRegenerator;
	tracer: Tracer;
	transit?: Transit;
	started: boolean;
	servicesStarting: boolean;
	stopping: boolean;
	runner?: Runner;
	/**
	 * Creates an instance of ServiceBroker.
	 *
	 * @param {BrokerOptions} options
	 *
	 * @memberof ServiceBroker
	 */
	constructor(options?: ServiceBroker.BrokerOptions) {
		try {
			this.options = _.defaultsDeep(options, defaultOptions);

			// Custom Promise lib
			if (this.options.Promise) {
				this.Promise = this.options.Promise;
			} else {
				// Use native Promise lib
				this.Promise = Promise;
			}
			utils.polyfillPromise(this.Promise);

			// Broker started flag
			this.started = false;

			/** @type {Boolean} Broker is starting inital services flag*/
			this.servicesStarting = false;

			/** @type {Boolean} Broker stopping flag*/
			this.stopping = false;

			// Class factories
			this.ServiceFactory = this.options.ServiceFactory || require("./service");
			this.ContextFactory = this.options.ContextFactory || require("./context");

			// Namespace
			this.namespace = this.options.namespace || "";

			// Metadata
			this.metadata = this.options.metadata || {};

			// Self nodeID
			this.nodeID = this.options.nodeID || utils.getNodeID();

			// Instance ID
			this.instanceID = utils.generateToken();

			// Internal maps
			this.services = [];

			// Internal event bus
			this.localBus = new EventEmitter2({
				wildcard: true,
				maxListeners: 100
			});

			// Log Factory
			this.loggerFactory = new LoggerFactory(this);
			this.loggerFactory.init(this.options.logger);

			// Logger
			this.logger = this.getLogger("broker");

			this.logger.info(`Moleculer v${this.MOLECULER_VERSION} is starting...`);
			this.logger.info(`Namespace: ${this.namespace || "<not defined>"}`);
			this.logger.info(`Node ID: ${this.nodeID}`);

			// Async storage for Contexts
			//this.scope = new AsyncStorage(this);

			// Metrics Registry
			this.metrics = new MetricRegistry(this, this.options.metrics);
			this.metrics.init(this);
			this.registerMoleculerMetrics();

			// Middleware handler
			this.middlewares = new MiddlewareHandler(this);
			this.middlewares.middlewareInterceptors["call"] = this.interceptCallMiddleware;

			// Service registry
			this.registry = new Registry(this);

			// Cacher
			this.cacher = Cachers.resolve(this.options.cacher);
			if (this.cacher) {
				this.cacher.init(this);

				const name = utils.getConstructorName(this.cacher);
				this.logger.info(`Cacher: ${name}`);
			}

			// Serializer
			this.serializer = Serializers.resolve(this.options.serializer);
			this.serializer.init(this);

			// Error regenerator
			this.errorRegenerator = Errors.resolveRegenerator(this.options.errorRegenerator);
			this.errorRegenerator.init(this);

			const serializerName = utils.getConstructorName(this.serializer);
			this.logger.info(`Serializer: ${serializerName}`);

			// Validator
			if (this.options.validator) {
				this.validator = Validators.resolve(this.options.validator as any);
				if (this.validator) {
					const validatorName = utils.getConstructorName(this.validator);
					this.logger.info(`Validator: ${validatorName}`);
					this.validator.init(this);
				}
			}

			// Tracing
			this.tracer = new Tracer(this, this.options.tracing);
			this.tracer.init();

			// Register middlewares
			this.registerMiddlewares(this.options.middlewares as any);

			// Transit & Transporter
			if (this.options.transporter) {
				const tx = Transporters.resolve(this.options.transporter);
				this.transit = new Transit(this, tx, this.options.transit);

				const txName = utils.getConstructorName(tx);
				this.logger.info(`Transporter: ${txName}`);

				if (this.options.disableBalancer) {
					if (tx.hasBuiltInBalancer) {
						this.logger.info("The broker built-in balancer is DISABLED.");
					} else {
						this.logger.warn(
							`The ${txName} has no built-in balancer. Broker balancer is ENABLED.`
						);
						this.options.disableBalancer = false;
					}
				}
			}

			// Change the call method if balancer is disabled
			if (this.options.disableBalancer) {
				this.call = this.callWithoutBalancer;
			}

			if (this.options.transit.serviceChangedDebounceTime > 0) {
				// Create debounced localServiceChanged
				const origLocalServiceChanged = this.localServiceChanged;
				this.localServiceChanged = _.debounce(
					() => origLocalServiceChanged.call(this),
					this.options.transit.serviceChangedDebounceTime
				);
			}

			this.registry.init();

			// Register internal actions
			if (this.options.internalServices)
				this.registerInternalServices(this.options.internalServices as any);

			// Call `created` event handler in middlewares
			this.callMiddlewareHookSync("created", [this]);

			// Call `created` event handler from options
			if (utils.isFunction(this.options.created)) this.options.created(this);

			// Graceful exit
			this._closeFn = () => {
				/* istanbul ignore next */
				this.stop()
					.catch(err => this.logger.error(err))
					.then(() => process.exit(0));
			};

			process.setMaxListeners(0);
			if (this.options.skipProcessEventRegistration === false) {
				process.on("beforeExit", this._closeFn);
				process.on("exit", this._closeFn);
				process.on("SIGINT", this._closeFn);
				process.on("SIGTERM", this._closeFn);
			}
		} catch (err) {
			if (this.logger) this.fatal("Unable to create ServiceBroker.", err, true);
			else {
				/* eslint-disable-next-line no-console */
				console.error("Unable to create ServiceBroker.", err);
				process.exit(1);
			}
		}
	}

	/**
	 * Register middlewares (user & internal)
	 *
	 * @param {MiddlewareHandler.Middleware[]} userMiddlewares
	 * @memberof ServiceBroker
	 */
	registerMiddlewares(userMiddlewares: MiddlewareHandler.Middleware[]) {
		// Register user middlewares
		if (Array.isArray(userMiddlewares) && userMiddlewares.length > 0) {
			_.compact(userMiddlewares).forEach(mw => this.middlewares.add(mw));
		}

		if (this.options.internalMiddlewares) {
			// Register internal middlewares
			INTERNAL_MIDDLEWARES.forEach(mw => this.middlewares.add(mw));

			if (this.options.hotReload) {
				// 14. Hot Reload
				this.middlewares.add("HotReload");
			}
		}
		this.logger.info(`Registered ${this.middlewares.count()} middleware(s).`);

		this.createService = this.wrapMethod("createService", this.createService);
		this.registerLocalService = this.wrapMethod(
			"registerLocalService",
			this.registerLocalService
		);
		this.destroyService = this.wrapMethod("destroyService", this.destroyService);
		this.call = this.wrapMethod("call", this.call);
		this.callWithoutBalancer = this.wrapMethod("call", this.callWithoutBalancer);
		this.mcall = this.wrapMethod("mcall", this.mcall);
		this.emit = this.wrapMethod("emit", this.emit);
		this.broadcast = this.wrapMethod("broadcast", this.broadcast);
		this.broadcastLocal = this.wrapMethod("broadcastLocal", this.broadcastLocal);

		this.metrics.set(METRIC.MOLECULER_BROKER_MIDDLEWARES_TOTAL, this.middlewares.count());
	}

	/**
	 * It is necessary to keep the context of the call when using call middleware.
	 */
	interceptCallMiddleware(createMiddleware) {
		return next => {
			let result = null;
			const call = createMiddleware((...args) => (result = next(...args)));
			return (...args) => {
				const promise = call(...args);
				if (result) promise.ctx = result.ctx;
				return promise;
			};
		};
	}

	/**
	 * Register Moleculer Core metrics.
	 */
	registerMoleculerMetrics() {
		if (!this.isMetricsEnabled()) return;

		// --- MOLECULER NODE METRICS ---

		this.metrics
			.register({
				name: METRIC.MOLECULER_NODE_TYPE,
				type: METRIC.TYPE_INFO,
				description: "Moleculer implementation type"
			})
			.set("nodejs");
		this.metrics
			.register({
				name: METRIC.MOLECULER_NODE_VERSIONS_MOLECULER,
				type: METRIC.TYPE_INFO,
				description: "Moleculer version number"
			})
			.set(ServiceBroker.MOLECULER_VERSION);
		this.metrics
			.register({
				name: METRIC.MOLECULER_NODE_VERSIONS_PROTOCOL,
				type: METRIC.TYPE_INFO,
				description: "Moleculer protocol version"
			})
			.set(ServiceBroker.PROTOCOL_VERSION);

		// --- MOLECULER BROKER METRICS ---

		this.metrics
			.register({
				name: METRIC.MOLECULER_BROKER_NAMESPACE,
				type: METRIC.TYPE_INFO,
				description: "Moleculer namespace"
			})
			.set(this.namespace);
		this.metrics
			.register({
				name: METRIC.MOLECULER_BROKER_STARTED,
				type: METRIC.TYPE_GAUGE,
				description: "ServiceBroker started"
			})
			.set(0);
		this.metrics
			.register({
				name: METRIC.MOLECULER_BROKER_LOCAL_SERVICES_TOTAL,
				type: METRIC.TYPE_GAUGE,
				description: "Number of local services"
			})
			.set(0);
		this.metrics
			.register({
				name: METRIC.MOLECULER_BROKER_MIDDLEWARES_TOTAL,
				type: METRIC.TYPE_GAUGE,
				description: "Number of local middlewares"
			})
			.set(0);
	}

	/**
	 * Start broker. If has transporter, transporter.connect will be called.
	 *
	 * @memberof ServiceBroker
	 */
	start(): Promise<void> {
		const startTime = Date.now();

		return this.Promise.resolve()
			.then(() => {
				//this.tracer.restartScope();
				//this.scope.enable();
			})
			.then(() => {
				return this.callMiddlewareHook("starting", [this]);
			})
			.then(() => {
				if (this.transit) return this.transit.connect();
			})
			.then(() => {
				// Call service `started` handlers
				const startingServices = this.services.map(svc => svc._start.call(svc));
				// Set servicesStarting, so new services created from now on will be started when registered
				this.servicesStarting = true;
				// Wait for services `started` handlers
				return this.Promise.all(startingServices).catch(err => {
					/* istanbul ignore next */
					this.logger.error("Unable to start all services.", err);
					throw err;
				});
			})
			.then(() => {
				this.started = true;
				this.servicesStarting = false;
				this.metrics.set(METRIC.MOLECULER_BROKER_STARTED, 1);
				this.broadcastLocal("$broker.started");
			})
			.then(() => {
				if (this.transit) return this.transit.ready();
			})
			.then(() => {
				return this.callMiddlewareHook("started", [this]);
			})
			.then(() => {
				if (utils.isFunction(this.options.started)) return this.options.started(this);
			})
			.then(() => {
				const duration = Date.now() - startTime;
				this.logger.info(
					`✔ ServiceBroker with ${
						this.services.length
					} service(s) started successfully in ${utils.humanize(duration)}.`
				);
			});
	}

	/**
	 * Stop broker. If has transporter, transporter.disconnect will be called.
	 *
	 * @memberof ServiceBroker
	 */
	stop(): Promise<any> {
		this.started = false;
		return this.Promise.resolve()
			.then(() => {
				if (this.transit) {
					this.registry.regenerateLocalRawInfo(true, true);
					// Send empty node info in order to block incoming requests
					return this.registry.discoverer.sendLocalNodeInfo();
				}
			})
			.then(() => {
				return this.Promise.delay(this.options.registry.stopDelay);
			})
			.then(() => {
				this.stopping = true;

				return this.callMiddlewareHook("stopping", [this], { reverse: true });
			})
			.then(() => {
				// Call service `stopped` handlers
				return this.Promise.all(this.services.map(svc => svc._stop.call(svc))).catch(
					err => {
						/* istanbul ignore next */
						this.logger.error("Unable to stop all services.", err);

						this.broadcastLocal("$broker.error", {
							error: err,
							module: "broker",
							type: C.FAILED_STOPPING_SERVICES
						});
					}
				);
			})
			.then(() => {
				if (this.transit) {
					return this.transit.disconnect();
				}
			})
			.then(() => {
				if (this.cacher) {
					return this.cacher.close();
				}
			})
			.then(() => {
				if (this.metrics) {
					return this.metrics.stop();
				}
			})
			.then((): any => {
				if (this.tracer) {
					return this.tracer.stop();
				}
			})
			.then(() => {
				return this.registry.stop();
			})
			.then(() => {
				return this.callMiddlewareHook("stopped", [this], { reverse: true });
			})
			.then(() => {
				if (utils.isFunction(this.options.stopped)) return this.options.stopped(this);
			})
			.catch(err => {
				/* istanbul ignore next */
				this.logger.error(err);
			})
			.then(() => {
				this.logger.info("ServiceBroker is stopped. Good bye.");
				this.metrics.set(METRIC.MOLECULER_BROKER_STARTED, 0);

				this.broadcastLocal("$broker.stopped");

				if (this.options.skipProcessEventRegistration === false) {
					process.removeListener("beforeExit", this._closeFn);
					process.removeListener("exit", this._closeFn);
					process.removeListener("SIGINT", this._closeFn);
					process.removeListener("SIGTERM", this._closeFn);
				}
			})
			.then(() => {
				return this.loggerFactory.stop();
			})
			.catch(() => {
				// Silent
			});
	}

	/**
	 * Switch the console to REPL mode.
	 *
	 * @example
	 * broker.start().then(() => broker.repl());
	 * @returns
	 */
	repl() {
		let repl;
		try {
			repl = require("moleculer-repl");
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(
				"The 'moleculer-repl' package is missing. Please install it with 'npm install moleculer-repl' command."
			);
			this.logger.error(
				"The 'moleculer-repl' package is missing. Please install it with 'npm install moleculer-repl' command."
			);
			this.logger.debug("ERROR", error);
			return;
		}

		if (repl) {
			return repl(this, this.options.replOptions);
		}
	}

	/**
	 * Global error handler.
	 *
	 * @param {Error} err
	 * @param {object} info
	 * @returns
	 * @memberof ServiceBroker
	 */
	errorHandler(err: Error, info: ServiceBroker.BrokerErrorHandlerInfo) {
		if (this.options.errorHandler) {
			return this.options.errorHandler.call(this, err, info);
		}

		throw err;
	}

	/**
	 * Wrap a method with middlewares
	 *
	 * @param {string} name
	 * @param {Function} handler
	 * @param {any=} bindTo
	 * @param {Object=} opts
	 * @returns {any}
	 *
	 * @memberof ServiceBroker
	 */
	wrapMethod(name: string, handler: any, bindTo?: any, opts?: any) {
		return this.middlewares.wrapMethod(name, handler, bindTo, opts);
	}

	/**
	 * Call a handler asynchronously in all middlewares
	 *
	 * @param {String} name
	 * @param {Array<any>} args
	 * @param {Object=} opts
	 * @returns {Promise}
	 *
	 * @memberof ServiceBroker
	 */
	callMiddlewareHook(name: string, args: any[], opts?: any) {
		return this.middlewares.callHandlers(name, args, opts);
	}

	/**
	 * Call a handler synchronously in all middlewares
	 *
	 * @param {String} name
	 * @param {Array<any>} args
	 * @param {Object=} opts
	 * @returns
	 *
	 * @memberof ServiceBroker
	 */
	callMiddlewareHookSync(name: string, args: any[], opts?: MiddlewareCallHandlerOptions) {
		return this.middlewares.callSyncHandlers(name, args, opts);
	}

	/**
	 * Check metrics are enabled.
	 *
	 * @returns {boolean}
	 * @memberof ServiceBroker
	 */
	isMetricsEnabled(): boolean {
		return this.metrics.isEnabled();
	}

	/**
	 * Check tracing is enabled.
	 *
	 * @returns {boolean}
	 * @memberof ServiceBroker
	 */
	isTracingEnabled(): boolean {
		return this.tracer.isEnabled();
	}

	/**
	 * Get a custom logger for sub-modules (service, transporter, cacher, context...etc)
	 *
	 * @param {String} mod	Name of module
	 * @param {Record<string, any>=} props	Module properties (service name, version, ...etc
	 * @returns {Logger}
	 *
	 * @memberof ServiceBroker
	 */
	getLogger(mod: string, props?: any) {
		const bindings = Object.assign(
			{
				nodeID: this.nodeID,
				ns: this.namespace,
				mod
			},
			props
		);

		return this.loggerFactory.getLogger(bindings);
	}

	/**
	 * Fatal error. Print the message to console and exit the process (if need)
	 *
	 * @param {String} message
	 * @param {Error=} err
	 * @param {boolean=} [needExit=true]
	 *
	 * @memberof ServiceBroker
	 */
	fatal(message: string, err?: Error, needExit: boolean = true) {
		if (this.logger) this.logger.fatal(message, err);
		else console.error(message, err); // eslint-disable-line no-console

		if (needExit) process.exit(1);
	}

	/**
	 * Load services from a folder
	 *
	 * @param {string} [folder="./services"]		Folder of services
	 * @param {string} [fileMask="**\/*.service.js"]	Service filename mask
	 * @returns	{Number}							Number of found services
	 *
	 * @memberof ServiceBroker
	 */
	loadServices(folder: string = "./services", fileMask: string = "**/*.service.js"): number {
		this.logger.debug(`Search services in '${folder}/${fileMask}'...`);

		let serviceFiles;

		if (Array.isArray(fileMask)) serviceFiles = fileMask.map(f => path.join(folder, f));
		else serviceFiles = globSync(folder + "/" + fileMask);

		if (serviceFiles) serviceFiles.forEach(filename => this.loadService(filename));

		return serviceFiles.length;
	}

	/**
	 * Load a service from file
	 *
	 * @param {string} filePath
	 * @returns	{Service}
	 *
	 * @memberof ServiceBroker
	 */
	loadService(filePath: string): Service {
		let fName, schema;

		try {
			fName = require.resolve(path.resolve(filePath));
			this.logger.debug(`Load service '${path.basename(fName)}'...`);

			const r = require(fName);
			schema = r.default != null ? r.default : r;

			let svc;
			schema = this.normalizeSchemaConstructor(schema);
			if (utils.isInheritedClass(schema, this.ServiceFactory)) {
				// Service implementation
				// @ts-ignore
				svc = new schema(this);

				// If broker is started, call the started lifecycle event of service
				if (this.started || this.servicesStarting) this._restartService(svc);
			} else if (utils.isFunction(schema)) {
				// Function
				svc = schema(this);
				if (!utils.isInheritedClass(svc, this.ServiceFactory)) {
					svc = this.createService(svc);
				} else {
					// If broker is started, call the started lifecycle event of service
					if (this.started || this.servicesStarting) this._restartService(svc);
				}
			} else if (schema) {
				// Schema object
				svc = this.createService(schema);
			}

			if (svc) {
				svc.__filename = fName;
			}

			return svc;
		} catch (e) {
			this.logger.error(`Failed to load service '${filePath}'`, e);
			this.broadcastLocal("$broker.error", {
				error: e,
				module: "broker",
				type: C.FAILED_LOAD_SERVICE
			});
			throw e;
		}
	}

	/**
	 * Create a new service by schema
	 *
	 * @param {ServiceSchema} schema	Schema of service or a Service class
	 * @param {ServiceSchema=} schemaMods	Modified schema
	 * @returns {Service}
	 *
	 * @memberof ServiceBroker
	 */
	createService<
		TSettings = ServiceSettingSchema,
		TMethods = Record<string, any>,
		TVars = Record<string, any>,
		TThis = Service<TSettings> & TVars & TMethods
	>(schema: any, schemaMods?: any): TThis {
		/** @type {Service} */
		let service;

		schema = this.normalizeSchemaConstructor(schema);
		if (Object.prototype.isPrototypeOf.call(this.ServiceFactory, schema)) {
			// @ts-ignore
			service = new schema(this, schemaMods);
		} else {
			service = new this.ServiceFactory(this, schema, schemaMods);
		}

		// If broker has began to start its initial services yet, call the started lifecycle event of service
		if (this.started || this.servicesStarting) this._restartService(service);

		return service;
	}

	/**
	 * Restart a hot-reloaded service after creation.
	 *
	 * @param {Service} service
	 * @returns {Promise}
	 * @memberof ServiceBroker
	 */
	_restartService(service: Service): Promise<void> {
		return service._start.call(service).catch(err => {
			this.logger.error("Unable to start service.", err);

			this.broadcastLocal("$broker.error", {
				error: err,
				module: "broker",
				type: C.FAILED_RESTART_SERVICE
			});
		});
	}

	/**
	 * Add a local service instance
	 *
	 * @param {Service} service
	 * @memberof ServiceBroker
	 */
	addLocalService(service: Service) {
		this.services.push(service);
		this.metrics.set(METRIC.MOLECULER_BROKER_LOCAL_SERVICES_TOTAL, this.services.length);
	}

	/**
	 * Register a local service to Service Registry
	 *
	 * @param {ServiceItem} registryItem
	 * @memberof ServiceBroker
	 */
	registerLocalService(registryItem: ServiceItem) {
		this.registry.registerLocalService(registryItem);

		return null;
	}

	/**
	 * Destroy a local service
	 *
	 * @param {Service|string|ServiceDependency} service
	 * @returns Promise<void>
	 * @memberof ServiceBroker
	 */
	destroyService(service: Service | string | ServiceDependency): Promise<void> {
		let serviceName;
		let serviceVersion;
		/** @type {Service} */
		let svc;
		if (utils.isString(service)) {
			serviceName = service;
			svc = this.getLocalService(service);
		} else if (utils.isPlainObject(service)) {
			serviceName = service.name;
			serviceVersion = service.version;
			svc = this.getLocalService(service);
		} else {
			svc = service;
		}

		if (!svc) {
			return this.Promise.reject(
				new E.ServiceNotFoundError({ service: serviceName, version: serviceVersion })
			);
		}

		return this.Promise.resolve()
			.then(() => svc._stop())
			.catch(err => {
				/* istanbul ignore next */
				this.logger.error(`Unable to stop '${svc.fullName}' service.`, err);

				this.broadcastLocal("$broker.error", {
					error: err,
					module: "broker",
					type: C.FAILED_DESTRUCTION_SERVICE
				});
			})
			.then(() => {
				utils.removeFromArray(this.services, svc);
				this.registry.unregisterService(svc.fullName, this.nodeID);

				this.logger.info(`Service '${svc.fullName}' is stopped.`);
				this.servicesChanged(true);

				this.metrics.set(
					METRIC.MOLECULER_BROKER_LOCAL_SERVICES_TOTAL,
					this.services.length
				);
			});
	}

	/**
	 * It will be called when a new local or remote service
	 * is registered or unregistered.
	 *
	 * @memberof ServiceBroker
	 */
	servicesChanged(localService: boolean = false) {
		this.broadcastLocal("$services.changed", { localService });
		// Should notify remote nodes, because our service list is changed.
		if (localService && this.transit) {
			this.localServiceChanged();
		}
	}

	/**
	 * It's a debounced method to send INFO packets to remote nodes.
	 */
	localServiceChanged() {
		if (!this.stopping) {
			this.registry.discoverer.sendLocalNodeInfo();
		}
	}

	/**
	 * Register internal services
	 * @param {Partial<ServiceSchema>?} opts
	 *
	 * @memberof ServiceBroker
	 */
	registerInternalServices(opts?: object) {
		opts = utils.isObject(opts) ? opts : {};
		/** @type {import("./service").ServiceSchema} */
		const internalsSchema = require("./internals")();
		// If it's present any custom definition, define it as the root schema and the default one as a mixin
		if (opts["$node"]) {
			const definitiveSchema = opts["$node"];
			if (!definitiveSchema.mixins) definitiveSchema.mixins = [];
			definitiveSchema.mixins.push(internalsSchema);
			this.createService(definitiveSchema);
		} else {
			// Otherwise, just use the default one
			this.createService(internalsSchema);
		}
	}

	/**
	 * Get a local service by name
	 *
	 * Example:
	 * 	getLocalService("v2.posts");
	 * 	getLocalService({ name: "posts", version: 2 });
	 *
	 * @param {String|ServiceDependency} name
	 * @returns {Service}
	 *
	 * @memberof ServiceBroker
	 */
	getLocalService(name: string | ServiceDependency): Service {
		if (utils.isString(name)) return this.services.find(service => service.fullName == name);
		else if (utils.isPlainObject(name))
			return this.services.find(
				service => service.name == name.name && service.version == name.version
			);
	}

	/**
	 * Wait for other services
	 *
	 * @param {String|Array<String>|ServiceDependency|Array<ServiceDependency>} service
	 * @param {Number=} timeout Timeout in milliseconds
	 * @param {Number=} interval Check interval in milliseconds
	 * @returns {Promise}
	 *
	 * @memberof ServiceBroker
	 */
	waitForServices(
		service,
		timeout = this.options.dependencyTimeout,
		interval = this.options.dependencyInterval,
		logger = this.logger
	) {
		let serviceNames = Array.isArray(service) ? service : [service];

		serviceNames = utils.uniq(
			_.compact(
				serviceNames.map(x => {
					if (utils.isPlainObject(x) && x.name) {
						if (Array.isArray(x.version)) {
							return x.version.map(v =>
								this.ServiceFactory.getVersionedFullName(x.name, v)
							);
						} else {
							return this.ServiceFactory.getVersionedFullName(x.name, x.version);
						}
					} else if (utils.isString(x)) {
						return x;
					}
				})
			)
		);

		if (serviceNames.length === 0) return this.Promise.resolve({ services: [], statuses: [] });

		logger.info(
			`Waiting for service(s) '${serviceNames
				.map(n => (Array.isArray(n) ? n.join(" OR ") : n))
				.join(", ")}'...`
		);

		const startTime = Date.now();
		return new this.Promise((resolve, reject) => {
			const check = () => {
				const serviceStatuses = serviceNames.map(name => {
					if (Array.isArray(name)) {
						return name.map(n => ({
							name: n,
							available: this.registry.hasService(n)
						}));
					} else {
						return {
							name,
							available: this.registry.hasService(name)
						};
					}
				});
				const flattenedStatuses = _.flatMap(serviceStatuses, s => s);
				const names = flattenedStatuses.map(s => s.name);
				const availableServices = flattenedStatuses.filter(s => s.available);

				const isReady = serviceStatuses.every(status =>
					Array.isArray(status) ? status.some(n => n.available) : status.available
				);
				if (isReady) {
					logger.info(
						`Service(s) '${availableServices
							.map(s => s.name)
							.join(", ")}' are available.`
					);
					return resolve({ services: names, statuses: flattenedStatuses });
				}

				const unavailableServices = flattenedStatuses.filter(s => !s.available);
				logger.debug(
					format(
						"%d (%s) of %d services are available. %d (%s) are still unavailable. Waiting further...",
						availableServices.length,
						availableServices.map(s => s.name).join(", "),
						serviceStatuses.length,
						unavailableServices.length,
						unavailableServices.map(s => s.name).join(", ")
					)
				);

				if (timeout && Date.now() - startTime > timeout)
					return reject(
						new E.MoleculerServerError(
							"Services waiting is timed out.",
							500,
							"WAITFOR_SERVICES",
							{ services: names, statuses: flattenedStatuses }
						)
					);

				setTimeout(check, interval);
			};

			check();
		});
	}

	/**
	 * Find the next available endpoint for action
	 *
	 * @param {String |ActionEndpoint} actionName
	 * @param {Object?} opts
	 * @param {Context?} ctx
	 * @returns {ActionEndpoint|E.MoleculerRetryableError}
	 *
	 * @performance-critical
	 * @memberof ServiceBroker
	 */
	findNextActionEndpoint(actionName, opts, ctx) {
		if (typeof actionName !== "string") {
			return actionName;
		} else {
			if (opts && opts.nodeID) {
				const nodeID = opts.nodeID;
				// Direct call
				const endpoint = this.registry.getActionEndpointByNodeId(actionName, nodeID);
				if (!endpoint) {
					this.logger.warn(`Service '${actionName}' is not found on '${nodeID}' node.`);
					return new E.ServiceNotFoundError({ action: actionName, nodeID });
				}
				return endpoint;
			} else {
				// Get endpoint list by action name
				const epList = this.registry.getActionEndpoints(actionName);
				if (!epList) {
					this.logger.warn(`Service '${actionName}' is not registered.`);
					return new E.ServiceNotFoundError({ action: actionName });
				}

				// Get the next available endpoint
				const endpoint = epList.next(ctx);
				if (!endpoint) {
					const errMsg = `Service '${actionName}' is not available.`;
					this.logger.warn(errMsg);
					return new E.ServiceNotAvailableError({ action: actionName });
				}
				return endpoint;
			}
		}
	}

	/**
	 * Call an action
	 *
	 * @param {String} actionName		name of action
	 * @param {Object=} params			params of action
	 * @param {CallingOptions=} opts	options of call (optional)
	 * @returns {Promise}
	 *
	 * @performance-critical
	 * @memberof ServiceBroker
	 */
	call<TReturn = any, TParams = any>(
		actionName: string,
		params?: TParams,
		opts: any = {}
	): Promise<TReturn> {
		if (params === undefined) params = {} as TParams; // Backward compatibility

		// Create context
		let ctx;
		if (opts.ctx != null) {
			const endpoint = this.findNextActionEndpoint(actionName, opts, opts.ctx);
			if (endpoint instanceof Error) {
				return this.Promise.reject(endpoint).catch(err =>
					this.errorHandler(err, { actionName, params, opts } as any)
				);
			}

			// Reused context
			ctx = opts.ctx;
			ctx.endpoint = endpoint;
			ctx.nodeID = endpoint.id;
			ctx.action = endpoint.action;
			ctx.service = endpoint.action.service;
		} else {
			// New root context
			ctx = this.ContextFactory.create(this, null, params, opts);

			const endpoint = this.findNextActionEndpoint(actionName, opts, ctx);
			if (endpoint instanceof Error) {
				return this.Promise.reject(endpoint).catch(err =>
					this.errorHandler(err, { actionName, params, opts })
				);
			}

			ctx.setEndpoint(endpoint);
		}

		if (ctx.endpoint.local) {
			this.logger.debug("Call action locally.", {
				action: ctx.action.name,
				requestID: ctx.requestID
			});

			// Stream redirection
			if (opts.stream) {
				ctx.stream = opts.stream;
			}
		} else {
			this.logger.debug("Call action on remote node.", {
				action: ctx.action.name,
				nodeID: ctx.nodeID,
				requestID: ctx.requestID
			});
		}

		//this.setCurrentContext(ctx);

		const p = ctx.endpoint.action.handler(ctx);

		// Pointer to Context
		p.ctx = ctx;

		return p;
	}

	/**
	 * Call an action without built-in balancer.
	 * You don't call it directly. Broker will replace the
	 * original 'call' method to this if you disable the
	 * built-in balancer with the "disableBalancer" option.
	 *
	 * @param {String} actionName	name of action
	 * @param {Object=} params		params of action
	 * @param {Object=} opts 		options of call (optional)
	 * @returns {Promise}
	 *
	 * @memberof ServiceBroker
	 */
	callWithoutBalancer<TReturn = any, TParams = any>(
		actionName: string,
		params?: TParams,
		opts: any = {}
	): Promise<TReturn> {
		if (params === undefined) params = {} as TParams; // Backward compatibility

		let nodeID = null;
		/** @type {ActionEndpoint} */
		let endpoint;
		if (typeof actionName !== "string") {
			endpoint = actionName;
			actionName = endpoint.action.name;
			nodeID = endpoint.id;
		} else {
			if (opts.nodeID) {
				nodeID = opts.nodeID;
				endpoint = this.registry.getActionEndpointByNodeId(actionName, nodeID);
				if (!endpoint) {
					this.logger.warn(`Service '${actionName}' is not found on '${nodeID}' node.`);
					return this.Promise.reject(
						new E.ServiceNotFoundError({ action: actionName, nodeID })
					).catch(err =>
						this.errorHandler(err, { nodeID, actionName, params, opts } as any)
					);
				}
			} else {
				// Get endpoint list by action name
				const epList = this.registry.getActionEndpoints(actionName);
				if (epList == null) {
					this.logger.warn(`Service '${actionName}' is not registered.`);
					return this.Promise.reject(
						new E.ServiceNotFoundError({ action: actionName })
					).catch(err => this.errorHandler(err, { actionName, params, opts }));
				}

				endpoint = epList.getFirst();
				if (endpoint == null) {
					const errMsg = `Service '${actionName}' is not available.`;
					this.logger.warn(errMsg);
					return this.Promise.reject(
						new E.ServiceNotAvailableError({ action: actionName })
					).catch(err => this.errorHandler(err, { actionName, params, opts }));
				}
			}
		}

		// Create context
		let ctx;
		if (opts.ctx != null) {
			// Reused context
			ctx = opts.ctx;
			if (endpoint) {
				ctx.endpoint = endpoint;
				ctx.action = endpoint.action;
			}
		} else {
			// New root context
			ctx = this.ContextFactory.create(this, endpoint, params, opts);
		}
		ctx.nodeID = nodeID;

		this.logger.debug("Call action on a node.", {
			action: ctx.action.name,
			nodeID: ctx.nodeID,
			requestID: ctx.requestID
		});

		const p = endpoint.action.remoteHandler(ctx);

		// Pointer to Context
		p.ctx = ctx;

		return p;
	}

	/**
	 *
	 * @param {string} actionName
	 * @param {Context=} ctx
	 * @returns
	 */
	_getLocalActionEndpoint(actionName: string, ctx?: Context): ActionEndpoint {
		// Find action by name
		const epList = this.registry.getActionEndpoints(actionName);
		if (epList == null || !epList.hasLocal()) {
			this.logger.warn(`Service '${actionName}' is not registered locally.`);
			throw new E.ServiceNotFoundError({ action: actionName, nodeID: this.nodeID });
		}

		// Get local endpoint
		const endpoint = epList.nextLocal(ctx);
		if (!endpoint) {
			this.logger.warn(`Service '${actionName}' is not available locally.`);
			throw new E.ServiceNotAvailableError({ action: actionName, nodeID: this.nodeID });
		}

		return endpoint;
	}

	/**
	 * @overload
	 * @param {Record<string, MCallDefinition>} def
	 * @param {MCallCallingOptions=} opts
	 * @returns {Promise<Record<string, TResult>>}
	 */
	/**
	 * @overload
	 * @param {MCallDefinition[]} def
	 * @param {MCallCallingOptions=} opts
	 * @returns {Promise<TResult[]>}
	 */
	/**
	 * Multiple action calls.
	 *
	 * @template TResult
	 * @param {Record<string, MCallDefinition>|MCallDefinition[]} def
	 * @param {MCallCallingOptions=} opts
	 * @returns {Promise<Record<string, TResult> | TResult[]>}
	 * @memberof ServiceBroker
	 */
	mcall<TResult = any>(def: any, opts: any = {}): Promise<TResult> {
		const { settled, ...options } = opts;
		if (Array.isArray(def)) {
			return utils.promiseAllControl(
				def.map(item => this.call(item.action, item.params, item.options || options)),
				settled,
				this.Promise
			) as any;
		} else if (utils.isObject(def)) {
			/** @type {Record<string, TResult>} */
			const results = {};
			const promises = Object.keys(def).map(name => {
				const item = def[name];
				const callOptions = item.options || options;
				return this.call(item.action, item.params, callOptions).then(
					res => (results[name] = res)
				);
			});

			const p = utils.promiseAllControl(promises, settled, this.Promise);

			// Pointer to Context
			// @ts-ignore
			p.ctx = promises.map(promise => promise.ctx);

			return p.then(() => results) as any;
		} else {
			return this.Promise.reject(
				new E.MoleculerServerError("Invalid calling definition.", 500, "INVALID_PARAMETERS")
			);
		}
	}

	/**
	 * Emit an event (grouped & balanced global event)
	 *
	 * @param {string} eventName
	 * @param {any=} payload
	 * @param {Object=} opts
	 * @returns {Promise<any>}
	 *
	 * @memberof ServiceBroker
	 */
	emit<TData = any>(eventName: string, payload?: TData, opts?: any): Promise<void> {
		if (Array.isArray(opts) || utils.isString(opts)) opts = { groups: opts };
		else if (opts == null) opts = {};

		if (opts.groups && !Array.isArray(opts.groups)) opts.groups = [opts.groups];

		const promises = [];

		const ctx = this.ContextFactory.create(this, null, payload, opts);
		ctx.eventName = eventName;
		ctx.eventType = "emit";
		ctx.eventGroups = opts.groups;

		this.logger.debug(
			`Emit '${eventName}' event` +
				(opts.groups ? ` to '${opts.groups.join(", ")}' group(s)` : "") +
				"."
		);

		// Call local/internal subscribers
		if (/^\$/.test(eventName)) this.localBus.emit(eventName, payload);

		if (!this.options.disableBalancer) {
			const endpoints = this.registry.events.getBalancedEndpoints(
				eventName,
				opts.groups,
				ctx
			);

			// Grouping remote events (reduce the network traffic)
			const groupedEP = {};

			endpoints.forEach(([ep, group]) => {
				if (ep.id === this.nodeID) {
					// Local service, call handler
					const newCtx = ctx.copy(ep);
					promises.push(
						this.registry.events.callEventHandler(newCtx).catch(err => {
							// Catch and log the error because it's a local event handler, not throwing further.
							this.logger.error(err);
						})
					);
				} else {
					// Remote service
					const e = groupedEP[ep.id];
					if (e) e.groups.push(group);
					else
						groupedEP[ep.id] = {
							ep,
							groups: [group]
						};
				}
			});

			if (this.transit) {
				// Remote service
				_.forIn(groupedEP, item => {
					const newCtx = ctx.copy(item.ep);
					newCtx.eventGroups = item.groups;
					promises.push(this.transit.sendEvent(newCtx));
				});
			}
		} else if (this.transit) {
			// Disabled balancer case
			let groups = opts.groups;

			if (!groups || groups.length === 0) {
				// Apply to all groups
				groups = this.getEventGroups(eventName);
			}

			if (groups.length === 0) return this.Promise.resolve(true) as any;

			ctx.eventGroups = groups;
			promises.push(this.transit.sendEvent(ctx));
		}

		const p: any = this.Promise.allSettled(promises).then(results => {
			const err = results.find(r => r.status == "rejected");
			if (err) return this.Promise.reject(err.reason);
			return true;
		});

		if (opts.throwError) {
			return p;
		}
		return p.catch(() => {
			// swallow the error. It's already logged.
		});
	}

	/**
	 * Broadcast an event for all local & remote services
	 *
	 * @param {string} eventName
	 * @param {any=} payload
	 * @param {Object=} opts
	 * @returns {Promise}
	 *
	 * @memberof ServiceBroker
	 */
	broadcast<TData = any>(eventName: string, payload?: TData, opts?: any): Promise<void> {
		if (Array.isArray(opts) || utils.isString(opts)) opts = { groups: opts };
		else if (opts == null) opts = {};

		if (opts.groups && !Array.isArray(opts.groups)) opts.groups = [opts.groups];

		const promises = [];

		this.logger.debug(
			`Broadcast '${eventName}' event` +
				(opts.groups ? ` to '${opts.groups.join(", ")}' group(s)` : "") +
				"."
		);

		if (this.transit) {
			const ctx = this.ContextFactory.create(this, null, payload, opts);
			ctx.eventName = eventName;
			ctx.eventType = "broadcast";
			ctx.eventGroups = opts.groups;

			if (!this.options.disableBalancer) {
				const endpoints = this.registry.events.getAllEndpoints(eventName, opts.groups);

				// Send to remote services
				endpoints.forEach(ep => {
					if (ep.id != this.nodeID) {
						const newCtx = ctx.copy(ep);
						promises.push(this.transit.sendEvent(newCtx));
					}
				});
			} else {
				// Disabled balancer case
				let groups = opts.groups;

				if (!groups || groups.length === 0) {
					// Apply to all groups
					groups = this.getEventGroups(eventName);
				}

				if (groups.length === 0) return; // Return here because balancer disabled, so we can't call the local services.

				const endpoints = this.registry.events.getAllEndpoints(eventName, groups);

				// Return here because balancer disabled, so we can't call the local services.
				endpoints.forEach(ep => {
					const newCtx = ctx.copy(ep);
					newCtx.eventGroups = groups;
					promises.push(this.transit.sendEvent(newCtx));
				});
			}
		}

		if (!this.options.disableBalancer) {
			// Send to local services
			promises.push(this.broadcastLocal(eventName, payload, opts));
		}

		const p: any = this.Promise.allSettled(promises).then(results => {
			const err = results.find(r => r.status == "rejected");
			if (err) return this.Promise.reject(err.reason);
			return true;
		});

		if (opts.throwError) {
			return p;
		}
		return p.catch(() => {
			// swallow the error. It's already logged.
		});
	}

	/**
	 * Broadcast an event for all local services
	 *
	 * @param {string} eventName
	 * @param {any=} payload
	 * @param {Object=} opts
	 * @returns
	 *
	 * @memberof ServiceBroker
	 */
	broadcastLocal<TData = any>(eventName: string, payload?: TData, opts?: any): Promise<void> {
		if (Array.isArray(opts) || utils.isString(opts)) opts = { groups: opts };
		else if (opts == null) opts = {};

		if (opts.groups && !Array.isArray(opts.groups)) opts.groups = [opts.groups];

		this.logger.debug(
			`Broadcast '${eventName}' local event` +
				(opts.groups ? ` to '${opts.groups.join(", ")}' group(s)` : "") +
				"."
		);

		// Call internal subscribers
		if (/^\$/.test(eventName)) this.localBus.emit(eventName, payload);

		const ctx = this.ContextFactory.create(this, null, payload, opts);
		ctx.eventName = eventName;
		ctx.eventType = "broadcastLocal";
		ctx.eventGroups = opts.groups;

		const p = this.emitLocalServices(ctx);

		if (opts.throwError) {
			return p;
		}

		return p.catch(err => {
			// Catch and log the error because it's a local event handler, not throwing further.
			this.logger.error(err);
		});
	}

	/**
	 * Send ping to a node (or all nodes if nodeID is null)
	 *
	 * @param {String|Array<String>?} nodeID
	 * @param {Number?} timeout
	 * @returns {Promise}
	 * @memberof ServiceBroker
	 */
	ping(nodeID?: string | string[], timeout: number = 2000): Promise<ServiceBroker.PongResponse> {
		if (this.transit && this.transit.connected) {
			if (utils.isString(nodeID)) {
				// Ping a single node
				return new this.Promise<any>(resolve => {
					const timer = setTimeout(() => {
						this.localBus.off("$node.pong", handler);
						resolve(null);
					}, timeout);

					const handler = pong => {
						if (pong.nodeID == nodeID) {
							clearTimeout(timer);
							this.localBus.off("$node.pong", handler);
							resolve(pong);
						}
					};

					this.localBus.on("$node.pong", handler);

					this.transit.sendPing(nodeID);
				});
			} else {
				const pongs = {};
				let nodes = nodeID;
				if (!nodes) {
					nodes = this.registry
						.getNodeList({ onlyAvailable: true })
						.filter(node => node.id != this.nodeID)
						.map(node => node.id);
				}

				nodes.forEach(id => (pongs[id] = null));
				const processing = new Set(nodes);

				// Ping multiple nodes
				return new this.Promise<any>(resolve => {
					const timer = setTimeout(() => {
						this.localBus.off("$node.pong", handler);
						resolve(pongs);
					}, timeout);

					const handler = pong => {
						pongs[pong.nodeID] = pong;
						processing.delete(pong.nodeID);

						if (processing.size === 0) {
							clearTimeout(timer);
							this.localBus.off("$node.pong", handler);
							resolve(pongs);
						}
					};

					this.localBus.on("$node.pong", handler);

					nodes.forEach(id => this.transit.sendPing(id));
				});
			}
		}

		return this.Promise.resolve(nodeID ? null : []) as any;
	}

	/**
	 * Get local node health status
	 *
	 * @returns {NodeHealthStatus}
	 * @memberof ServiceBroker
	 */
	getHealthStatus(): ServiceBroker.NodeHealthStatus {
		return H.getHealthStatus();
	}

	/**
	 * Get local node info.
	 *
	 * @returns {NodeRawInfo}
	 * @memberof ServiceBroker
	 */
	getLocalNodeInfo(): ServiceRegistry.NodeRawInfo {
		return this.registry.getLocalNodeInfo();
	}

	/**
	 * Get event groups by event name
	 *
	 * @param {String} eventName
	 * @returns
	 * @memberof ServiceBroker
	 */
	getEventGroups(eventName: string): string[] {
		return this.registry.events.getGroups(eventName);
	}

	/**
	 * Has registered event listener for an event name?
	 *
	 * @param {String} eventName
	 * @returns {boolean}
	 */
	hasEventListener(eventName: string): boolean {
		return this.registry.events.getAllEndpoints(eventName).length > 0;
	}

	/**
	 * Get all registered event listener for an event name.
	 *
	 * @param {String} eventName
	 * @returns {Array<Object>}
	 */
	getEventListeners(eventName: string): EventEndpoint[] {
		return this.registry.events.getAllEndpoints(eventName);
	}

	/**
	 * Emit event to local nodes. It is called from transit when a remote event received
	 * or from `broadcastLocal`
	 *
	 * @param {Context} ctx
	 * @returns {Promise<any>}
	 * @memberof ServiceBroker
	 */
	emitLocalServices(ctx: Context): Promise<void> {
		return this.registry.events.emitLocalServices(ctx);
	}

	/**
	 * Set the current Context to the async storage.
	 *
	 * @param {Context} ctx
	 * @memberof ServiceBroker
	 *
	setCurrentContext(ctx) {
		this.scope.setSessionData(ctx);
	}*/

	/**
	 * Get the current Context from the async storage.
	 *
	 * @returns {Context?}
	 * @memberof ServiceBroker
	 *
	getCurrentContext() {
		return this.scope.getSessionData();
	}*/

	/**
	 * Get node overall CPU usage
	 *
	 * @returns {Promise<object>}
	 * @memberof ServiceBroker
	 */
	getCpuUsage(): Promise<Record<string, any>> {
		return cpuUsage();
	}

	/**
	 * Generate an UUID.
	 *
	 * @returns {String} uuid
	 */
	generateUid(): string {
		if (this.options.uidGenerator) return this.options.uidGenerator.call(this, this);

		return utils.generateToken();
	}

	/**
	 * Only for backward compatibility
	 */
	getConstructorName(obj) {
		return utils.getConstructorName(obj);
	}

	/**
	 * Ensure the service schema will be prototype of ServiceFactory;
	 *
	 * @param {ServiceSchema} schema
	 * @returns {ServiceSchema}
	 *
	 */
	normalizeSchemaConstructor(schema: ServiceSchema): ServiceSchema {
		if (Object.prototype.isPrototypeOf.call(this.ServiceFactory, schema)) {
			return schema;
		}
		// Sometimes the schame was loaded from another node_module or is a object copy.
		// Then we will check if the constructor name is the same, asume that is a derivate object
		// and adjust the prototype of the schema.
		const serviceName = utils.getConstructorName(this.ServiceFactory);
		let target = utils.getConstructorName(schema);
		if (serviceName === target) {
			Object.setPrototypeOf(schema, this.ServiceFactory);
			return schema;
		}
		// Depending how the schema was create the correct constructor name (from base class) will be locate on __proto__.
		target = utils.getConstructorName(Object.getPrototypeOf(schema));
		if (serviceName === target) {
			Object.setPrototypeOf(Object.getPrototypeOf(schema), this.ServiceFactory);
			return schema;
		}
		// This is just to handle some idiosyncrasies from Jest.
		if ((schema as any)._isMockFunction) {
			target = utils.getConstructorName(Object.getPrototypeOf((schema as any).prototype));
			if (serviceName === target) {
				Object.setPrototypeOf(schema, this.ServiceFactory);
				return schema;
			}
		}
		return schema;
	}
}

/**
 * Version of Moleculer
 */
ServiceBroker.MOLECULER_VERSION = require("../package.json").version;
ServiceBroker.prototype.MOLECULER_VERSION = ServiceBroker.MOLECULER_VERSION;

/**
 * Version of Protocol
 */
ServiceBroker.PROTOCOL_VERSION = "5";
ServiceBroker.prototype.PROTOCOL_VERSION = ServiceBroker.PROTOCOL_VERSION;

/**
 * Internal middlewares (order)
 */
ServiceBroker.INTERNAL_MIDDLEWARES = INTERNAL_MIDDLEWARES;

/**
 * Default configuration
 */
ServiceBroker.defaultOptions = defaultOptions as any;

export = ServiceBroker;
