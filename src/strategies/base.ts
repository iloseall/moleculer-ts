/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type Context = require("../context");
import type ServiceBroker = require("../service-broker");
import type Registry = require("../registry/registry");
import type Endpoint = require("../registry/endpoint");

/**
 * Base strategy class
 *
 */
class BaseStrategy {
	registry: Registry;
	broker: ServiceBroker;
	opts: Record<string, any>;
	/**
	 * Constructor
	 *
	 * @param {Registry} registry
	 * @param {ServiceBroker} broker
	 * @param {Record<string, any>?} opts
	 */
	constructor(registry: Registry, broker: ServiceBroker, opts?: object) {
		this.registry = registry;
		this.broker = broker;
		this.opts = opts || {};
	}

	/**
	 * Select an endpoint.
	 *
	 * @param {Endpoint[]} list
	 * @param {Context?} ctx
	 * @returns {Endpoint}
	 * @memberof BaseStrategy
	 */
	select(list: Endpoint[], ctx?: Context): Endpoint | null {
		/* istanbul ignore next */
		throw new Error("Not implemented method!");
	}
}

export = BaseStrategy;
