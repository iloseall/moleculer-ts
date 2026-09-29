/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import BaseMetric = require("../types/base");
import MetricRegistry = require("../registry");
import MetricBaseReporter = require("./base");

declare namespace StatsDReporter {
	export interface StatsDReporterOptions extends MetricBaseReporter.MetricReporterOptions {
		host?: string;
		port?: number;
		maxPayloadSize?: number;

		types?: string | string[];
	}
}

import BaseReporter = require("./base");
import _ = require("lodash");
import dgram = require("dgram");
import METRIC = require("../constants");

/**
 * UDP (StatsD) reporter for Moleculer.
 *
 * @class DatadogReporter
 * @extends {BaseReporter}
 */
class StatsDReporter extends BaseReporter {
	defaultLabels: any;
	opts: StatsDReporter.StatsDReporterOptions;
	/**
	 * Constructor of StatsDReporters
	 *
	 * @param {StatsDReporterOptions} opts
	 * @memberof StatsDReporter
	 */
	constructor(opts?: StatsDReporter.StatsDReporterOptions) {
		super(opts);

		/** @type {StatsDReporterOptions} */
		this.opts = _.defaultsDeep(this.opts, {
			host: "localhost",
			port: 8125,

			types: null,

			maxPayloadSize: 1300
		});
	}

	/**
	 * Initialize reporter.
	 *
	 * @param {MetricRegistry} registry
	 * @memberof StatsDReporter
	 */
	init(registry: MetricRegistry) {
		super.init(registry);

		this.flush();
	}

	/**
	 * Flush metric data
	 *
	 * @memberof StatsDReporter
	 */
	flush() {
		const series = this.generateStatsDSeries();

		if (series.length === 0) return;

		this.sendChunks(series);
	}

	/**
	 * Create & send chunks.
	 *
	 * @param {Array<Object>} series
	 */
	sendChunks(series: Array<any>) {
		let len = 0;

		const chunks = [];

		while (series.length > 0 && (!this.opts.maxPayloadSize || len < this.opts.maxPayloadSize)) {
			const item = series.shift();
			chunks.push(item);
			len += item.length;
		}

		if (chunks.length > 0) {
			this.send(Buffer.from(chunks.join("\n")));
		}

		if (series.length > 0) {
			setTimeout(() => this.sendChunks(series), 100);
		}
	}

	/**
	 * Send concatenated data to StatsD server via UDP
	 *
	 * @param {Buffer} buf
	 */
	send(buf: Buffer) {
		//this.logger.info("Buffer\n" + buf.toString());
		const sock = dgram.createSocket("udp4");
		sock.send(buf, 0, buf.length, this.opts.port, this.opts.host, (err, bytes) => {
			if (err) {
				this.logger.warn(
					"Unable to send metrics to StatsD server. Error:" + err.message,
					err
				);
			} else {
				this.logger.debug("Metrics are uploaded to StatsD. Sent bytes:", bytes);
			}

			sock.close();
		});
	}

	/**
	 * Generate metric data.
	 *
	 * @returns {Array<Object>}
	 * @memberof StatsDReporter
	 */
	generateStatsDSeries(): Array<string> {
		const series = [];

		const list = this.registry.list({
			types: this.opts.types,
			includes: this.opts.includes,
			excludes: this.opts.excludes
		});

		list.forEach(metric => {
			metric.values.forEach(item => {
				const line = this.generateStatDLine(metric, item);
				if (line) series.push(line);
			});
		});

		return series;
	}

	generateStatDLine(metric: any, item: any, lastValue?: any): string {
		const metricName = this.formatMetricName(metric.name);

		switch (metric.type) {
			case METRIC.TYPE_COUNTER: {
				let line = `${metricName}:${item.value}|c`;
				if (metric.labelNames.length > 0) line += "|#" + this.labelsToTags(item.labels);
				return line;
			}
			case METRIC.TYPE_GAUGE: {
				let line = `${metricName}:${item.value}|g`;
				if (metric.labelNames.length > 0) line += "|#" + this.labelsToTags(item.labels);
				return line;
			}
			case METRIC.TYPE_INFO: {
				let line = `${metricName}:${
					typeof item.value == "number" ? item.value : '"' + item.value + '"'
				}|s`;
				if (metric.labelNames.length > 0) line += "|#" + this.labelsToTags(item.labels);
				return line;
			}
			case METRIC.TYPE_HISTOGRAM: {
				if (lastValue != null) {
					let line = `${metricName}:${lastValue}|ms`;
					if (metric.labelNames.length > 0) line += "|#" + this.labelsToTags(item.labels);
					return line;
				}
			}
		}
	}

	/**
	 * Some metric has been changed.
	 *
	 * @param {BaseMetric} metric
	 * @param {any} value
	 * @param {Object} labels
	 *
	 * @memberof BaseReporter
	 */
	metricChanged(metric: BaseMetric<any>, value: any, labels: any) {
		if (!this.matchMetricName(metric.name)) return;

		const line = this.generateStatDLine(metric, metric.get(labels), value);
		if (line) {
			this.send(Buffer.from(line));
		}
	}

	/**
	 * Escape label value characters.
	 * @param {String} str
	 * @returns {String}
	 * @memberof DatadogReporter
	 */
	escapeLabelValue(str: string): string {
		if (typeof str == "string") return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
		return str;
	}

	/**
	 * Convert labels to StatsD label string
	 *
	 * @param {Object} itemLabels
	 * @returns {String}
	 *
	 * @memberof StatsDReporter
	 */
	labelsToTags(itemLabels) {
		const labels = Object.assign({}, this.defaultLabels || {}, itemLabels || {});
		const keys = Object.keys(labels);
		if (keys.length === 0) return "";

		return keys
			.map(key => `${this.formatLabelName(key)}:${this.escapeLabelValue(labels[key])}`)
			.join(",");
	}
}

export = StatsDReporter;
