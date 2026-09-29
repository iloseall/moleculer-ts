/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type Service = require("../service");
import type { EventSchema } from "../service";

import Endpoint = require("./endpoint");

/**
 * Endpoint class for events
 *
 * @class EventEndpoint
 * @extends {Endpoint}
 */
class EventEndpoint extends Endpoint {
	service: Service;
	event: EventSchema;
	/**
	 * Creates an instance of EventEndpoint.
	 * @param {Registry} registry
	 * @param {ServiceBroker} broker
	 * @param {Node} node
	 * @param {Service} service
	 * @param {EventSchema} event
	 * @memberof EventEndpoint
	 */
	constructor(registry, broker, node, service, event) {
		super(registry, broker, node);

		this.service = service;
		this.event = event;
	}

	/**
	 * Update properties
	 *
	 * @param {EventSchema} event
	 * @memberof EventEndpoint
	 */
	update(event: EventSchema) {
		this.event = event;
	}
}

export = EventEndpoint;
