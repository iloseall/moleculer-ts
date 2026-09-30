"use strict";

import _ from "lodash";
import ServiceBroker from "../../src/service-broker";

export function createNode(opts: any, services?: any[]) {
	const node = new ServiceBroker(_.defaultsDeep(opts, { logger: false, transporter: "Fake" }));
	if (services) addServices(node, services);
	return node;
}

export function addServices(broker: any, services: any[]) {
	services.forEach(service => broker.createService(_.cloneDeep(service)));
}

export function removeServices(broker: any, serviceNames: string[]) {
	serviceNames.forEach(name => {
		const svc = broker.getLocalService(name);
		if (svc) broker.destroyService(svc);
	});
}

export function hasService(broker: any, fullName: string, nodeID?: string) {
	return broker.registry.services.has(fullName, nodeID);
}

export function hasAction(broker: any, name: string) {
	return broker.registry.actions.get(name) != null;
}

export function isActionAvailable(broker: any, name: string) {
	return broker.registry.actions.isAvailable(name);
}

export function getNode(broker: any, nodeID: string) {
	return broker.registry.nodes.get(nodeID);
}

export function getActionNodes(broker: any, actionName: string) {
	const list = broker.registry.actions.get(actionName);
	if (list) return list.endpoints.map((ep: any) => ep.id);

	/* istanbul ignore next */
	return [];
}

export function getEventNodes(broker: any, eventName: string) {
	return broker.registry.events.getAllEndpoints(eventName).map((node: any) => node.id);
}
