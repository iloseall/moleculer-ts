/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type ServiceBroker from "../service-broker";
import type Registry from "../registry/registry";
import type Endpoint from "../registry/endpoint";

import BaseStrategy from "./base";

/**
 * Round-robin strategy class
 *
 */
class RoundRobinStrategy extends BaseStrategy {
	counter: number;
	constructor(registry: Registry, broker: ServiceBroker, opts?: object) {
		super(registry, broker, opts);

		this.counter = 0;
	}

	/**
	 * Select an endpoint.
	 *
	 * @param {Endpoint[]} list
	 *
	 * @returns {Endpoint}
	 * @memberof BaseStrategy
	 */
	select(list: Endpoint[]) {
		// Reset counter
		if (this.counter >= list.length) {
			this.counter = 0;
		}
		return list[this.counter++];
	}
}

export = RoundRobinStrategy;
