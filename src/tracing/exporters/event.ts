/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type { BaseTraceExporterOptions } from "./base";
import type Span from "../span";
import type Tracer from "../tracer";

declare namespace EventTraceExporter {
	export type EventTraceExporterSpanConverter = (span: Span) => Record<string, any>;

	export interface EventTraceExporterOptions extends BaseTraceExporterOptions {
		eventName?: string;

		sendStartSpan?: boolean;
		sendFinishSpan?: boolean;

		broadcast?: boolean;

		groups?: string[];

		interval?: number;

		spanConverter?: EventTraceExporterSpanConverter;

		defaultTags?: Tracer.TracerDefaultTagsFunction | Record<string, any>;
	}
}

import _ from "lodash";
import BaseTraceExporter from "./base";
import { isFunction } from "../../utils";

/**
 * Event Trace Exporter.
 *
 * @class EventTraceExporter
 */
class EventTraceExporter extends BaseTraceExporter {
	queue: any[];
	timer: any;
	defaultTags: any;
	opts: EventTraceExporter.EventTraceExporterOptions;
	/**
	 * Creates an instance of EventTraceExporter.
	 * @param {EventTraceExporterOptions?} opts
	 * @memberof EventTraceExporter
	 */
	constructor(opts: EventTraceExporter.EventTraceExporterOptions) {
		super(opts);

		/** @type {EventTraceExporterOptions} */
		this.opts = _.defaultsDeep(this.opts, {
			eventName: "$tracing.spans",

			sendStartSpan: false,
			sendFinishSpan: true,

			broadcast: false,

			groups: null,

			interval: 5,

			spanConverter: null,

			defaultTags: null
		});

		this.queue = [];
	}

	/**
	 * Initialize Trace Exporter.
	 *
	 * @param {Tracer} tracer
	 * @memberof EventTraceExporter
	 */
	init(tracer: Tracer) {
		super.init(tracer);

		if (this.opts.interval > 0) {
			this.timer = setInterval(() => this.flush(), this.opts.interval * 1000);
			this.timer.unref();
		}

		this.defaultTags = isFunction(this.opts.defaultTags)
			? this.opts.defaultTags.call(this, tracer)
			: this.opts.defaultTags;
	}

	/**
	 * Stop Trace exporter
	 */
	stop() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
		return this.Promise.resolve();
	}

	/**
	 * Span is started.
	 *
	 * @param {Span} span
	 * @memberof BaseTraceExporter
	 */
	spanStarted(span: Span) {
		if (this.opts.sendStartSpan) {
			if (span.tags.eventName == this.opts.eventName) return;

			this.queue.push(span);
			if (!this.timer) this.flush();
		}
	}

	/**
	 * Span is finished.
	 *
	 * @param {Span} span
	 * @memberof EventTraceExporter
	 */
	spanFinished(span: Span) {
		if (this.opts.sendFinishSpan) {
			if (span.tags.eventName == this.opts.eventName) return;

			this.queue.push(span);
			if (!this.timer) this.flush();
		}
	}

	/**
	 * Flush tracing data to Datadog server
	 *
	 * @memberof EventTraceExporter
	 */
	flush() {
		if (this.queue.length === 0) return;

		const data = this.generateTracingData();
		this.queue.length = 0;

		if (this.opts.broadcast) {
			this.logger.debug(`Send tracing spans (${data.length} spans) broadcast events.`);
			this.broker.broadcast(this.opts.eventName, data, { groups: this.opts.groups });
		} else {
			this.logger.debug(`Send tracing spans (${data.length} spans) events.`);
			this.broker.emit(this.opts.eventName, data, { groups: this.opts.groups });
		}
	}

	/**
	 * Generate tracing data with custom converter
	 *
	 * @returns {Record<string, any>[]}
	 * @memberof EventTraceExporter
	 */
	generateTracingData(): Record<string, any>[] {
		if (isFunction(this.opts.spanConverter))
			return this.queue.map(span => this.opts.spanConverter.call(this, span));

		return Array.from(this.queue).map(span => {
			const newSpan = Object.assign({}, span);
			if (newSpan.error) newSpan.error = this.errorToObject(span.error);

			return newSpan;
		});
	}
}

export = EventTraceExporter;
