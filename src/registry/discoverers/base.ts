/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type ServiceBroker from "../../service-broker";
import type Transit from "../../transit";
import type Registry from "../registry";
import type Node from "../node";
import type { Logger } from "../../logger-factory";

declare namespace BaseDiscoverer {
	export interface DiscovererOptions extends Record<string, any> {
		heartbeatInterval?: number;
		heartbeatTimeout?: number;

		disableHeartbeatChecks?: boolean;
		disableOfflineNodeRemoving?: boolean;
		cleanOfflineNodesTimeout?: number;
	}

	export interface RegistryDiscovererOptions {
		type: string;
		options: DiscovererOptions;
	}
}

import _ from "lodash";

/**
 * Abstract Discoverer class
 *
 * @class BaseDiscoverer
 */
class BaseDiscoverer {
	broker: ServiceBroker;
	registry: Registry;
	opts: BaseDiscoverer.DiscovererOptions;
	Promise: PromiseConstructor;
	transit?: Transit;
	logger: Logger;
	localNode?: Node;
	heartbeatTimer: NodeJS.Timeout;
	checkNodesTimer: NodeJS.Timeout;
	offlineTimer: NodeJS.Timeout;
	/**
	 * Creates an instance of Discoverer.
	 *
	 * @memberof BaseDiscoverer
	 */
	constructor(opts?: BaseDiscoverer.DiscovererOptions) {
		this.Promise = Promise; // while `init` is not called

		this.opts = _.defaultsDeep({}, opts, {
			heartbeatInterval: null,
			heartbeatTimeout: null,

			disableHeartbeatChecks: false,
			disableOfflineNodeRemoving: false,
			cleanOfflineNodesTimeout: 10 * 60 // 10 minutes
		});

		// Timer variables
		this.heartbeatTimer = null;
		this.checkNodesTimer = null;
		this.offlineTimer = null;

		// Pointer for the local `Node` instance
		this.localNode = null;
	}

	/**
	 * Initialize Discoverer
	 *
	 * @param {ServiceRegistry} registry
	 */
	init(registry: Registry) {
		this.registry = registry;
		this.broker = registry.broker;
		this.Promise = this.broker.Promise;

		if (this.broker) {
			this.logger = this.broker.getLogger("Discovery");
			this.transit = this.broker.transit;

			// Get HB time settings from broker options. Backward compatibility
			if (this.opts.heartbeatInterval == null)
				this.opts.heartbeatInterval = this.broker.options.heartbeatInterval;
			if (this.opts.heartbeatTimeout == null)
				this.opts.heartbeatTimeout = this.broker.options.heartbeatTimeout;
		}

		if (this.transit) {
			this.broker.localBus.on("$transporter.connected", () => this.startHeartbeatTimers());
			this.broker.localBus.on("$transporter.disconnected", () => this.stopHeartbeatTimers());
		}

		this.localNode = this.registry.nodes.localNode;

		this.registerMoleculerMetrics();
	}

	/**
	 * Stop discoverer clients.
	 */
	stop(): Promise<void> {
		this.stopHeartbeatTimers();
		return this.Promise.resolve();
	}

	/**
	 * Register Moleculer Transit Core metrics.
	 */
	registerMoleculerMetrics() {
		// Not implemented
	}

	/**
	 * Start heartbeat timers
	 */
	startHeartbeatTimers() {
		this.stopHeartbeatTimers();

		if (this.opts.heartbeatInterval > 0) {
			// HB timer
			const time =
				this.opts.heartbeatInterval * 1000 + (Math.round(Math.random() * 1000) - 500); // random +/- 500ms
			this.heartbeatTimer = setInterval(() => this.beat(), time);
			this.heartbeatTimer.unref();

			// Check expired heartbeats of remote nodes timer
			this.checkNodesTimer = setInterval(
				() => this.checkRemoteNodes(),
				this.opts.heartbeatTimeout * 1000
			);
			this.checkNodesTimer.unref();

			// Clean offline nodes timer
			this.offlineTimer = setInterval(() => this.checkOfflineNodes(), 60 * 1000); // 1 min
			this.offlineTimer.unref();
		}
	}

	/**
	 * Stop heartbeat timers
	 */
	stopHeartbeatTimers() {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}

		if (this.checkNodesTimer) {
			clearInterval(this.checkNodesTimer);
			this.checkNodesTimer = null;
		}

		if (this.offlineTimer) {
			clearInterval(this.offlineTimer);
			this.offlineTimer = null;
		}
	}

	/**
	 * Disable built-in Heartbeat logic. Used by TCP transporter
	 */
	disableHeartbeat() {
		this.opts.heartbeatInterval = 0;
		this.stopHeartbeatTimers();
	}

	/**
	 * Heartbeat method.
	 */
	beat(): Promise<void> {
		// Update the local CPU usage before sending heartbeat.
		return this.localNode
			.updateLocalInfo(this.broker.getCpuUsage)
			.then(() => this.sendHeartbeat());
	}

	/**
	 * Check all registered remote nodes are available.
	 */
	checkRemoteNodes() {
		if (this.opts.disableHeartbeatChecks) return;

		const now = Math.round(process.uptime());
		this.registry.nodes.toArray().forEach(node => {
			if (node.local || !node.available) return;
			if (!node.lastHeartbeatTime) {
				// Not received the first heartbeat yet
				node.lastHeartbeatTime = now;
				return;
			}

			if (now - node.lastHeartbeatTime > this.opts.heartbeatTimeout) {
				this.logger.warn(`Heartbeat is not received from '${node.id}' node.`);
				this.registry.nodes.disconnected(node.id, true);
			}
		});
	}

	/**
	 * Check offline nodes. Remove which is older than 10 minutes.
	 */
	checkOfflineNodes() {
		if (this.opts.disableOfflineNodeRemoving || !this.opts.cleanOfflineNodesTimeout) return;

		const now = Math.round(process.uptime());
		this.registry.nodes.toArray().forEach(node => {
			if (node.local || node.available) return;
			if (!node.lastHeartbeatTime) {
				// Not received the first
				node.lastHeartbeatTime = now;
				return;
			}

			if (now - node.lastHeartbeatTime > this.opts.cleanOfflineNodesTimeout) {
				this.logger.warn(
					`Removing offline '${node.id}' node from registry because it hasn't submitted heartbeat signal for 10 minutes.`
				);
				this.registry.nodes.delete(node.id);
			}
		});
	}

	/**
	 * Heartbeat received from a remote node.
	 *
	 * @param {String} nodeID
	 * @param {Object} payload
	 */
	heartbeatReceived(nodeID, payload) {
		const node = this.registry.nodes.get(nodeID);
		if (node) {
			if (!node.available) {
				// Reconnected node. Request a fresh INFO
				this.discoverNode(nodeID);
			} else {
				if (payload.seq != null && node.seq !== payload.seq) {
					// Some services changed on the remote node. Request a new INFO
					this.discoverNode(nodeID);
				} else if (
					payload.instanceID != null &&
					!node.instanceID.startsWith(payload.instanceID)
				) {
					// The node has been restarted. Request a new INFO
					this.discoverNode(nodeID);
				} else {
					node.heartbeat(payload);
				}
			}
		} else {
			// Unknow node. Request an INFO
			this.discoverNode(nodeID);
		}
	}

	/**
	 * Received an INFO from a remote node.
	 *
	 * @param {String} nodeID
	 * @param {Object} payload
	 */
	processRemoteNodeInfo(nodeID, payload) {
		return this.broker.registry.processNodeInfo(payload);
	}

	/**
	 * Sending a local heartbeat to remote nodes.
	 */
	sendHeartbeat(): Promise<void> {
		if (!this.transit) return this.Promise.resolve();
		return this.transit.sendHeartbeat(this.localNode);
	}

	/**
	 * Discover a new or old node by nodeID
	 *
	 * @param {String} nodeID
	 * @returns {Promise<Node | void>}
	 */
	discoverNode(nodeID: string): Promise<Node | void> {
		/* istanbul ignore next */
		throw new Error("Not implemented");
	}

	/**
	 * Discover all nodes (after connected)
	 * @returns {Promise<Node[] | void>}
	 */
	discoverAllNodes(): Promise<Node[] | void> {
		/* istanbul ignore next */
		throw new Error("Not implemented");
	}

	/**
	 * Local service registry has been changed. We should notify remote nodes.
	 *
	 * @param {String=} nodeID
	 * @returns {Promise<void>}
	 */
	sendLocalNodeInfo(nodeID?: string): Promise<void> {
		/* istanbul ignore next */
		throw new Error("Not implemented");
	}

	/**
	 * Called when the local node disconnected.
	 * You can clean it from the remote registry.
	 */
	localNodeDisconnected(): Promise<void> {
		if (!this.transit) return this.Promise.resolve();
		return this.transit.sendDisconnectPacket();
	}

	/**
	 * Called when a remote node disconnected (received DISCONNECT packet)
	 * You can clean it from local registry.
	 *
	 * @param {String} nodeID
	 * @param {Boolean} isUnexpected
	 */
	remoteNodeDisconnected(nodeID: string, isUnexpected: boolean) {
		return this.registry.nodes.disconnected(nodeID, isUnexpected);
	}
}

export = BaseDiscoverer;
