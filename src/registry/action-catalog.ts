/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type { ActionSchema } from "../service";
import type Node = require("./node");
import type ServiceItem = require("./service-item");
import type ServiceBroker = require("../service-broker");
import type Registry = require("./registry");
import type Strategy = require("../strategies/base");

declare namespace ActionCatalog {
	export interface ActionCatalogListOptions {
		onlyLocal?: boolean;
		onlyAvailable?: boolean;
		skipInternal?: boolean;
		withEndpoints?: boolean;
	}

	interface ActionEndpointList {
		nodeID: string;
		state: boolean;
		available: boolean;
	}

	export interface ActionCatalogListResult {
		name: string;
		count: number;
		hasLocal: boolean;
		available: boolean;
		action?: Omit<ActionSchema, "handler" | "remoteHandler" | "service">;
		endpoints?: ActionEndpointList[];
	}
}

import _ = require("lodash");
import Strategies = require("../strategies");
import EndpointList = require("./endpoint-list");
import ActionEndpoint = require("./endpoint-action");

/**
 * Catalog class to store service actions
 *
 * @class ActionCatalog
 */
class ActionCatalog {
	registry: Registry;
	broker: ServiceBroker;
	logger: any;
	actions: Map<string, any>;
	StrategyFactory: typeof Strategy;
	EndpointFactory: typeof ActionEndpoint;
	/**
	 * Creates an instance of ActionCatalog.
	 *
	 * @param {Registry} registry
	 * @param {ServiceBroker} broker
	 * @param {typeof Strategies.Base} StrategyFactory
	 * @memberof ActionCatalog
	 */
	constructor(registry: Registry, broker: ServiceBroker, StrategyFactory: typeof Strategy) {
		this.registry = registry;
		this.broker = broker;
		this.logger = registry.logger;
		this.StrategyFactory = StrategyFactory;

		this.actions = new Map();

		this.EndpointFactory = ActionEndpoint;
	}

	/**
	 * Add an action
	 *
	 * @param {Node} node
	 * @param {ServiceItem} service
	 * @param {ActionSchema} action
	 * @returns {EndpointList}
	 * @memberof ActionCatalog
	 */
	add(node: Node, service: ServiceItem, action: ActionSchema): EndpointList<ActionEndpoint> {
		let list = this.actions.get(action.name);
		if (!list) {
			const strategyFactory = action.strategy
				? Strategies.resolve(action.strategy) || this.StrategyFactory
				: this.StrategyFactory;
			const strategyOptions = action.strategyOptions
				? action.strategyOptions
				: this.registry.opts.strategyOptions;
			// Create a new EndpointList
			list = new EndpointList(
				this.registry,
				this.broker,
				action.name,
				null,
				this.EndpointFactory,
				strategyFactory,
				strategyOptions
			);
			this.actions.set(action.name, list);
		}

		list.add(node, service, action);

		return list;
	}

	/**
	 * Get action by name
	 *
	 * @param {string} actionName
	 * @returns
	 * @memberof ActionCatalog
	 */
	get(actionName: string): EndpointList<ActionEndpoint> | undefined {
		return this.actions.get(actionName);
	}

	/**
	 * Check the action is available (there is live endpoint)
	 *
	 * @param {string} actionName
	 * @returns {boolean}
	 * @memberof ActionCatalog
	 */
	isAvailable(actionName: string): boolean {
		const list = this.actions.get(actionName);
		if (list) return list.hasAvailable();

		return false;
	}

	/**
	 * Remove all actions by service
	 *
	 * @param {ServiceItem} service
	 * @memberof ActionCatalog
	 */
	removeByService(service: ServiceItem) {
		this.actions.forEach(list => {
			list.removeByService(service);
		});
	}

	/**
	 * Remove action by name & nodeID
	 *
	 * @param {string} actionName
	 * @param {string} nodeID
	 * @memberof ActionCatalog
	 */
	remove(actionName: string, nodeID: string) {
		const list = this.actions.get(actionName);
		if (list) list.removeByNodeID(nodeID);
	}

	/**
	 * Get a filtered list of actions
	 *
	 * @param {ActionCatalogListOptions} opts
	 * @returns {Array<ActionCatalogListResult>}
	 *
	 * @memberof ActionCatalog
	 */
	list({
		onlyLocal = false,
		onlyAvailable = false,
		skipInternal = false,
		withEndpoints = false
	} = {}) {
		const res = [];

		this.actions.forEach((list, key) => {
			if (skipInternal && /^\$/.test(key)) return;

			if (onlyLocal && !list.hasLocal()) return;

			if (onlyAvailable && !list.hasAvailable()) return;

			const item: Record<string, any> = {
				name: key,
				count: list.count(),
				hasLocal: list.hasLocal(),
				available: list.hasAvailable()
			};

			if (item.count > 0) {
				const ep = list.endpoints[0];
				if (ep) item.action = _.omit(ep.action, ["handler", "remoteHandler", "service"]);
			}
			if (item.action && item.action.protected === true) return;

			if (withEndpoints) {
				if (item.count > 0) {
					item.endpoints = list.endpoints.map(ep => {
						return {
							nodeID: ep.node.id,
							state: ep.state,
							available: ep.node.available
						};
					});
				}
			}

			res.push(item);
		});

		return res;
	}
}

export = ActionCatalog;
