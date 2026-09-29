/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type Service = require("../service");
import type { ActionSchema } from "../service";

import Endpoint = require("./endpoint");

/**
 * Endpoint class for actions
 *
 * @class ActionEndpoint
 * @extends {Endpoint}
 */
class ActionEndpoint extends Endpoint {
	service: Service;
	action: ActionSchema;
	name: string;
	/**
	 * Creates an instance of ActionEndpoint.
	 * @param {Registry} registry
	 * @param {ServiceBroker} broker
	 * @param {Node} node
	 * @param {Service} service
	 * @param {ActionSchema} action
	 * @memberof ActionEndpoint
	 */
	constructor(registry, broker, node, service, action) {
		super(registry, broker, node);

		this.service = service;
		this.action = action;

		this.name = `${this.id}:${this.action.name}`;
	}

	/**
	 * Update properties
	 *
	 * @param {ActionSchema} action
	 * @memberof ActionEndpoint
	 */
	update(action: ActionSchema) {
		this.action = action;
	}
}

export = ActionEndpoint;
