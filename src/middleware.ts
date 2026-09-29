/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type {
	ActionHandler,
	ActionSchema,
	EventSchema,
	EventSchemaHandler,
	ServiceMethod
} from "./service";
import type { CallingOptions } from "./service-broker";
import type Service from "./service";
import type ServiceBroker from "./service-broker";
import type Transit from "./transit";
import type BaseTransporter from "./transporters/base";

declare namespace MiddlewareHandler {
	export type CallMiddlewareHandler = (
		actionName: string,
		params: any,
		opts: CallingOptions
	) => Promise<any>;

	export interface Middleware {
		name?: string;
		created?: (broker: ServiceBroker) => void;
		// `next` is the next handler of the chain. The innermost action handler is
		// already bound to its service (`Service._createAction`), and middleware
		// wrappers invoke `next(ctx)` as a plain function, so `this` must stay
		// unconstrained here (the service `this` of the action handler itself is
		// described by `ActionHandler<TThis>`).
		localAction?: (
			this: ServiceBroker,
			next: ActionHandler<any>,
			action: ActionSchema
		) => ActionHandler<any>;
		remoteAction?: (
			this: ServiceBroker,
			next: ActionHandler<any>,
			action: ActionSchema
		) => ActionHandler<any>;
		localEvent?: (next: EventSchemaHandler, event: EventSchema) => EventSchemaHandler;
		remoteEvent?: (next: EventSchemaHandler, event: EventSchema) => EventSchemaHandler;
		localMethod?: (next: ServiceMethod, method: ServiceMethod) => ServiceMethod;
		createService?: (
			next: ServiceBroker["createService"]
		) => ReturnType<ServiceBroker["createService"]>;
		registerLocalService?: (
			next: ServiceBroker["registerLocalService"]
		) => ReturnType<ServiceBroker["registerLocalService"]>;
		destroyService?: (
			next: ServiceBroker["destroyService"]
		) => ReturnType<ServiceBroker["destroyService"]>;
		call?: (next: ServiceBroker["call"]) => ReturnType<ServiceBroker["call"]>;
		mcall?: (next: ServiceBroker["mcall"]) => ReturnType<ServiceBroker["mcall"]>;
		emit?: (next: ServiceBroker["emit"]) => ReturnType<ServiceBroker["emit"]>;
		broadcast?: (next: ServiceBroker["broadcast"]) => ReturnType<ServiceBroker["broadcast"]>;
		broadcastLocal?: (
			next: ServiceBroker["broadcastLocal"]
		) => ReturnType<ServiceBroker["broadcastLocal"]>;
		serviceCreating?: (service: Service, schema: Service.ServiceSchema) => void;
		serviceCreated?: (service: Service) => void;
		serviceStarting?: (service: Service) => Promise<void>;
		serviceStarted?: (service: Service) => Promise<void>;
		serviceStopping?: (service: Service) => Promise<void>;
		serviceStopped?: (service: Service) => Promise<void>;
		starting?: (broker: ServiceBroker) => Promise<void>;
		started?: (broker: ServiceBroker) => Promise<void>;
		stopping?: (broker: ServiceBroker) => Promise<void>;
		stopped?: (broker: ServiceBroker) => Promise<void>;
		transitPublish?(next: Transit["publish"]): ReturnType<Transit["publish"]>;
		transitMessageHandler?(
			next: Transit["messageHandler"]
		): ReturnType<Transit["messageHandler"]>;
		transporterSend?(next: BaseTransporter["send"]): ReturnType<BaseTransporter["send"]>;
		transporterReceive?(
			next: BaseTransporter["receive"]
		): ReturnType<BaseTransporter["receive"]>;
		newLogEntry?(type: string, args: unknown[], bindings: unknown): void;
	}

	export type MiddlewareInit = (broker: ServiceBroker) => Middleware;
	export interface MiddlewareCallHandlerOptions {
		reverse?: boolean;
	}
}

import _ from "lodash";
import Middlewares from "./middlewares";
import { BrokerOptionsError } from "./errors";
import { isObject, isFunction, isString } from "./utils";

/**
 * class MiddlewareHandler
 */
class MiddlewareHandler {
	broker: ServiceBroker;
	list: MiddlewareHandler.Middleware[];
	registeredHooks: Record<string, any>;
	middlewareInterceptors: Record<string, any>;
	constructor(broker: ServiceBroker) {
		this.broker = broker;

		this.list = [];

		this.registeredHooks = {};

		this.middlewareInterceptors = {};
	}

	add(mw: string | MiddlewareHandler.Middleware | MiddlewareHandler.MiddlewareInit) {
		if (!mw) return;

		if (isString(mw)) {
			const found = _.get(Middlewares, mw);
			if (!found)
				throw new BrokerOptionsError(`Invalid built-in middleware type '${mw}'.`, {
					type: mw
				});
			mw = found;
		}

		if (isFunction(mw))
			mw = (mw as MiddlewareHandler.MiddlewareInit).call(this.broker, this.broker);
		if (!mw) return;

		if (!isObject(mw))
			throw new BrokerOptionsError(
				`Invalid middleware type '${typeof mw}'. Accept only Object or Function.`,
				{ type: typeof mw, value: mw }
			);

		Object.keys(mw).forEach(key => {
			if (isFunction(mw[key])) {
				const handle = isFunction(this.middlewareInterceptors[key])
					? this.middlewareInterceptors[key](mw[key])
					: mw[key];
				if (Array.isArray(this.registeredHooks[key])) {
					this.registeredHooks[key].push(handle);
				} else {
					this.registeredHooks[key] = [handle];
				}
			}
		});

		this.list.push(mw as MiddlewareHandler.Middleware);
	}

	/**
	 * Wrap a handler
	 *
	 * @param {string} method
	 * @param {Function} handler
	 * @param {Object} def
	 * @returns {Function}
	 * @memberof MiddlewareHandler
	 */
	wrapHandler(method: string, handler: Function, def: ActionSchema): typeof handler {
		if (this.registeredHooks[method] && this.registeredHooks[method].length) {
			handler = this.registeredHooks[method].reduce((handler, fn) => {
				return fn.call(this.broker, handler, def);
			}, handler);
		}

		return handler;
	}

	/**
	 * Call a handler asynchronously in all middlewares
	 *
	 * @param {String} method
	 * @param {Array<any>} args
	 * @param {MiddlewareCallHandlerOptions=} opts
	 * @returns {Promise}
	 * @memberof MiddlewareHandler
	 */
	callHandlers(
		method: string,
		args: any[],
		opts: MiddlewareHandler.MiddlewareCallHandlerOptions = {}
	) {
		if (this.registeredHooks[method] && this.registeredHooks[method].length) {
			const list = opts.reverse
				? Array.from(this.registeredHooks[method]).reverse()
				: this.registeredHooks[method];
			return list.reduce(
				(p, fn) => p.then(() => fn.apply(this.broker, args)),
				this.broker.Promise.resolve()
			);
		}

		return this.broker.Promise.resolve();
	}

	/**
	 * Call a handler synchronously in all middlewares
	 *
	 * @param {String} method
	 * @param {Array<any>} args
	 * @param {MiddlewareCallHandlerOptions=} opts
	 * @returns {Array<any>}
	 * @memberof MiddlewareHandler
	 */
	callSyncHandlers(
		method: string,
		args: any[],
		opts: MiddlewareHandler.MiddlewareCallHandlerOptions = {}
	) {
		if (this.registeredHooks[method] && this.registeredHooks[method].length) {
			const list = opts.reverse
				? Array.from(this.registeredHooks[method]).reverse()
				: this.registeredHooks[method];
			return list.map(fn => fn.apply(this.broker, args));
		}
		return;
	}

	/**
	 * Get count of registered middlewares
	 *
	 * @returns {Number}
	 * @memberof MiddlewareHandler
	 */
	count(): number {
		return this.list.length;
	}

	/**
	 * Wrap a method
	 *
	 * @param {string} method
	 * @param {Function} handler
	 * @param {any=} bindTo
	 * @param {MiddlewareCallHandlerOptions=} opts
	 * @returns {Function}
	 * @memberof MiddlewareHandler
	 */
	wrapMethod(
		method: string,
		handler: any,
		bindTo: any = this.broker,
		opts: MiddlewareHandler.MiddlewareCallHandlerOptions = {}
	) {
		if (this.registeredHooks[method] && this.registeredHooks[method].length) {
			const list = opts.reverse
				? Array.from(this.registeredHooks[method]).reverse()
				: this.registeredHooks[method];
			handler = list.reduce((next, fn) => fn.call(bindTo, next), handler.bind(bindTo));
		}

		return handler;
	}
}

export = MiddlewareHandler;

/*
{
    // After broker is created
    created(broker) {
		return;
    },

    // Wrap local action handlers (legacy middleware handler)
    localAction(next, action) {
		return ctx => {
			return next(ctx);
		};
    },

    // Wrap remote action handlers
    remoteAction(next, action) {
		return ctx => {
			return next(ctx);
		};
    },

	// Wrap local event handlers
	localEvent(next, event) {
		return (payload, sender, event) => {
			return next(payload, sender, event);
		};
	},

    // Wrap local method handlers
    localMethod(next, method) {
		return () => {
			return next(...arguments);
		};
	},

	// Wrap broker.createService method
	createService(next) {
		return (schema, schemaMods) => {
			return next(schema, schemaMods);
		};
	},

	// Wrap broker.registerLocalService method
	registerLocalService(next) {
		return (svc) => {
			return next(svc);
		};
	},

	// Wrap broker.destroyService method
	destroyService(next) {
		return (svc) => {
			return next(svc);
		};
	},

	// Wrap broker.call method
	call(next) {
		return (actionName, params, opts) => {
			return next(actionName, params, opts);
		};
	},

	// Wrap broker.mcall method
	mcall(next) {
		return (def) => {
			return next(def);
		};
	},

    // Wrap broker.emit method
    emit(next) {
		return (event, payload) => {
			return next(event, payload);
		};
    },

    // Wrap broker.broadcast method
    broadcast(next) {
		return (event, payload) => {
			return next(event, payload);
		};
    },

    // Wrap broker.broadcastLocal method
    broadcastLocal(next) {
		return (event, payload) => {
			return next(event, payload);
		};
    },

	// While a new local service creating (after mixins are mixed)
	serviceCreating(service, schema) {
		return;
	},

	// After a new local service created
	serviceCreated(service) {
		return;
	},

	// Before a local service started
	serviceStarting(service) {
		return Promise.resolve();
	},

	// After a local service started
	serviceStarted(service) {
		return Promise.resolve();
	},

	// Before a local service stopping
	serviceStopping(service) {
		return Promise.resolve();
	},

	// After a local service stopped
	serviceStopped(service) {
		return Promise.resolve();
	},

    // Before broker starting
    starting(broker) {
		return Promise.resolve();
    },

    // After broker started
    started(broker) {
		return Promise.resolve();
    },

    // Before broker stopping
    stopping(broker) {
		return Promise.resolve();
    },

    // After broker stopped
    stopped(broker) {
		return Promise.resolve();
    },

	// When transit publishing a packet
	transitPublish(next) {
		return (packet) => {
			return next(packet);
		};
	},

	// When transit receives & handles a packet
	transitMessageHandler(next) {
		return (cmd, packet) => {
			return next(cmd, packet);
		};
	},

	// When transporter send data
	transporterSend(next) {
		return (topic, data, meta) => {
			return next(topic, data, meta);
		};
	},

	// When transporter received data
	transporterReceive(next) {
		return (cmd, data, s) => {
			return next(cmd, data, s);
		};
	},

	// When transporter received data
	newLogEntry(type, args, bindings) {
		// Do something
	}
}

*/
