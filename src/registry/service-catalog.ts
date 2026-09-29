/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type { ActionSchema } from "../service";
import type { EventSchema, ServiceDependency } from "../service";
import type Node from "./node";
import type ServiceBroker from "../service-broker";
import type Registry from "./registry";

declare namespace ServiceCatalog {
	export interface ServiceCatalogListOptions {
		onlyLocal?: boolean;
		onlyAvailable?: boolean;
		skipInternal?: boolean;
		withActions?: boolean;
		withEvents?: boolean;
		grouping?: boolean;
	}

	export interface ServiceCatalogListResult {
		name: string;
		version: string | number;
		fullName: string;
		settings: Record<string, any>;
		metadata: Record<string, any>;

		local: boolean;
		available: boolean;
		nodes?: string[];
		nodeID?: string;

		action?: Omit<ActionSchema, "handler" | "remoteHandler" | "service">;
		events?: Omit<EventSchema, "handler" | "remoteHandler" | "service">;
	}

	export interface ServiceCatalogLocalNodeServicesResult {
		name: string;
		version: string | number;
		fullName: string;
		settings: Record<string, any>;
		metadata: Record<string, any>;
		dependencies: string | ServiceDependency | (string | ServiceDependency)[];

		action: Record<string, Omit<ActionSchema, "handler" | "remoteHandler" | "service">>;
		events: Record<string, Omit<EventSchema, "handler" | "remoteHandler" | "service">>;
	}
}

import _ from "lodash";
import ServiceItem from "./service-item";
import { removeFromArray } from "../utils";

/**
 * Catalog for services
 *
 * @class ServiceCatalog
 */
class ServiceCatalog {
	logger: any;
	registry: Registry;
	broker: ServiceBroker;
	services: ServiceItem[];
	/**
	 * Creates an instance of ServiceCatalog.
	 *
	 * @param {Registry} registry
	 * @param {ServiceBroker} broker
	 * @memberof ServiceCatalog
	 */
	constructor(registry: Registry, broker: ServiceBroker) {
		this.registry = registry;
		this.broker = broker;
		this.logger = registry.logger;

		this.services = [];
	}

	/**
	 * Add a new service
	 *
	 * @param {Node} node
	 * @param {Object} service
	 * @param {Boolean} local
	 *
	 * @returns {ServiceItem}
	 *
	 * @memberof ServiceCatalog
	 */
	add(node: Node, service: ServiceItem, local: boolean): ServiceItem {
		const item = new ServiceItem(node, service, local);
		this.services.push(item);
		return item;
	}

	/**
	 * Check the service is exist
	 *
	 * @param {String} fullName
	 * @param {String} nodeID
	 * @returns {Boolean}
	 * @memberof ServiceCatalog
	 */
	has(fullName: string, nodeID: string): boolean {
		return this.services.find(svc => svc.equals(fullName, nodeID)) != null;
	}

	/**
	 * Get a service by fullName & nodeID
	 *
	 * @param {String} fullName
	 * @param {String} nodeID
	 * @returns {ServiceItem}
	 * @memberof ServiceCatalog
	 */
	get(fullName: string, nodeID: string): ServiceItem {
		return this.services.find(svc => svc.equals(fullName, nodeID));
	}

	/**
	 * Get a filtered list of services with actions
	 *
	 * @param {ServiceCatalogListOptions} opts
	 * @returns {ServiceCatalogListResult[]}
	 *
	 * @memberof Registry
	 */
	list({
		onlyLocal = false,
		onlyAvailable = false,
		skipInternal = false,
		withActions = false,
		withEvents = false,
		grouping = false
	} = {}) {
		const res = [];
		this.services.forEach(service => {
			if (skipInternal && /^\$/.test(service.name)) return;

			if (onlyLocal && !service.local) return;

			if (onlyAvailable && !service.node.available) return;

			let item;
			if (grouping) item = res.find(svc => svc.fullName == service.fullName);

			if (!item) {
				const item: Record<string, any> = {
					name: service.name,
					version: service.version,
					fullName: service.fullName,
					settings: service.settings,
					metadata: service.metadata,

					local: service.local,
					available: service.node.available
				};

				if (grouping) item.nodes = [service.node.id];
				else item.nodeID = service.node.id;

				if (withActions) {
					item.actions = {};

					_.forIn(service.actions, action => {
						if (action.protected) return;

						item.actions[action.name] = _.omit(action, [
							"handler",
							"remoteHandler",
							"service"
						]);
					});
				}

				if (withEvents) {
					item.events = {};

					_.forIn(service.events, event => {
						// Skip internal event handlers
						if (/^\$/.test(event.name)) return;

						item.events[event.name] = _.omit(event, [
							"handler",
							"remoteHandler",
							"service"
						]);
					});
				}

				res.push(item);
			} else {
				if (item.nodes.indexOf(service.node.id) === -1) item.nodes.push(service.node.id);

				// Merge actions from subsequent nodes so that autoAliases always
				// sees the full union of actions across all nodes for this service.
				// This prevents stale registry entries (e.g. a k8s zombie pod killed
				// via SIGKILL) from shadowing newer actions of a replacement pod.
				if (withActions && item.actions) {
					_.forIn(service.actions, action => {
						if (action.protected || item.actions[action.name]) return;
						item.actions[action.name] = _.omit(action, [
							"handler",
							"remoteHandler",
							"service"
						]);
					});
				}

				if (withEvents && item.events) {
					_.forIn(service.events, event => {
						if (/^\$/.test(event.name) || item.events[event.name]) return;
						item.events[event.name] = _.omit(event, [
							"handler",
							"remoteHandler",
							"service"
						]);
					});
				}
			}
		});

		return res;
	}

	/**
	 * Get local service list for INFO packet
	 *
	 * @returns {ServiceCatalogLocalNodeServicesResult[]}
	 * @memberof ServiceCatalog
	 */
	getLocalNodeServices(): ServiceCatalog.ServiceCatalogLocalNodeServicesResult[] {
		const res = [];
		this.services.forEach(service => {
			if (!service.local) return;

			const item: Record<string, any> = {
				name: service.name,
				version: service.version,
				fullName: service.fullName,
				settings: service.settings,
				metadata: service.metadata,
				dependencies: service.dependencies
			};

			item.actions = {};

			_.forIn(service.actions, action => {
				if (action.protected) return;

				item.actions[action.name] = _.omit(action, ["handler", "remoteHandler", "service"]);
			});

			item.events = {};

			_.forIn(service.events, event => {
				// Leave internal event handlers, because it can be used for internal events.
				//if (/^\$/.test(event.name)) return;

				item.events[event.name] = _.omit(event, ["handler", "remoteHandler", "service"]);
			});

			res.push(item);
		});

		return res;
	}

	/**
	 * Remove all endpoints by nodeID
	 *
	 * @param {String} nodeID
	 * @memberof ServiceCatalog
	 */
	removeAllByNodeID(nodeID: string) {
		_.remove(this.services, service => {
			if (service.node.id == nodeID) {
				this.registry.actions.removeByService(service);
				this.registry.events.removeByService(service);
				return true;
			}
		});
	}

	/**
	 * Remove endpoint by fullName & nodeID
	 *
	 * @param {String} fullName
	 * @param {String} nodeID
	 * @memberof ServiceCatalog
	 */
	remove(fullName: string, nodeID: string) {
		const service = this.get(fullName, nodeID);
		if (service) {
			this.registry.actions.removeByService(service);
			this.registry.events.removeByService(service);

			removeFromArray(this.services, service);
		}
	}
}

export = ServiceCatalog;
