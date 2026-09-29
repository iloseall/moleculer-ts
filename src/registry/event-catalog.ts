/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import Node = require("./node");
import ServiceItem = require("./service-item");
import type { EventSchema } from "../service";
import ServiceBroker = require("../service-broker");
import Registry = require("./registry");
import Context = require("../context");
import Strategy = require("../strategies/base");

declare namespace EventCatalog {
	export interface EventCatalogListOptions {
		onlyLocal?: boolean;
		onlyAvailable?: boolean;
		skipInternal?: boolean;
		withEndpoints?: boolean;
	}

	interface EventEndpointList {
		nodeID: string;
		state: boolean;
		available: boolean;
	}

	export interface EventCatalogListResult {
		name: string;
		count: number;
		hasLocal: boolean;
		available: boolean;
		group: string;
		event?: Omit<EventSchema, "handler" | "remoteHandler" | "service">;
		endpoints?: EventEndpointList[];
	}
}

import _ = require("lodash");
import utils = require("../utils");
import Strategies = require("../strategies");
import EndpointList = require("./endpoint-list");
import EventEndpoint = require("./endpoint-event");

/**
 * Catalog for events
 *
 * @class EventCatalog
 */
class EventCatalog {
	logger: any;
	registry: Registry;
	broker: ServiceBroker;
	events: EndpointList<EventEndpoint>[];
	StrategyFactory: typeof Strategy;
	EndpointFactory: typeof EventEndpoint;
	/**
	 * Creates an instance of EventCatalog.
	 *
	 * @param {Registry} registry
	 * @param {ServiceBroker} broker
	 * @param {typeof import("../strategies/base")} StrategyFactory
	 * @memberof EventCatalog
	 */
	constructor(registry: Registry, broker: ServiceBroker, StrategyFactory: typeof Strategy) {
		this.registry = registry;
		this.broker = broker;
		this.logger = registry.logger;
		this.StrategyFactory = StrategyFactory;

		/** @type EndpointList<EventEndpoint>[] */
		this.events = [];

		this.EndpointFactory = EventEndpoint;
	}

	/**
	 * Add a new event
	 *
	 * @param {Node} node
	 * @param {ServiceItem} service
	 * @param {EventSchema} event
	 * @returns {EndpointList<EventEndpoint>}
	 * @memberof EventCatalog
	 */
	add(node: Node, service: ServiceItem, event: EventSchema): EndpointList<EventEndpoint> {
		const eventName = event.name;
		const groupName = event.group || service.name;
		let list = this.get(eventName, groupName);
		if (!list) {
			const strategyFactory = event.strategy
				? Strategies.resolve(event.strategy) || this.StrategyFactory
				: this.StrategyFactory;
			const strategyOptions = event.strategyOptions
				? event.strategyOptions
				: this.registry.opts.strategyOptions;
			// Create a new EndpointList
			list = new EndpointList(
				this.registry,
				this.broker,
				eventName,
				groupName,
				this.EndpointFactory,
				strategyFactory,
				strategyOptions
			);

			this.events.push(list);
		}

		list.add(node, service, event);

		return list;
	}

	/**
	 * Get an event by name (and group name)
	 *
	 * @param {String} eventName
	 * @param {String} groupName
	 * @returns {EndpointList<EventEndpoint>}
	 * @memberof EventCatalog
	 */
	get(eventName: string, groupName: string): EndpointList<EventEndpoint> | null {
		return this.events.find(list => list.name === eventName && list.group === groupName);
	}

	/**
	 * Get balanced endpoint for event
	 *
	 * @param {String} eventName
	 * @param {String|Array?} groups
	 * @param {Context} ctx
	 * @returns {[EventEndpoint, string][]}
	 * @memberof EventCatalog
	 */
	getBalancedEndpoints(eventName, groups, ctx) {
		const res = [];

		this.events.forEach(list => {
			if (!utils.match(eventName, list.name)) return;
			if (groups == null || groups.length === 0 || groups.indexOf(list.group) !== -1) {
				// Use built-in balancer, get the next endpoint
				const ep = list.next(ctx);
				if (ep && ep.isAvailable) res.push([ep, list.group]);
			}
		});

		return res;
	}

	/**
	 * Get all groups for event
	 *
	 * @param {string} eventName
	 * @returns {string[]}
	 * @memberof EventCatalog
	 */
	getGroups(eventName: string): string[] {
		return utils.uniq(
			this.events.filter(list => utils.match(eventName, list.name)).map(item => item.group)
		) as string[];
	}

	/**
	 * Get all endpoints for event
	 *
	 * @param {String} eventName
	 * @param {Array<String>?} groupNames
	 * @returns {EventEndpoint[]}
	 * @memberof EventCatalog
	 */
	getAllEndpoints(eventName: string, groupNames?: string[]): EventEndpoint[] {
		const res = [];
		this.events.forEach(list => {
			if (!utils.match(eventName, list.name)) return;
			if (
				groupNames == null ||
				groupNames.length === 0 ||
				groupNames.indexOf(list.group) !== -1
			) {
				list.endpoints.forEach(ep => {
					if (ep.isAvailable) res.push(ep);
				});
			}
		});

		return _.uniqBy(res, "id");
	}

	/**
	 * Call local service handlers
	 *
	 * @param {Context} ctx
	 * @returns {Promise<any>}
	 *
	 * @memberof EventCatalog
	 */
	emitLocalServices(ctx: Context): Promise<any> {
		const isBroadcast = ["broadcast", "broadcastLocal"].indexOf(ctx.eventType) !== -1;
		const sender = ctx.nodeID;

		const promises = [];

		this.events.forEach(list => {
			if (!utils.match(ctx.eventName, list.name)) return;
			if (
				ctx.eventGroups == null ||
				ctx.eventGroups.length === 0 ||
				ctx.eventGroups.indexOf(list.group) !== -1
			) {
				if (isBroadcast) {
					list.endpoints.forEach(ep => {
						if (ep.local && ep.event.handler) {
							const newCtx = ctx.copy(ep);
							newCtx.nodeID = sender;
							promises.push(this.callEventHandler(newCtx));
						}
					});
				} else {
					const ep = list.nextLocal();
					if (ep && ep.event.handler) {
						const newCtx = ctx.copy(ep);
						newCtx.nodeID = sender;
						promises.push(this.callEventHandler(newCtx));
					}
				}
			}
		});

		return this.broker.Promise.allSettled(promises).then(results => {
			const err = results.find(r => r.status == "rejected");
			// @ts-ignore
			if (err) return this.broker.Promise.reject(err.reason);
			return true;
		});
	}

	/**
	 * Call local event handler and handles unhandled promise rejections.
	 *
	 * @param {Context} ctx
	 *
	 * @memberof EventCatalog
	 */
	callEventHandler(ctx: Context): Promise<any> {
		// @ts-ignore
		return ctx.endpoint.event.handler(ctx);
	}

	/**
	 * Remove endpoints by service
	 *
	 * @param {ServiceItem} service
	 * @memberof EventCatalog
	 */
	removeByService(service: ServiceItem) {
		this.events.forEach(list => {
			list.removeByService(service);
		});
	}

	/**
	 * Remove endpoint by name & nodeId
	 *
	 * @param {String} eventName
	 * @param {String} nodeID
	 * @memberof EventCatalog
	 */
	remove(eventName: string, nodeID: string) {
		this.events.forEach(list => {
			if (list.name == eventName) list.removeByNodeID(nodeID);
		});
	}

	/**
	 * Get a filtered list of events
	 *
	 * @param {EventCatalogListOptions} opts
	 * @returns {EventCatalogListResult[]}
	 *
	 * @memberof EventCatalog
	 */
	list({
		onlyLocal = false,
		onlyAvailable = false,
		skipInternal = false,
		withEndpoints = false
	} = {}) {
		const res = [];

		this.events.forEach(list => {
			/* istanbul ignore next */
			if (skipInternal && /^\$/.test(list.name)) return;

			if (onlyLocal && !list.hasLocal()) return;

			if (onlyAvailable && !list.hasAvailable()) return;

			const item: Record<string, any> = {
				name: list.name,
				group: list.group,
				count: list.count(),
				//service: list.service,
				hasLocal: list.hasLocal(),
				available: list.hasAvailable()
			};

			if (item.count > 0) {
				const ep = /** @type {EventEndpoint} */ list.endpoints[0];
				if (ep) item.event = _.omit(ep.event, ["handler", "remoteHandler", "service"]);
			}

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

export = EventCatalog;
