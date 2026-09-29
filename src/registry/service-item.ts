/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import Node = require("./node");
import type { ActionSchema } from "../service";
import type { EventSchema } from "../service";

/**
 * Service class
 *
 * @class ServiceItem
 */
class ServiceItem {
	dependencies: string | string[];
	node: Node;
	name: string;
	fullName: string;
	version: string | number;
	settings: Record<string, any>;
	metadata: Record<string, any>;
	local: boolean;
	actions: Record<string, ActionSchema>;
	events: Record<string, EventSchema>;
	/**
	 * Creates an instance of ServiceItem.
	 *
	 * @param {Node} node
	 * @param {object} service
	 * @param {Boolean} local
	 * @memberof ServiceItem
	 */
	constructor(node, service, local) {
		this.node = node;
		this.name = service.name;
		this.fullName = service.fullName;
		this.version = service.version;
		this.settings = service.settings;
		this.metadata = service.metadata || {};

		this.local = !!local;

		this.actions = {};
		this.events = {};
	}

	/**
	 * Check the service equals params
	 *
	 * @param {String} fullName
	 * @param {String=} nodeID
	 * @returns
	 * @memberof ServiceItem
	 */
	equals(fullName: string, nodeID?: string): boolean {
		return this.fullName == fullName && (nodeID == null || this.node.id == nodeID);
	}

	/**
	 * Update service properties
	 *
	 * @param {object} svc
	 * @memberof ServiceItem
	 */
	update(svc) {
		this.fullName = svc.fullName;
		this.version = svc.version;
		this.settings = svc.settings;
		this.metadata = svc.metadata || {};
	}

	/**
	 * Add action to service
	 *
	 * @param {ActionSchema} action
	 * @memberof ServiceItem
	 */
	addAction(action: ActionSchema) {
		this.actions[action.name] = action;
	}

	/**
	 * Add event to service
	 *
	 * @param {EventSchema} event
	 * @memberof ServiceItem
	 */
	addEvent(event: EventSchema) {
		this.events[event.name] = event;
	}
}

export = ServiceItem;
