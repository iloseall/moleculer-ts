/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import GaugeMetric from "./gauge";
import * as METRIC from "../constants";

/**
 * Counter metric class.
 *
 * @class CounterMetric
 * @extends {GaugeMetric}
 */
class CounterMetric extends GaugeMetric {
	/**
	 * Creates an instance of CounterMetric.
	 * @param {GaugeMetricOptions} opts
	 * @param {MetricRegistry} registry
	 * @memberof CounterMetric
	 */
	constructor(opts, registry) {
		super(opts, registry);
		this.type = METRIC.TYPE_COUNTER;
	}

	/**
	 * Disabled decrement method.
	 *
	 * @memberof CounterMetric
	 */
	decrement(...args: any[]): void {
		throw new Error("Counter can't be decreased.");
	}
}

export = CounterMetric;
