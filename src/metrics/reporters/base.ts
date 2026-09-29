/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type ServiceBroker from "../../service-broker";
import type MetricRegistry from "../registry";
import type { Logger } from "../../logger-factory";

declare namespace MetricBaseReporter {
	export interface MetricReporterOptions {
		includes?: string | string[];
		excludes?: string | string[];

		metricNamePrefix?: string;
		metricNameSuffix?: string;

		metricNameFormatter?: (name: string) => string;
		labelNameFormatter?: (name: string) => string;
	}
}

import _ from "lodash";
import { match, isString } from "../../utils";

/**
 * Metric reporter base class.
 *
 * @class MetricBaseReporter
 */
class MetricBaseReporter {
	opts: any;
	broker: ServiceBroker;
	registry: MetricRegistry;
	logger: Logger;
	/**
	 * Creates an instance of BaseReporter.
	 *
	 * @param {MetricReporterOptions?} opts
	 * @memberof MetricBaseReporter
	 */
	constructor(opts?: MetricBaseReporter.MetricReporterOptions) {
		this.opts = _.defaultsDeep(opts, {
			includes: null,
			excludes: null,

			metricNamePrefix: null,
			metricNameSuffix: null,

			metricNameFormatter: null,
			labelNameFormatter: null
		});

		if (isString(this.opts.includes)) this.opts.includes = [this.opts.includes];
		if (isString(this.opts.excludes)) this.opts.excludes = [this.opts.excludes];
	}

	/**
	 * Initialize reporter
	 *
	 * @param {MetricRegistry} registry
	 * @memberof MetricBaseReporter
	 */
	init(registry: MetricRegistry) {
		this.registry = registry;
		this.broker = this.registry.broker;
		this.logger = this.registry.logger;
	}

	/**
	 * Stop reporter
	 *
	 * @memberof MetricBaseReporter
	 */
	stop(): Promise<void> {
		return Promise.resolve();
	}

	/**
	 * Match the metric name. Check the `includes` & `excludes` patterns.
	 *
	 * @param {String} name
	 * @returns {boolean}
	 * @memberof MetricBaseReporter
	 */
	matchMetricName(name: string): boolean {
		if (Array.isArray(this.opts.includes)) {
			if (!this.opts.includes.some(pattern => match(name, pattern))) return false;
		}

		if (Array.isArray(this.opts.excludes)) {
			if (!this.opts.excludes.every(pattern => !match(name, pattern))) return false;
		}

		return true;
	}

	/**
	 * Format metric name. Add prefix, suffix and call custom formatter.
	 *
	 * @param {String} name
	 * @returns {String}
	 * @memberof MetricBaseReporter
	 */
	formatMetricName(name: string): string {
		name =
			(this.opts.metricNamePrefix ? this.opts.metricNamePrefix : "") +
			name +
			(this.opts.metricNameSuffix ? this.opts.metricNameSuffix : "");
		if (this.opts.metricNameFormatter) return this.opts.metricNameFormatter(name);
		return name;
	}

	/**
	 * Format label name. Call custom formatter.
	 *
	 * @param {String} name
	 * @returns {String}
	 * @memberof MetricBaseReporter
	 */
	formatLabelName(name: string): string {
		if (this.opts.labelNameFormatter) return this.opts.labelNameFormatter(name);
		return name;
	}

	/**
	 * Some metric has been changed.
	 *
	 * @param {BaseMetric} metric
	 * @param {any} value
	 * @param {Object} labels
	 * @param {Number?} timestamp
	 *
	 * @memberof MetricBaseReporter
	 */
	metricChanged(metric, value, labels, timestamp) {
		// Not implemented. Abstract method
	}
}

export = MetricBaseReporter;
