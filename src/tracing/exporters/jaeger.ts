/*
 * moleculer
 * Copyright (c) 2025 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type { BaseTraceExporterOptions } from "./base";
import type Span from "../span";
import type Tracer from "../tracer";

declare namespace JaegerTraceExporter {
	export interface JaegerTraceExporterOptions extends BaseTraceExporterOptions {
		endpoint?: string;
		host?: string;
		port?: number;

		sampler?: {
			type?: string;
			options?: {
				maxTracesPerSecond?: number;
				initBalance?: number;
				samplingRate?: number;
				lowerBound?: number;
				decision?: number;
				[key: string]: any;
			};
		};

		tracerOptions?: Record<string, any>;
		defaultTags?: Tracer.TracerDefaultTagsFunction | Record<string, any>;
		legacyMode?: boolean;
	}
}

import _ from "lodash";
import BaseTraceExporter from "./base";
import { isFunction } from "../../utils";

let Jaeger, GuaranteedThroughputSampler, RemoteControlledSampler, UDPSender, HTTPSender;

/**
 * Trace Exporter for Jaeger.
 *
 * http://jaeger.readthedocs.io/en/latest/getting_started/#all-in-one-docker-image
 *
 * @class JaegerTraceExporter
 */
class JaegerTraceExporter extends BaseTraceExporter {
	tracers: any;
	defaultTags: any;
	opts: JaegerTraceExporter.JaegerTraceExporterOptions;
	/**
	 * Creates an instance of JaegerTraceExporter.
	 * @param {JaegerTraceExporterOptions?} opts
	 * @memberof JaegerTraceExporter
	 */
	constructor(opts: JaegerTraceExporter.JaegerTraceExporterOptions) {
		super(opts);

		/** @type {JaegerTraceExporterOptions} */
		this.opts = _.defaultsDeep(this.opts, {
			/** @type {String?} HTTP Reporter endpoint - is set, HTTP Reporter will be used. */
			endpoint: null,
			/** @type {String} UDP Sender host option. */
			host: "127.0.0.1",
			/** @type {Number?} UDP Sender port option. */
			port: 6832,

			/** @type {Object?} Sampler configuration. */
			sampler: {
				/** @type {String?} Sampler type */
				type: "Const",

				/** @type {Object?} Sampler specific options. */
				options: {}
			},

			/** @type {Object?} Additional options for `Jaeger.Tracer` */
			tracerOptions: {},

			/** @type {Object?} Default span tags */
			defaultTags: null,

			/** @type {boolean?} Use legacy mode with 64 bit trace ids*/
			legacyMode: true
		});

		this.tracers = {};
	}

	/**
	 * Initialize Trace Exporter.
	 *
	 * @param {Tracer} tracer
	 * @memberof JaegerTraceExporter
	 */
	init(tracer: Tracer) {
		super.init(tracer);

		try {
			Jaeger = require("jaeger-client");
			GuaranteedThroughputSampler =
				require("jaeger-client/dist/src/samplers/guaranteed_throughput_sampler").default;
			RemoteControlledSampler =
				require("jaeger-client/dist/src/samplers/remote_sampler").default;
			UDPSender = require("jaeger-client/dist/src/reporters/udp_sender").default;
			HTTPSender = require("jaeger-client/dist/src/reporters/http_sender").default;
		} catch (err) {
			/* istanbul ignore next */
			this.tracer.broker.fatal(
				"The 'jaeger-client' package is missing! Please install it with 'npm install jaeger-client --save' command!",
				err,
				true
			);
		}

		this.defaultTags = isFunction(this.opts.defaultTags)
			? this.opts.defaultTags.call(this, tracer)
			: this.opts.defaultTags;
		if (this.defaultTags) {
			this.defaultTags = this.flattenTags(this.defaultTags);
		}
	}

	/**
	 * Stop Trace exporter
	 */
	stop() {
		if (this.tracers) {
			return this.broker.Promise.all(
				Object.values(this.tracers).map((tracer: any) => tracer.close())
			);
		}
		return this.broker.Promise.resolve();
	}

	/**
	 * Get reporter instance for Tracer
	 *
	 */
	getReporter(): any {
		let reporter;

		if (this.opts.endpoint) {
			reporter = new HTTPSender({ endpoint: this.opts.endpoint, logger: this.logger });
		} else {
			reporter = new UDPSender({
				host: this.opts.host,
				port: this.opts.port,
				logger: this.logger
			});
		}

		return new Jaeger.RemoteReporter(reporter);
	}

	/**
	 * Get sampler instance for Tracer
	 *
	 * @param {string} serviceName
	 */
	getSampler(serviceName: string): any {
		if (isFunction(this.opts.sampler)) return this.opts.sampler;

		if (this.opts.sampler.type == "RateLimiting")
			return new Jaeger.RateLimitingSampler(
				this.opts.sampler.options.maxTracesPerSecond,
				this.opts.sampler.options.initBalance
			);

		if (this.opts.sampler.type == "Probabilistic")
			return new Jaeger.ProbabilisticSampler(this.opts.sampler.options.samplingRate);

		if (this.opts.sampler.type == "GuaranteedThroughput")
			return new GuaranteedThroughputSampler(
				this.opts.sampler.options.lowerBound,
				this.opts.sampler.options.samplingRate
			);

		if (this.opts.sampler.type == "RemoteControlled")
			return new RemoteControlledSampler(serviceName, this.opts.sampler.options);

		return new Jaeger.ConstSampler(
			this.opts.sampler.options && this.opts.sampler.options.decision != null
				? this.opts.sampler.options.decision
				: 1
		);
	}

	/**
	 * Get a tracer instance by service name
	 *
	 * @param {string} serviceName
	 */
	getTracer(serviceName: string): any {
		if (this.tracers[serviceName]) return this.tracers[serviceName];

		const sampler = this.getSampler(serviceName);
		const reporter = this.getReporter();

		const tracer = new Jaeger.Tracer(
			serviceName,
			reporter,
			sampler,
			Object.assign({ logger: this.logger }, this.opts.tracerOptions)
		);
		this.tracers[serviceName] = tracer;

		return tracer;
	}

	/**
	 * Span is finished.
	 *
	 * @param {Span} span
	 * @memberof JaegerTraceExporter
	 */
	spanFinished(span: Span) {
		this.generateJaegerSpan(span);
	}

	/**
	 * Create Jaeger tracing span
	 *
	 * @param {Span} span
	 * @returns {Object}
	 */
	generateJaegerSpan(span: Span): any {
		const serviceName = span.service ? span.service.fullName : "no-service";
		const tracer = this.getTracer(serviceName);

		let parentCtx;
		if (span.parentID) {
			parentCtx = new Jaeger.SpanContext(
				this.convertTraceID(span.traceID), // traceId,
				this.convertSpanID(span.parentID), // spanId,
				null, // parentId,
				null, // traceIdStr
				null, // spanIdStr
				null, // parentIdStr
				1, // flags
				{}, // baggage
				"" // debugId
			);
		}

		const jaegerSpan = tracer.startSpan(span.name, {
			startTime: span.startTime,
			childOf: parentCtx,
			tags: this.flattenTags(
				_.defaultsDeep(
					{
						"span.type": span.type
					},
					span.tags,
					this.defaultTags
				)
			)
		});

		this.addLogs(jaegerSpan, span.logs);

		this.addTags(jaegerSpan, "service", serviceName);
		this.addTags(
			jaegerSpan,
			Jaeger.opentracing.Tags.SPAN_KIND,
			Jaeger.opentracing.Tags.SPAN_KIND_RPC_SERVER
		);

		const sc = jaegerSpan.context();
		sc.traceId = this.convertTraceID(span.traceID);
		sc.spanId = this.convertSpanID(span.id);

		if (span.error) {
			this.addTags(jaegerSpan, Jaeger.opentracing.Tags.ERROR, true);
			this.addTags(jaegerSpan, "error", this.errorToObject(span.error));
		}

		jaegerSpan.finish(span.finishTime);

		return jaegerSpan;
	}

	/**
	 * Add logs to span
	 *
	 * @param {any} span
	 * @param {SpanLogEntry[]} logs
	 */
	addLogs(span: any, logs: Span.SpanLogEntry[]) {
		if (Array.isArray(logs)) {
			logs.forEach(log => {
				span.log(
					{
						event: log.name,
						payload: log.fields
					},
					log.time
				);
			});
		}
	}

	/**
	 * Add tags to span
	 *
	 * @param {any} span
	 * @param {String} key
	 * @param {any} value
	 * @param {String=} prefix
	 */
	addTags(span: any, key: string, value: any, prefix?: string) {
		const name = prefix ? `${prefix}.${key}` : key;
		if (value != null && typeof value == "object") {
			Object.keys(value).forEach(k => this.addTags(span, k, value[k], name));
		} else if (value !== undefined) {
			span.setTag(name, value);
		}
	}

	/**
	 * Convert Trace/Span ID to Jaeger format
	 *
	 * @param {String} id
	 * @returns {Buffer}
	 */
	convertSpanID(id) {
		if (id) return Buffer.from(id.replace(/-/g, "").substring(0, 16), "hex");

		return null;
	}

	/**
	 * Convert Trace ID to Jaeger format. Return 128 bit IDs or 64 bit IDs if legacy is set.
	 *
	 * @param {String} id
	 * @returns {String}
	 */
	convertTraceID(id) {
		if (id)
			return Buffer.from(
				id.replace(/-/g, "").substring(0, this.opts.legacyMode ? 16 : 32),
				"hex"
			);

		return null;
	}
}

export = JaegerTraceExporter;
