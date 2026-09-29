/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type Context from "./context";
import type ServiceBroker from "./service-broker";
import type Strategy from "./strategies/base";
import type { Logger } from "./logger-factory";
import type { CacherKeygen } from "./cachers/base";
import type {
	BrokerCircuitBreakerOptions,
	CallingOptions,
	FallbackHandler,
	RetryPolicyOptions
} from "./service-broker";
import type { TracingActionTags, TracingEventTags } from "./tracing/tracer";

declare namespace Service {
	export type ServiceSyncLifecycleHandler<TThis = Service> = (this: TThis) => void;
	export type ServiceAsyncLifecycleHandler<TThis = Service> = (
		this: TThis
	) => void | Promise<void>;

	export interface ServiceSearchObj {
		name?: string;
		version?: string | number;
	}

	export interface ServiceSchema<
		TSettings = ServiceSettingSchema,
		TMethods = Record<string, any>,
		TVars = Record<string, any>,
		TThis = Service<TSettings> & TVars & TMethods
	> {
		name: string;
		version?: string | number;
		settings?: TSettings;
		dependencies?: string | ServiceDependency | (string | ServiceDependency)[];
		metadata?: any;
		actions?: ServiceActionsSchema<TThis>;
		mixins?: Partial<ServiceSchema>[];
		methods?: ServiceMethods & ThisType<TThis>;
		hooks?: ServiceHooks<TThis>;

		events?: EventSchemas<TThis>;
		created?: ServiceSyncLifecycleHandler<TThis> | ServiceSyncLifecycleHandler<TThis>[];
		started?: ServiceAsyncLifecycleHandler<TThis> | ServiceAsyncLifecycleHandler<TThis>[];
		stopped?: ServiceAsyncLifecycleHandler<TThis> | ServiceAsyncLifecycleHandler<TThis>[];
	}

	export interface ServiceSettingSchema {
		$noVersionPrefix?: boolean;
		$noServiceNamePrefix?: boolean;
		$dependencyTimeout?: number;
		$shutdownTimeout?: number;
		$secureSettings?: string[];
	}

	export type ServiceAction = <
		T = Promise<any>,
		P extends Record<string, any> = Record<string, any>
	>(
		params?: P,
		opts?: CallingOptions
	) => T;

	export interface ServiceActions {
		[name: string]: ServiceAction;
	}

	export type ActionVisibility = "published" | "public" | "protected" | "private";

	export type ActionParamTypes =
		| "any"
		| "array"
		| "boolean"
		| "custom"
		| "date"
		| "email"
		| "enum"
		| "forbidden"
		| "function"
		| "number"
		| "object"
		| "string"
		| "url"
		| "uuid"
		| boolean
		| string
		| Record<string, any>;

	export type ActionParams = { [key: string]: ActionParamTypes };

	export type ActionCacheEnabledFunc = (ctx: Context<any, any>) => boolean;
	export interface ActionCacheOptions<TParams = unknown, TMeta extends object = object> {
		enabled?: boolean | ActionCacheEnabledFunc;
		ttl?: number;
		keys?: string[];
		keygen?: CacherKeygen<TParams, TMeta>;
		lock?: {
			enabled?: boolean;
			staleTime?: number;
		};
	}

	export interface ActionSchema<TThis = Service> {
		name?: string;
		/**
		 * Free-form metadata. Not used by the core, but exposed to tooling
		 * (REPL `services` listing, API gateway & doc generators).
		 */
		description?: string;
		visibility?: ActionVisibility;
		/**
		 * Legacy shorthand of `visibility: "protected"`. The registry still
		 * honours it (`action.protected === true`), so it stays part of the schema.
		 */
		protected?: boolean;
		params?: ActionParams;
		service?: Service;
		cache?: boolean | ActionCacheOptions;
		handler?: ActionHandler<TThis>;
		tracing?: boolean | TracingActionOptions;
		bulkhead?: Record<string, any>;
		circuitBreaker?: BrokerCircuitBreakerOptions;
		retryPolicy?: RetryPolicyOptions;
		fallback?: string | FallbackHandler;
		hooks?: ActionHooks & ThisType<TThis>;
		strategy?: string | typeof Strategy;
		strategyOptions?: Record<string, any>;

		// For internal purposes only!
		remoteHandler?: ActionHandler<TThis>;
	}

	export type ActionHandler<TThis = Service> = (
		this: TThis,
		ctx: Context<any, any>
	) => Promise<any> | any;

	export type ServiceActionsSchema<TThis = Service> = {
		[key: string]: ActionSchema<TThis> | ActionHandler<TThis> | boolean;
	};

	export type ServiceMethod = (...args: any[]) => any;
	export type ServiceMethods = { [key: string]: ServiceMethod };

	export interface ServiceDependency {
		name: string;
		version?: string | number;
	}

	export type ActionHookBefore = (ctx: Context<any, any>) => Promise<void> | void;
	export type ActionHookAfter = (ctx: Context<any, any>, res: any) => Promise<any> | any;
	export type ActionHookError = (ctx: Context<any, any>, err: Error) => Promise<void> | void;

	export interface ActionHooks {
		before?: string | ActionHookBefore | (string | ActionHookBefore)[];
		after?: string | ActionHookAfter | (string | ActionHookAfter)[];
		error?: string | ActionHookError | (string | ActionHookError)[];
	}

	export interface ServiceHooksBefore {
		[key: string]: string | ActionHookBefore | (string | ActionHookBefore)[];
	}

	export interface ServiceHooksAfter {
		[key: string]: string | ActionHookAfter | (string | ActionHookAfter)[];
	}

	export interface ServiceHooksError {
		[key: string]: string | ActionHookError | (string | ActionHookError)[];
	}

	export interface ServiceHooks<TThis = Service> {
		before?: ServiceHooksBefore & ThisType<TThis>;
		after?: ServiceHooksAfter & ThisType<TThis>;
		error?: ServiceHooksError & ThisType<TThis>;
	}

	export type EventSchemaHandler = (ctx: Context<any, any>) => void | Promise<void>;

	export interface EventSchema {
		name?: string;
		group?: string;
		params?: ActionParams;
		service?: Service;
		context?: boolean;
		debounce?: number;
		throttle?: number;
		strategy?: string | typeof Strategy;
		strategyOptions?: Record<string, any>;
		handler?: EventSchemaHandler;

		// [key: string]: any;
	}

	export type EventSchemas<TThis = Service> = {
		[key: string]: EventSchemaHandler | EventSchema;
	} & ThisType<TThis>;

	export interface WaitForServicesResult {
		services: string[];
		statuses: { name: string; available: boolean }[];
	}

	export type TracingSpanNameOption = string | ((ctx: Context) => string);

	export interface TracingOptions {
		enabled?: boolean;
		tags?: TracingActionTags | TracingEventTags;
		spanName?: TracingSpanNameOption;
		safetyTags?: boolean;
	}

	export interface TracingActionOptions extends TracingOptions {
		tags?: TracingActionTags;
	}

	export interface TracingEventOptions extends TracingOptions {
		tags?: TracingEventTags;
	}
}

import _ from "lodash";
import { ServiceSchemaError, MoleculerError } from "./errors";
import { isObject, isFunction, flatten, uniq } from "./utils";

/**
 * Wrap a handler Function to an object with a `handler` property.
 *
 * @param {Function|Object} o
 * @returns {Object}
 */
function wrapToHandler(o) {
	return isFunction(o) ? { handler: o } : o;
}

/**
 * Wrap any value to an array.
 * @param {any} o
 * @returns {Array}
 */
function wrapToArray(o) {
	return Array.isArray(o) ? o : [o];
}

/**
 * Service class
 *
 */
class Service<S = Service.ServiceSettingSchema> {
	events: Record<string, any>;
	_serviceSpecification: any;
	name: string;
	fullName: string;
	version?: string | number;
	settings: S;
	metadata: Record<string, any>;
	dependencies?: string | Service.ServiceDependency | (string | Service.ServiceDependency)[];
	schema: Service.ServiceSchema<S>;
	originalSchema: Service.ServiceSchema<S>;
	broker: ServiceBroker;
	logger: Logger;
	actions: Service.ServiceActions;
	Promise: PromiseConstructor;
	/**
	 * Creates an instance of Service by schema.
	 *
	 * @param {ServiceBroker} 	broker	broker of service
	 * @param {Partial<ServiceSchema>}	schema	schema of service
	 *
	 */
	constructor(
		broker: ServiceBroker,
		schema?: Partial<Service.ServiceSchema<S>>,
		schemaMods?: any
	) {
		if (!isObject(broker)) throw new ServiceSchemaError("Must set a ServiceBroker instance!");

		this.broker = broker;

		if (broker) this.Promise = broker.Promise;
		if (schema) this.parseServiceSchema(schema);
	}

	/**
	 * Parse Service schema & register as local service
	 *
	 * @param {Partial<ServiceSchema>} schema of Service
	 */
	parseServiceSchema(schema: Partial<Service.ServiceSchema<S>>) {
		if (!isObject(schema))
			throw new ServiceSchemaError(
				"The service schema can't be null. Maybe is it not a service schema?"
			);

		this.originalSchema = _.cloneDeep(schema);

		if (schema.mixins) {
			schema = this.applyMixins(schema) as any;
		}

		if (isFunction((schema as any).merged)) {
			(schema as any).merged.call(this, schema);
		} else if (Array.isArray((schema as any).merged)) {
			(schema as any).merged.forEach((fn: any) => fn.call(this, schema));
		}

		this.broker.callMiddlewareHookSync("serviceCreating", [this, schema]);

		if (!schema.name) {
			/* eslint-disable-next-line no-console */
			console.error(
				"Service name can't be empty! Maybe it is not a valid Service schema. Maybe is it not a service schema?",
				{ schema }
			);
			throw new ServiceSchemaError(
				"Service name can't be empty! Maybe it is not a valid Service schema. Maybe is it not a service schema?",
				{ schema }
			);
		}

		this.name = schema.name;
		this.version = schema.version;
		this.settings = (schema.settings || {}) as S;
		this.metadata = schema.metadata || {};
		this.schema = schema as any;

		this.fullName = Service.getVersionedFullName(
			this.name,
			(this.settings as any).$noVersionPrefix !== true ? this.version : undefined
		);

		this.logger = this.broker.getLogger(this.fullName, {
			svc: this.name,
			ver: this.version
		});

		this.actions = {}; // external access to actions
		this.events = {}; // external access to event handlers.

		// Service item for Registry
		const serviceSpecification = {
			name: this.name,
			version: this.version,
			fullName: this.fullName,
			settings: this._getPublicSettings(this.settings),
			metadata: this.metadata,
			actions: {},
			events: {}
		};

		// Register methods
		if (isObject(schema.methods)) {
			_.forIn(schema.methods, (method, name) => {
				/* istanbul ignore next */
				if (
					[
						"name",
						"version",
						"settings",
						"metadata",
						"dependencies",
						"schema",
						"broker",
						"actions",
						"logger",
						"created",
						"started",
						"stopped",
						"_start",
						"_stop",
						"_init",
						"applyMixins"
					].indexOf(name) !== -1 ||
					name.startsWith("mergeSchema")
				) {
					throw new ServiceSchemaError(
						`Invalid method name '${name}' in '${this.name}' service!`
					);
				}

				this._createMethod(method, name);
			});
		}

		// Register actions
		if (isObject(schema.actions)) {
			_.forIn(schema.actions, (action, name) => {
				if (action === false) return;

				const innerAction = this._createAction(action, name);

				serviceSpecification.actions[innerAction.name] = innerAction;

				const wrappedHandler = this.broker.middlewares.wrapHandler(
					"localAction",
					innerAction.handler,
					innerAction
				);

				// Expose to be callable as `this.actions.find({ ...params })`
				const ep = this.broker.registry.createPrivateActionEndpoint(innerAction);
				this.actions[name] = (params, opts) => {
					let ctx;
					if (opts && opts.ctx) {
						// Reused context (in case of retry)
						ctx = opts.ctx;
					} else {
						ctx = this.broker.ContextFactory.create(
							this.broker,
							ep,
							params,
							opts || {}
						);
					}
					return wrappedHandler(ctx);
				};
			});
		}

		// Event subscriptions
		if (isObject(schema.events)) {
			_.forIn(schema.events, (event, name) => {
				const innerEvent = this._createEvent(event, name);
				serviceSpecification.events[innerEvent.name] = innerEvent;

				// Expose to be callable as `this.events[''](params, opts);
				this.events[innerEvent.name] = (params, opts) => {
					let ctx;
					if (opts && opts.ctx) {
						// Reused context (in case of retry)
						ctx = opts.ctx;
					} else {
						const ep = /** @type {EventEndpoint} */ {
							id: this.broker.nodeID,
							event: innerEvent,
							broker: this.broker,
							service: null,
							node: null,
							local: true,
							state: true
						};
						ctx = this.broker.ContextFactory.create(
							this.broker,
							ep,
							params,
							opts || {}
						);
					}
					ctx.eventName = name;
					ctx.eventType = "emit";
					ctx.eventGroups = [innerEvent.group || this.name];

					return innerEvent.handler(ctx);
				};
			});
		}

		this._serviceSpecification = serviceSpecification;

		// Initialize
		this._init();
	}

	/**
	 * Return a service settings without protected properties.
	 *
	 * @param {Record<string, any>?} settings
	 */
	_getPublicSettings(settings) {
		if (settings && Array.isArray(settings.$secureSettings)) {
			return _.omit(settings, [].concat(settings.$secureSettings, ["$secureSettings"]));
		}

		return settings;
	}

	/**
	 * Initialize service. It called `created` handler in schema
	 */
	_init() {
		this.logger.debug(`Service '${this.fullName}' is creating...`);
		if (isFunction(this.schema.created)) {
			(this.schema.created as any).call(this);
		} else if (Array.isArray(this.schema.created)) {
			(this.schema.created as any).forEach((fn: any) => fn.call(this));
		}

		this.broker.addLocalService(this);

		this.broker.callMiddlewareHookSync("serviceCreated", [this]);

		this.logger.debug(`Service '${this.fullName}' created.`);
	}

	/**
	 * Start service
	 *
	 * @returns {Promise}
	 */
	_start(): Promise<void> {
		this.logger.debug(`Service '${this.fullName}' is starting...`);
		return this.Promise.resolve()
			.then(() => {
				return this.broker.callMiddlewareHook("serviceStarting", [this]);
			})
			.then(() => {
				// Wait for dependent services
				if (this.schema.dependencies)
					return this.waitForServices(
						this.schema.dependencies,
						(this.settings as any).$dependencyTimeout ||
							this.broker.options.dependencyTimeout,
						(this.settings as any).$dependencyInterval ||
							this.broker.options.dependencyInterval
					);
			})
			.then(() => {
				if (isFunction(this.schema.started))
					return this.Promise.method(this.schema.started as any).call(this);

				if (Array.isArray(this.schema.started)) {
					return this.schema.started
						.map(fn => this.Promise.method(fn.bind(this)))
						.reduce((p, fn) => p.then(() => fn()), this.Promise.resolve());
				}
			})
			.then(() => {
				// Register service
				return this.broker.registerLocalService(this._serviceSpecification as any);
			})
			.then(() => {
				return this.broker.callMiddlewareHook("serviceStarted", [this]);
			})
			.then(() => this.logger.info(`Service '${this.fullName}' started.`));
	}

	/**
	 * Stop service
	 *
	 * @returns {Promise}
	 */
	_stop(): Promise<void> {
		this.logger.debug(`Service '${this.fullName}' is stopping...`);
		return this.Promise.resolve()
			.then(() => {
				return this.broker.callMiddlewareHook("serviceStopping", [this], { reverse: true });
			})
			.then(() => {
				if (isFunction(this.schema.stopped))
					return (this.Promise.method(this.schema.stopped as any) as any).call(this);

				if (Array.isArray(this.schema.stopped)) {
					const arr = Array.from(this.schema.stopped).reverse();
					return arr
						.map(fn => this.Promise.method(fn.bind(this)))
						.reduce((p, fn) => p.then(() => fn()), this.Promise.resolve());
				}

				return this.Promise.resolve();
			})
			.then(() => {
				return this.broker.callMiddlewareHook("serviceStopped", [this], { reverse: true });
			})
			.then(() => this.logger.info(`Service '${this.fullName}' stopped.`));
	}

	/**
	 * Create an external action handler for broker (internal command!)
	 *
	 * @param {Object|Function} actionDef
	 * @param {String} name
	 * @returns {Object}
	 *
	 * @private
	 */
	_createAction(actionDef, name) {
		let action;
		if (isFunction(actionDef)) {
			// Wrap to an object
			action = {
				handler: actionDef
			};
		} else if (isObject(actionDef)) {
			action = _.cloneDeep(actionDef);
		} else {
			throw new ServiceSchemaError(
				`Invalid action definition in '${name}' action in '${this.fullName}' service!`
			);
		}

		const handler = action.handler;
		if (!isFunction(handler)) {
			throw new ServiceSchemaError(
				`Missing action handler on '${name}' action in '${this.fullName}' service!`
			);
		}

		action.rawName = action.name || name;
		if ((this.settings as any).$noServiceNamePrefix !== true)
			action.name = this.fullName + "." + action.rawName;
		else action.name = action.rawName;

		if (action.cache === undefined && (this.settings as any).$cache !== undefined) {
			action.cache = (this.settings as any).$cache;
		}

		action.service = this;
		action.handler = this.Promise.method(handler.bind(this));

		return action;
	}

	/**
	 * Create an internal service method.
	 *
	 * @param {Record<string, any>|Function} methodDef
	 * @param {String} name
	 * @returns {Record<string, any>}
	 */
	_createMethod(methodDef, name) {
		let method;
		if (isFunction(methodDef)) {
			// Wrap to an object
			method = {
				handler: methodDef
			};
		} else if (isObject(methodDef)) {
			method = methodDef;
		} else {
			throw new ServiceSchemaError(
				`Invalid method definition in '${name}' method in '${this.fullName}' service!`
			);
		}

		if (!isFunction(method.handler)) {
			throw new ServiceSchemaError(
				`Missing method handler on '${name}' method in '${this.fullName}' service!`
			);
		}

		method.name = name;
		method.service = this;
		method.handler = method.handler.bind(this);

		this[name] = this.broker.middlewares.wrapHandler("localMethod", method.handler, method);

		return method;
	}

	/**
	 * Create an event subscription for broker
	 *
	 * @param {Record<string, any>|Function} eventDef
	 * @param {String} name
	 * @returns {Record<string, any>}
	 *
	 * @private
	 */
	_createEvent(eventDef, name) {
		let event;
		if (isFunction(eventDef) || Array.isArray(eventDef)) {
			event = {
				handler: eventDef
			};
		} else if (isObject(eventDef)) {
			event = _.cloneDeep(eventDef);
		} else {
			throw new ServiceSchemaError(
				`Invalid event definition in '${name}' event in '${this.fullName}' service!`
			);
		}

		if (!isFunction(event.handler) && !Array.isArray(event.handler)) {
			throw new ServiceSchemaError(
				`Missing event handler on '${name}' event in '${this.fullName}' service!`
			);
		}

		// Detect new or legacy parameter list of event handler
		// Legacy: handler(payload, sender, eventName)
		// New: handler(ctx)
		let handler;
		if (isFunction(event.handler)) {
			handler = this.Promise.method(event.handler);
		} else if (Array.isArray(event.handler)) {
			handler = event.handler.map(h => {
				h = this.Promise.method(h);
				return h;
			});
		}

		if (!event.name) event.name = name;

		event.service = this;
		const self = this;
		if (isFunction(handler)) {
			// Call single handler
			event.handler = function (ctx) {
				return handler.call(self, ctx);
			};
		} else if (Array.isArray(handler)) {
			// Call multiple handler
			event.handler = function (ctx) {
				return self.Promise.all(handler.map(fn => fn.call(self, ctx)));
			};
		}

		return event;
	}

	/**
	 * Call a local event handler. Useful for unit tests.
	 *
	 * @param {String} eventName
	 * @param {any?} params
	 * @param {Record<string, any>?} opts
	 */
	emitLocalEventHandler(eventName: string, params?: any, opts?: any): any {
		if (!this.events[eventName])
			return Promise.reject(
				new MoleculerError(
					`No '${eventName}' registered local event handler`,
					500,
					"NOT_FOUND_EVENT",
					{ eventName }
				)
			);

		return this.events[eventName](params, opts);
	}

	/**
	 * Getter of current Context.
	 * @returns {Context?}
	 *
	 *
	get currentContext() {
		return this.broker.getCurrentContext();
	}*/

	/**
	 * Setter of current Context
	 *
	 *
	set currentContext(ctx) {
		this.broker.setCurrentContext(ctx);
	}*/

	/**
	 * Wait for other services
	 *
	 * @param {string | ServiceDependency | (string | ServiceDependency)[]} serviceNames
	 * @param {number?} timeout Timeout in milliseconds
	 * @param {number?} interval Check interval in milliseconds
	 * @returns {Promise}
	 */
	waitForServices(serviceNames, timeout, interval) {
		return this.broker.waitForServices(serviceNames, timeout, interval, this.logger);
	}

	/**
	 * Apply `mixins` list in schema. Merge the schema with mixins schemas. Returns with the mixed schema
	 *
	 * @param {Partial<ServiceSchema>} schema
	 * @returns {Partial<ServiceSchema>}
	 *
	 */
	applyMixins(schema: Partial<Service.ServiceSchema>): Partial<Service.ServiceSchema> {
		if (schema.mixins) {
			const mixins = Array.isArray(schema.mixins) ? schema.mixins : [schema.mixins];
			if (mixins.length > 0) {
				const mixedSchema = Array.from(mixins)
					.reverse()
					.reduce((s, mixin) => {
						if (mixin.mixins) mixin = this.applyMixins(mixin);

						return s ? this.mergeSchemas(s, mixin) : mixin;
					}, null);

				return this.mergeSchemas(mixedSchema, schema);
			}
		}

		/* istanbul ignore next */
		return schema;
	}

	/**
	 * Merge two Service schema
	 *
	 * @param {Partial<ServiceSchema>} mixinSchema		Mixin schema
	 * @param {Partial<ServiceSchema>} svcSchema 		Service schema
	 * @returns {Partial<ServiceSchema>} Mixed schema
	 *
	 */
	mergeSchemas(mixinSchema, svcSchema) {
		const res = _.cloneDeep(mixinSchema);
		if (!svcSchema) return res;
		const mods = _.cloneDeep(svcSchema);
		if (!mixinSchema) return mods;

		Object.keys(mods).forEach(key => {
			if ((key === "name" || key === "version") && mods[key] !== undefined) {
				// Simple overwrite
				res[key] = mods[key];
			} else if (key === "settings") {
				// Merge with defaultsDeep
				res[key] = this.mergeSchemaSettings(mods[key], res[key]);
			} else if (key === "metadata") {
				// Merge with defaultsDeep
				res[key] = this.mergeSchemaMetadata(mods[key], res[key]);
			} else if (key === "hooks") {
				// Merge & concat
				res[key] = this.mergeSchemaHooks(mods[key], res[key] || {});
			} else if (key === "actions") {
				// Merge with defaultsDeep
				res[key] = this.mergeSchemaActions(mods[key], res[key] || {});
			} else if (key === "methods") {
				// Overwrite
				res[key] = this.mergeSchemaMethods(mods[key], res[key]);
			} else if (key === "events") {
				// Merge & concat by groups
				res[key] = this.mergeSchemaEvents(mods[key], res[key] || {});
			} else if (["merged", "created", "started", "stopped"].indexOf(key) !== -1) {
				// Concat lifecycle event handlers
				res[key] = this.mergeSchemaLifecycleHandlers(mods[key], res[key]);
			} else if (key === "mixins") {
				// Concat mixins
				res[key] = this.mergeSchemaUniqArray(mods[key], res[key]);
			} else if (key === "dependencies") {
				// Concat mixins
				res[key] = this.mergeSchemaUniqArray(mods[key], res[key]);
			} else {
				const customFnName = "mergeSchema" + key.replace(/./, key[0].toUpperCase()); // capitalize first letter
				// TODO: add middleware hook
				if (isFunction(this[customFnName])) {
					res[key] = this[customFnName](mods[key], res[key]);
				} else {
					res[key] = this.mergeSchemaUnknown(mods[key], res[key]);
				}
			}
		});

		return res;
	}

	/**
	 * Merge `settings` property in schema
	 *
	 * @param {Object} src Source schema property
	 * @param {Object} target Target schema property
	 *
	 * @returns {Object} Merged schema
	 */
	mergeSchemaSettings(src, target) {
		if ((target && target.$secureSettings) || (src && src.$secureSettings)) {
			const srcSS = src && src.$secureSettings ? src.$secureSettings : [];
			const targetSS = target && target.$secureSettings ? target.$secureSettings : [];
			if (!target) target = {};

			target.$secureSettings = uniq([...srcSS, ...targetSS]);
		}

		return _.defaultsDeep(src, target);
	}

	/**
	 * Merge `metadata` property in schema
	 *
	 * @param {Object} src Source schema property
	 * @param {Object} target Target schema property
	 *
	 * @returns {Object} Merged schema
	 */
	mergeSchemaMetadata(src, target) {
		return _.defaultsDeep(src, target);
	}

	/**
	 * Merge `mixins` property in schema
	 *
	 * @param {Object} src Source schema property
	 * @param {Object} target Target schema property
	 *
	 * @returns {Object} Merged schema
	 */
	mergeSchemaUniqArray(src, target) {
		return _.uniqWith(_.compact(flatten([src, target])), _.isEqual);
	}

	/**
	 * Merge `dependencies` property in schema
	 *
	 * @param {Object} src Source schema property
	 * @param {Object} target Target schema property
	 *
	 * @returns {Object} Merged schema
	 */
	mergeSchemaDependencies(src, target) {
		return this.mergeSchemaUniqArray(src, target);
	}

	/**
	 * Merge `hooks` property in schema
	 *
	 * @param {Object} src Source schema property
	 * @param {Object} target Target schema property
	 *
	 * @returns {Object} Merged schema
	 */
	mergeSchemaHooks(src, target) {
		Object.keys(src).forEach(k => {
			if (target[k] == null) target[k] = {};

			Object.keys(src[k]).forEach(k2 => {
				const modHook = wrapToArray(src[k][k2]);
				const resHook = wrapToArray(target[k][k2]);

				target[k][k2] = _.compact(
					flatten(k === "before" ? [resHook, modHook] : [modHook, resHook])
				);
			});
		});

		return target;
	}

	/**
	 * Merge `actions` property in schema
	 *
	 * @param {Object} src Source schema property (real schema)
	 * @param {Object} target Target schema property (mixin schema)
	 *
	 * @returns {Object} Merged schema
	 */
	mergeSchemaActions(src, target) {
		Object.keys(src).forEach(k => {
			if (src[k] === false) {
				delete target[k];
				return;
			}

			const srcAction = wrapToHandler(src[k]);
			const targetAction = wrapToHandler(target[k]);

			if (srcAction && srcAction.hooks && targetAction && targetAction.hooks) {
				Object.keys(srcAction.hooks).forEach(k => {
					const modHook = wrapToArray(srcAction.hooks[k]);
					const resHook = wrapToArray(targetAction.hooks[k]);

					srcAction.hooks[k] = _.compact(
						flatten(k === "before" ? [resHook, modHook] : [modHook, resHook])
					);
				});
			}

			target[k] = _.defaultsDeep(srcAction, targetAction);
		});

		return target;
	}

	/**
	 * Merge `methods` property in schema
	 *
	 * @param {Object} src Source schema property
	 * @param {Object} target Target schema property
	 *
	 * @returns {Object} Merged schema
	 */
	mergeSchemaMethods(src, target) {
		return Object.assign(target || {}, src || {});
	}

	/**
	 * Merge `events` property in schema
	 *
	 * @param {Object} src Source schema property
	 * @param {Object} target Target schema property
	 *
	 * @returns {Object} Merged schema
	 */
	mergeSchemaEvents(src, target) {
		Object.keys(src).forEach(k => {
			const modEvent = wrapToHandler(src[k]);
			const resEvent = wrapToHandler(target[k]);

			let handler = _.compact(
				flatten([resEvent ? resEvent.handler : null, modEvent ? modEvent.handler : null])
			);
			if (handler.length === 1) handler = handler[0];

			target[k] = _.defaultsDeep(modEvent, resEvent);
			target[k].handler = handler;
		});

		return target;
	}

	/**
	 * Merge `started`, `stopped`, `created` event handler properties in schema
	 *
	 * @param {Object} src Source schema property
	 * @param {Object} target Target schema property
	 *
	 * @returns {Object} Merged schema
	 */
	mergeSchemaLifecycleHandlers(src, target) {
		return _.compact(flatten([target, src]));
	}

	/**
	 * Merge unknown properties in schema
	 *
	 * @param {Object} src Source schema property
	 * @param {Object} target Target schema property
	 *
	 * @returns {Object} Merged schema
	 */
	mergeSchemaUnknown(src, target) {
		if (src !== undefined) return src;

		return target;
	}

	/**
	 * Return a versioned full service name.
	 * @param {String} name
	 * @param {String|Number?} version
	 */
	static getVersionedFullName(name: string, version?: string | number): string {
		if (version != null)
			return (typeof version == "number" ? "v" + version : version) + "." + name;

		return name;
	}
}

export = Service;
