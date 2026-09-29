/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import ActionEndpoint = require("./registry/endpoint-action");
import EventEndpoint = require("./registry/endpoint-event");
import type { CallingOptions } from "./service-broker";
import Service = require("./service");
import Span = require("./tracing/span");
import type { ActionSchema, EventSchema } from "./service";
import type ServiceBroker = require("./service-broker");
import { Stream } from "stream";

declare namespace Context {
	export interface ContextParentSpan {
		id: string;
		traceID: string;
		sampled: boolean;
	}
}

import util = require("util");
import _0 = require("lodash");
const { pick } = _0;
import { RequestSkippedError, MaxCallLevelError } from "./errors";

/**
 */

/**
 * Merge metadata
 *
 * @param {Context} ctx
 * @param {Object} newMeta
 */
function mergeMeta(ctx, newMeta) {
	if (newMeta) Object.assign(ctx.meta, newMeta);
	return ctx.meta;
}

/**
 * Context class for action calls
 *
 * @class Context
 */
class Context<
	TParams = unknown,
	TMeta extends object = {},
	TLocals = Record<string, any>,
	THeaders = Record<string, any>
> {
	id: string;
	broker: ServiceBroker;
	endpoint: ActionEndpoint | EventEndpoint | null;
	action: ActionSchema | null;
	event: EventSchema | null;
	service: Service | null;
	nodeID: string | null;
	eventName: string | null;
	eventType: string | null;
	eventGroups: string[] | null;
	options: CallingOptions;
	parentID: string | null;
	caller: string | null;
	tracing: boolean | null;
	span: Span | null;
	needAck: boolean | null;
	ackID: string | null;
	locals: TLocals;
	level: number;
	params: TParams;
	meta: TMeta;
	headers: THeaders;
	responseHeaders: THeaders;
	requestID: string | null;
	stream: Stream | null;
	cachedResult: boolean;
	startHrTime: [number, number] | null;
	_spanStack: Span[];
	/**
	 * Creates an instance of Context.
	 *
	 * @param {ServiceBroker} broker - Broker instance
	 * @param {ActionEndpoint|EventEndpoint=} endpoint
	 *
	 * @memberof Context
	 */
	constructor(broker: ServiceBroker, endpoint?: ActionEndpoint | EventEndpoint) {
		this.broker = broker;
		if (this.broker) {
			this.nodeID = this.broker.nodeID;
			this.id = this.broker.generateUid();
		} else {
			this.nodeID = null;
		}

		if (endpoint) {
			this.setEndpoint(endpoint);
		} else {
			this.endpoint = null;
			this.service = null;
			this.action = null;
			this.event = null;
		}

		// The emitted event "user.created" because `ctx.event.name` can be "user.**"
		this.eventName = null;
		// Type of event ("emit" or "broadcast")
		this.eventType = null;
		// The groups of event
		this.eventGroups = null;

		/** @type {CallingOptions} */
		this.options = {
			timeout: null,
			retries: null
		};

		this.parentID = null;
		this.caller = null;

		this.level = 1;

		this.params = null;
		this.meta = {} as TMeta;
		this.headers = {} as THeaders;
		this.responseHeaders = {} as THeaders;
		this.locals = {} as TLocals;

		this.stream = null;

		this.requestID = this.id;

		this.tracing = null;
		this.span = null;
		this._spanStack = [];

		this.needAck = null;
		this.ackID = null;

		this.startHrTime = null;

		this.cachedResult = false;
	}

	/**
	 * Create a new Context instance
	 *
	 * @param {ServiceBroker} broker
	 * @param {ActionEndpoint|EventEndpoint} endpoint
	 * @param {Object?} params
	 * @param {CallingOptions} opts
	 * @returns {Context}
	 *
	 * @static
	 * @memberof Context
	 */
	static create(broker: any, endpoint: any, params: any, opts: any = {}) {
		const ctx = new broker.ContextFactory(broker, endpoint);

		if (endpoint != null) ctx.setEndpoint(endpoint);

		if (params != null) {
			let cloning = broker ? broker.options.contextParamsCloning : false;
			if (opts.paramsCloning != null) cloning = opts.paramsCloning;
			ctx.setParams(params, cloning);
		}

		//Object.assign(ctx.options, opts);
		ctx.options = opts;

		// RequestID
		if (opts.requestID != null) ctx.requestID = opts.requestID;
		else if (opts.parentCtx != null && opts.parentCtx.requestID != null)
			ctx.requestID = opts.parentCtx.requestID;

		// Meta
		if (opts.parentCtx != null && opts.parentCtx.meta != null)
			ctx.meta = Object.assign({}, opts.parentCtx.meta || {}, opts.meta || {});
		else if (opts.meta != null) ctx.meta = opts.meta;

		// Headers
		if (opts.headers) {
			ctx.headers = opts.headers;
		}

		// ParentID, Level, Caller, Tracing
		if (opts.parentCtx != null) {
			ctx.tracing = opts.parentCtx.tracing;
			ctx.level = opts.parentCtx.level + 1;

			if (opts.parentCtx.span) ctx.parentID = opts.parentCtx.span.id;
			else ctx.parentID = opts.parentCtx.id;

			if (opts.parentCtx.service) ctx.caller = opts.parentCtx.service.fullName;
		}

		// caller
		if (opts.caller) {
			ctx.caller = opts.caller;
		}

		// Parent span
		if (opts.parentSpan != null) {
			ctx.parentID = opts.parentSpan.id;
			ctx.requestID = opts.parentSpan.traceID;
			ctx.tracing = opts.parentSpan.sampled;
		}

		// Event acknowledgement
		// if (opts.needAck) {
		// 	ctx.needAck = opts.needAck;
		// }

		return ctx;
	}

	/**
	 * Copy itself without ID.
	 *
	 * @param {ActionEndpoint|EventEndpoint} ep
	 * @returns {Context}
	 */
	copy(ep) {
		/** @type {any} */
		const ctor = this.constructor;

		/** @type {Context} */
		const newCtx = new (ctor as any)(this.broker);

		newCtx.nodeID = this.nodeID;
		newCtx.setEndpoint(ep || this.endpoint);
		newCtx.options = this.options;
		newCtx.parentID = this.parentID;
		newCtx.caller = this.caller;
		newCtx.level = this.level;
		newCtx.params = this.params;
		newCtx.meta = this.meta;
		newCtx.headers = this.headers;
		newCtx.responseHeaders = this.responseHeaders;
		newCtx.locals = this.locals;
		newCtx.requestID = this.requestID;
		newCtx.tracing = this.tracing;
		newCtx.span = this.span;
		newCtx.needAck = this.needAck;
		newCtx.ackID = this.ackID;
		newCtx.eventName = this.eventName;
		newCtx.eventType = this.eventType;
		newCtx.eventGroups = this.eventGroups;
		newCtx.stream = this.stream;

		newCtx.cachedResult = this.cachedResult;

		return newCtx;
	}

	/**
	 *
	 * @param {ActionEndpoint|EventEndpoint} ep
	 * @returns {ep is ActionEndpoint}
	 */
	isActionEndpoint(ep: ActionEndpoint | EventEndpoint): ep is ActionEndpoint {
		// @ts-ignore
		return ep?.action != null;
	}

	/**
	 *
	 * @param {ActionEndpoint|EventEndpoint} ep
	 * @returns {ep is EventEndpoint}
	 */
	isEventEndpoint(ep: ActionEndpoint | EventEndpoint): ep is EventEndpoint {
		// @ts-ignore
		return ep?.event != null;
	}

	/**
	 * Set endpoint of context
	 *
	 * @param {ActionEndpoint|EventEndpoint} endpoint
	 * @memberof Context
	 */
	setEndpoint(endpoint: ActionEndpoint | EventEndpoint) {
		this.endpoint = endpoint;
		if (endpoint) {
			this.nodeID = endpoint.id;
			if (this.isActionEndpoint(endpoint)) {
				this.action = endpoint.action;
				this.service = this.action.service;
				this.event = null;
			} else if (this.isEventEndpoint(endpoint)) {
				this.event = endpoint.event;
				this.service = this.event.service;
				this.action = null;
			}
		}
	}

	/**
	 * Set params of context
	 *
	 * @param {Object} newParams
	 * @param {Boolean} cloning
	 *
	 * @memberof Context
	 */
	setParams(newParams: TParams, cloning: boolean = false) {
		if (cloning && newParams) this.params = structuredClone(newParams);
		else this.params = newParams;
	}

	/**
	 * Call an other action. It creates a sub-context.
	 *
	 * @param {String} actionName
	 * @param {Object=} params
	 * @param {Object=} _opts
	 * @returns {Promise}
	 *
	 * @example <caption>Call an other service with params & options</caption>
	 * ctx.call("posts.get", { id: 12 }, { timeout: 1000 });
	 *
	 * @memberof Context
	 */
	call<TResult = any, TParams = any>(
		actionName: string,
		params?: TParams,
		_opts?: any
	): Promise<TResult> {
		const opts = Object.assign(
			{
				parentCtx: this
			},
			_opts
		);

		if (this.options.timeout > 0 && this.startHrTime) {
			// Distributed timeout handling. Decrementing the timeout value with the elapsed time.
			// If the timeout below 0, skip the call.
			const diff = process.hrtime(this.startHrTime);
			const duration = diff[0] * 1e3 + diff[1] / 1e6;
			const distTimeout = this.options.timeout - duration;

			if (distTimeout <= 0) {
				return this.broker.Promise.reject(
					new RequestSkippedError({ action: actionName, nodeID: this.broker.nodeID })
				);
			}

			if (!opts.timeout || distTimeout < opts.timeout) opts.timeout = distTimeout;
		}

		// Max calling level check to avoid calling loops
		if (
			this.broker.options.maxCallLevel > 0 &&
			this.level >= this.broker.options.maxCallLevel
		) {
			return this.broker.Promise.reject(
				new MaxCallLevelError({ nodeID: this.broker.nodeID, level: this.level })
			);
		}

		const p = this.broker.call(actionName, params, opts);

		// Merge metadata with sub context metadata
		return p
			.then(res => {
				if (p.ctx) mergeMeta(this, p.ctx.meta);

				return res;
			})
			.catch(err => {
				if (p.ctx) mergeMeta(this, p.ctx.meta);

				return this.broker.Promise.reject(err);
			});
	}

	/**
	 * @overload
	 * @param {Record<string, MCallDefinition>} def
	 * @param {MCallCallingOptions=} _opts
	 * @returns {Promise<Record<string, TResult>>}
	 */
	/**
	 * @overload
	 * @param {MCallDefinition[]} def
	 * @param {MCallCallingOptions=} _opts
	 * @returns {Promise<TResult[]>}
	 */
	/**
	 * Multiple action calls.
	 *
	 * @template TResult
	 * @param {Record<string, MCallDefinition>|MCallDefinition[]} def
	 * @param {MCallCallingOptions=} _opts
	 * @returns {Promise<Record<string, TResult> | TResult[]>}
	 */
	mcall<TResult = any>(def: any, _opts?: any): Promise<TResult> {
		const opts = Object.assign(
			{
				parentCtx: this
			},
			_opts
		);

		if (this.options.timeout > 0 && this.startHrTime) {
			// Distributed timeout handling. Decrementing the timeout value with the elapsed time.
			// If the timeout below 0, skip the call.
			const diff = process.hrtime(this.startHrTime);
			const duration = diff[0] * 1e3 + diff[1] / 1e6;
			const distTimeout = this.options.timeout - duration;

			if (distTimeout <= 0) {
				const action = (Array.isArray(def) ? def : Object.values(def))
					.map(d => d.action)
					.join(", ");
				return this.broker.Promise.reject(
					new RequestSkippedError({ action, nodeID: this.broker.nodeID })
				);
			}

			if (!opts.timeout || distTimeout < opts.timeout) opts.timeout = distTimeout;
		}

		// Max calling level check to avoid calling loops
		if (
			this.broker.options.maxCallLevel > 0 &&
			this.level >= this.broker.options.maxCallLevel
		) {
			return this.broker.Promise.reject(
				new MaxCallLevelError({ nodeID: this.broker.nodeID, level: this.level })
			);
		}

		const p = this.broker.mcall(/** @type {MCallDefinition[]} */ def, opts);

		// Merge metadata with sub context metadata
		return p
			.then(res => {
				if (Array.isArray(p.ctx) && p.ctx.length)
					p.ctx.forEach(ctx => mergeMeta(this, ctx.meta));

				return res;
			})
			.catch(err => {
				if (Array.isArray(p.ctx) && p.ctx.length)
					p.ctx.forEach(ctx => mergeMeta(this, ctx.meta));

				return this.broker.Promise.reject(err);
			});
	}

	/**
	 * Emit an event (grouped & balanced global event)
	 *
	 * @param {string} eventName
	 * @param {any=} data
	 * @param {Object=} opts
	 * @returns {Promise}
	 *
	 * @example
	 * ctx.emit("user.created", { entity: user, creator: ctx.meta.user });
	 *
	 * @memberof Context
	 */
	emit<D = any>(eventName: string, data?: D, opts?: any): Promise<void> {
		opts = opts ?? {};
		opts.parentCtx = this;

		if (opts.groups && !Array.isArray(opts.groups)) opts.groups = [opts.groups];

		return this.broker.emit(eventName, data, opts);
	}

	/**
	 * Emit an event for all local & remote services
	 *
	 * @param {string} eventName
	 * @param {any=} data
	 * @param {Object=} opts
	 * @returns {Promise}
	 *
	 * @example
	 * ctx.broadcast("user.created", { entity: user, creator: ctx.meta.user });
	 *
	 * @memberof Context
	 */
	broadcast<D = any>(eventName: string, data?: D, opts?: any): Promise<void> {
		opts = opts ?? {};
		opts.parentCtx = this;

		if (opts.groups && !Array.isArray(opts.groups)) opts.groups = [opts.groups];

		return this.broker.broadcast(eventName, data, opts);
	}

	/**
	 * Start a new child tracing span.
	 *
	 * @param {String} name
	 * @param {Object=} opts
	 * @returns {Span}
	 * @memberof Context
	 */
	startSpan(name, opts) {
		let span;
		if (this.span) {
			span = this.span.startSpan(name, Object.assign({ ctx: this }, opts));
		} else {
			span = this.broker.tracer.startSpan(name, Object.assign({ ctx: this }, opts));
		}

		this._spanStack.push(span);
		this.span = span;

		return span;
	}

	/**
	 * Finish an active span.
	 *
	 * @param {Span} span
	 * @param {Number=} time
	 */
	finishSpan(span: Span, time?: number) {
		if (!span.isActive()) return;

		span.finish(time);

		const idx = this._spanStack.findIndex(sp => sp == span);
		if (idx !== -1) {
			this._spanStack.splice(idx, 1);
			this.span = this._spanStack[this._spanStack.length - 1];
		} else {
			/* istanbul ignore next */
			this.service.logger.warn("This span is not assigned to this context", span);
		}
	}

	/**
	 * Convert Context to a printable POJO object.
	 */
	toJSON(): Record<string, any> {
		const res = pick(this, [
			"id",
			"nodeID",
			"action.name",
			"event.name",
			"service.name",
			"service.version",
			"service.fullName",
			"options",
			"parentID",
			"caller",
			"level",
			"params",
			"meta",
			"headers",
			"responseHeaders",
			//"locals",
			"requestID",
			"tracing",
			"span",
			"needAck",
			"ackID",
			"eventName",
			"eventType",
			"eventGroups",
			"cachedResult"
		]);

		return res;
	}

	/* istanbul ignore next */
	[util.inspect.custom](depth, options) {
		// https://nodejs.org/docs/latest-v8.x/api/util.html#util_custom_inspection_functions_on_objects
		if (depth < 0) {
			return options.stylize("[Context]", "special");
		}

		const inner = util.inspect(this.toJSON(), options);
		return `${options.stylize("Context", "special")}< ${inner} >`;
	}
}

export = Context;
