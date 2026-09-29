/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type ServiceBroker from "../service-broker";
import type Registry from "./registry";
import type Node from "./node";

/**
 * Endpoint class
 *
 * @class Endpoint
 */
class Endpoint {
	broker: ServiceBroker;
	registry: Registry;
	id: string;
	node: Node;
	local: boolean;
	state: boolean;
	/**
	 * Creates an instance of Endpoint.
	 * @param {Registry} registry
	 * @param {ServiceBroker} broker
	 * @param {Node} node
	 * @memberof Endpoint
	 */
	constructor(registry: Registry, broker: ServiceBroker, node: Node) {
		this.registry = registry;
		this.broker = broker;

		this.id = node.id;
		this.node = node;

		this.local = node.id === broker.nodeID;
		this.state = true;
	}

	destroy() {}

	/**
	 * Get availability
	 *
	 * @readonly
	 * @memberof Endpoint
	 */
	get isAvailable() {
		return this.state;
	}

	update(action?: any) {}
}

export = Endpoint;
