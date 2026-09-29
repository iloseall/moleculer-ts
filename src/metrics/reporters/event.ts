/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import BaseMetric = require("../types/base");
import MetricBaseReporter = require("./base");
import MetricRegistry = require("../registry");

declare namespace EventReporter {
	export interface EventReporterOptions extends MetricBaseReporter.MetricReporterOptions {
		eventName?: string;

		broadcast?: boolean;
		groups?: string | string[];

		onlyChanges?: boolean;

		interval?: number;
	}
}

import BaseReporter = require("./base");
import _ = require("lodash");

/**
 * Event reporter for Moleculer Metrics
 *
 * @class EventReporter
 * @extends {BaseReporter}
 */
class EventReporter extends BaseReporter {
	lastChanges: any;
	opts: EventReporter.EventReporterOptions;
	timer: NodeJS.Timeout;
	/**
	 * Creates an instance of EventReporter.
	 * @param {EventReporterOptions} opts
	 * @memberof EventReporter
	 */
	constructor(opts?: EventReporter.EventReporterOptions) {
		super(opts);

		/** @type {EventReporterOptions} */
		this.opts = _.defaultsDeep(this.opts, {
			eventName: "$metrics.snapshot",

			broadcast: false,
			groups: null,

			onlyChanges: false,

			interval: 5
		});

		this.lastChanges = new Set();
	}

	/**
	 * Initialize reporter.
	 *
	 * @param {MetricRegistry} registry
	 * @memberof EventReporter
	 */
	init(registry: MetricRegistry) {
		super.init(registry);

		if (this.opts.interval > 0) {
			this.timer = setInterval(() => this.sendEvent(), this.opts.interval * 1000);
			this.timer.unref();
		}
	}

	/**
	 * Send metrics snapshot via event.
	 *
	 * @memberof EventReporter
	 */
	sendEvent() {
		let list = this.registry.list({
			includes: this.opts.includes,
			excludes: this.opts.excludes
		});

		if (this.opts.onlyChanges) list = list.filter(metric => this.lastChanges.has(metric.name));

		if (list.length === 0) return;

		if (this.opts.broadcast) {
			this.logger.debug(`Send metrics.snapshot (${list.length} metrics) broadcast events.`);
			this.broker.broadcast(this.opts.eventName, list, { groups: this.opts.groups });
		} else {
			this.logger.debug(`Send metrics.snapshot (${list.length} metrics) events.`);
			this.broker.emit(this.opts.eventName, list, { groups: this.opts.groups });
		}

		this.lastChanges.clear();
	}

	/**
	 * Some metric has been changed.
	 *
	 * @param {BaseMetric} metric
	 * @memberof BaseReporter
	 */
	metricChanged(metric: BaseMetric<any>) {
		if (!this.matchMetricName(metric.name)) return;

		this.lastChanges.add(metric.name);
	}
}

export = EventReporter;
