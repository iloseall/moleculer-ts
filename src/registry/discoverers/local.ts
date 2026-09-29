/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type Registry from "../registry";
import type Node from "../node";

declare namespace LocalDiscoverer {
	export interface LocalDiscovererOptions extends BaseDiscoverer.DiscovererOptions {}
}

import BaseDiscoverer from "./base";

/**
 * Local (built-in) Discoverer class
 *
 * @class Discoverer
 */
class LocalDiscoverer extends BaseDiscoverer {
	/**
	 * Creates an instance of Discoverer.
	 *
	 * @param {LocalDiscovererOptions?} opts
	 * @memberof LocalDiscoverer
	 */
	constructor(opts?: LocalDiscoverer.LocalDiscovererOptions) {
		super(opts);
	}

	/**
	 * Initialize Discoverer
	 *
	 * @param {any} registry
	 *
	 * @memberof LocalDiscoverer
	 */
	init(registry: Registry) {
		super.init(registry);
	}

	/**
	 * Discover a new or old node.
	 *
	 * @param {String} nodeID
	 * @returns {Promise<Node | void>}
	 */
	discoverNode(nodeID: string): Promise<Node | void> {
		if (!this.transit) return this.Promise.resolve();
		return this.transit.discoverNode(nodeID);
	}

	/**
	 * Discover all nodes (after connected)
	 * @returns {Promise<Node[] | void>}
	 */
	discoverAllNodes(): Promise<Node[] | void> {
		if (!this.transit) return this.Promise.resolve();
		return this.transit.discoverNodes();
	}

	/**
	 * Local service registry has been changed. We should notify remote nodes.
	 *
	 * @param {String=} nodeID
	 * @returns {Promise<void>}
	 */
	sendLocalNodeInfo(nodeID?: string): Promise<void> {
		if (!this.transit) return this.Promise.resolve();

		const info = this.broker.getLocalNodeInfo();

		const p =
			!nodeID && this.broker.options.disableBalancer
				? this.transit.tx.makeBalancedSubscriptions()
				: this.Promise.resolve();
		return p.then(() => this.transit.sendNodeInfo(info, nodeID));
	}
}

export = LocalDiscoverer;
